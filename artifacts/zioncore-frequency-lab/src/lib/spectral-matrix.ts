export const SPECTRAL_MATRIX_BAND_COUNT = 5;
export const SPECTRAL_MATRIX_MAX_FRAMES = 120;
export const MIN_SPECTRAL_MATRIX_FRAMES = 4;
const variationThreshold = 1e-10;

export type SpectralMatrixStatus =
  | 'sufficient'
  | 'insufficient_frames'
  | 'silent'
  | 'static';

export type SpectralMatrixAnalysis = {
  status: SpectralMatrixStatus;
  frameCount: number;
  bandLabels: string[];
  correlationMatrix: number[][];
  principalDirection: number[];
  principalVarianceShare: number | null;
};

function formatBandEdge(frequencyHz: number): string {
  return frequencyHz >= 1000
    ? `${(frequencyHz / 1000).toFixed(1)} kHz`
    : `${Math.round(frequencyHz)} Hz`;
}

function getBandLabels(sampleRate: number): string[] {
  const nyquistHz = sampleRate / 2;
  return Array.from({ length: SPECTRAL_MATRIX_BAND_COUNT }, (_, bandIndex) => {
    const lowHz = (nyquistHz * bandIndex) / SPECTRAL_MATRIX_BAND_COUNT;
    const highHz = (nyquistHz * (bandIndex + 1)) / SPECTRAL_MATRIX_BAND_COUNT;
    return `${formatBandEdge(lowHz)}–${formatBandEdge(highHz)}`;
  });
}

function zeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function zeroAnalysis(
  status: SpectralMatrixStatus,
  frameCount: number,
  bandLabels: string[],
): SpectralMatrixAnalysis {
  return {
    status,
    frameCount,
    bandLabels,
    correlationMatrix: zeroMatrix(SPECTRAL_MATRIX_BAND_COUNT),
    principalDirection: Array.from({ length: SPECTRAL_MATRIX_BAND_COUNT }, () => 0),
    principalVarianceShare: null,
  };
}

function toRelativeBandProfile(frame: number[]): number[] | null {
  if (frame.length < SPECTRAL_MATRIX_BAND_COUNT) return null;

  const bandIntensities = Array.from({ length: SPECTRAL_MATRIX_BAND_COUNT }, (_, bandIndex) => {
    const start = Math.floor((frame.length * bandIndex) / SPECTRAL_MATRIX_BAND_COUNT);
    const end = Math.max(start + 1, Math.floor((frame.length * (bandIndex + 1)) / SPECTRAL_MATRIX_BAND_COUNT));
    let total = 0;
    let count = 0;

    for (let binIndex = start; binIndex < Math.min(end, frame.length); binIndex += 1) {
      const value = frame[binIndex];
      if (!Number.isFinite(value)) continue;
      const normalized = Math.max(0, Math.min(255, value)) / 255;
      total += normalized * normalized;
      count += 1;
    }

    return count ? total / count : 0;
  });

  const totalIntensity = bandIntensities.reduce((total, value) => total + value, 0);
  if (totalIntensity <= variationThreshold) return bandIntensities.map(() => 0);
  return bandIntensities.map(value => value / totalIntensity);
}

function principalComponent(covariance: number[][]): {
  direction: number[];
  eigenvalue: number;
} | null {
  const size = covariance.length;
  let best: { direction: number[]; eigenvalue: number } | null = null;

  // Multiple deterministic starting vectors avoid a single vector being
  // orthogonal to the leading mode. For this five-band matrix, the extra
  // matrix-vector products are negligible and keep the calculation robust.
  for (let seed = 0; seed < size; seed += 1) {
    let direction: number[] = Array.from({ length: size }, (_, index) => index === seed ? 1 : 0);
    let usable = true;

    for (let iteration = 0; iteration < 64; iteration += 1) {
      const next = covariance.map(row =>
        row.reduce((total, value, index) => total + value * direction[index], 0),
      );
      const norm = Math.sqrt(next.reduce((total, value) => total + value * value, 0));
      if (norm <= variationThreshold || !Number.isFinite(norm)) {
        usable = false;
        break;
      }
      direction = next.map(value => value / norm);
    }

    if (!usable) continue;
    const projected = covariance.map(row =>
      row.reduce((total, value, index) => total + value * direction[index], 0),
    );
    const eigenvalue = direction.reduce(
      (total, value, index) => total + value * projected[index],
      0,
    );
    if (!Number.isFinite(eigenvalue) || eigenvalue <= variationThreshold) continue;

    const firstMeaningful = direction.find(value => Math.abs(value) > variationThreshold) ?? 1;
    if (firstMeaningful < 0) direction = direction.map(value => -value);
    if (!best || eigenvalue > best.eigenvalue) best = { direction, eigenvalue };
  }

  return best;
}

