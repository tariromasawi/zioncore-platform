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

test('email registration and recovery failures give a specific next step', () => {
  const cases = [
    ['auth/email-already-in-use', /Sign in instead/i],
    ['auth/invalid-email', /valid email/i],
    ['auth/weak-password', /at least 6 characters/i],
    ['auth/too-many-requests', /wait a little while/i],
    ['auth/network-request-failed', /check your connection and retry/i],
    ['auth/operation-not-allowed', /not enabled in the Firebase project/i],
    ['auth/web-storage-unsupported', /cannot keep a signed-in session/i],
    ['auth/user-token-expired', /sign in again/i],
    ['auth/email-not-verified', /verify your email address/i],
  ] as const;
  for (const [code, expected] of cases) {
    const error = Object.assign(new Error(code), { code });
    assert.match(getAuthErrorMessage(error), expected, code);
  }
});
