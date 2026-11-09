import assert from 'node:assert/strict';
import { test } from 'node:test';
import { upsertObservation, type Observation } from '@/lib/observations';

const observation = (id: string, dominantFrequencyHz = 440.625): Observation => ({
  id,
  createdAt: '2026-11-09T20:00:00.000Z',
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz,
  topPeaksHz: [dominantFrequencyHz],
  rmsLevel: 0.12,
  durationSeconds: 8,
  mode: 'microphone',
});

test('upsert adds a new observation to the start of history', () => {
  const existing = observation('older');
  const newest = observation('newest');
  assert.deepEqual(upsertObservation([existing], newest), [newest, existing]);
});

test('upsert replaces a saved observation with the same capture ID', () => {
  const existing = observation('capture-1');
  const revised = {
    ...existing,
    interpretation: {
      scientificInterpretation: 'A narrow peak was measured.',
      confidence: 'low' as const,
      uncertainty: 'The source is not identified.',
      possibleSources: ['A steady tone'],
      faithReflection: null,
      model: 'gemini-3.5-flash-lite',
    },
  };
  assert.deepEqual(upsertObservation([existing], revised), [revised]);
});
