import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFreeListeningReading, type FreeListeningInput } from './free-listening';

const capture: FreeListeningInput = {
  dominantFrequencyHz: 440, rmsLevel: 0.1, sampleRate: 48000, durationSeconds: 5, silent: false,
  features: {
    spectralCentroidHz: 500, spectralFlatness: 0.1, spectralEntropy: 0.2,
    peakToMedianContrastDb: 20, rolloff85Hz: 1000, harmonicity: 0.8,
    zeroCrossingRate: 0.02, dominantFrequencyStabilityHz: 2,
    dominantFrequencyDriftHz: 1, amplitudeVariationCoefficient: 0.1,
    temporalWindowSeconds: 5,
  },
};
test('free reading derives descriptors from real measurements without provider work', () => {
  const result = buildFreeListeningReading(capture, 'Observe birds', 'environment');
  assert.equal(result.title, 'The Architecture of Harmonic Resonance');
  assert.ok(result.observations.some(line => line.includes('440.0 Hz')));
  assert.match(result.method, /No external AI-provider charge/);
  assert.match(result.interpretation, /Observe birds/);
});
test('quiet captures offer a useful baseline without inventing a source', () => {
  const result = buildFreeListeningReading({ ...capture, silent: true, durationSeconds: 1 }, '', 'animal');
  assert.equal(result.title, 'The Hidden Architecture of Stillness');
  assert.match(result.interpretation, /quiet|baseline|reference/i);
  assert.ok(!/detected (?:bird|species|message)/i.test(result.interpretation));
  assert.equal(result.limitations.length, 4);
  assert.ok(!result.observations.some(line => line.includes('440.0')));
});
test('spiritual and celestial lenses never declare detected entities or energy', () => {
  const result = buildFreeListeningReading(capture, 'Prayer', 'spiritual');
  assert.match(result.interpretation, /SPIRITUAL RESONANCE INTELLIGENCE/);
  assert.match(result.advice, /constructive action/);
  assert.ok(!/detected (?:a )?(?:divine|supernatural|celestial)|confirmed (?:a )?(?:divine|supernatural|celestial)/i.test(result.interpretation));
  assert.match(buildFreeListeningReading(capture, '', 'celestial').interpretation, /sonification/i);
});
test('invalid measurements are rejected and out-of-band peaks excluded', () => {
  assert.throws(() => buildFreeListeningReading({ ...capture, rmsLevel: NaN }, '', 'animal'));
  const result = buildFreeListeningReading({ ...capture, dominantFrequencyHz: 90000 }, '', 'environment');
  assert.ok(!result.observations.some(line => line.includes('90000')));
});
test('optional context stays bounded and readings are deterministic', () => {
  const a = buildFreeListeningReading(capture, 'x'.repeat(400), 'animal');
  assert.ok(!a.interpretation.includes('x'.repeat(301)));
  assert.deepEqual(a, buildFreeListeningReading(capture, 'x'.repeat(400), 'animal'));
});
