import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthErrorMessage } from '@/lib/firebase-auth';

test('Google account collision tells the user to link the existing account', () => {
  const error = Object.assign(new Error('collision'), {
    code: 'auth/account-exists-with-different-credential',
  });
  assert.match(getAuthErrorMessage(error), /sign in with that account first/i);
  assert.match(getAuthErrorMessage(error), /keep the same user and permissions/i);
});

test('Google credential already linked elsewhere does not suggest merging accounts', () => {
  const error = Object.assign(new Error('in use'), {
    code: 'auth/credential-already-in-use',
  });
  assert.match(getAuthErrorMessage(error), /No accounts were merged/);
});

test('unauthorized Firebase redirect domain gets actionable guidance', () => {
  const error = Object.assign(new Error('unauthorized'), {
    code: 'auth/unauthorized-domain',
  });
  assert.match(getAuthErrorMessage(error), /not authorized for Firebase sign-in/i);
});
