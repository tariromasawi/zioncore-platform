import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOwnerIdentity } from './owner-access';

const ownerIdentity = (
  overrides: Partial<Parameters<typeof isOwnerIdentity>[0]> = {},
): Parameters<typeof isOwnerIdentity>[0] => ({
  uid: 'verified-firebase-uid',
  email: 'masawit1@icloud.com',
  emailVerified: true,
  zioncoreOwner: true,
  ...overrides,
});

test('approved administrators require a valid UID, verified email, and owner claim', () => {
  assert.equal(isOwnerIdentity(ownerIdentity()), true);
  assert.equal(isOwnerIdentity(ownerIdentity({
    email: 'TARIROMASAWI19@gmail.com',
  })), true);
  assert.equal(isOwnerIdentity(ownerIdentity({ emailVerified: false })), false);
  assert.equal(isOwnerIdentity(ownerIdentity({ zioncoreOwner: false })), false);
  assert.equal(isOwnerIdentity(ownerIdentity({ zioncoreOwner: undefined })), false);
  assert.equal(isOwnerIdentity(ownerIdentity({ uid: '' })), false);
});

test('an owner claim cannot grant access to unlisted or malformed identities', () => {
  assert.equal(isOwnerIdentity(ownerIdentity({ email: 'other@example.com' })), false);
  assert.equal(isOwnerIdentity(ownerIdentity({ uid: 'invalid/uid' })), false);
  assert.equal(isOwnerIdentity(ownerIdentity({ uid: 'x'.repeat(129) })), false);
});
