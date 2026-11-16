import type Stripe from 'stripe';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getCreditLedger } from './credit-ledger';
import { getFirebaseAdminApp } from './firebase-admin';
import {
  findBillingOffer,
  getCreditPackGrantAmount,
  getCheckoutMode,
  isLegacyCreditPackKey,
  isCreditPackKey,
  readBillingCatalog,
} from './billing-catalog';
import { getStripeSync, getStripeWebhookSecret, getUncachableStripeClient } from './stripe-client';
import { processStripeWebhookDelivery } from './stripe-webhook-delivery';

type CreditGrant = {
  uid: string;
  amount: number;
  sessionId: string;
  eventId: string;
  purchaseKey: string;
};

export function resolvePaidCreditGrant(
  event: Stripe.Event,
  expectedMode: 'test' | 'live',
): CreditGrant | null {
  if (event.livemode !== (expectedMode === 'live')) return null;
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    return null;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const offerKey = session.metadata?.offerKey ?? '';
  const grantAmount = getCreditPackGrantAmount(offerKey);
  const uid = session.metadata?.firebaseUid ?? session.client_reference_id ?? '';
  if (
    session.mode !== 'payment'
    || session.payment_status !== 'paid'
    || session.metadata?.app !== 'zioncore'
    || !session.metadata.priceId
    || !isCreditPackKey(offerKey)
    || grantAmount === undefined
    || !uid
    || uid.length > 128
    || uid.includes('/')
    || (session.client_reference_id && session.client_reference_id !== uid)
    || !/^cs_[A-Za-z0-9_]{8,100}$/.test(session.id ?? '')
  ) {
    return null;
  }

  return {
    uid,
    amount: grantAmount,
    sessionId: session.id,
    eventId: event.id,
    purchaseKey: `stripe-checkout:${session.id}`,
  };
}

export function matchesArchivedCreditCheckoutPrice(
  session: Stripe.Checkout.Session,
  lineItem: Stripe.LineItem | undefined,
  price: Stripe.Price,
  product: Stripe.Product,
  expectedMode: 'test' | 'live',
): boolean {
  const offerKey = session.metadata?.offerKey ?? '';
  const grantAmount = getCreditPackGrantAmount(offerKey);
  const linePriceId = typeof lineItem?.price === 'string'
    ? lineItem.price
    : lineItem?.price?.id;
  const priceProductId = typeof price.product === 'string'
    ? price.product
    : 'id' in price.product
      ? price.product.id
      : '';

  return isLegacyCreditPackKey(offerKey)
    && grantAmount !== undefined
    && session.mode === 'payment'
    && session.payment_status === 'paid'
    && session.metadata?.app === 'zioncore'
    && session.metadata.priceId === price.id
    && session.currency === 'gbp'
    && session.amount_subtotal === price.unit_amount
    && price.livemode === (expectedMode === 'live')
    && price.currency === 'gbp'
    && price.type === 'one_time'
    && !price.recurring
    && linePriceId === price.id
    && lineItem?.quantity === 1
    && priceProductId === product.id
    && product.metadata.app === 'zioncore'
    && product.metadata.pack === offerKey
    && product.metadata.credits === String(grantAmount);
}

function stripeCustomerId(customer: Stripe.Subscription['customer'] | Stripe.Checkout.Session['customer']): string | null {
  if (typeof customer === 'string') return customer;
  return customer && 'id' in customer ? customer.id : null;
}

// Call only after the paid session, line items, and allowlisted price match.
export async function applyVerifiedCheckoutCreditGrant(
  grant: CreditGrant,
  ledger: Pick<ReturnType<typeof getCreditLedger>, 'grantCredits'>,
) {
  return ledger.grantCredits(grant.uid, {
    amount: grant.amount,
    bucket: 'purchased',
    idempotencyKey: grant.purchaseKey,
    relatedOperationId: grant.sessionId,
    deduplicateByRelatedOperation: true,
  });
}

export function membershipStatus(status: Stripe.Subscription.Status) {
  const allowed = new Set([
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
  ]);
  if (status === 'incomplete_expired') return 'expired' as const;
  return allowed.has(status) ? status as
    | 'incomplete'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid' : 'incomplete' as const;
}

