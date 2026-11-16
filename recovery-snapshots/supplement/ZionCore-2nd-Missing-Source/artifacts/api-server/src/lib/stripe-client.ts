import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

type StripeConnectionSettings = {
  secret_key?: unknown;
  webhook_secret?: unknown;
};

type StripeConnectionResponse = {
  items?: Array<{ settings?: StripeConnectionSettings }>;
};

async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret?: string;
}> {
  if (process.env.ZIONCORE_CHECKOUT_MODE === 'live') {
    const secretKey = process.env.STRIPE_LIVE_SECRET_KEY?.trim();
    const webhookSecret = process.env.STRIPE_LIVE_WEBHOOK_SECRET?.trim();
    if (secretKey) {
      const liveApiKey = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_');
      if (!liveApiKey) {
        throw new Error('The configured Stripe API credential is not a live-mode key.');
      }
      if (webhookSecret && !webhookSecret.startsWith('whsec_')) {
        throw new Error('The configured Stripe webhook credential is not a signing secret.');
      }
      return { secretKey, webhookSecret };
    }
  }

  if (process.env.NODE_ENV !== 'production' && process.env.ZIONCORE_CHECKOUT_MODE === 'test') {
    const secretKey = process.env.STRIPE_TEST_SECRET_KEY?.trim();
    const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET?.trim();
    if (!secretKey || !webhookSecret) {
      throw new Error('Development test checkout requires test-mode Stripe secrets in Replit Secrets.');
    }
    const testApiKey = secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_');
    if (!testApiKey || !webhookSecret.startsWith('whsec_')) {
      throw new Error('Development Stripe test credentials must be test-mode keys.');
    }
    return { secretKey, webhookSecret };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !replToken) {
    throw new Error('Stripe is not connected to this Replit environment.');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: {
        Accept: 'application/json',
        X_REPLIT_TOKEN: replToken,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Stripe connection request failed with status ${response.status}.`);
  }

  const data = await response.json() as StripeConnectionResponse;
  const settings = data.items?.[0]?.settings;
  if (typeof settings?.secret_key !== 'string' || settings.secret_key.length === 0) {
    throw new Error('The connected Stripe account does not provide a secret key.');
  }
  return {
    secretKey: settings.secret_key,
    webhookSecret: typeof settings.webhook_secret === 'string'
      ? settings.webhook_secret
      : undefined,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey, { maxNetworkRetries: 2 });
}

export async function getStripeWebhookSecret(): Promise<string> {
  const { webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) {
    throw new Error('A Stripe webhook signing secret is not configured.');
  }
  return webhookSecret;
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Stripe data synchronization.');
  }
  const { secretKey, webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) {
    throw new Error('A Stripe webhook signing secret is not configured.');
  }
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
  });
}
