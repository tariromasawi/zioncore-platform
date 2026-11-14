import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeSignalFrame,
  downsampleSpectrum,
  type TemporalSample,
} from './signal-analysis';

test('extracts spectral shape and harmonic peaks from measured bins', () => {
  const fftSize = 4096;
  const sampleRate = 48000;
  const bins = new Uint8Array(fftSize / 2);
  bins[37] = 80;
  bins[38] = 220;
  bins[39] = 80;
  bins[75] = 25;
  bins[76] = 110;
  bins[77] = 25;
  bins[113] = 12;
  bins[114] = 60;
  bins[115] = 12;
  const samples = Float32Array.from(
    { length: fftSize },
    (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.2,
  );
  const result = analyzeSignalFrame(bins, samples, sampleRate, fftSize, [], 1);

  assert.equal(result.silent, false);
  assert.equal(result.dominantFrequencyHz, (38 * sampleRate) / fftSize);
  assert.equal(result.peakFrequenciesHz.length, 3);
  assert.ok(result.features.spectralCentroidHz! > 0);
  assert.ok(result.features.spectralEntropy >= 0 && result.features.spectralEntropy <= 1);
  assert.ok(result.features.harmonicity > 0.5);
  assert.ok(result.features.zeroCrossingRate > 0.01);
});

test('computes frequency stability, drift, and amplitude variation over time', () => {
  const history: TemporalSample[] = [
    { timeSeconds: 1, dominantFrequencyHz: 440, rmsLevel: 0.1 },
    { timeSeconds: 2, dominantFrequencyHz: 442, rmsLevel: 0.12 },
    { timeSeconds: 3, dominantFrequencyHz: 444, rmsLevel: 0.11 },
  ];
  const result = analyzeSignalFrame(
    new Uint8Array(1024),
    new Float32Array(2048),
    48000,
    2048,
    history,
    3,
  );

  assert.equal(result.features.dominantFrequencyDriftHz, 4);
  assert.ok(result.features.dominantFrequencyStabilityHz! > 0);
  assert.ok(result.features.amplitudeVariationCoefficient! > 0);
  assert.equal(result.features.temporalWindowSeconds, 2);
});

test('reports silence without inventing a dominant frequency', () => {
  const result = analyzeSignalFrame(
    new Uint8Array(1024),
    new Float32Array(2048),
    48000,
    2048,
    [],
    0,
  );

  assert.equal(result.silent, true);
  assert.equal(result.dominantFrequencyHz, null);
  assert.deepEqual(result.peakFrequenciesHz, []);
  assert.equal(result.features.spectralCentroidHz, null);
  assert.equal(result.features.peakToMedianContrastDb, null);
});

test('estimates relative peak-to-median spectral contrast without claiming calibrated SPL', () => {
  const bins = new Uint8Array(1024).fill(8);
  bins[49] = 80;
  bins[50] = 200;
  bins[51] = 80;
  const samples = Float32Array.from(
    { length: 2048 },
    (_, index) => Math.sin((2 * Math.PI * 440 * index) / 48000) * 0.2,
  );
  const result = analyzeSignalFrame(bins, samples, 48000, 2048, [], 1);

  assert.ok(result.features.peakToMedianContrastDb != null);
  assert.ok(Math.abs(result.features.peakToMedianContrastDb - 20 * Math.log10(200 / 8)) < 0.2);

  const liveDbfs = analyzeSignalFrame(bins, samples, 48000, 2048, [], 1, 'dbfs-byte');
  assert.ok(liveDbfs.features.peakToMedianContrastDb != null);
  assert.ok(Math.abs(liveDbfs.features.peakToMedianContrastDb - ((200 - 8) / 255) * 80) < 0.2);
});

test('downsamples a spectrum using bounded peak-preserving buckets', () => {
  const bins = new Uint8Array(256);
  bins[7] = 240;
  bins[255] = 255;
  const reduced = downsampleSpectrum(bins, 32);

  assert.equal(reduced.length, 32);
  assert.equal(reduced[0], 240);
  assert.equal(reduced[31], 255);
  assert.deepEqual(downsampleSpectrum(new Uint8Array(), 4), []);
  assert.throws(() => downsampleSpectrum(bins, 513), RangeError);
});

test('keeps signal features finite and bounded across supported FFT sizes', () => {
  let state = 0x5f3759df;
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };

  for (const [fftSize, sampleRate] of [
    [2048, 44100],
    [4096, 48000],
    [8192, 96000],
  ] as const) {
    const bins = Uint8Array.from(
      { length: fftSize / 2 },
      () => Math.floor(random() * 256),
    );
    const timeDomain = Float32Array.from(
      { length: fftSize },
      (_, index) => Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.1 +
        (random() - 0.5) * 0.02,
    );
    const history: TemporalSample[] = Array.from({ length: 6 }, (_, index) => ({
      timeSeconds: index,
      dominantFrequencyHz: 438 + index * 0.5,
      rmsLevel: 0.08 + random() * 0.04,
    }));

    const result = analyzeSignalFrame(
      bins,
      timeDomain,
      sampleRate,
      fftSize,
      history,
      5,
    );

    assert.ok(Number.isFinite(result.rmsLevel));
    assert.ok(Number.isFinite(result.features.spectralFlatness));
    assert.ok(result.features.spectralFlatness >= 0 && result.features.spectralFlatness <= 1);
    assert.ok(Number.isFinite(result.features.spectralEntropy));
    assert.ok(result.features.spectralEntropy >= 0 && result.features.spectralEntropy <= 1);
    assert.ok(Number.isFinite(result.features.harmonicity));
    assert.ok(result.features.harmonicity >= 0 && result.features.harmonicity <= 1);
    assert.ok(Number.isFinite(result.features.zeroCrossingRate));
    assert.ok(result.peakFrequenciesHz.every(frequency =>
      Number.isFinite(frequency) && frequency >= 0 && frequency <= sampleRate / 2,
    ));
  }
});
