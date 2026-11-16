import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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

const validInterpretation = (observationId = null) => ({
  scientificInterpretation: 'A narrow peak was measured; its source is not identified.',
  confidence: 'low',
  uncertainty: 'A single microphone reading cannot identify a source.',
  possibleSources: ['A steady nearby tone'],
  faithReflection: null,
  model: 'gemini-3.5-flash-lite',
  ...(observationId ? {
    provenance: {
      source: 'ai-generated',
      observationId,
      methodId: 'frequency-measurement-explanation',
      methodVersion: '1.0.0',
      promptVersion: '1.0.0',
      provider: 'firebase-ai-google',
      modelId: 'gemini-3.5-flash-lite',
      generatedAt: '2026-11-12T10:00:00.000Z',
    },
  } : {}),
});

const validInstrumentProvenance = () => ({
  instrumentId: 'instrument.browser-microphone-web-audio',
  instrumentName: 'Browser microphone and Web Audio analyser',
  acquisitionMethod: 'browser-microphone',
  physicalDeviceIdentity: 'not-collected',
  inputChannels: 1,
  units: {
    frequency: 'Hz',
    frequencyResolution: 'Hz',
    amplitude: 'FS',
    duration: 'seconds',
  },
  calibration: {
    status: 'uncalibrated',
    checkedAt: '2026-11-12T10:00:00.000Z',
    reference: 'Browser microphone input is not calibrated for absolute sound-pressure measurements.',
  },
  softwareVersion: '@workspace/zioncore-frequency-lab@0.0.0',
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

test('signed-in users can create validated local WAV measurements under their own UID', async () => {
  await assertSucceeds(setDoc(
    observationReference('user-a', 'wav-reading'),
    { ...validObservation(), mode: 'audio-file' },
  ));
});

test('signed-in users can save a bounded interpretation with their own observation', async () => {
  await assertSucceeds(setDoc(
    observationReference('user-a', 'reading-with-interpretation'),
    { ...validObservation(), interpretation: validInterpretation('reading-with-interpretation') },
  ));
});

test('signed-in users can create a bounded observation with instrument provenance', async () => {
  await assertSucceeds(setDoc(
    observationReference('user-a', 'with-instrument-provenance'),
    { ...validObservation(), instrumentProvenance: validInstrumentProvenance() },
  ));
});

test('signed-in users can save an interpreted observation with instrument provenance', async () => {
  await assertSucceeds(setDoc(
    observationReference('user-a', 'interpreted-with-instrument-provenance'),
    {
      ...validObservation(),
      interpretation: validInterpretation('interpreted-with-instrument-provenance'),
      instrumentProvenance: validInstrumentProvenance(),
    },
  ));
});

test('instrument provenance cannot contain physical device identifiers or unknown units', async () => {
  const leakedIdentifier = validInstrumentProvenance();
  leakedIdentifier.physicalDeviceIdentity = 'microphone-device-123';
  await assertFails(setDoc(
    observationReference('user-a', 'leaked-device-id'),
    { ...validObservation(), instrumentProvenance: leakedIdentifier },
  ));

  const invalidUnits = validInstrumentProvenance();
  invalidUnits.units.frequency = 'kHz';
  await assertFails(setDoc(
    observationReference('user-a', 'invalid-provenance-units'),
    { ...validObservation(), instrumentProvenance: invalidUnits },
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

test('users cannot read, list, create, update, or delete records under another UID', async () => {
  const ownerRef = observationReference('user-a', 'private-reading');
  await assertSucceeds(setDoc(ownerRef, validObservation()));

  const ownerFirestore = testEnvironment.authenticatedContext('user-a').firestore();
  await assertSucceeds(getDocs(collection(ownerFirestore, 'users', 'user-a', 'frequency_observations')));

  const otherUser = testEnvironment.authenticatedContext('user-b').firestore();
  await assertFails(getDoc(doc(otherUser, 'users', 'user-a', 'frequency_observations', 'private-reading')));
  await assertFails(getDocs(collection(otherUser, 'users', 'user-a', 'frequency_observations')));
  await assertFails(setDoc(
    doc(otherUser, 'users', 'user-a', 'frequency_observations', 'stolen-write'),
    validObservation(),
  ));
  await assertFails(updateDoc(
    doc(otherUser, 'users', 'user-a', 'frequency_observations', 'private-reading'),
    { interpretation: validInterpretation(), updatedAt: serverTimestamp() },
  ));
  await assertFails(deleteDoc(
    doc(otherUser, 'users', 'user-a', 'frequency_observations', 'private-reading'),
  ));
  assert.equal((await getDoc(ownerRef)).exists(), true);
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

  const invalidInterpretation = validObservation();
  invalidInterpretation.interpretation = {
    ...validInterpretation(),
    possibleSources: [{ source: 'not a string' }],
  };
  await assertFails(setDoc(
    observationReference('user-a', 'invalid-interpretation'),
    invalidInterpretation,
  ));
});

test('users can attach or revise an interpretation without editing measurement fields', async () => {
  const reference = observationReference('user-a', 'interpret-once');
  await assertSucceeds(setDoc(reference, validObservation()));
  await assertSucceeds(updateDoc(reference, {
    interpretation: validInterpretation('interpret-once'),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(reference, {
    interpretation: { ...validInterpretation('interpret-once'), scientificInterpretation: 'Changed result' },
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(reference, {
    notes: 'changed',
    updatedAt: serverTimestamp(),
  }));
});

test('interpretation provenance cannot be attached to a different observation document', async () => {
  await assertFails(setDoc(
    observationReference('user-a', 'linked-reading'),
    { ...validObservation(), interpretation: validInterpretation('different-reading') },
  ));
  const reference = observationReference('user-a', 'linked-reading-update');
  await assertSucceeds(setDoc(reference, validObservation()));
  await assertFails(updateDoc(reference, {
    interpretation: validInterpretation('different-reading'),
    updatedAt: serverTimestamp(),
  }));
});

test('client deletion is denied until an audited server deletion path exists', async () => {
  const reference = observationReference('user-a', 'audit-required');
  await assertSucceeds(setDoc(reference, validObservation()));
  await assertFails(deleteDoc(reference));
  assert.equal((await getDoc(reference)).exists(), true);
});

test('clients cannot modify profile identity, roles, entitlements, or financial records', async () => {
  const restrictedDocuments = [
    {
      reference: doc(testEnvironment.authenticatedContext('user-a').firestore(), 'users', 'user-a'),
      original: { uid: 'user-a', role: 'customer', creditBalance: 25 },
      attempted: { uid: 'user-b', role: 'owner', creditBalance: 9999 },
    },
    {
      reference: doc(testEnvironment.authenticatedContext('user-a').firestore(), 'users', 'user-a', 'roles', 'primary'),
      original: { role: 'customer' },
      attempted: { role: 'owner' },
    },
    {
      reference: doc(testEnvironment.authenticatedContext('user-a').firestore(), 'users', 'user-a', 'entitlements', 'premium'),
      original: { active: false },
      attempted: { active: true },
    },
    {
      reference: doc(testEnvironment.authenticatedContext('user-a').firestore(), 'users', 'user-a', 'wallets', 'primary'),
      original: { balance: 25 },
      attempted: { balance: 9999 },
    },
    {
      reference: doc(testEnvironment.authenticatedContext('user-a').firestore(), 'users', 'user-a', 'purchases', 'purchase-1'),
      original: { amountMinor: 250, credits: 50 },
      attempted: { amountMinor: 1, credits: 5000 },
    },
  ];

  await testEnvironment.withSecurityRulesDisabled(async context => {
    const privilegedFirestore = context.firestore();
    for (const { reference, original } of restrictedDocuments) {
      await setDoc(doc(privilegedFirestore, reference.path), original);
    }
  });

  for (const { reference, attempted } of restrictedDocuments) {
    await assertFails(updateDoc(reference, attempted));
    await assertFails(setDoc(reference, attempted));
  }
});

test('denies client access to unclassified legacy roots and unmatched paths', async () => {
  const anonymous = testEnvironment.unauthenticatedContext().firestore();
  const signedIn = testEnvironment.authenticatedContext('user-a').firestore();
  const legacyRoots = [
    'DivineTreasury',
    'ZionLattice',
    'SovereignPatents',
    'advancements',
    'soul_signatures',
    'petitions',
  ];

  for (const root of legacyRoots) {
    const anonymousReference = doc(anonymous, root, 'legacy-record');
    const signedInReference = doc(signedIn, root, 'legacy-record');
    await assertFails(getDoc(anonymousReference));
    await assertFails(setDoc(anonymousReference, { value: 'blocked' }));
    await assertFails(setDoc(signedInReference, { value: 'blocked' }));
  }

  await assertFails(getDoc(doc(anonymous, 'unmatched-collection', 'private-record')));
});
