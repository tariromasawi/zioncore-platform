import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FREE_MEMBERSHIP,
  canManageStripeBilling,
  isPremiumEntitled,
  membershipDisplayLabel,
  parseMembershipRecord,
} from './membership-model';

const now = Date.parse('2026-11-06T12:00:00.000Z');

function activePremium(overrides: Record<string, unknown> = {}) {
  return parseMembershipRecord({
    tier: 'premium',
    status: 'active',
    source: 'stripe',
    accessUntil: '2026-12-06T12:00:00.000Z',
    cancelAtPeriodEnd: false,
    updatedAt: '2026-11-06T11:00:00.000Z',
    ...overrides,
  });
}

test('a missing membership record defaults to Free', () => {
  assert.equal(FREE_MEMBERSHIP.tier, 'free');
  assert.equal(isPremiumEntitled(FREE_MEMBERSHIP, now), false);
});

test('only an active, server-sourced, unexpired Premium record grants the UI entitlement', () => {
  assert.equal(isPremiumEntitled(activePremium(), now), true);
  assert.equal(isPremiumEntitled(activePremium({ status: 'past_due' }), now), false);
  assert.equal(isPremiumEntitled(activePremium({ accessUntil: '2026-11-06T11:59:59.000Z' }), now), false);
  assert.throws(
    () => activePremium({ source: 'system' }),
    /verified billing source/i,
  );
});

test('Premium records without a billing source or access end are rejected', () => {
  assert.throws(
    () => activePremium({ source: 'system' }),
    /verified billing source/i,
  );
  assert.throws(
    () => activePremium({ accessUntil: null }),
    /server-set access end date/i,
  );
});

test('unknown membership fields and invalid dates fail closed', () => {
  assert.throws(
    () => activePremium({ role: 'admin' }),
    /Unrecognized key/i,
  );
  assert.throws(
    () => activePremium({ accessUntil: 'not-a-date' }),
  );
});

test('Firestore-like timestamps are normalized to ISO strings', () => {
  const accessUntil = new Date('2026-12-06T12:00:00.000Z');
  const record = parseMembershipRecord({
    tier: 'premium',
    status: 'active',
    source: 'stripe',
    accessUntil: { toDate: () => accessUntil },
    cancelAtPeriodEnd: true,
    updatedAt: { toDate: () => new Date('2026-11-06T11:00:00.000Z') },
  });
  assert.equal(record.accessUntil, accessUntil.toISOString());
  assert.equal(record.cancelAtPeriodEnd, true);
});

test('billing status distinguishes canceled, expired, and payment-problem records from Free', () => {
  const now = Date.parse('2026-11-06T12:00:00.000Z');
  assert.equal(membershipDisplayLabel(FREE_MEMBERSHIP, now), 'Free');
  assert.equal(membershipDisplayLabel(activePremium({ cancelAtPeriodEnd: true }), now), 'Premium');
  assert.equal(membershipDisplayLabel(activePremium({ status: 'past_due' }), now), 'Payment due');
  assert.equal(membershipDisplayLabel(activePremium({ status: 'unpaid' }), now), 'Payment due');
  assert.equal(membershipDisplayLabel(activePremium({ status: 'canceled' }), now), 'Ended');
  assert.equal(membershipDisplayLabel(activePremium({ accessUntil: '2026-11-06T11:59:59.000Z' }), now), 'Expired');
});

test('billing management is available for a verified Stripe record without granting Premium', () => {
  const pastDue = activePremium({ status: 'past_due' });
  assert.equal(canManageStripeBilling(pastDue), true);
  assert.equal(isPremiumEntitled(pastDue, now), false);
  assert.equal(canManageStripeBilling(FREE_MEMBERSHIP), false);
  assert.equal(canManageStripeBilling(activePremium({ updatedAt: null })), false);
});
