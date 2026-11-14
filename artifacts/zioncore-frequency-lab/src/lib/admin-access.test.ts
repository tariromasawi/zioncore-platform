import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canShowAdminLink } from './admin-access';

test('admin navigation is shown for either approved verified account', () => {
  assert.equal(canShowAdminLink({ email: 'masawit1@icloud.com', emailVerified: true }, false), true);
  assert.equal(canShowAdminLink({ email: 'TARIROMASAWI19@gmail.com', emailVerified: true }, false), true);
});

test('admin navigation remains hidden for unverified and unlisted accounts', () => {
  assert.equal(canShowAdminLink({ email: 'masawit1@icloud.com', emailVerified: false }, false), false);
  assert.equal(canShowAdminLink({ email: 'other@example.com', emailVerified: true }, false), false);
  assert.equal(canShowAdminLink(null, false), false);
});

test('an owner claim does not expose admin navigation to an unlisted account', () => {
  assert.equal(canShowAdminLink({ email: 'other@example.com', emailVerified: true }, true), false);
  assert.equal(canShowAdminLink({ email: null, emailVerified: false }, true), false);
});
