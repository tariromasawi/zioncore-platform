import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';
import { membershipStatus, saveSubscriptionMembership } from './stripe-webhook';

assertLocalFirestoreEmulator(process.env.FIRESTORE_EMULATOR_HOST);

const app = initializeApp(
  { projectId: 'demo-zioncore-frequency-lab' },
  `stripe-membership-tests-${process.pid}`,
);
const db = getFirestore(app);

after(async () => {
  await deleteApp(app);
});

function subscription(
  uid: string,
  overrides: {
    id?: string;
    status?: Stripe.Subscription.Status;
    currentPeriodEnd?: number;
    cancelAtPeriodEnd?: boolean;
  } = {},
): Stripe.Subscription {
  return {
    id: overrides.id ?? 'sub_membership_fixture',
    customer: 'cus_membership_fixture',
    status: overrides.status ?? 'active',
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    metadata: { firebaseUid: uid },
    items: {
      data: [{ current_period_end: overrides.currentPeriodEnd ?? 1_900_000_000 }],
    },
  } as unknown as Stripe.Subscription;
}

test('subscription statuses grant Premium only for active or trialing access', () => {
  assert.equal(membershipStatus('active'), 'active');
  assert.equal(membershipStatus('trialing'), 'trialing');
  assert.equal(membershipStatus('past_due'), 'past_due');
  assert.equal(membershipStatus('canceled'), 'canceled');
  assert.equal(membershipStatus('unpaid'), 'unpaid');
  assert.equal(membershipStatus('incomplete_expired'), 'expired');
  assert.equal(membershipStatus('paused' as Stripe.Subscription.Status), 'incomplete');
});

test('subscription updates preserve event ordering and separate live from test entitlements', async () => {
  const uid = `stripe-membership-${process.pid}`;
  const accessUntil = new Date(1_900_000_000 * 1000).toISOString();
  const liveMembership = db.doc(`users/${uid}/membership/current`);
  const testMembership = db.doc(`users/${uid}/test_billing/membership`);
  const billingRef = db.doc(`users/${uid}/billing/stripe`);

  await saveSubscriptionMembership(
    uid,
    subscription(uid, { id: 'sub_live_fixture', status: 'active', cancelAtPeriodEnd: true }),
    100,
    'live',
    db,
  );
  let live = (await liveMembership.get()).data();
  assert.equal(live?.tier, 'premium');
  assert.equal(live?.status, 'active');
  assert.equal(live?.source, 'stripe');
  assert.equal(live?.accessUntil, accessUntil);
  assert.equal(live?.cancelAtPeriodEnd, true);

  await saveSubscriptionMembership(
    uid,
    subscription(uid, { id: 'sub_live_fixture', status: 'past_due' }),
    200,
    'live',
    db,
  );
  live = (await liveMembership.get()).data();
  assert.equal(live?.tier, 'free');
  assert.equal(live?.status, 'past_due');

  await saveSubscriptionMembership(
    uid,
    subscription(uid, { id: 'sub_live_fixture', status: 'canceled' }),
    300,
    'live',
    db,
  );
  await saveSubscriptionMembership(
    uid,
    subscription(uid, { id: 'sub_live_fixture', status: 'active' }),
    250,
    'live',
    db,
  );
  live = (await liveMembership.get()).data();
  assert.equal(live?.tier, 'free');
  assert.equal(live?.status, 'canceled', 'an older active event must not restore Premium');
  assert.equal((await billingRef.get()).data()?.lastLiveSubscriptionEventCreated, 300);

  await saveSubscriptionMembership(
    uid,
    subscription(uid, { id: 'sub_test_fixture', status: 'trialing' }),
    400,
    'test',
    db,
  );
  const test = (await testMembership.get()).data();
  assert.equal(test?.tier, 'premium');
  assert.equal(test?.status, 'trialing');
  assert.equal((await liveMembership.get()).data()?.status, 'canceled');
  const billing = (await billingRef.get()).data();
  assert.equal(billing?.liveSubscriptionId, 'sub_live_fixture');
  assert.equal(billing?.testSubscriptionId, 'sub_test_fixture');
});
