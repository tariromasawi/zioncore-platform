import assert from 'node:assert/strict';
import test from 'node:test';
import type { Observation } from '@/lib/observations';
import { compareObservations } from './discovery-engine';

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 'capture-a',
    createdAt: '2026-10-01T10:00:00.000Z',
    sampleRate: 48_000,
    fftSize: 4_096,
    frequencyResolutionHz: 48_000 / 4_096,
    dominantFrequencyHz: 440,
    topPeaksHz: [440, 880, 1_320],
    rmsLevel: 0.1,
    durationSeconds: 5,
    mode: 'microphone',
    notes: 'private note must not be exported',
    ...overrides,
  };
}

test('compares repeated captures using their measured resolution, without source attribution', () => {
  const result = compareObservations(
    observation(),
    observation({
      id: 'capture-b',
      createdAt: '2026-10-01T10:01:00.000Z',
      dominantFrequencyHz: 442,
      topPeaksHz: [442, 881, 1_321],
    }),
    'environment',
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.finding, 'repeatable-pattern');
  assert.equal(result.data.setupComparable, true);
  assert.equal(result.data.matchedPeaksHz.length, 3);
  assert.equal(result.data.dominantShiftHz, 2);
  assert.match(result.data.summary, /not a source identification/);
  assert.equal('notes' in result.data.first, false);
});

test('marks mismatched capture settings inconclusive and recommends matching them', () => {
  const result = compareObservations(
    observation(),
    observation({
      id: 'capture-b',
      sampleRate: 44_100,
      fftSize: 8_192,
      frequencyResolutionHz: 44_100 / 8_192,
      mode: 'audio-file',
      dominantFrequencyHz: 440,
    }),
    'unknown',
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.finding, 'changed-or-ambiguous');
  assert.deepEqual(result.data.setupDifferences, ['sample rate', 'FFT size', 'capture type']);
  assert.match(result.data.summary, /inconclusive/);
  assert.match(result.data.nextExperiments[0], /same sample rate, FFT size, capture type/);
});

test('requires two distinct valid observations and never mutates the inputs', () => {
  const first = observation();
  const second = observation({ id: 'capture-b' });
  const original = JSON.stringify([first, second]);
  assert.equal(compareObservations(first, first, 'human').success, false);
  assert.equal(compareObservations(first, { ...second, sampleRate: -1 }, 'human').success, false);
  const result = compareObservations(first, second, 'spiritual');
  assert.equal(result.success, true);
  assert.equal(JSON.stringify([first, second]), original);
  if (result.success) {
    assert.match(result.data.nextExperiments[1], /personal reflection/);
  }
});

test('reports insufficient evidence instead of inventing a pattern', () => {
  const result = compareObservations(
    observation({ dominantFrequencyHz: null, topPeaksHz: [] }),
    observation({ id: 'capture-b', dominantFrequencyHz: null, topPeaksHz: [] }),
    'celestial',
  );
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.finding, 'insufficient-data');
  assert.match(result.data.summary, /not contain enough peak information/);
});
