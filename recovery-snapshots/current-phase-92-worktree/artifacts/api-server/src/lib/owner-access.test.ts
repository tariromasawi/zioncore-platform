import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOwnerIdentity } from './owner-access';

test('both approved administrator emails are accepted only when Firebase verifies the email', () => {
  assert.equal(isOwnerIdentity({ email: 'masawit1@icloud.com', emailVerified: true }), true);
  assert.equal(isOwnerIdentity({ email: 'TARIROMASAWI19@gmail.com', emailVerified: true }), true);
  assert.equal(isOwnerIdentity({ email: 'masawit1@icloud.com', emailVerified: false }), false);
  assert.equal(isOwnerIdentity({ email: 'tariromasawi19@gmail.com', emailVerified: false }), false);
});

test('only the two approved verified emails receive owner access', () => {
  assert.equal(isOwnerIdentity({ email: 'other@example.com', emailVerified: true }), false);
  assert.equal(isOwnerIdentity({ email: 'masawit1@icloud.com', emailVerified: true, zioncoreOwner: false }), true);
  assert.equal(isOwnerIdentity({ email: 'other@example.com', emailVerified: true, zioncoreOwner: true }), false);
  assert.equal(isOwnerIdentity({ email: 'masawit1@icloud.com', emailVerified: false, zioncoreOwner: true }), false);
});
