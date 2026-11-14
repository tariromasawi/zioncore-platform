import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createResonanceEngineSnapshot,
  type ResonanceEngineInput,
} from './resonance-engine';
import { buildAnalysisPrompt, deriveResonanceProfile } from '@workspace/frequency-ai-contract';
import type { SignalFeatures } from './signal-analysis';
import type { SpectralMatrixAnalysis } from './spectral-matrix';

const harmonicFeatures: SignalFeatures = {
  spectralCentroidHz: 442,
  spectralFlatness: 0.08,
  spectralEntropy: 0.32,
  peakToMedianContrastDb: 18,
  rolloff85Hz: 880,
  harmonicity: 0.74,
  zeroCrossingRate: 0.04,
  dominantFrequencyStabilityHz: 0.3,
  dominantFrequencyDriftHz: 0.1,
  amplitudeVariationCoefficient: 0.1,
  temporalWindowSeconds: 4,
};

const sufficientMatrix: SpectralMatrixAnalysis = {
  status: 'sufficient',
  frameCount: 18,
  bandLabels: ['0–4 kHz', '4–8 kHz', '8–12 kHz', '12–16 kHz', '16–20 kHz'],
  correlationMatrix: Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, column) => row === column ? 1 : 0.5),
  ),
  principalDirection: [0.4, 0.4, 0.4, 0.4, 0.6],
  principalVarianceShare: 0.76,
};

const activeReading = {
  sampleRate: 48_000,
  fftSize: 4096,
  frequencyResolutionHz: 48_000 / 4096,
  dominantFrequencyHz: 440,
  peakFrequenciesHz: [440, 880, 1320],
  rmsLevel: 0.08,
  source: 'microphone' as const,
  features: harmonicFeatures,
  temporalSamples: [
    { timeSeconds: 1, dominantFrequencyHz: 440, rmsLevel: 0.06 },
    { timeSeconds: 2, dominantFrequencyHz: 441, rmsLevel: 0.08 },
    { timeSeconds: 3, dominantFrequencyHz: 440, rmsLevel: 0.07 },
  ],
};

function baseInput(overrides: Partial<ResonanceEngineInput> = {}): ResonanceEngineInput {
  return {
    starting: false,
    running: false,
    silent: false,
    elapsedSeconds: 0,
    reading: null,
    matrix: null,
    interpretationLoading: false,
    hasInterpretation: false,
    ...overrides,
  };
}

test('shows standby without fabricating a source or signal readings', () => {
  const snapshot = createResonanceEngineSnapshot(baseInput());

  assert.equal(snapshot.phase, 'standby');
  assert.equal(snapshot.sourceLabel, 'No source');
  assert.equal(snapshot.dominantFrequencyHz, null);
  assert.equal(snapshot.matrixFrameCount, 0);
  assert.equal(snapshot.textureLabel, 'Awaiting a signal');
  assert.ok(snapshot.trend.length === 0);
});

test('reports a real low-signal state and does not classify it as a source', () => {
  const snapshot = createResonanceEngineSnapshot(baseInput({
    running: true,
    silent: true,
    reading: { ...activeReading, dominantFrequencyHz: null, peakFrequenciesHz: [] },
  }));

  assert.equal(snapshot.phase, 'low_signal');
  assert.equal(snapshot.textureLabel, 'Low or unresolved input');
  assert.match(snapshot.stages[1].detail, /silence threshold/);
});

test('combines spectral texture, temporal stability, and band-matrix state', () => {
  const snapshot = createResonanceEngineSnapshot(baseInput({
    elapsedSeconds: 5,
    reading: activeReading,
    matrix: sufficientMatrix,
  }));

  assert.equal(snapshot.phase, 'ready');
  assert.equal(snapshot.textureLabel, 'Harmonic-focused texture');
  assert.equal(snapshot.temporalLabel, 'Peak is steady in this window');
  assert.equal(snapshot.matrixLabel, 'One dominant band-change pattern');
  assert.equal(snapshot.matrixFrameCount, 18);
  assert.equal(snapshot.stages[3].state, 'ready');
  assert.deepEqual(snapshot.trend.map(point => point.dominantFrequencyHz), [440, 441, 440]);
});

