import { getFirestore } from 'firebase-admin/firestore';
import { Router, type IRouter, type Request } from 'express';
import {
  CreateBillingPortalSessionResponse,
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  GetBillingCatalogResponse,
} from '@workspace/api-zod';
import {
  findBillingOffer,
  getCheckoutMode,
  isCheckoutEnabled,
  isOfferPurchasable,
  readBillingCatalog,
} from '../lib/billing-catalog';
import { getTrustedBillingOrigin } from '../lib/billing-origin';
import { getFirebaseAdminApp } from '../lib/firebase-admin';
import { getUncachableStripeClient } from '../lib/stripe-client';
import { requireFirebaseIdentity } from '../middlewares/firebase-identity';

const router: IRouter = Router();

function verifiedUid(res: Parameters<typeof requireFirebaseIdentity>[1]): string | null {
  const uid = res.locals.firebaseUid;
  return typeof uid === 'string' && uid.length > 0 ? uid : null;
}

function trustedOrigin(req: Request): string | null {
  return getTrustedBillingOrigin(req.get('origin'), {
    nodeEnv: process.env.NODE_ENV,
    replitDomains: process.env.REPLIT_DOMAINS,
    replitDevDomain: process.env.REPLIT_DEV_DOMAIN,
  });
}

router.get('/billing/catalog', async (req, res) => {
  try {
    const catalog = await readBillingCatalog();
    res.status(200).json(GetBillingCatalogResponse.parse(catalog.response));
  } catch (error) {
    req.log.error({ err: error }, 'Could not read ZionCore billing catalog');
    res.status(503).json({ error: 'The billing catalog is temporarily unavailable.' });
  }
});

router.post('/billing/checkout', requireFirebaseIdentity, async (req, res) => {
  const uid = verifiedUid(res);
  if (!uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Choose an available ZionCore offer.' });
    return;
  }
  const origin = trustedOrigin(req);
  if (!origin) {
    res.status(400).json({ error: 'Checkout can only return to an approved app domain.' });
    return;
  }
  if (!isCheckoutEnabled()) {
    res.status(503).json({ error: 'Checkout is not enabled for this environment.' });
    return;
  }

  try {
    const mode = getCheckoutMode();
    const catalog = await readBillingCatalog();
    const offer = findBillingOffer(catalog.entries, parsed.data.offerKey);
    if (!offer || offer.livemode !== (mode === 'live') || !isOfferPurchasable(offer.key)) {
      res.status(503).json({ error: 'That offer is not available in this Stripe environment.' });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const customerField = mode === 'live' ? 'liveCustomerId' : 'testCustomerId';
    const accountRecord = (await getFirestore(getFirebaseAdminApp())
      .doc(`users/${uid}/billing/stripe`)
      .get()).data();
    const savedCustomerId = accountRecord?.[customerField];
    const customerId = typeof savedCustomerId === 'string' && savedCustomerId.startsWith('cus_')
      ? savedCustomerId
      : null;
    const metadata = {
      app: 'zioncore',
      firebaseUid: uid,
      offerKey: offer.key,
      priceId: offer.priceId,
    };
    const isSubscription = offer.kind === 'premium_subscription';
    const session = await stripe.checkout.sessions.create(
      {
        mode: isSubscription ? 'subscription' : 'payment',
        line_items: [{ price: offer.priceId, quantity: 1 }],
        client_reference_id: uid,
        metadata,
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancelled`,
        ...(customerId
          ? { customer: customerId }
          : !isSubscription
            ? { customer_creation: 'always' as const }
            : {}),
        ...(isSubscription
          ? { subscription_data: { metadata } }
          : {}),
        ...(mode === 'live' ? { automatic_tax: { enabled: true } } : {}),
      },
      {
        idempotencyKey: `zioncore:${mode}:${uid}:${offer.key}:${Math.floor(Date.now() / 60_000)}`,
      },
    );

    if (!session.url) {
      res.status(503).json({ error: 'Stripe did not return a hosted checkout URL.' });
      return;
    }
    res.status(200).json(CreateCheckoutSessionResponse.parse({ url: session.url }));
  } catch (error) {
    req.log.error({ err: error }, 'Could not create ZionCore Checkout session');
    res.status(503).json({ error: 'Checkout could not be started. No payment was taken.' });
  }
});

router.post('/billing/portal', requireFirebaseIdentity, async (req, res) => {
  const uid = verifiedUid(res);
  if (!uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const origin = trustedOrigin(req);
  if (!origin) {
    res.status(400).json({ error: 'The billing portal can only return to an approved app domain.' });
    return;
  }

  try {
    if (getCheckoutMode() === 'disabled') {
      res.status(503).json({ error: 'Billing management is not enabled for this environment.' });
      return;
    }
    const customerRef = getFirestore(getFirebaseAdminApp())
      .doc(`users/${uid}/billing/stripe`);
    const customerRecord = (await customerRef.get()).data();
    const customerField = getCheckoutMode() === 'live' ? 'liveCustomerId' : 'testCustomerId';
    const customerId = customerRecord?.[customerField];
    if (typeof customerId !== 'string' || !customerId.startsWith('cus_')) {
      res.status(404).json({ error: 'No billing account is linked to this user yet.' });
      return;
    }
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?billing=managed`,
    });
    res.status(200).json(CreateBillingPortalSessionResponse.parse({ url: session.url }));
  } catch (error) {
    req.log.error({ err: error }, 'Could not create ZionCore billing portal session');
    res.status(503).json({ error: 'Billing management is temporarily unavailable.' });
  }
});

export default router;
