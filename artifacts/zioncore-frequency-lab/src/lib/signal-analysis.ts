export type TemporalSample = {
  timeSeconds: number;
  dominantFrequencyHz: number | null;
  rmsLevel: number;
};

export type SignalFeatures = {
  spectralCentroidHz: number | null;
  spectralFlatness: number;
  spectralEntropy: number;
  peakToMedianContrastDb: number | null;
  rolloff85Hz: number | null;
  harmonicity: number;
  zeroCrossingRate: number;
  dominantFrequencyStabilityHz: number | null;
  dominantFrequencyDriftHz: number | null;
  amplitudeVariationCoefficient: number | null;
  temporalWindowSeconds: number;
};

export type SignalFrameAnalysis = {
  dominantFrequencyHz: number | null;
  peakFrequenciesHz: number[];
  rmsLevel: number;
  silent: boolean;
  features: SignalFeatures;
};

export function downsampleSpectrum(
  bins: ArrayLike<number>,
  targetBins = 128,
): number[] {
  if (!Number.isSafeInteger(targetBins) || targetBins < 1 || targetBins > 512) {
    throw new RangeError('Spectrum display width must be between 1 and 512 bins.');
  }
  if (!Number.isSafeInteger(bins.length) || bins.length < 0) {
    throw new TypeError('Spectrum bins must have a valid length.');
  }
  if (bins.length === 0) return [];

  return Array.from({ length: Math.min(targetBins, bins.length) }, (_, index) => {
    const start = Math.floor((index * bins.length) / Math.min(targetBins, bins.length));
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) * bins.length) / Math.min(targetBins, bins.length)),
    );
    let maximum = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      const value = Number(bins[sourceIndex]);
      if (Number.isFinite(value)) maximum = Math.max(maximum, value);
    }
    return Math.max(0, Math.min(255, Math.round(maximum)));
  });
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const mean = average(values);
  return Math.sqrt(average(values.map(value => (value - mean) ** 2)));
}

function temporalProfile(samples: TemporalSample[], nowSeconds: number) {
  const recent = samples.filter(sample => sample.timeSeconds >= nowSeconds - 5);
  const frequencies = recent
    .filter((sample): sample is TemporalSample & { dominantFrequencyHz: number } =>
      sample.dominantFrequencyHz != null,
    );
  const amplitudes = recent.map(sample => sample.rmsLevel).filter(Number.isFinite);
  const frequencyValues = frequencies.map(sample => sample.dominantFrequencyHz);
  const frequencySpread = standardDeviation(frequencyValues);
  const amplitudeSpread = standardDeviation(amplitudes);
  const amplitudeMean = average(amplitudes);
  const duration = recent.length > 1
    ? recent[recent.length - 1].timeSeconds - recent[0].timeSeconds
    : 0;

  return {
    dominantFrequencyStabilityHz: frequencySpread,
    dominantFrequencyDriftHz: frequencyValues.length > 1
      ? frequencyValues[frequencyValues.length - 1] - frequencyValues[0]
      : null,
    amplitudeVariationCoefficient: amplitudeSpread == null || amplitudeMean <= 0
      ? null
      : amplitudeSpread / amplitudeMean,
    temporalWindowSeconds: Math.max(0, duration),
  };
}

