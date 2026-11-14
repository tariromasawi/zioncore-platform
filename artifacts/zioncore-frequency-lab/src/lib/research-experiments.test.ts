import assert from 'node:assert/strict';
import test from 'node:test';
import type { Observation } from './observations';
import { compareObservations } from './discovery-engine';
import {
  appendResearchExperiment,
  createObservationComparisonExperiment,
  readResearchExperimentArchive,
  RESEARCH_EXPERIMENT_STORAGE_KEY,
  ResearchExperimentStorageError,
} from './research-experiments';

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
    notes: 'private note must stay out of the research record',
    ...overrides,
  };
}

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => { value = next; },
    raw: () => value,
  };
}

function makeExperiment() {
  const first = observation();
  const second = observation({
    id: 'capture-b',
    createdAt: '2026-10-01T10:01:00.000Z',
    dominantFrequencyHz: 442,
    topPeaksHz: [442, 881, 1_321],
  });
  const comparison = compareObservations(first, second, 'environment');
  assert.equal(comparison.success, true);
  if (!comparison.success) throw new Error(comparison.error);
  return createObservationComparisonExperiment({
    id: 'research-record-001',
    createdAt: '2026-10-01T10:02:00.000Z',
    hypothesis: 'The repeated tone is stable across two recordings.',
    first,
    second,
    comparison: comparison.data,
  });
}

test('research records preserve user hypotheses and measurements without copying audio or notes', () => {
  const experiment = makeExperiment();
  assert.equal(experiment.hypothesis.status, 'unverified');
  assert.deepEqual(experiment.source.observationIds, ['capture-a', 'capture-b']);
  assert.equal(experiment.provenance.rawAudioIncluded, false);
  assert.equal(experiment.provenance.sourceObservationNotesIncluded, false);
  assert.equal(JSON.stringify(experiment).includes('private note'), false);
  const first = observation();
  const second = observation({ id: 'capture-b' });
  const comparison = compareObservations(first, second, 'unknown');
  assert.equal(comparison.success, true);
  if (!comparison.success) return;
  assert.throws(
    () => createObservationComparisonExperiment({
      id: 'empty-hypothesis',
      createdAt: '2026-10-01T10:02:00.000Z',
      hypothesis: '  ',
      first,
      second,
      comparison: comparison.data,
    }),
    ResearchExperimentStorageError,
  );
});

test('research archive appends validated records and reads them back locally', async () => {
  const storage = memoryStorage();
  const experiment = makeExperiment();
  const saved = await appendResearchExperiment(experiment, {
    storage,
    runExclusive: async commit => commit(),
  });
  const archive = readResearchExperimentArchive(storage);

  assert.equal(saved.length, 1);
  assert.equal(archive.status, 'ready');
  assert.equal(archive.items[0]?.id, experiment.id);
  assert.equal(archive.items[0]?.hypothesis.statement, experiment.hypothesis.statement);
});

test('damaged research archives are preserved and block new writes', async () => {
  const damaged = '{broken archive bytes';
  const storage = memoryStorage(damaged);

  await assert.rejects(
    appendResearchExperiment(makeExperiment(), {
      storage,
      runExclusive: async commit => commit(),
    }),
    /original bytes are preserved|unreadable/i,
  );
  assert.equal(storage.raw(), damaged);
  assert.equal(readResearchExperimentArchive(storage).status, 'damaged');
  assert.equal(RESEARCH_EXPERIMENT_STORAGE_KEY, 'zioncore.frequency-lab.research-experiments.v1');
});

test('storage quota failure does not silently replace the local research archive', async () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      const error = new Error('quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    },
  };

  await assert.rejects(
    appendResearchExperiment(makeExperiment(), {
      storage,
      runExclusive: async commit => commit(),
    }),
    /Browser storage is full/,
  );
});