test('prioritizes live operation and completed interpretation states', () => {
  const interpreting = createResonanceEngineSnapshot(baseInput({
    elapsedSeconds: 5,
    reading: activeReading,
    matrix: sufficientMatrix,
    interpretationLoading: true,
  }));
  const complete = createResonanceEngineSnapshot(baseInput({
    elapsedSeconds: 5,
    reading: activeReading,
    matrix: sufficientMatrix,
    hasInterpretation: true,
  }));

  assert.equal(interpreting.phase, 'interpreting');
  assert.equal(interpreting.stages[3].state, 'active');
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.stages[3].state, 'complete');
});

test('surfaces capture and interpretation errors as monitor attention states', () => {
  const captureError = createResonanceEngineSnapshot(baseInput({
    captureError: 'Microphone permission was denied.',
  }));
  const interpretationError = createResonanceEngineSnapshot(baseInput({
    elapsedSeconds: 5,
    reading: activeReading,
    interpretationError: 'Provider unavailable.',
  }));

  assert.equal(captureError.phase, 'error');
  assert.equal(captureError.stages[0].state, 'error');
  assert.equal(interpretationError.phase, 'error');
  assert.equal(interpretationError.stages[3].state, 'error');
});

test('handles malformed optional measurements without emitting NaN monitor values', () => {
  const features = {
    ...harmonicFeatures,
    spectralFlatness: Number.NaN,
    spectralEntropy: Number.POSITIVE_INFINITY,
    harmonicity: Number.NaN,
    dominantFrequencyStabilityHz: Number.NaN,
    dominantFrequencyDriftHz: Number.NaN,
  };
  const snapshot = createResonanceEngineSnapshot(baseInput({
    elapsedSeconds: 4,
    reading: {
      ...activeReading,
      frequencyResolutionHz: Number.NaN,
      dominantFrequencyHz: 440,
      features,
      temporalSamples: [
        { timeSeconds: Number.NaN, dominantFrequencyHz: Number.NaN, rmsLevel: Number.NaN },
      ],
    },
    matrix: { ...sufficientMatrix, principalVarianceShare: Number.NaN },
  }));

  assert.equal(snapshot.frequencyResolutionHz, null);
  assert.equal(snapshot.dominantFrequencyHz, 440);
  assert.equal(snapshot.textureLabel, 'Texture not resolved');
  assert.equal(snapshot.matrixVarianceShare, null);
  assert.ok(snapshot.trend.every(point =>
    Number.isFinite(point.timeSeconds)
    && Number.isFinite(point.rmsLevel)
    && (point.dominantFrequencyHz == null || Number.isFinite(point.dominantFrequencyHz)),
  ));
});

test('uses the same versioned resonance profile in the AI interpretation prompt', () => {
  const measurement = {
    captureSource: 'microphone' as const,
    sampleRate: activeReading.sampleRate,
    fftSize: activeReading.fftSize,
    frequencyResolutionHz: activeReading.frequencyResolutionHz,
    dominantFrequencyHz: activeReading.dominantFrequencyHz,
    topPeaksHz: activeReading.peakFrequenciesHz,
    rmsLevel: activeReading.rmsLevel,
    durationSeconds: 5,
    signalFeatures: harmonicFeatures,
    spectralMatrixAnalysis: sufficientMatrix,
  };
  const profile = deriveResonanceProfile(measurement);
  const prompt = buildAnalysisPrompt(measurement, false);

  assert.equal(profile.version, 'zcrp-1');
  assert.match(prompt, /Deterministic ZionCore resonance profile \(zcrp-1\)/);
  assert.ok(prompt.includes(profile.texture.label));
  assert.ok(prompt.includes(profile.matrix.detail));
  assert.ok(prompt.includes(profile.boundary));
});

test('shared profile remains descriptive when optional features are malformed', () => {
  const profile = deriveResonanceProfile({
    durationSeconds: Number.NaN,
    frequencyResolutionHz: Number.NaN,
    dominantFrequencyHz: 440,
    signalFeatures: {
      ...harmonicFeatures,
      spectralFlatness: Number.NaN,
      spectralEntropy: Number.POSITIVE_INFINITY,
      harmonicity: Number.NaN,
      dominantFrequencyStabilityHz: Number.NaN,
      dominantFrequencyDriftHz: Number.NaN,
    },
    spectralMatrixAnalysis: { ...sufficientMatrix, principalVarianceShare: Number.NaN },
  });

  assert.equal(profile.texture.label, 'Texture not resolved');
  assert.equal(profile.temporal.label, 'Window building');
  assert.equal(profile.matrix.varianceShare, null);
  assert.ok(!JSON.stringify(profile).includes('NaN'));
});
