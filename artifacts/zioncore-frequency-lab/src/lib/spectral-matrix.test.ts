import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeSpectralMatrix } from './spectral-matrix';

function spectrumFromBandPowers(powers: number[]): number[] {
  return Array.from({ length: 125 }, (_, binIndex) => {
    const bandIndex = Math.min(4, Math.floor(binIndex / 25));
    return Math.sqrt(Math.max(0, powers[bandIndex])) * 50;
  });
}

test('computes a symmetric five-band Pearson matrix and principal covariance mode', () => {
  const frames = Array.from({ length: 12 }, (_, index) => {
    const rising = index + 1;
    return spectrumFromBandPowers([rising, rising, 14 - rising, 2, 2]);
  });

  const analysis = analyzeSpectralMatrix(frames, 48_000);

  assert.equal(analysis.status, 'sufficient');
  assert.equal(analysis.frameCount, 12);
  assert.equal(analysis.bandLabels.length, 5);
  assert.ok(Math.abs(analysis.correlationMatrix[0][0] - 1) < 1e-4);
  assert.ok(Math.abs(analysis.correlationMatrix[0][1] - 1) < 1e-4);
  assert.ok(analysis.correlationMatrix[0][2] < 0);
  assert.ok(Math.abs(analysis.correlationMatrix[0][2] - analysis.correlationMatrix[2][0]) < 1e-4);
  assert.ok(analysis.principalVarianceShare != null);
  assert.ok(analysis.principalVarianceShare > 0 && analysis.principalVarianceShare <= 1);
  assert.ok(Math.abs(Math.sqrt(analysis.principalDirection.reduce(
    (total, value) => total + value * value,
    0,
  )) - 1) < 1e-3);
});

test('reports insufficient, silent, and static windows without inventing correlations', () => {
  const short = analyzeSpectralMatrix(
    Array.from({ length: 3 }, () => spectrumFromBandPowers([1, 2, 3, 4, 5])),
    48_000,
  );
  assert.equal(short.status, 'insufficient_frames');
  assert.equal(short.principalVarianceShare, null);

  const silent = analyzeSpectralMatrix(
    Array.from({ length: 6 }, () => Array.from({ length: 125 }, () => 0)),
    48_000,
  );
  assert.equal(silent.status, 'silent');
  assert.ok(silent.correlationMatrix.flat().every(value => value === 0));

  const steady = analyzeSpectralMatrix(
    Array.from({ length: 6 }, () => spectrumFromBandPowers([2, 1, 5, 3, 4])),
    48_000,
  );
  assert.equal(steady.status, 'static');
  assert.equal(steady.principalVarianceShare, null);
});

test('limits temporal work to the newest 120 frames and ignores malformed rows', () => {
  const validFrame = spectrumFromBandPowers([1, 2, 3, 4, 5]);
  const frames = [
    ...Array.from({ length: 120 }, (_, index) => spectrumFromBandPowers([
      index + 1,
      index + 2,
      index + 3,
      index + 4,
      index + 5,
    ])),
    [1, Number.NaN],
    validFrame,
  ];

  const analysis = analyzeSpectralMatrix(frames, 48_000);
  assert.equal(analysis.frameCount, 119);
  assert.equal(analysis.status, 'sufficient');
});
