import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clusterAcousticEvents,
  compareAcousticEventSets,
  MAX_BIOACOUSTIC_INPUT_BYTES,
  validateBioacousticInputBudget,
  type AcousticEventFeature,
} from '@/lib/bioacoustic-analysis';

function event(
  id: string,
  durationSeconds: number,
  dominantFrequencyHz: number,
  spectralCentroidHz: number,
  meanRms: number,
): AcousticEventFeature {
  return {
    id,
    startSeconds: 0,
    endSeconds: durationSeconds,
    durationSeconds,
    meanRms,
    peakRms: meanRms * 1.2,
    dominantFrequencyHz,
    spectralCentroidHz,
  };
}

test('acoustic event clustering is deterministic and groups feature-near events without species claims', () => {
  const samples = [
    event('a-1', 0.1, 450, 600, 0.08),
    event('a-2', 0.12, 470, 630, 0.09),
    event('a-3', 0.35, 2400, 3100, 0.31),
    event('a-4', 0.32, 2450, 3000, 0.29),
  ];
  const first = clusterAcousticEvents(samples, 2);
  const second = clusterAcousticEvents(samples, 2);
  assert.equal(first.effectiveClusterCount, 2);
  assert.deepEqual(first.events.map(item => item.clusterId), second.events.map(item => item.clusterId));
  assert.equal(first.events[0].clusterId, first.events[1].clusterId);
  assert.equal(first.events[2].clusterId, first.events[3].clusterId);
  assert.notEqual(first.events[0].clusterId, first.events[2].clusterId);
  assert.equal(first.methodVersion, '1.0.0');
});

test('recording comparison matches similar features one-to-one and reports its limits', () => {
  const baseline = event('a-1', 0.18, 800, 1100, 0.12);
  const nearby = event('b-1', 0.19, 820, 1130, 0.13);
  const different = event('b-2', 0.6, 5200, 6900, 0.55);
  const result = compareAcousticEventSets([baseline], [nearby, different]);
  assert.equal(result.firstEventCount, 1);
  assert.equal(result.secondEventCount, 2);
  assert.equal(result.matchedEventCount, 1);
  assert.equal(result.similarityPercent, 50);
  assert.equal(result.maximumNormalizedDistance, 1.5);
  assert.ok((result.averageDominantFrequencyDeltaHz ?? Infinity) < 30);
  assert.match(result.limitation, /does not identify species/i);
  assert.equal(result.methodVersion, '1.0.0');
});

test('empty comparisons and invalid cluster or distance settings have explicit results', () => {
  const empty = compareAcousticEventSets([], []);
  assert.equal(empty.similarityPercent, 0);
  assert.equal(empty.averageDurationDeltaSeconds, null);
  assert.throws(() => clusterAcousticEvents([event('one', 0.1, 100, 200, 0.1)], 1), /between 2 and 8/);
  assert.throws(() => compareAcousticEventSets([], [], 0), /threshold/);
});

test('local recording pair has an explicit combined memory budget', () => {
  assert.doesNotThrow(() => validateBioacousticInputBudget(10, MAX_BIOACOUSTIC_INPUT_BYTES - 10));
  assert.throws(
    () => validateBioacousticInputBudget(MAX_BIOACOUSTIC_INPUT_BYTES, 1),
    /combined local analysis limit/,
  );
  assert.throws(() => validateBioacousticInputBudget(0), /non-empty primary WAV/);
});
