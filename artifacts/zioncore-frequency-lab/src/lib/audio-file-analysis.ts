import {
  analyzeSignalFrame,
  downsampleSpectrum,
  type SignalFeatures,
  type TemporalSample,
} from './signal-analysis';
import { MAX_ANALYSIS_SAMPLE_RATE_HZ } from './audio-capture-capabilities';

export const MAX_AUDIO_FILE_BYTES = 24 * 1024 * 1024;
export const MIN_AUDIO_DURATION_SECONDS = 3;
export const MAX_AUDIO_DURATION_SECONDS = 10 * 60;
const maximumDecodedSampleCount = 16_000_000;
const maximumAnalysisFrames = 256;
const maximumTemporalSamples = 150;
const standardAudioSampleRateCeilingHz = 48_000;

export type SupportedFftSize = 2048 | 4096 | 8192;

export type ImportedAudioAnalysis = {
  sampleRate: number;
  fftSize: SupportedFftSize;
  resolution: number;
  dominant: number | null;
  peaks: number[];
  rms: number;
  bins: number[];
  spectrogram: number[][];
  temporalSamples: TemporalSample[];
  features: SignalFeatures;
  durationSeconds: number;
  analyzedFrames: number;
};

export class AudioFileAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioFileAnalysisError';
  }
}

export function readWavSampleRate(data: ArrayBuffer): number | null {
  if (data.byteLength < 12) return null;
  const view = new DataView(data);
  const readTag = (offset: number) => String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
  if (readTag(0) !== 'RIFF' || readTag(8) !== 'WAVE') return null;

  let offset = 12;
  while (offset + 8 <= data.byteLength) {
    const chunkId = readTag(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;
    if (chunkSize > data.byteLength - chunkDataOffset) return null;
    if (chunkId === 'fmt ') {
      if (chunkSize < 16) return null;
      return view.getUint32(chunkDataOffset + 4, true);
    }
    const nextOffset = chunkDataOffset + chunkSize + (chunkSize % 2);
    if (nextOffset <= offset) return null;
    offset = nextOffset;
  }
  return null;
}

export function readWavAnalysisMetadata(data: ArrayBuffer): {
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  decodedSampleCount: number;
} | null {
  if (data.byteLength < 12) return null;
  const view = new DataView(data);
  const tag = (offset: number) => String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

  let format: { sampleRate: number; channels: number; blockAlign: number } | null = null;
  let sampleBytes: number | null = null;
  for (let offset = 12; offset + 8 <= data.byteLength;) {
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkSize > data.byteLength - chunkStart) return null;
    const chunkTag = tag(offset);
    if (chunkTag === 'fmt ' && chunkSize >= 16) {
      format = {
        channels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        blockAlign: view.getUint16(chunkStart + 12, true),
      };
    } else if (chunkTag === 'data') {
      sampleBytes = chunkSize;
    }
    const next = chunkStart + chunkSize + (chunkSize % 2);
    if (next <= offset) return null;
    offset = next;
  }
  if (!format || !sampleBytes || !format.blockAlign || sampleBytes % format.blockAlign !== 0) return null;
  const frames = sampleBytes / format.blockAlign;
  return {
    sampleRate: format.sampleRate,
    channels: format.channels,
    durationSeconds: frames / format.sampleRate,
    decodedSampleCount: frames * format.channels,
  };
}

function isSupportedFftSize(value: number): value is SupportedFftSize {
  return value === 2048 || value === 4096 || value === 8192;
}

function createAudioAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Audio import was cancelled.', 'AbortError');
  }
  const error = new Error('Audio import was cancelled.');
  error.name = 'AbortError';
  return error;
}

