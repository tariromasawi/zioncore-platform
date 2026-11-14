import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = 'demo-zioncore-frequency-lab';
const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (!emulatorHost || !/^(127\.0\.0\.1|localhost):9099$/.test(emulatorHost)) {
  throw new Error('This test must run only through the local Firebase Auth emulator.');
}

const adminApp = initializeApp({ projectId }, `zioncore-auth-server-emulator-${process.pid}`);
const adminAuth = getAuth(adminApp);
let createdUid: string | null = null;

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(
    `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/${path}?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json() as Record<string, unknown>;
  assert.equal(response.ok, true, `Firebase Auth emulator request failed with HTTP ${response.status}.`);
  return result;
}

after(async () => {
  if (createdUid) await adminAuth.deleteUser(createdUid);
  await deleteApp(adminApp);
});

test('server verifies emulator ID tokens and accepts a refreshed session token', async () => {
  const email = `zioncore-server-${randomUUID()}@example.test`;
  const password = 'emulator-server-test-password-97';
  const signUp = await postJson('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });

  assert.equal(typeof signUp.localId, 'string');
  assert.equal(typeof signUp.idToken, 'string');
  assert.equal(typeof signUp.refreshToken, 'string');
  createdUid = signUp.localId as string;

  const decoded = await adminAuth.verifyIdToken(signUp.idToken as string);
  assert.equal(decoded.uid, createdUid);
  assert.equal(decoded.aud, projectId);

  await assert.rejects(
    adminAuth.verifyIdToken('not-a-firebase-id-token'),
  );

  const refreshed = await fetch(
    `http://${emulatorHost}/securetoken.googleapis.com/v1/token?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: signUp.refreshToken as string,
      }),
    },
  );
  const refreshedResult = await refreshed.json() as Record<string, unknown>;
  assert.equal(refreshed.ok, true, `Firebase token refresh failed with HTTP ${refreshed.status}.`);
  assert.equal(typeof refreshedResult.id_token, 'string');

  const refreshedIdentity = await adminAuth.verifyIdToken(refreshedResult.id_token as string);
  assert.equal(refreshedIdentity.uid, createdUid);
});
