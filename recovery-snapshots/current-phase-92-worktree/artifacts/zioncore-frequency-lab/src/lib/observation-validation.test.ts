import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateObservation } from '@/lib/observation-validation';

const validObservation = {
  id: 'reading-1',
  createdAt: '2026-11-06T14:00:00.000Z',
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  mode: 'microphone',
};

test('accepts a finite microphone observation with a consistent FFT resolution', () => {
  assert.equal(validateObservation(validObservation).success, true);
});

test('accepts an imported-audio measurement without storing the source file', () => {
  assert.equal(validateObservation({
    ...validObservation,
    mode: 'audio-file',
  }).success, true);
});

test('rejects an impossible peak and inconsistent FFT resolution', () => {
  assert.equal(validateObservation({
    ...validObservation,
    frequencyResolutionHz: 1,
    topPeaksHz: [24001],
  }).success, false);
});

test('rejects unknown fields, invalid amplitude, and oversized notes', () => {
  assert.equal(validateObservation({ ...validObservation, bins: [0, 1] }).success, false);
  assert.equal(validateObservation({ ...validObservation, mode: 'celestial-sensor' }).success, false);
  assert.equal(validateObservation({ ...validObservation, rmsLevel: 1.1 }).success, false);
  assert.equal(validateObservation({ ...validObservation, notes: 'x'.repeat(4001) }).success, false);
});