async function decodeAudioDataAbortably(
  context: AudioContext,
  data: ArrayBuffer,
  signal?: AbortSignal,
): Promise<AudioBuffer> {
  if (!signal) return context.decodeAudioData(data);
  if (signal.aborted) throw createAudioAbortError();

  let rejectOnAbort: ((reason: Error) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = reject;
  });
  const onAbort = () => rejectOnAbort?.(createAudioAbortError());
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    if (signal.aborted) throw createAudioAbortError();
    // AudioContext cannot cancel decodeAudioData directly. Racing the signal
    // lets the caller stop waiting promptly; analyzeAudioFile closes the
    // decoder context in its finally block to release browser resources.
    return await Promise.race([context.decodeAudioData(data), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function magnitudeBins(samples: Float32Array, fftSize: SupportedFftSize): Uint8Array {
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);

  for (let index = 0; index < fftSize; index += 1) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (fftSize - 1));
    real[index] = (Number.isFinite(samples[index]) ? samples[index] : 0) * hann;
  }

  for (let index = 1, reversed = 0; index < fftSize; index += 1) {
    let bit = fftSize >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }

  for (let length = 2; length <= fftSize; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    const halfLength = length >> 1;

    for (let start = 0; start < fftSize; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < halfLength; offset += 1) {
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfLength;
        const oddReal = real[oddIndex] * twiddleReal - imaginary[oddIndex] * twiddleImaginary;
        const oddImaginary = real[oddIndex] * twiddleImaginary + imaginary[oddIndex] * twiddleReal;

        real[oddIndex] = real[evenIndex] - oddReal;
        imaginary[oddIndex] = imaginary[evenIndex] - oddImaginary;
        real[evenIndex] += oddReal;
        imaginary[evenIndex] += oddImaginary;

        const nextTwiddleReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextTwiddleReal;
      }
    }
  }

  const magnitudes = new Float64Array(fftSize / 2);
  let maximumMagnitude = 0;
  for (let bin = 0; bin < magnitudes.length; bin += 1) {
    const magnitude = Math.hypot(real[bin], imaginary[bin]);
    magnitudes[bin] = magnitude;
    maximumMagnitude = Math.max(maximumMagnitude, magnitude);
  }

  const bins = new Uint8Array(magnitudes.length);
  if (maximumMagnitude > 0) {
    for (let bin = 0; bin < bins.length; bin += 1) {
      bins[bin] = Math.round((magnitudes[bin] / maximumMagnitude) * 255);
    }
  }
  return bins;
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function meanPresent(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null && Number.isFinite(value));
  return present.length ? mean(present) : null;
}

function preserveTimelineCoverage(samples: TemporalSample[]): TemporalSample[] {
  if (samples.length <= maximumTemporalSamples) return samples;

  const selected: TemporalSample[] = [];
  const lastIndex = samples.length - 1;
  for (let slot = 0; slot < maximumTemporalSamples; slot += 1) {
    const index = Math.round((slot * lastIndex) / (maximumTemporalSamples - 1));
    const sample = samples[index];
    if (sample) selected.push(sample);
  }
  return selected;
}

