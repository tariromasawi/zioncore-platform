import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  initializeAuth,
  inMemoryPersistence,
  type AuthError,
} from 'firebase/auth';
import { createFirebaseAuthOperations } from '../lib/firebase-auth';

const app = initializeApp(
  {
    apiKey: 'demo-api-key',
    authDomain: 'localhost',
    projectId: 'demo-zioncore-frequency-lab',
  },
  `zioncore-auth-emulator-${process.pid}`,
);
const auth = initializeAuth(app, { persistence: inMemoryPersistence });
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const authOperations = createFirebaseAuthOperations(auth);

after(async () => {
  await authOperations.signOutCurrentUser();
  await deleteApp(app);
});

test('email account creation, sign-out, sign-in, and invalid-password rejection work in the emulator', async () => {
  const email = `zioncore-${randomUUID()}@example.test`;
  const password = 'emulator-test-password-93';

  const created = await authOperations.authenticateWithEmail(
    'create',
    ` ${email} `,
    password,
  );
  assert.equal(created.email, email);
  assert.ok(created.uid);
  assert.equal(auth.currentUser?.uid, created.uid);

  await authOperations.signOutCurrentUser();
  assert.equal(auth.currentUser, null);

  const signedIn = await authOperations.authenticateWithEmail(
    'sign-in',
    email,
    password,
  );
  assert.equal(signedIn.uid, created.uid);
  assert.equal(auth.currentUser?.uid, created.uid);

  await authOperations.signOutCurrentUser();
  await assert.rejects(
    authOperations.authenticateWithEmail('sign-in', email, 'wrong-emulator-password'),
    (error: unknown) => {
      const code = (error as AuthError).code;
      return code === 'auth/invalid-credential' || code === 'auth/wrong-password';
    },
  );
});

test('duplicate email registration is rejected by Firebase Authentication', async () => {
  const email = `zioncore-${randomUUID()}@example.test`;
  const password = 'emulator-test-password-94';

  await authOperations.authenticateWithEmail('create', email, password);
  await authOperations.signOutCurrentUser();

  await assert.rejects(
    authOperations.authenticateWithEmail('create', email, password),
    (error: unknown) => (error as AuthError).code === 'auth/email-already-in-use',
  );
});
