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

test('accepts a saved interpretation while keeping it separate from measurement fields', () => {
  const result = validateObservation({
    ...validObservation,
    interpretation: {
      scientificInterpretation: 'A narrow peak was measured; its source is not identified.',
      confidence: 'low',
      uncertainty: 'A single microphone reading cannot identify a source.',
      possibleSources: ['A steady nearby tone'],
      faithReflection: null,
      model: 'gemini-3.5-flash-lite',
    },
  });
  assert.equal(result.success, true);
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
  assert.equal(validateObservation({ ...validObservation, rmsLevel: 1.1 }).success, false);
  assert.equal(validateObservation({ ...validObservation, notes: 'x'.repeat(4001) }).success, false);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: {
      scientificInterpretation: 'Valid text',
      confidence: 'certain',
      uncertainty: 'Unknown',
      possibleSources: [],
      faithReflection: null,
      model: 'gemini-3.5-flash-lite',
    },
  }).success, false);
});