export function analyzeAudioChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  fftSize: number,
): ImportedAudioAnalysis {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new AudioFileAnalysisError('This recording has an unsupported sample rate.');
  }
  if (!isSupportedFftSize(fftSize)) {
    throw new AudioFileAnalysisError('Choose a supported FFT size before analyzing the recording.');
  }
  if (!channels.length || channels.length > 8) {
    throw new AudioFileAnalysisError('This recording has an unsupported number of audio channels.');
  }

  const sampleCount = channels[0]?.length ?? 0;
  if (!sampleCount || channels.some(channel => channel.length !== sampleCount)) {
    throw new AudioFileAnalysisError('The audio file contains an invalid or empty channel.');
  }
  const durationSeconds = sampleCount / sampleRate;
  if (durationSeconds < MIN_AUDIO_DURATION_SECONDS) {
    throw new AudioFileAnalysisError(`Choose a recording at least ${MIN_AUDIO_DURATION_SECONDS} seconds long for a useful temporal reading.`);
  }
  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw new AudioFileAnalysisError(`Recordings must be ${MAX_AUDIO_DURATION_SECONDS} seconds or shorter.`);
  }
  if (sampleCount * channels.length > maximumDecodedSampleCount) {
    throw new AudioFileAnalysisError(
      'This recording exceeds the safe local analysis memory limit. Use a shorter recording or a lower-channel-count source file.',
    );
  }

  const mono = new Float32Array(sampleCount);
  const channelScale = 1 / channels.length;
  for (const channel of channels) {
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = Number.isFinite(channel[index]) ? channel[index] : 0;
      mono[index] += Math.max(-1, Math.min(1, sample)) * channelScale;
    }
  }

  const lastStart = sampleCount - fftSize;
  const adaptiveHop = Math.ceil(lastStart / (maximumAnalysisFrames - 1));
  const hopSize = Math.max(fftSize >> 1, adaptiveHop);
  const frameStarts: number[] = [];
  for (let start = 0; start <= lastStart; start += hopSize) {
    frameStarts.push(start);
  }
  if (lastStart - frameStarts[frameStarts.length - 1] > hopSize / 2) {
    frameStarts.push(lastStart);
  }

  const temporalSamples: TemporalSample[] = [];
  const spectrogram: number[][] = [];
  const frameAnalyses = [];
  const accumulatedBins = new Float64Array(fftSize / 2);

  for (const start of frameStarts) {
    const frame = mono.subarray(start, start + fftSize);
    const bins = magnitudeBins(frame, fftSize);
    spectrogram.push(downsampleSpectrum(bins));
    const timeSeconds = start / sampleRate;
    const analysis = analyzeSignalFrame(
      bins,
      frame,
      sampleRate,
      fftSize,
      temporalSamples,
      timeSeconds,
    );
    frameAnalyses.push(analysis);
    temporalSamples.push({
      timeSeconds,
      dominantFrequencyHz: analysis.dominantFrequencyHz,
      rmsLevel: analysis.rmsLevel,
    });
    for (let bin = 0; bin < bins.length; bin += 1) {
      accumulatedBins[bin] += bins[bin] / frameStarts.length;
    }
  }

  const averageBins = Uint8Array.from(accumulatedBins, value => Math.round(value));
  const aggregate = analyzeSignalFrame(
    averageBins,
    mono.subarray(0, fftSize),
    sampleRate,
    fftSize,
    temporalSamples,
    durationSeconds,
  );
  const squaredTotal = mono.reduce((total, sample) => total + sample * sample, 0);
  const rms = Math.sqrt(squaredTotal / mono.length);
  const features: SignalFeatures = {
    spectralCentroidHz: meanPresent(frameAnalyses.map(frame => frame.features.spectralCentroidHz)),
    spectralFlatness: mean(frameAnalyses.map(frame => frame.features.spectralFlatness)),
    spectralEntropy: mean(frameAnalyses.map(frame => frame.features.spectralEntropy)),
    peakToMedianContrastDb: meanPresent(frameAnalyses.map(frame => frame.features.peakToMedianContrastDb)),
    rolloff85Hz: meanPresent(frameAnalyses.map(frame => frame.features.rolloff85Hz)),
    harmonicity: mean(frameAnalyses.map(frame => frame.features.harmonicity)),
    zeroCrossingRate: mean(frameAnalyses.map(frame => frame.features.zeroCrossingRate)),
    dominantFrequencyStabilityHz: aggregate.features.dominantFrequencyStabilityHz,
    dominantFrequencyDriftHz: aggregate.features.dominantFrequencyDriftHz,
    amplitudeVariationCoefficient: aggregate.features.amplitudeVariationCoefficient,
    temporalWindowSeconds: aggregate.features.temporalWindowSeconds,
  };

  return {
    sampleRate,
    fftSize,
    resolution: sampleRate / fftSize,
    dominant: aggregate.dominantFrequencyHz,
    peaks: aggregate.peakFrequenciesHz,
    rms,
    bins: Array.from(averageBins),
    spectrogram,
    temporalSamples: preserveTimelineCoverage(temporalSamples),
    features,
    durationSeconds,
    analyzedFrames: frameStarts.length,
  };
}

