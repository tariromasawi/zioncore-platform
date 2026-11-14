import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analysisMeasurementSchema,
  buildAnalysisPrompt,
} from './index';

const baseMeasurement = {
  captureSource: 'microphone' as const,
  sampleRate: 48_000,
  fftSize: 4096 as const,
  frequencyResolutionHz: 48_000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
};

test('accepts a valid base measurement when optional derived analysis is unavailable', () => {
  assert.deepEqual(
    analysisMeasurementSchema.parse(baseMeasurement),
    baseMeasurement,
  );

  const prompt = buildAnalysisPrompt(baseMeasurement, false, '');
  assert.match(prompt, /No derived signalFeatures were supplied/);
  assert.match(prompt, /No spectralMatrixAnalysis was supplied/);
  assert.doesNotMatch(prompt, /Deterministic ZionCore resonance profile/);
});

test('still validates the range of optional derived features when they are supplied', () => {
  const result = analysisMeasurementSchema.safeParse({
    ...baseMeasurement,
    signalFeatures: {
      spectralCentroidHz: 620,
      spectralFlatness: 0.12,
      spectralEntropy: 0.34,
      peakToMedianContrastDb: 28.4,
      rolloff85Hz: 1_800,
      harmonicity: 0.81,
      zeroCrossingRate: 0.018,
      dominantFrequencyStabilityHz: 1.4,
      dominantFrequencyDriftHz: 2.1,
      amplitudeVariationCoefficient: 0.08,
      temporalWindowSeconds: 5,
    },
  });
  assert.equal(result.success, true);

  const invalid = analysisMeasurementSchema.safeParse({
    ...baseMeasurement,
    signalFeatures: {
      spectralCentroidHz: 25_000,
      spectralFlatness: 0.12,
      spectralEntropy: 0.34,
      peakToMedianContrastDb: 28.4,
      rolloff85Hz: 1_800,
      harmonicity: 0.81,
      zeroCrossingRate: 0.018,
      dominantFrequencyStabilityHz: 1.4,
      dominantFrequencyDriftHz: 2.1,
      amplitudeVariationCoefficient: 0.08,
      temporalWindowSeconds: 5,
    },
  });
  assert.equal(invalid.success, false);
});
