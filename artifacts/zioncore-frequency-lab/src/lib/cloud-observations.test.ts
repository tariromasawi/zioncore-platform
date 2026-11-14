import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deleteCloudObservations,
  getCloudHistoryErrorMessage,
  saveCloudObservation,
} from '@/lib/cloud-observations';

const validObservation = {
  id: 'gate-check',
  createdAt: '2026-11-11T10:00:00.000Z',
  sampleRate: 48000,
  fftSize: 4096 as const,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  mode: 'microphone' as const,
};

test('cloud history reports missing or rejected App Check without claiming enforcement', () => {
  assert.match(
    getCloudHistoryErrorMessage({ code: 'app-check/token-unavailable' }),
    /App Check.*valid attestation/i,
  );
  assert.match(
    getCloudHistoryErrorMessage(new Error('App attestation failed.')),
    /reCAPTCHA key.*hostname/i,
  );
});

test('ordinary permission denials are not mislabeled as App Check failures', () => {
  assert.match(
    getCloudHistoryErrorMessage({ code: 'firestore/permission-denied' }),
    /account permissions/i,
  );
});

test('validated observations are not uploaded while cloud rules and App Check are unapproved', async () => {
  await assert.rejects(
    saveCloudObservation(validObservation),
    /paused until Firestore rules and App Check are verified/i,
  );
});

test('invalid observations are rejected before any cloud write is attempted', async () => {
  await assert.rejects(
    saveCloudObservation({ ...validObservation, sampleRate: 4000 }),
    /does not pass validation and was not uploaded/i,
  );
});

test('cloud deletion stays blocked until an authenticated audit endpoint exists', async () => {
  await assert.rejects(
    deleteCloudObservations(['valid-record-id']),
    /server-side deletion path.*audit event.*No cloud records were deleted/i,
  );
  await assert.doesNotReject(deleteCloudObservations([]));
});
