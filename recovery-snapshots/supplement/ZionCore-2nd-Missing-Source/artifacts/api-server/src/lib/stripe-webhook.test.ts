import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import { matchesArchivedCreditCheckoutPrice, resolvePaidCreditGrant } from './stripe-webhook';

function checkoutEvent(overrides: {
  livemode?: boolean;
  type?: string;
  mode?: string;
  paymentStatus?: string;
  offerKey?: string;
  app?: string;
  uid?: string;
} = {}): Stripe.Event {
  const session = {
    id: 'cs_test_0123456789',
    mode: overrides.mode ?? 'payment',
    payment_status: overrides.paymentStatus ?? 'paid',
    client_reference_id: overrides.uid ?? 'firebase-user-123',
    metadata: {
      app: overrides.app ?? 'zioncore',
      offerKey: overrides.offerKey ?? 'credits-250',
      firebaseUid: overrides.uid ?? 'firebase-user-123',
      priceId: 'price_test_12345678',
    },
  };
  return {
    id: 'evt_test_0123456789',
    type: overrides.type ?? 'checkout.session.completed',
    livemode: overrides.livemode ?? false,
    created: 1_800_000_000,
    data: { object: session },
  } as unknown as Stripe.Event;
}

test('only paid, signed ZionCore credit checkouts resolve to grants', () => {
  assert.deepEqual(
    resolvePaidCreditGrant(checkoutEvent(), 'test'),
    {
      uid: 'firebase-user-123',
      amount: 250,
      sessionId: 'cs_test_0123456789',
      eventId: 'evt_test_0123456789',
      purchaseKey: 'stripe-checkout:cs_test_0123456789',
    },
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ paymentStatus: 'unpaid' }), 'test'),
    null,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ mode: 'subscription' }), 'test'),
    null,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ app: 'other-app' }), 'test'),
    null,
  );
});

test('credit grants are fixed by the allowlisted pack key', () => {
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-500' }), 'test')?.amount,
    500,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-1050' }), 'test')?.amount,
    1050,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-2750' }), 'test')?.amount,
    2750,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-5750' }), 'test')?.amount,
    5750,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-50' }), 'test')?.amount,
    50,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-200' }), 'test')?.amount,
    200,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-1000' }), 'test')?.amount,
    1000,
  );
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ offerKey: 'credits-999999' }), 'test'),
    null,
  );
});

test('archived credit prices can finish old paid sessions without permitting mismatches', () => {
  const session = checkoutEvent({ offerKey: 'credits-50' }).data.object as Stripe.Checkout.Session;
  session.currency = 'gbp';
  session.amount_subtotal = 250;
  session.metadata!.priceId = 'price_archived_50';
  const product = {
    id: 'prod_archived_50',
    active: false,
    metadata: { app: 'zioncore', pack: 'credits-50', credits: '50' },
  } as unknown as Stripe.Product;
  const price = {
    id: 'price_archived_50',
    livemode: false,
    currency: 'gbp',
    type: 'one_time',
    recurring: null,
    unit_amount: 250,
    product: product.id,
  } as unknown as Stripe.Price;
  const lineItem = {
    price: price.id,
    quantity: 1,
  } as unknown as Stripe.LineItem;

  assert.equal(
    matchesArchivedCreditCheckoutPrice(session, lineItem, price, product, 'test'),
    true,
  );
  assert.equal(
    matchesArchivedCreditCheckoutPrice(session, { ...lineItem, quantity: 2 }, price, product, 'test'),
    false,
  );
  assert.equal(
    matchesArchivedCreditCheckoutPrice(session, lineItem, { ...price, unit_amount: 100 } as Stripe.Price, product, 'test'),
    false,
  );
  assert.equal(
    matchesArchivedCreditCheckoutPrice(session, lineItem, { ...price, livemode: true } as Stripe.Price, product, 'test'),
    false,
  );
});

test('a test event cannot grant credits in live mode and vice versa', () => {
  assert.equal(resolvePaidCreditGrant(checkoutEvent(), 'live'), null);
  assert.equal(
    resolvePaidCreditGrant(checkoutEvent({ livemode: true }), 'test'),
    null,
  );
});

test('completed and async success events share a purchase key, not an event key', () => {
  const completed = checkoutEvent();
  const asyncSuccess = checkoutEvent({ type: 'checkout.session.async_payment_succeeded' });
  asyncSuccess.id = 'evt_another_success';
  assert.equal(
    resolvePaidCreditGrant(completed, 'test')?.purchaseKey,
    resolvePaidCreditGrant(asyncSuccess, 'test')?.purchaseKey,
  );
});

test('conflicting account references and malformed account IDs cannot receive credits', () => {
  const conflicting = checkoutEvent();
  (conflicting.data.object as Stripe.Checkout.Session).client_reference_id = 'different-account';
  assert.equal(resolvePaidCreditGrant(conflicting, 'test'), null);
  assert.equal(resolvePaidCreditGrant(checkoutEvent({ uid: 'invalid/user' }), 'test'), null);
});
