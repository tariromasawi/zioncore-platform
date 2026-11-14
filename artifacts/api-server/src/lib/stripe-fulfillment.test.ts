import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { createCreditLedger, CreditLedgerError } from './credit-ledger';
import { applyVerifiedCheckoutCreditGrant, resolvePaidCreditGrant } from './stripe-webhook';
import { processStripeWebhookDelivery } from './stripe-webhook-delivery';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';

assertLocalFirestoreEmulator(process.env.FIRESTORE_EMULATOR_HOST);
const app = initializeApp({ projectId: 'demo-zioncore-frequency-lab' }, `stripe-tests-${process.pid}`);
const db = getFirestore(app);
const ledger = createCreditLedger(db);
const stripe = new Stripe('sk_test_emulator_fixture_only');
const secret = 'emulator-signing-fixture';
after(async () => { await deleteApp(app); });

function paidEvent(
  uid: string,
  sessionId: string,
  eventId: string,
  type = 'checkout.session.completed',
  offerKey = 'credits-250',
) {
  return {
    id: eventId,
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: {
      id: sessionId,
      mode: 'payment',
      payment_status: 'paid',
      client_reference_id: uid,
      metadata: { app: 'zioncore', firebaseUid: uid, offerKey, priceId: 'price_fixture' },
    } },
  } as unknown as Stripe.Event;
}

// Exercises signature verification and the exact post-price-validation mutation
// used by production, without Stripe calls, real keys, or live Firestore writes.
async function deliver(event: Stripe.Event) {
  const payload = Buffer.from(JSON.stringify(event));
  const signature = stripe.webhooks.generateTestHeaderString({ payload: payload.toString(), secret });
  await processStripeWebhookDelivery(payload, signature, {
    verify: (body, header) => stripe.webhooks.constructEvent(body, header, secret),
    fulfill: async verified => {
      const grant = resolvePaidCreditGrant(verified, 'test');
      if (grant) await applyVerifiedCheckoutCreditGrant(grant, ledger);
    },
  });
}

test('signed duplicate and asynchronous events credit one purchase exactly once', async () => {
  const uid = `test-${randomUUID()}`;
  const session = `cs_test_${randomUUID().replaceAll('-', '')}`;
  const completed = paidEvent(uid, session, 'evt_completed_fixture');
  const asyncSuccess = paidEvent(uid, session, 'evt_async_fixture', 'checkout.session.async_payment_succeeded');
  await Promise.all([deliver(completed), deliver(completed), deliver(asyncSuccess)]);
  assert.equal((await ledger.readWallet(uid)).availableCredits, 250);
  assert.equal((await ledger.listTransactions(uid)).filter(tx => tx.type === 'purchase').length, 1);

  await ledger.reserveCredits(uid, {
    operationId: 'analysis-fixture-0001', amount: 35, idempotencyKey: 'reserve-fixture-0001',
  });
  assert.equal((await ledger.readWallet(uid)).availableCredits, 215);
  await ledger.settleReservation(uid, {
    operationId: 'analysis-fixture-0001', finalChargeCredits: 35, idempotencyKey: 'settle-fixture-0001',
  });
  const reconnected = createCreditLedger(db);
  assert.equal((await reconnected.readWallet(uid)).availableCredits, 215);
  assert.equal((await reconnected.readWallet(uid)).reservedCredits, 0);
  await deliver(completed);
  assert.equal((await reconnected.readWallet(uid)).availableCredits, 215);
});

test('legacy event-keyed receipts are recognized without re-crediting or rewriting them', async () => {
  const uid = `test-${randomUUID()}`;
  const session = `cs_test_${randomUUID().replaceAll('-', '')}`;
  await ledger.grantCredits(uid, {
    amount: 50, bucket: 'purchased', idempotencyKey: 'evt_legacy_fixture', relatedOperationId: session,
  });
  await deliver(paidEvent(uid, session, 'evt_after_upgrade_fixture', 'checkout.session.completed', 'credits-50'));
  assert.equal((await ledger.readWallet(uid)).availableCredits, 50);
  assert.equal((await ledger.listTransactions(uid)).length, 1);
});

test('a legacy receipt with a conflicting amount fails closed instead of topping up again', async () => {
  const uid = `test-${randomUUID()}`;
  const session = `cs_test_${randomUUID().replaceAll('-', '')}`;
  await ledger.grantCredits(uid, {
    amount: 200, bucket: 'purchased', idempotencyKey: 'evt_legacy_other_amount', relatedOperationId: session,
  });
  await assert.rejects(deliver(paidEvent(uid, session, 'evt_conflict_fixture', 'checkout.session.completed', 'credits-50')),
    error => error instanceof CreditLedgerError && error.code === 'IDEMPOTENCY_CONFLICT');
  assert.equal((await ledger.readWallet(uid)).availableCredits, 200);
});

test('separate genuine Checkout sessions can each add credits', async () => {
  const uid = `test-${randomUUID()}`;
  for (const suffix of ['first_fixture', 'second_fixture']) {
    await deliver(paidEvent(uid, `cs_test_${suffix}`, `evt_${suffix}`));
  }
  assert.equal((await ledger.readWallet(uid)).availableCredits, 500);
});
