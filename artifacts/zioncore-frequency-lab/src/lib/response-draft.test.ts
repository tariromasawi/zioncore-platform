import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareResponseDraft, takeResponseDraft, guidedResponseAccess } from './response-draft';
import { FREE_MEMBERSHIP, type MembershipSnapshot } from './membership-model';
test('a personal response transfers locally once and expires instead of entering URLs', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  prepareResponseDraft('MWARI NDI MWARI — peace', storage, 1000);
  assert.equal(takeResponseDraft(storage, 2000), 'MWARI NDI MWARI — peace');
  assert.equal(takeResponseDraft(storage, 2000), '');
  prepareResponseDraft('Private intention', storage, 1000);
  assert.equal(takeResponseDraft(storage, 400000), '');
});
test('guided response requires the current account, a valid Stripe entitlement and completed paid interpretation', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const active: MembershipSnapshot = { tier: 'premium', status: 'active', source: 'stripe', accessUntil: '2026-12-10T00:00:00.000Z', cancelAtPeriodEnd: false, updatedAt: null };
  const base = { userUid: 'customer-one', membership: { uid: 'customer-one', value: active }, hasPaidInterpretation: true };
  assert.equal(guidedResponseAccess(base, now), 'encode');
  assert.equal(guidedResponseAccess({ ...base, userUid: null }, now), 'sign-in');
  assert.equal(guidedResponseAccess({ ...base, hasPaidInterpretation: false }, now), 'quote');
  assert.equal(guidedResponseAccess({ ...base, membership: { uid: 'another-customer', value: active } }, now), 'premium');
  assert.equal(guidedResponseAccess({ ...base, membership: { uid: base.userUid, value: FREE_MEMBERSHIP } }, now), 'premium');
  assert.equal(guidedResponseAccess(base, Date.parse('2027-01-01T00:00:00Z')), 'premium');
});