export function analyzeSignalFrame(
  bins: ArrayLike<number>,
  timeDomain: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  temporalSamples: TemporalSample[],
  nowSeconds: number,
  spectrumEncoding: 'relative-magnitude' | 'dbfs-byte' = 'relative-magnitude',
): SignalFrameAnalysis {
  const binWidth = sampleRate / fftSize;
  const lastBin = Math.max(1, bins.length - 1);
  const powers: number[] = [];
  const spectrumMagnitudes: number[] = [];
  const peaks: { frequencyHz: number; magnitude: number; bin: number }[] = [];
  let powerTotal = 0;
  let weightedFrequencyTotal = 0;
  let strongestMagnitude = 0;
  let strongestBin = 0;

  for (let bin = 1; bin < lastBin; bin += 1) {
    const magnitude = Math.max(0, Math.min(255, Number(bins[bin]))) / 255;
    spectrumMagnitudes.push(magnitude);
    const power = magnitude * magnitude;
    powers.push(power);
    powerTotal += power;
    weightedFrequencyTotal += bin * binWidth * power;

    if (magnitude * 255 > strongestMagnitude) {
      strongestMagnitude = magnitude * 255;
      strongestBin = bin;
    }
    if (
      Number(bins[bin]) > Number(bins[bin - 1]) &&
      Number(bins[bin]) >= Number(bins[bin + 1]) &&
      Number(bins[bin]) > 32
    ) {
      peaks.push({
        frequencyHz: bin * binWidth,
        magnitude: Number(bins[bin]),
        bin,
      });
    }
  }

  let squaredSamples = 0;
  let zeroCrossings = 0;
  for (let index = 0; index < timeDomain.length; index += 1) {
    const sample = Number(timeDomain[index]) || 0;
    squaredSamples += sample * sample;
    if (index > 0) {
      const previous = Number(timeDomain[index - 1]) || 0;
      if ((previous <= 0 && sample > 0) || (previous >= 0 && sample < 0)) {
        zeroCrossings += 1;
      }
    }
  }
  const rmsLevel = timeDomain.length ? Math.sqrt(squaredSamples / timeDomain.length) : 0;
  const silent = rmsLevel < 0.0008 || strongestMagnitude < 4 || powerTotal <= 0;
  const dominantFrequencyHz = silent ? null : strongestBin * binWidth;

  peaks.sort((left, right) => right.magnitude - left.magnitude);
  const topPeaks = peaks.slice(0, 6);
  const totalPeakMagnitude = topPeaks.reduce((sum, peak) => sum + peak.magnitude, 0);
  let harmonicMagnitude = 0;
  if (dominantFrequencyHz != null && totalPeakMagnitude > 0) {
    for (let harmonic = 1; harmonic <= 8; harmonic += 1) {
      const expectedBin = strongestBin * harmonic;
      const candidate = topPeaks.find(peak =>
        Math.abs(peak.bin - expectedBin) <= Math.max(1, Math.round(strongestBin * 0.02)),
      );
      if (candidate) harmonicMagnitude += candidate.magnitude;
    }
  }

  const meanPower = powers.length ? powerTotal / powers.length : 0;
  const sortedMagnitudes = [...spectrumMagnitudes].sort((left, right) => left - right);
  const medianMagnitude = sortedMagnitudes.length
    ? sortedMagnitudes[Math.floor(sortedMagnitudes.length / 2)]
    : 0;
  const peakToMedianContrastDb = !silent && medianMagnitude > 0
    ? Math.max(0, Math.min(
      120,
      spectrumEncoding === 'dbfs-byte'
        ? ((strongestMagnitude - medianMagnitude * 255) / 255) * 80
        : 20 * Math.log10((strongestMagnitude / 255) / medianMagnitude),
    ))
    : null;
  const geometricMeanPower = powers.length
    ? Math.exp(average(powers.map(power => Math.log(Math.max(power, 1e-12)))))
    : 0;
  const entropy = powerTotal > 0
    ? -powers.reduce((sum, power) => {
        if (power <= 0) return sum;
        const probability = power / powerTotal;
        return sum + probability * Math.log(probability);
      }, 0) / Math.log(Math.max(2, powers.length))
    : 0;

  let cumulativePower = 0;
  let rolloff85Hz: number | null = null;
  for (let index = 0; index < powers.length; index += 1) {
    cumulativePower += powers[index];
    if (cumulativePower >= powerTotal * 0.85) {
      rolloff85Hz = (index + 1) * binWidth;
      break;
    }
  }

  return {
    dominantFrequencyHz,
    peakFrequenciesHz: silent ? [] : topPeaks.map(peak => peak.frequencyHz),
    rmsLevel,
    silent,
    features: {
      spectralCentroidHz: !silent && powerTotal > 0
        ? weightedFrequencyTotal / powerTotal
        : null,
      spectralFlatness: meanPower > 0 ? Math.min(1, geometricMeanPower / meanPower) : 0,
      spectralEntropy: Math.max(0, Math.min(1, entropy)),
      peakToMedianContrastDb,
      rolloff85Hz: silent ? null : rolloff85Hz,
      harmonicity: totalPeakMagnitude > 0
        ? Math.min(1, harmonicMagnitude / totalPeakMagnitude)
        : 0,
      zeroCrossingRate: timeDomain.length > 1
        ? zeroCrossings / (timeDomain.length - 1)
        : 0,
      ...temporalProfile(temporalSamples, nowSeconds),
    },
  };
}