export async function analyzeAudioFile(
  file: File,
  fftSize: SupportedFftSize,
  signal?: AbortSignal,
): Promise<ImportedAudioAnalysis> {
  signal?.throwIfAborted();
  if (file.size === 0) {
    throw new AudioFileAnalysisError('The selected audio file is empty.');
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    throw new AudioFileAnalysisError('Choose an audio file no larger than 24 MB.');
  }
  if (typeof AudioContext === 'undefined') {
    throw new AudioFileAnalysisError('This browser does not support local audio-file analysis.');
  }

  let context: AudioContext | null = null;
  try {
    const fileData = await file.arrayBuffer();
    const sourceSampleRate = readWavSampleRate(fileData);
    const wavMetadata = readWavAnalysisMetadata(fileData);
    if (wavMetadata && (
      !Number.isFinite(wavMetadata.durationSeconds)
      || wavMetadata.durationSeconds < MIN_AUDIO_DURATION_SECONDS
      || wavMetadata.durationSeconds > MAX_AUDIO_DURATION_SECONDS
      || wavMetadata.decodedSampleCount > maximumDecodedSampleCount
    )) {
      throw new AudioFileAnalysisError(
        'This WAV exceeds ZionCore’s supported duration or safe local memory limit.',
      );
    }
    if (sourceSampleRate != null && (
      !Number.isSafeInteger(sourceSampleRate)
      || sourceSampleRate < 8_000
      || sourceSampleRate > MAX_ANALYSIS_SAMPLE_RATE_HZ
    )) {
      throw new AudioFileAnalysisError(
        `This WAV sample rate is outside ZionCore’s supported 8–${MAX_ANALYSIS_SAMPLE_RATE_HZ / 1_000} kHz range.`,
      );
    }

    if (sourceSampleRate != null) {
      try {
        context = new AudioContext({ sampleRate: sourceSampleRate });
      } catch {
        if (sourceSampleRate > standardAudioSampleRateCeilingHz) {
          throw new AudioFileAnalysisError(
            `This browser could not open the WAV at its native ${(sourceSampleRate / 1_000).toFixed(1)} kHz rate. Use a browser that supports native-rate decoding; otherwise ultrasonic detail could be lost.`,
          );
        }
        context = new AudioContext();
      }
    } else {
      context = new AudioContext();
    }

    if (
      sourceSampleRate != null
      && sourceSampleRate > standardAudioSampleRateCeilingHz
      && context.sampleRate !== sourceSampleRate
    ) {
      throw new AudioFileAnalysisError(
        `The browser resampled this ${(sourceSampleRate / 1_000).toFixed(1)} kHz WAV to ${(context.sampleRate / 1_000).toFixed(1)} kHz. ZionCore stopped rather than silently losing high-frequency detail.`,
      );
    }

    const decoded = await decodeAudioDataAbortably(context, fileData.slice(0), signal);
    signal?.throwIfAborted();
    if (
      sourceSampleRate != null
      && sourceSampleRate > standardAudioSampleRateCeilingHz
      && decoded.sampleRate !== sourceSampleRate
    ) {
      throw new AudioFileAnalysisError(
        `The browser decoded this WAV at ${(decoded.sampleRate / 1_000).toFixed(1)} kHz instead of its ${(sourceSampleRate / 1_000).toFixed(1)} kHz source rate. High-frequency detail was not analyzed.`,
      );
    }
    if (decoded.duration < MIN_AUDIO_DURATION_SECONDS || decoded.duration > MAX_AUDIO_DURATION_SECONDS) {
      throw new AudioFileAnalysisError(`Choose a recording between ${MIN_AUDIO_DURATION_SECONDS} and ${MAX_AUDIO_DURATION_SECONDS} seconds long.`);
    }
    if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 8) {
      throw new AudioFileAnalysisError('This recording has an unsupported number of audio channels.');
    }
    if (decoded.length * decoded.numberOfChannels > maximumDecodedSampleCount) {
      throw new AudioFileAnalysisError(
        'This recording exceeds the safe local analysis memory limit. Use a shorter recording or a lower-channel-count source file.',
      );
    }
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, index) => decoded.getChannelData(index),
    );
    const { analyzeAudioOffThread } = await import('./audio-analysis-client');
    try {
      return await analyzeAudioOffThread(channels, decoded.sampleRate, fftSize, signal);
    } catch (cause) {
      throw new AudioFileAnalysisError(cause instanceof Error ? cause.message : 'Background audio analysis could not complete.');
    }
  } catch (error) {
    if (error instanceof AudioFileAnalysisError) throw error;
    if (signal?.aborted) throw new AudioFileAnalysisError('Audio import was cancelled.');
    const extension = file.name.split('.').at(-1)?.toLowerCase();
    const label = extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension.toUpperCase() : 'selected';
    throw new AudioFileAnalysisError(
      `This browser could not decode this ${label} recording locally. Try a WAV, MP3, or another format your browser supports.`,
    );
  } finally {
    if (context && context.state !== 'closed') {
      try {
        await context.close();
      } catch {
        // The browser may already have closed the decoder context.
      }
    }
  }
}