/**
 * Builds a five-band temporal relationship matrix from the locally rendered
 * spectrogram. Each frame is reduced to relative squared display intensity per
 * equal-width Nyquist band. Pearson correlation describes co-variation only;
 * these values are neither calibrated sound power nor source identification.
 */
export function analyzeSpectralMatrix(
  frames: readonly number[][],
  sampleRate: number,
): SpectralMatrixAnalysis {
  const bandLabels = getBandLabels(sampleRate);
  const validFrames = frames
    .slice(-SPECTRAL_MATRIX_MAX_FRAMES)
    .filter(frame => Array.isArray(frame) && frame.length >= SPECTRAL_MATRIX_BAND_COUNT)
    .map(toRelativeBandProfile)
    .filter((profile): profile is number[] => profile !== null);

  if (validFrames.length < MIN_SPECTRAL_MATRIX_FRAMES) {
    return zeroAnalysis('insufficient_frames', validFrames.length, bandLabels);
  }

  const totalProfileEnergy = validFrames.reduce(
    (total, profile) => total + profile.reduce((frameTotal, value) => frameTotal + value, 0),
    0,
  );
  if (totalProfileEnergy <= variationThreshold) {
    return zeroAnalysis('silent', validFrames.length, bandLabels);
  }

  const bandMeans = Array.from({ length: SPECTRAL_MATRIX_BAND_COUNT }, (_, bandIndex) =>
    validFrames.reduce((total, frame) => total + frame[bandIndex], 0) / validFrames.length,
  );
  const covariance = zeroMatrix(SPECTRAL_MATRIX_BAND_COUNT);

  for (let row = 0; row < SPECTRAL_MATRIX_BAND_COUNT; row += 1) {
    for (let column = row; column < SPECTRAL_MATRIX_BAND_COUNT; column += 1) {
      const coVariation = validFrames.reduce(
        (total, frame) =>
          total + (frame[row] - bandMeans[row]) * (frame[column] - bandMeans[column]),
        0,
      ) / Math.max(1, validFrames.length - 1);
      covariance[row][column] = coVariation;
      covariance[column][row] = coVariation;
    }
  }

  const variances = covariance.map((row, index) => Math.max(0, row[index]));
  const correlationMatrix = covariance.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      const denominator = Math.sqrt(variances[rowIndex] * variances[columnIndex]);
      if (denominator <= variationThreshold) return 0;
      const correlation = value / denominator;
      return Math.max(-1, Math.min(1, Number(correlation.toFixed(4))));
    }),
  );
  const covarianceTrace = variances.reduce((total, value) => total + value, 0);

  if (covarianceTrace <= variationThreshold) {
    return {
      ...zeroAnalysis('static', validFrames.length, bandLabels),
      correlationMatrix,
    };
  }

  const leadingComponent = principalComponent(covariance);
  if (!leadingComponent) {
    return {
      ...zeroAnalysis('static', validFrames.length, bandLabels),
      correlationMatrix,
    };
  }

  return {
    status: 'sufficient',
    frameCount: validFrames.length,
    bandLabels,
    correlationMatrix,
    principalDirection: leadingComponent.direction.map(value =>
      Number(Math.max(-1, Math.min(1, value)).toFixed(4)),
    ),
    principalVarianceShare: Number(
      Math.max(0, Math.min(1, leadingComponent.eigenvalue / covarianceTrace)).toFixed(4),
    ),
  };
}
