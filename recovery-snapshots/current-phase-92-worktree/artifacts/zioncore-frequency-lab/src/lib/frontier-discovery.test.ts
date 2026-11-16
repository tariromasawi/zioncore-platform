import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRONTIER_TOOLS, DISCOVERY_STATES, buildFrontierReport, compareFrontierCaptures, createFrontierExperiment } from './frontier-discovery';
import type { FreeListeningInput } from './free-listening';
import { appendResearchExperiment, readResearchExperimentArchive } from './research-experiments';

const signal: FreeListeningInput = {
  dominantFrequencyHz: 440, rmsLevel: 0.1, sampleRate: 48000, durationSeconds: 6,
  silent: false, fftSize: 4096, captureSource: 'microphone',
  features: { spectralCentroidHz: 500, spectralFlatness: 0.1, spectralEntropy: 0.3, peakToMedianContrastDb: 20, rolloff85Hz: 1000, harmonicity: 0.7, zeroCrossingRate: 0.02, dominantFrequencyStabilityHz: 3, dominantFrequencyDriftHz: 6, amplitudeVariationCoefficient: 0.3, temporalWindowSeconds: 5 },
};
const report = buildFrontierReport(signal, { toolId: 'unknown', context: 'A personal intention', feeling: 'unsettled', hypothesis: 'Does the pattern repeat with a second recorder?' });

test('all nineteen products have working reading and experiment outputs', () => {
  assert.equal(FRONTIER_TOOLS.length, 19);
  assert.equal(new Set(FRONTIER_TOOLS.map(tool => tool.id)).size, 19);
  for (const tool of FRONTIER_TOOLS) {
    const result = buildFrontierReport(signal, { toolId: tool.id, context: '', feeling: 'unspecified', hypothesis: '' });
    assert.equal(result.tool.id, tool.id);
    assert.ok(result.reading.observations.length > 2);
    assert.equal(result.matrix.length, 4);
    assert.ok(result.experiment.steps.length >= 5);
    assert.ok(result.hypotheses.length >= 3);
  }
});
test('user-reported disturbance never becomes a detected threat or spiritual fact', () => {
  assert.match(report.feeling, /You described this experience as unsettled/);
  assert.match(report.feeling, /comfortable environment|constructive care/);
  assert.ok(!/detected energy|presence|threat|cursed/i.test(report.feeling));
  assert.match(report.hypotheses[2].explanation, /independent observations/);
});
test('baseline comparisons require matched source and FFT settings', () => {
  const result = compareFrontierCaptures(signal, { ...signal, dominantFrequencyHz: 450 });
  assert.equal(result.frequencyDifferenceHz, 10);
  assert.equal(compareFrontierCaptures(signal, { ...signal, fftSize: 8192 }).frequencyDifferenceHz, null);
  assert.equal(compareFrontierCaptures(signal, { ...signal, captureSource: 'audio-file' }).comparable, false);
  assert.equal(compareFrontierCaptures(signal, { ...signal, silent: true }).frequencyDifferenceHz, null);
});
test('seven research states stay user assessments and never establish a source automatically', () => {
  for (const state of DISCOVERY_STATES) {
    const record = createFrontierExperiment(signal, report, { id: 'capture-one', createdAt: '2026-11-10T05:00:00.000Z', state, evidence: 'User cites a second independent recording for future review.' });
    assert.equal(record.hypothesis.status, 'unverified');
    assert.equal(record.results[0].status, 'hypothesis');
    assert.ok(!JSON.stringify(record).includes('A personal intention'));
  }
  assert.throws(() => createFrontierExperiment(signal, report, { id: 'short', createdAt: '2026-11-10T05:00:00.000Z', state: 'Independently Corroborated', evidence: '' }), /supporting evidence/);
});
test('frontier notebook reuses strict archive storage with append-only revisions', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const first = createFrontierExperiment(signal, report, { id: 'first', createdAt: '2026-11-10T05:00:00.000Z', state: 'Observed', evidence: '' });
  await appendResearchExperiment(first, { storage });
  const revision = createFrontierExperiment(signal, report, { id: 'revision', createdAt: '2026-11-10T05:01:00.000Z', state: 'Unexplained', evidence: '', parentId: first.id });
  await appendResearchExperiment(revision, { storage });
  const archive = readResearchExperimentArchive(storage);
  assert.equal(archive.status, 'ready');
  assert.equal(archive.items.length, 2);
  assert.deepEqual(archive.items[1], first);
  assert.ok(archive.items[0].results.some(item => item.name === 'previous-revision' && item.value === 'first'));
});
