import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

const projectId = 'demo-zioncore-frequency-lab';
let testEnvironment;

const validObservation = () => ({
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  mode: 'microphone',
  notes: 'Near-field tone test',
});

function observationReference(uid, id) {
  return doc(
    testEnvironment.authenticatedContext(uid).firestore(),
    'users',
    uid,
    'frequency_observations',
    id,
  );
}

function membershipReference(authUid, ownerUid = authUid) {
  return doc(
    testEnvironment.authenticatedContext(authUid).firestore(),
    'users',
    ownerUid,
    'membership',
    'current',
  );
}

async function seedMembership(uid) {
  await testEnvironment.withSecurityRulesDisabled(async context => {
    await setDoc(
      doc(context.firestore(), 'users', uid, 'membership', 'current'),
      {
        tier: 'premium',
        status: 'active',
        source: 'stripe',
        accessUntil: new Date('2026-12-06T12:00:00.000Z'),
        cancelAtPeriodEnd: false,
        updatedAt: new Date('2026-11-06T11:00:00.000Z'),
      },
    );
  });
}

before(async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

test('signed-in users can create a validated observation under their own UID', async () => {
  await assertSucceeds(setDoc(observationReference('user-a', 'reading-1'), validObservation()));
});

test('signed-in users can save imported-audio analysis metadata under their own UID', async () => {
  await assertSucceeds(setDoc(
    observationReference('user-a', 'imported-audio-reading'),
    { ...validObservation(), mode: 'audio-file' },
  ));
});

test('unauthenticated users cannot read or create observations', async () => {
  const firestore = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(firestore, 'users', 'user-a', 'frequency_observations')));
  await assertFails(setDoc(
    doc(firestore, 'users', 'user-a', 'frequency_observations', 'reading-2'),
    validObservation(),
  ));
});

test('users cannot read or create records under another UID', async () => {
  const ownerRef = observationReference('user-a', 'private-reading');
  await assertSucceeds(setDoc(ownerRef, validObservation()));

  const otherUser = testEnvironment.authenticatedContext('user-b').firestore();
  await assertFails(getDoc(doc(otherUser, 'users', 'user-a', 'frequency_observations', 'private-reading')));
  await assertFails(setDoc(
    doc(otherUser, 'users', 'user-a', 'frequency_observations', 'stolen-write'),
    validObservation(),
  ));
});

test('users cannot list, update, or delete observations under another UID', async () => {
  await assertSucceeds(setDoc(observationReference('user-a', 'private-for-user-a'), validObservation()));
  const otherUser = testEnvironment.authenticatedContext('user-b').firestore();
  const otherUsersCollection = collection(otherUser, 'users', 'user-a', 'frequency_observations');
  const otherUsersRecord = doc(otherUsersCollection, 'private-for-user-a');

  await assertFails(getDocs(otherUsersCollection));
  await assertFails(setDoc(otherUsersRecord, { ...validObservation(), notes: 'attempted overwrite' }));
  await assertFails(deleteDoc(otherUsersRecord));
});

test('cloud observations reject raw audio and other undeclared fields', async () => {
  await assertFails(setDoc(
    observationReference('user-a', 'raw-audio-must-not-persist'),
    { ...validObservation(), audioBase64: 'cHJpdmF0ZS1hdWRpby1maXh0dXJl' },
  ));
});

test('invalid measurement fields and client-selected timestamps are rejected', async () => {
  const invalid = validObservation();
  invalid.sampleRate = 999;
  await assertFails(setDoc(observationReference('user-a', 'invalid-rate'), invalid));

  const impossiblePeak = validObservation();
  impossiblePeak.topPeaksHz = [24001];
  await assertFails(setDoc(observationReference('user-a', 'impossible-peak'), impossiblePeak));

  const clientTimestamp = validObservation();
  clientTimestamp.createdAt = new Date();
  await assertFails(setDoc(observationReference('user-a', 'client-time'), clientTimestamp));
});

test('users can delete but cannot update their own observations', async () => {
  const reference = observationReference('user-a', 'delete-me');
  await assertSucceeds(setDoc(reference, validObservation()));
  await assertFails(setDoc(reference, { ...validObservation(), notes: 'changed' }));
  await assertSucceeds(deleteDoc(reference));
});

test('users can read only their own server-managed membership record', async () => {
  await seedMembership('user-a');
  await assertSucceeds(getDoc(membershipReference('user-a')));
  await assertFails(getDoc(membershipReference('user-b', 'user-a')));

  const unauthenticated = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(
    doc(unauthenticated, 'users', 'user-a', 'membership', 'current'),
  ));
});

test('clients cannot create, update, or delete membership records', async () => {
  await seedMembership('user-a');
  const reference = membershipReference('user-a');
  const forgedRecord = {
    tier: 'premium',
    status: 'active',
    source: 'stripe',
    accessUntil: new Date('2026-12-06T12:00:00.000Z'),
    cancelAtPeriodEnd: false,
    updatedAt: new Date('2026-11-06T11:00:00.000Z'),
  };
  await assertFails(setDoc(reference, forgedRecord));
  await assertFails(deleteDoc(reference));
});

test('clients cannot read or modify server-managed wallet, ledger, or reservation records', async () => {
  const firestore = testEnvironment.authenticatedContext('user-a').firestore();
  const protectedPaths = [
    ['wallet', 'current'],
    ['credit_transactions', 'entry-1'],
    ['credit_reservations', 'operation-1'],
    ['ai_interpretation_jobs', 'retry-1'],
  ];

  for (const [collectionName, documentId] of protectedPaths) {
    const reference = doc(firestore, 'users', 'user-a', collectionName, documentId);
    await assertFails(getDoc(reference));
    await assertFails(setDoc(reference, { purchasedCredits: 999999 }));
    await assertFails(deleteDoc(reference));
  }
});
