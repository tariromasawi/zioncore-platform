import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFirebaseAppIdentityMismatch } from '@/lib/firebase-app-identity';

const expected = {
  projectId: 'ethereal-throne-b20e6',
  appId: '1:123456789:web:production-app',
};

test('a missing named app can be initialized from the current environment', () => {
  assert.equal(getFirebaseAppIdentityMismatch(null, expected), null);
});

test('a named app from another Firebase project is rejected', () => {
  assert.equal(
    getFirebaseAppIdentityMismatch({
      projectId: 'another-project',
      appId: expected.appId,
    }, expected),
    'project',
  );
});

test('a same-project app with a different web App ID is rejected for App Check safety', () => {
  assert.equal(
    getFirebaseAppIdentityMismatch({
      projectId: expected.projectId,
      appId: '1:123456789:web:development-app',
    }, expected),
    'app-id',
  );
});

test('the expected named Firebase app can be safely reused', () => {
  assert.equal(getFirebaseAppIdentityMismatch(expected, expected), null);
});
