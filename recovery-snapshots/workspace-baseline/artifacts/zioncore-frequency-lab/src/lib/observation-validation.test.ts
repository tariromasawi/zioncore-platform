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

test('accepts file measurements with a distinct source label', () => {
  assert.equal(validateObservation({ ...validObservation, mode: 'audio-file' }).success, true);
  assert.equal(validateObservation({ ...validObservation, mode: 'unknown-source' }).success, false);
});

test('accepts bounded instrument provenance on new measurements', () => {
  const instrumentProvenance = {
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
  };
  assert.equal(validateObservation({ ...validObservation, instrumentProvenance }).success, true);
  assert.equal(validateObservation({
    ...validObservation,
    instrumentProvenance: {
      ...instrumentProvenance,
      physicalDeviceIdentity: 'private-device-id',
    },
  }).success, false);
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

test('accepts bounded evidence and limitations while keeping old interpretations valid', () => {
  const interpretation = {
    scientificInterpretation: 'A narrow peak was measured; its source is not identified.',
    confidence: 'moderate',
    uncertainty: 'The input contains only a short acoustic measurement.',
    possibleSources: ['A steady nearby tone'],
    evidenceUsed: ['Dominant frequency bin: 440.63 Hz.'],
    limitations: ['RMS is not calibrated sound pressure.'],
    faithReflection: null,
    model: 'gemini-3.5-flash-lite',
  };
  assert.equal(validateObservation({ ...validObservation, interpretation }).success, true);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: { ...interpretation, evidenceUsed: Array.from({ length: 9 }, () => 'evidence') },
  }).success, false);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: { ...interpretation, limitations: ['x'.repeat(321)] },
  }).success, false);
});

test('interpretation provenance must match the exact saved observation and model', () => {
  const interpretation = {
    scientificInterpretation: 'A narrow peak was measured; its source is not identified.',
    confidence: 'low',
    uncertainty: 'A single microphone reading cannot identify a source.',
    possibleSources: ['A steady nearby tone'],
    faithReflection: null,
    model: 'gemini-3.5-flash-lite',
    provenance: {
      source: 'ai-generated',
      observationId: 'reading-1',
      methodId: 'frequency-measurement-explanation',
      methodVersion: '1.0.0',
      promptVersion: '1.0.0',
      provider: 'firebase-ai-google',
      modelId: 'gemini-3.5-flash-lite',
      generatedAt: '2026-11-12T10:00:00.000Z',
      clientRoundTripMs: 842,
    },
  };
  assert.equal(validateObservation({ ...validObservation, interpretation }).success, true);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: { ...interpretation, provenance: { ...interpretation.provenance, clientRoundTripMs: 300_001 } },
  }).success, false);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: { ...interpretation, provenance: { ...interpretation.provenance, observationId: 'other-reading' } },
  }).success, false);
  assert.equal(validateObservation({
    ...validObservation,
    interpretation: { ...interpretation, provenance: { ...interpretation.provenance, modelId: 'different-model' } },
  }).success, false);
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
