import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import {
  requireFirebaseOwnerClaim,
  createFirebaseIdentityMiddleware,
  type FirebaseTokenVerifier,
} from './firebase-identity';
import { FirebaseAdminConfigurationError } from '../lib/firebase-admin';

function createRequest(headers: Record<string, string> = {}) {
  const request = {
    get: (name: string) => headers[name.toLowerCase()],
    log: { error() {}, warn() {} },
  };
  return request as unknown as Request;
}

function createResponse() {
  const result = {
    statusCode: 200,
    body: undefined as unknown,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return result as unknown as Response & typeof result;
}

test('Firebase identity middleware requires a Firebase ID token', async () => {
  let verifierLookups = 0;
  const middleware = createFirebaseIdentityMiddleware(() => {
    verifierLookups += 1;
    throw new Error('should not be called');
  });
  const response = createResponse();

  await middleware(createRequest(), response, () => {});

  assert.equal(response.statusCode, 401);
  assert.equal(verifierLookups, 0);
});

test('Firebase identity middleware accepts authenticated requests without App Check', async () => {
  const verifier: FirebaseTokenVerifier = {
    async verifyIdToken() {
      return { uid: 'verified-user' };
    },
    async verifyAppCheckToken() {
      throw new Error('App Check should not be required');
    },
  };
  const middleware = createFirebaseIdentityMiddleware(() => verifier);
  const response = createResponse();
  let nextCalled = false;

  await middleware(
    createRequest({ authorization: 'Bearer signed-id-token' }),
    response,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(response.locals.firebaseUid, 'verified-user');
  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
});

test('Firebase identity middleware keeps only the verified UID and owner flag', async () => {
  const calls: string[] = [];
  const verifier: FirebaseTokenVerifier = {
    async verifyIdToken(token) {
      calls.push(`id:${token}`);
      return { uid: 'verified-user' };
    },
    async verifyAppCheckToken(token) {
      calls.push(`appcheck:${token}`);
      return {};
    },
  };
  const middleware = createFirebaseIdentityMiddleware(() => verifier);
  const response = createResponse();
  let nextCalled = false;

  await middleware(
    createRequest({
      authorization: 'Bearer signed-id-token',
      'x-firebase-appcheck': 'signed-app-check-token',
    }),
    response,
    () => {
      nextCalled = true;
    },
  );

  assert.deepEqual(calls.sort(), [
    'appcheck:signed-app-check-token',
    'id:signed-id-token',
  ]);
  assert.equal(response.locals.firebaseUid, 'verified-user');
  assert.equal(response.locals.firebaseOwner, false);
  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
});

test('owner authorization fails closed without the verified Firebase owner claim', async () => {
  const response = createResponse();
  let nextCalled = false;

  await requireFirebaseOwnerClaim(createRequest(), response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { error: 'Owner access is required for this resource.' });
  assert.equal(nextCalled, false);
});

test('an owner claim cannot grant access to an unlisted account', async () => {
  const verifier: FirebaseTokenVerifier = {
    async verifyIdToken() {
      return {
        uid: 'verified-user',
        email: 'other@example.com',
        emailVerified: true,
        zioncoreOwner: true,
      };
    },
    async verifyAppCheckToken() {
      return {};
    },
  };
  const identityResponse = createResponse();
  let ownerNextCalled = false;

  await createFirebaseIdentityMiddleware(() => verifier)(
    createRequest({ authorization: 'Bearer signed-id-token' }),
    identityResponse,
    () => {},
  );
  await requireFirebaseOwnerClaim(createRequest(), identityResponse, () => {
    ownerNextCalled = true;
  });

  assert.equal(identityResponse.locals.firebaseOwner, false);
  assert.equal(identityResponse.statusCode, 403);
  assert.equal(ownerNextCalled, false);
});

test('owner authorization accepts both approved Firebase-verified administrator emails', async () => {
  for (const email of ['masawit1@icloud.com', 'tariromasawi19@gmail.com']) {
    const verifier: FirebaseTokenVerifier = {
      async verifyIdToken() {
        return { uid: `verified-${email}`, email, emailVerified: true };
      },
      async verifyAppCheckToken() {
        return {};
      },
    };
    const response = createResponse();
    await createFirebaseIdentityMiddleware(() => verifier)(
      createRequest({ authorization: 'Bearer signed-id-token' }),
      response,
      () => {},
    );
    assert.equal(response.locals.firebaseOwner, true, `${email} should be owner-authorized`);
  }
});

test('an unverified allowlisted email does not receive owner authorization', async () => {
  const verifier: FirebaseTokenVerifier = {
    async verifyIdToken() {
      return { uid: 'unverified-admin-email', email: 'masawit1@icloud.com', emailVerified: false };
    },
    async verifyAppCheckToken() {
      return {};
    },
  };
  const response = createResponse();
  await createFirebaseIdentityMiddleware(() => verifier)(
    createRequest({ authorization: 'Bearer signed-id-token' }),
    response,
    () => {},
  );
  assert.equal(response.locals.firebaseOwner, false);
});

test('Firebase identity middleware fails closed on invalid tokens or missing server credentials', async () => {
  const invalidVerifier: FirebaseTokenVerifier = {
    async verifyIdToken() {
      return { uid: 'verified-user' };
    },
    async verifyAppCheckToken() {
      throw new Error('invalid token');
    },
  };
  const invalidResponse = createResponse();
  await createFirebaseIdentityMiddleware(() => invalidVerifier)(
    createRequest({
      authorization: 'Bearer bad-id-token',
      'x-firebase-appcheck': 'bad-app-check-token',
    }),
    invalidResponse,
    () => {},
  );
  assert.equal(invalidResponse.statusCode, 401);

  const unconfiguredResponse = createResponse();
  await createFirebaseIdentityMiddleware(() => {
    throw new FirebaseAdminConfigurationError('missing server credential');
  })(
    createRequest({
      authorization: 'Bearer id-token',
      'x-firebase-appcheck': 'app-check-token',
    }),
    unconfiguredResponse,
    () => {},
  );
  assert.equal(unconfiguredResponse.statusCode, 503);
});
