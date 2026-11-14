import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAuthErrorMessage, parsePendingProviderRedirect } from './firebase-auth';

function firebaseError(code: string) {
  return Object.assign(new Error('provider diagnostic details'), { code });
}

test('provider setup errors identify Firebase enablement and authorized-domain requirements', () => {
  assert.match(
    getAuthErrorMessage(firebaseError('auth/operation-not-allowed')),
    /Enable the provider in Firebase Console/,
  );
  assert.match(
    getAuthErrorMessage(firebaseError('auth/unauthorized-domain')),
    /exact hostname under Firebase Authentication settings/,
  );
});

test('provider collisions are not silently linked to another account', () => {
  assert.match(
    getAuthErrorMessage(firebaseError('auth/account-exists-with-different-credential')),
    /not linked automatically/,
  );
  assert.match(
    getAuthErrorMessage(firebaseError('auth/credential-already-in-use')),
    /already linked to another ZionCore account/,
  );
});

test('Apple nonce and user-cancel errors return safe, actionable messages', () => {
  assert.match(
    getAuthErrorMessage(firebaseError('auth/missing-or-invalid-nonce')),
    /Apple sign-in could not be verified/,
  );
  assert.equal(
    getAuthErrorMessage(firebaseError('auth/user-cancelled')),
    'Sign-in was cancelled.',
  );
});

test('unrecognized provider errors expose only a sanitized Firebase code, never raw details', () => {
  const message = getAuthErrorMessage(firebaseError('auth/internal-error'));
  assert.match(message, /Firebase code: auth\/internal-error/);
  assert.doesNotMatch(message, /provider diagnostic details/);
});

test('pending provider redirects accept only recent, well-formed provider markers', () => {
  const now = 1_800_000_000_000;
  assert.equal(parsePendingProviderRedirect(JSON.stringify({ provider: 'google', startedAt: now - 1_000 }), now), 'google');
  assert.equal(parsePendingProviderRedirect(JSON.stringify({ provider: 'apple', startedAt: now - 1_000 }), now), 'apple');
  assert.equal(parsePendingProviderRedirect(JSON.stringify({ provider: 'other', startedAt: now }), now), null);
  assert.equal(parsePendingProviderRedirect(JSON.stringify({ provider: 'google', startedAt: now - 21 * 60 * 1000 }), now), null);
  assert.equal(parsePendingProviderRedirect('{broken', now), null);
});
