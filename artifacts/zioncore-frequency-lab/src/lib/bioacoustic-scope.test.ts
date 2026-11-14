import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BIOACOUSTIC_BENCHMARK_STATUS,
  BIOACOUSTIC_CLASS_CANDIDATES,
  BIOACOUSTIC_REFERENCE_CLIPS,
  BIOACOUSTIC_REFERENCE_SOURCES,
} from './bioacoustic-scope';

test('bioacoustic candidate classes have traceable, rights-documented reference sources', () => {
  const sources = new Map(BIOACOUSTIC_REFERENCE_SOURCES.map(source => [source.id, source]));

  assert.ok(BIOACOUSTIC_CLASS_CANDIDATES.length >= 3);
  for (const candidate of BIOACOUSTIC_CLASS_CANDIDATES) {
    assert.equal(candidate.status, 'hypothesis-only');
    assert.ok(candidate.limit.length > 20);
    const references = BIOACOUSTIC_REFERENCE_CLIPS.filter(clip => clip.classId === candidate.id);
    assert.ok(references.length > 0, `${candidate.id} must have a reference record`);
    for (const reference of references) {
      assert.match(reference.url, /^https:\/\//);
      const source = sources.get(reference.sourceId);
      assert.ok(source, `${reference.id} must point to a registered source`);
      assert.ok(source.rights.length > 30);
    }
  }
});

test('reference links are not misrepresented as an evaluated classifier corpus', () => {
  assert.equal(BIOACOUSTIC_BENCHMARK_STATUS.recordingsInRuntime, 0);
  assert.equal(BIOACOUSTIC_BENCHMARK_STATUS.evaluatedRecordings, 0);
  assert.equal(BIOACOUSTIC_BENCHMARK_STATUS.precision, null);
  assert.equal(BIOACOUSTIC_BENCHMARK_STATUS.recall, null);
  assert.match(BIOACOUSTIC_BENCHMARK_STATUS.confidenceLimit, /not established/);
});
