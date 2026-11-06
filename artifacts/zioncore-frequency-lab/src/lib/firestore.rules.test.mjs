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