async function saveStripeCustomer(
  uid: string,
  customerId: string | null,
  mode: 'test' | 'live',
) {
  if (!customerId || !uid || uid.includes('/')) return;
  const db = getFirestore(getFirebaseAdminApp());
  const customerField = mode === 'live' ? 'liveCustomerId' : 'testCustomerId';
  await db.runTransaction(async transaction => {
    transaction.set(
      db.doc(`users/${uid}/billing/stripe`),
      { [customerField]: customerId, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    transaction.set(db.doc(`stripe_customer_map/${mode}_${customerId}`), { uid });
  });
}

export async function saveSubscriptionMembership(
  uid: string,
  subscription: Stripe.Subscription,
  eventCreated: number,
  mode: 'test' | 'live',
  firestore: Firestore = getFirestore(getFirebaseAdminApp()),
) {
  if (!uid || uid.includes('/')) return;
  const db = firestore;
  const billingRef = db.doc(`users/${uid}/billing/stripe`);
  const membershipRef = mode === 'live'
    ? db.doc(`users/${uid}/membership/current`)
    : db.doc(`users/${uid}/test_billing/membership`);
  const status = membershipStatus(subscription.status);
  const currentPeriodEnd = Math.max(
    0,
    ...subscription.items.data.map(item => item.current_period_end),
  );
  const accessUntil = currentPeriodEnd > 0
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;
  const premium = (status === 'active' || status === 'trialing') && accessUntil !== null;
  const customerId = stripeCustomerId(subscription.customer);
  const customerField = mode === 'live' ? 'liveCustomerId' : 'testCustomerId';
  const subscriptionField = mode === 'live' ? 'liveSubscriptionId' : 'testSubscriptionId';

  await db.runTransaction(async transaction => {
    const billingSnapshot = await transaction.get(billingRef);
    const eventTimeField = mode === 'live'
      ? 'lastLiveSubscriptionEventCreated'
      : 'lastTestSubscriptionEventCreated';
    const existingEventTime = billingSnapshot.data()?.[eventTimeField];
    if (typeof existingEventTime === 'number' && existingEventTime > eventCreated) return;

    transaction.set(billingRef, {
      ...(customerId ? { [customerField]: customerId } : {}),
      [subscriptionField]: subscription.id,
      [eventTimeField]: eventCreated,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    if (customerId) {
      transaction.set(db.doc(`stripe_customer_map/${mode}_${customerId}`), { uid });
    }
    transaction.set(membershipRef, {
      tier: premium ? 'premium' : 'free',
      status,
      source: 'stripe',
      accessUntil,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function recordBillingReview(
  uid: string,
  event: Stripe.Event,
  details: {
    objectId: string;
    category: 'refund' | 'dispute';
    amount: number | null;
    currency: string | null;
    status: string;
  },
) {
  if (!uid || uid.includes('/')) return;
  const db = getFirestore(getFirebaseAdminApp());
  await db.doc(`users/${uid}/billing/stripe/events/${event.id}`).set({
    eventType: event.type,
    objectId: details.objectId,
    category: details.category,
    amount: details.amount,
    currency: details.currency,
    status: details.status,
    createdAt: new Date(event.created * 1000).toISOString(),
    handling: 'manual_review_required',
  }, { merge: true });
}

async function processZionCoreEvent(event: Stripe.Event) {
  const mode = getCheckoutMode();
  if (mode === 'disabled' || event.livemode !== (mode === 'live')) return;

  const stripe = await getUncachableStripeClient();
  const grant = resolvePaidCreditGrant(event, mode);
  if (grant) {
    const session = event.data.object as Stripe.Checkout.Session;
    const catalog = await readBillingCatalog();
    const offerKey = session.metadata?.offerKey ?? '';
    const offer = findBillingOffer(catalog.entries, offerKey);
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 2,
      expand: ['data.price'],
    });
    const line = lineItems.data[0];
    const linePriceId = typeof line?.price === 'string' ? line.price : line?.price?.id;
    let verifiedPrice = offer?.kind === 'credit_pack'
      && offer.priceId === session.metadata?.priceId
      && lineItems.data.length === 1
      && linePriceId === offer.priceId
      && line?.quantity === 1
      && session.currency === 'gbp'
      && session.amount_subtotal === offer.amountMinor
      && offer.credits === grant.amount;

    if (!verifiedPrice && isLegacyCreditPackKey(offerKey)) {
      const priceId = session.metadata?.priceId ?? '';
      if (priceId) {
        const archivedPrice = await stripe.prices.retrieve(priceId);
        const productId = typeof archivedPrice.product === 'string'
          ? archivedPrice.product
          : archivedPrice.product.id;
        const archivedProduct = await stripe.products.retrieve(productId);
        if (!('deleted' in archivedProduct)) {
          verifiedPrice = matchesArchivedCreditCheckoutPrice(
            session,
            line,
            archivedPrice,
            archivedProduct,
            mode,
          ) && lineItems.data.length === 1;
        }
      }
    }

    if (!verifiedPrice) {
      throw new Error('Paid ZionCore checkout did not match an allowlisted Stripe price.');
    }
    await applyVerifiedCheckoutCreditGrant(
      grant,
      getCreditLedger(mode === 'live' ? 'production' : 'test'),
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.app !== 'zioncore') return;
    const uid = session.metadata.firebaseUid ?? session.client_reference_id ?? '';
    await saveStripeCustomer(uid, stripeCustomerId(session.customer), mode);

    if (
      session.mode === 'subscription'
      && session.metadata.offerKey === 'premium-monthly'
      && typeof session.subscription === 'string'
      && uid
    ) {
      const catalog = await readBillingCatalog();
      const premiumOffer = findBillingOffer(catalog.entries, 'premium-monthly');
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const subscriptionPriceIds = subscription.items.data.map(item => item.price.id);
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 2,
        expand: ['data.price'],
      });
      const line = lineItems.data[0];
      const linePriceId = typeof line?.price === 'string' ? line.price : line?.price?.id;
      if (
        premiumOffer
        && premiumOffer.priceId === session.metadata.priceId
        && subscriptionPriceIds.length === 1
        && subscriptionPriceIds[0] === premiumOffer.priceId
        && lineItems.data.length === 1
        && line?.quantity === 1
        && linePriceId === premiumOffer.priceId
      ) {
        await saveSubscriptionMembership(uid, subscription, event.created, mode);
      } else {
        throw new Error('Premium checkout did not match an allowlisted Stripe price.');
      }
    }
  }

  if (
    event.type === 'customer.subscription.created'
    || event.type === 'customer.subscription.updated'
    || event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const uid = subscription.metadata.firebaseUid;
    if (uid) {
      const catalog = await readBillingCatalog();
      const premiumOffer = findBillingOffer(catalog.entries, 'premium-monthly');
      const subscriptionPriceIds = subscription.items.data.map(item => item.price.id);
      if (
        premiumOffer
        && subscriptionPriceIds.length === 1
        && subscriptionPriceIds[0] === premiumOffer.priceId
      ) {
        await saveSubscriptionMembership(uid, subscription, event.created, mode);
      }
    }
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = stripeCustomerId(invoice.customer);
    if (!customerId) return;

    const db = getFirestore(getFirebaseAdminApp());
    const customerRecord = await db.doc(`stripe_customer_map/${mode}_${customerId}`).get();
    const uid = customerRecord.data()?.uid;
    if (typeof uid !== 'string' || !uid) return;
    const billingRecord = (await db.doc(`users/${uid}/billing/stripe`).get()).data();
    const subscriptionId = billingRecord?.[mode === 'live' ? 'liveSubscriptionId' : 'testSubscriptionId'];
    if (typeof subscriptionId !== 'string' || !subscriptionId.startsWith('sub_')) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const catalog = await readBillingCatalog();
    const premiumOffer = findBillingOffer(catalog.entries, 'premium-monthly');
    const subscriptionPriceIds = subscription.items.data.map(item => item.price.id);
    if (
      premiumOffer
      && subscriptionPriceIds.length === 1
      && subscriptionPriceIds[0] === premiumOffer.priceId
    ) {
      await saveSubscriptionMembership(uid, subscription, event.created, mode);
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    const customerId = stripeCustomerId(charge.customer);
    if (!customerId) return;
    const db = getFirestore(getFirebaseAdminApp());
    const customerRecord = await db.doc(`stripe_customer_map/${mode}_${customerId}`).get();
    const uid = customerRecord.data()?.uid;
    if (typeof uid !== 'string' || !uid) return;
    await recordBillingReview(uid, event, {
      objectId: charge.id,
      category: 'refund',
      amount: charge.amount_refunded,
      currency: charge.currency,
      status: 'review_required',
    });
  }

  if (
    event.type === 'charge.dispute.created'
    || event.type === 'charge.dispute.updated'
    || event.type === 'charge.dispute.closed'
  ) {
    const dispute = event.data.object as Stripe.Dispute;
    const chargeId = typeof dispute.charge === 'string'
      ? dispute.charge
      : dispute.charge?.id;
    if (!chargeId) return;
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = stripeCustomerId(charge.customer);
    if (!customerId) return;
    const db = getFirestore(getFirebaseAdminApp());
    const customerRecord = await db.doc(`stripe_customer_map/${mode}_${customerId}`).get();
    const uid = customerRecord.data()?.uid;
    if (typeof uid !== 'string' || !uid) return;
    await recordBillingReview(uid, event, {
      objectId: dispute.id,
      category: 'dispute',
      amount: dispute.amount,
      currency: dispute.currency,
      status: dispute.status,
    });
  }
}

export class StripeWebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    const stripe = await getUncachableStripeClient();
    const signingSecret = await getStripeWebhookSecret();
    await processStripeWebhookDelivery(payload, signature, {
      verify: (body, header) => stripe.webhooks.constructEvent(body, header, signingSecret),
      fulfill: processZionCoreEvent,
      // This existing Firebase app does not read the PostgreSQL Stripe mirror.
      // Enable it only after its production schema has been provisioned and
      // reviewed; an absent analytics database must not break paid fulfillment.
      ...(process.env.ZIONCORE_STRIPE_MIRROR_ENABLED === 'true' && getCheckoutMode() === 'live'
        ? { mirror: async (body: Buffer, header: string) => {
          const stripeSync = await getStripeSync();
          await stripeSync.processWebhook(body, header);
        } }
        : {}),
    });
  }
}
