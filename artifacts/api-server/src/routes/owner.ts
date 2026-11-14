import { Router } from 'express';
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  GetAdminDashboardSummaryResponse,
  GetOwnerFirebaseDiagnosticsResponse,
} from '@workspace/api-zod';
import { getFirebaseAdminApp } from '../lib/firebase-admin';
import { runFirebaseDiagnostics } from '../lib/firebase-diagnostics';
import {
  aggregateAiJobEconomics,
  aggregateBalanceTransactions,
  unavailableAiJobEconomics,
} from '../lib/owner-dashboard-data';
import { getCheckoutMode, isCheckoutEnabled } from '../lib/billing-catalog';
import { getStripeWebhookSecret, getUncachableStripeClient } from '../lib/stripe-client';
import { isGeminiConfigured } from '../lib/ai-provider-clients';
import { requireFirebaseOwner } from '../middlewares/firebase-identity';

const router = Router();
const stripeWebhookAppRoute = '/api/stripe/webhook';
const revenueWindowDays = 30;
const stripeTransactionPageLimit = 100;
const stripeTransactionMaxPages = 10;
const aiEconomicsReadLimit = 500;
const stripeWebhookPageLimit = 100;
const stripeWebhookMaxPages = 10;
const accountDirectoryMaxPages = 10;

async function readAccountDirectory(app: ReturnType<typeof getFirebaseAdminApp>) {
  let count = 0;
  let disabledCount = 0;
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const page = await getAuth(app).listUsers(1000, pageToken);
    count += page.users.length;
    disabledCount += page.users.filter(user => user.disabled).length;
    pageToken = page.pageToken;
    pages += 1;
  } while (pageToken && pages < accountDirectoryMaxPages);

  return {
    accountDirectoryStatus: 'connected' as const,
    accountCount: count,
    disabledAccountCount: disabledCount,
    accountCountIsLowerBound: Boolean(pageToken),
  };
}

async function readFirestoreStatus(app: ReturnType<typeof getFirebaseAdminApp>) {
  try {
    await getFirestore(app).collection('users').limit(1).get();
    return 'connected' as const;
  } catch {
    return 'unavailable' as const;
  }
}

function safeWebhookUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

async function readStripeSnapshot(mode: 'disabled' | 'test' | 'live') {
  if (mode === 'disabled') {
    return {
      stripe: {
        status: 'not_enabled' as const,
        mode,
        periodDays: 0,
        truncated: false,
        currencyTotals: [],
      },
      webhooks: {
        status: 'not_enabled' as const,
        appRoute: stripeWebhookAppRoute,
        signatureVerification: 'required' as const,
        signingSecretConfigured: false,
        inventoryTruncated: false,
        endpoints: [],
      },
    };
  }

  let signingSecretConfigured = false;
  try {
    signingSecretConfigured = (await getStripeWebhookSecret()).startsWith('whsec_');
  } catch {
    // The dashboard reports configuration state only; it never returns credentials.
  }

  let stripe: Stripe;
  try {
    stripe = await getUncachableStripeClient();
  } catch {
    return {
      stripe: {
        status: 'unavailable' as const,
        mode,
        periodDays: revenueWindowDays,
        truncated: false,
        currencyTotals: [],
      },
      webhooks: {
        status: 'unavailable' as const,
        appRoute: stripeWebhookAppRoute,
        signatureVerification: 'required' as const,
        signingSecretConfigured,
        inventoryTruncated: false,
        endpoints: [],
      },
    };
  }

  const since = Math.floor(Date.now() / 1000) - revenueWindowDays * 24 * 60 * 60;
  const currencyTotals = [];
  let truncated = false;
  let stripeStatus: 'connected' | 'unavailable' = 'connected';
  try {
    let startingAfter: string | undefined;
    const transactions: Array<Pick<Stripe.BalanceTransaction, 'amount' | 'currency' | 'type' | 'net'>> = [];
    for (let pageNumber = 0; pageNumber < stripeTransactionMaxPages; pageNumber += 1) {
      const page = await stripe.balanceTransactions.list({
        created: { gte: since },
        limit: stripeTransactionPageLimit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      transactions.push(...page.data);
      if (!page.has_more) break;
      const last = page.data.at(-1);
      if (!last) {
        truncated = true;
        break;
      }
      startingAfter = last.id;
      if (pageNumber === stripeTransactionMaxPages - 1) truncated = true;
    }
    currencyTotals.push(...aggregateBalanceTransactions(transactions));
  } catch {
    stripeStatus = 'unavailable';
  }

  let webhookStatus: 'ready' | 'needs_setup' | 'unavailable' = 'unavailable';
  let endpoints: Array<{
    id: string;
    url: string;
    enabled: boolean;
    livemode: boolean;
    enabledEventCount: number;
    createdAt: string;
  }> = [];
  let inventoryTruncated = false;
  try {
    let startingAfter: string | undefined;
    for (let pageNumber = 0; pageNumber < stripeWebhookMaxPages; pageNumber += 1) {
      const response = await stripe.webhookEndpoints.list({
        limit: stripeWebhookPageLimit,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      endpoints.push(...response.data.flatMap(endpoint => {
        const url = safeWebhookUrl(endpoint.url);
        if (!url) return [];
        return [{
          id: endpoint.id,
          url,
          enabled: endpoint.status === 'enabled',
          livemode: endpoint.livemode,
          enabledEventCount: endpoint.enabled_events.length,
          createdAt: new Date(endpoint.created * 1000).toISOString(),
        }];
      }));
      if (!response.has_more) break;
      const last = response.data.at(-1);
      if (!last || pageNumber === stripeWebhookMaxPages - 1) {
        inventoryTruncated = true;
        break;
      }
      startingAfter = last.id;
    }
    const correctMode = mode === 'live';
    const matchingEndpoint = endpoints.some(endpoint => {
      const pathname = new URL(endpoint.url).pathname;
      return endpoint.enabled
        && endpoint.livemode === correctMode
        && pathname === stripeWebhookAppRoute;
    });
    webhookStatus = signingSecretConfigured && matchingEndpoint ? 'ready' : 'needs_setup';
  } catch {
    webhookStatus = 'unavailable';
  }

  return {
    stripe: {
      status: stripeStatus,
      mode,
      periodDays: revenueWindowDays,
      truncated,
      currencyTotals,
    },
    webhooks: {
      status: webhookStatus,
      appRoute: stripeWebhookAppRoute,
      signatureVerification: 'required' as const,
      signingSecretConfigured,
      inventoryTruncated,
      endpoints,
    },
  };
}

router.get('/owner/summary', ...requireFirebaseOwner, async (req, res): Promise<void> => {
  const app = getFirebaseAdminApp();
  res.setHeader('Cache-Control', 'private, no-store');
  const [accountDirectory, firestoreStatus, stripeSnapshot, economics] = await Promise.all([
    readAccountDirectory(app).catch(error => {
      req.log.warn({ err: error }, 'Admin dashboard could not read Firebase account totals');
      return {
        accountDirectoryStatus: 'unavailable' as const,
        accountCount: 0,
        disabledAccountCount: 0,
        accountCountIsLowerBound: false,
      };
    }),
    readFirestoreStatus(app),
    readStripeSnapshot(getCheckoutMode()).catch(error => {
      req.log.warn({ err: error }, 'Admin dashboard could not read Stripe status');
      const mode = getCheckoutMode();
      return {
        stripe: {
          status: mode === 'disabled' ? 'not_enabled' as const : 'unavailable' as const,
          mode,
          periodDays: mode === 'disabled' ? 0 : revenueWindowDays,
          truncated: false,
          currencyTotals: [],
        },
        webhooks: {
          status: mode === 'disabled' ? 'not_enabled' as const : 'unavailable' as const,
          appRoute: stripeWebhookAppRoute,
          signatureVerification: 'required' as const,
          signingSecretConfigured: false,
          inventoryTruncated: false,
          endpoints: [],
        },
      };
    }),
    getFirestore(app).collectionGroup('ai_interpretation_jobs')
      .select('status', 'financialAudit')
      .limit(aiEconomicsReadLimit + 1)
      .get()
      .then(snapshot => {
        const truncated = snapshot.size > aiEconomicsReadLimit;
        return aggregateAiJobEconomics(
          snapshot.docs.slice(0, aiEconomicsReadLimit).map(document => document.data()),
          truncated,
        );
      })
      .catch(error => {
        req.log.warn({ err: error }, 'Admin dashboard could not read AI job cost summaries');
        return unavailableAiJobEconomics();
      }),
  ]);
  const memory = process.memoryUsage();

  const response = {
    generatedAt: new Date().toISOString(),
    firebase: {
      projectId: app.options.projectId ?? null,
      identityVerification: 'active',
      firestoreStatus,
      ...accountDirectory,
    },
    billing: {
      checkoutMode: getCheckoutMode(),
      checkoutEnabled: isCheckoutEnabled(),
    },
    providers: {
      geminiConfigured: isGeminiConfigured(),
      openaiConfigured: Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
      configurationOnly: true,
    },
    ...stripeSnapshot,
    economics,
    performance: {
      uptimeSeconds: Math.floor(process.uptime()),
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      nodeVersion: process.version,
    },
  };

  res.status(200).json(GetAdminDashboardSummaryResponse.parse(response));
});

router.get('/owner/firebase-diagnostics', ...requireFirebaseOwner, async (_req, res): Promise<void> => {
  const app = getFirebaseAdminApp();
  res.setHeader('Cache-Control', 'private, no-store');
  const diagnostics = await runFirebaseDiagnostics(app);
  res.status(200).json(GetOwnerFirebaseDiagnosticsResponse.parse(diagnostics));
});

export default router;
