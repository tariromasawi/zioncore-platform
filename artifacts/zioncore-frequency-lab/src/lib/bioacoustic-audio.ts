import { decodeNativeWav } from '@/lib/voice-v2-audio';
import {
  MAX_BIOACOUSTIC_EVENTS,
  type AcousticEventFeature,
} from '@/lib/bioacoustic-analysis';

export const MAX_BIOACOUSTIC_WAV_BYTES = 24 * 1024 * 1024;
export const MAX_BIOACOUSTIC_WAV_SECONDS = 60;
export const BIOACOUSTIC_SEGMENT_METHOD_ID = 'short-time-rms-hysteresis';
export const BIOACOUSTIC_SEGMENT_METHOD_VERSION = '1.0.0';

type AudioFileInput = Pick<File, 'name' | 'size' | 'arrayBuffer'>;

export type AudioEventSegmentationResult = {
  sourceName: string;
  sourceChannels: number;
  sourceSampleRateHz: number;
  durationSeconds: number;
  frameDurationMs: number;
  hopDurationMs: number;
  noiseFloorRms: number;
  onsetThresholdRms: number;
  candidateEventCount: number;
  truncated: boolean;
  methodId: string;
  methodVersion: string;
  events: AcousticEventFeature[];
};

function yieldToBrowser() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

function fftMagnitudes(samples: Float32Array, start: number, size: number) {
  const real = new Float64Array(size);
  const imag = new Float64Array(size);
  let windowSum = 0;
  for (let i = 0; i < size; i++) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
    real[i] = samples[start + i] * window;
    windowSum += window;
  }

  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    const half = length >> 1;
    for (let block = 0; block < size; block += length) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      for (let j = 0; j < half; j++) {
        const even = block + j;
        const odd = even + half;
        const productReal = twiddleReal * real[odd] - twiddleImag * imag[odd];
        const productImag = twiddleReal * imag[odd] + twiddleImag * real[odd];
        real[odd] = real[even] - productReal;
        imag[odd] = imag[even] - productImag;
        real[even] += productReal;
        imag[even] += productImag;
        [twiddleReal, twiddleImag] = [
          twiddleReal * stepReal - twiddleImag * stepImag,
          twiddleReal * stepImag + twiddleImag * stepReal,
        ];
      }
    }
  }

  const magnitudes = new Float64Array(size / 2);
  for (let bin = 0; bin < magnitudes.length; bin++) {
    magnitudes[bin] = Math.hypot(real[bin], imag[bin]) * 2 / windowSum;
  }
  return magnitudes;
}

/**
 * Finds bounded energy-based acoustic event candidates in an uncompressed WAV.
 * These spans are not animal-call detections, species identifications, or
 * evidence that an animal understood a generated signal.
 */
export async function segmentWavFile(
  file: AudioFileInput,
  isCurrent: () => boolean = () => true,
): Promise<AudioEventSegmentationResult> {
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_BIOACOUSTIC_WAV_BYTES) {
    throw new Error('Choose a non-empty WAV file no larger than 24 MiB.');
  }
  const buffer = await file.arrayBuffer();
  if (!isCurrent()) throw new Error('Audio segmentation was cancelled before processing.');
  if (buffer.byteLength !== file.size || buffer.byteLength > MAX_BIOACOUSTIC_WAV_BYTES) {
    throw new Error('The selected file changed or exceeded the import limit while being read.');
  }

  const decoded = decodeNativeWav(buffer);
  if (decoded.channels > 2) throw new Error('Bioacoustic comparison accepts mono or stereo WAV audio.');
  if (decoded.sampleRateHz > 96_000) throw new Error('WAV sample rates must be 96 kHz or lower for this analysis.');
  if (decoded.durationSeconds > MAX_BIOACOUSTIC_WAV_SECONDS) {
    throw new Error('WAV duration exceeds the 60-second local segmentation limit.');
  }
  const mono = decoded.samples;
  const sampleRateHz = decoded.sampleRateHz;
  const frameSize = Math.max(1, Math.round(sampleRateHz * 0.02));
  const hopSize = Math.max(1, Math.round(sampleRateHz * 0.01));
  if (mono.length < frameSize) {
    throw new Error('The WAV is too short for a 20 ms event-analysis window.');
  }

  const frameLevels: number[] = [];
  for (let frameIndex = 0, start = 0; start + frameSize <= mono.length; frameIndex++, start += hopSize) {
    if ((frameIndex & 0x7f) === 0) {
      if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
      if (frameIndex > 0) await yieldToBrowser();
    }
    let squareSum = 0;
    for (let index = start; index < start + frameSize; index++) {
      squareSum += mono[index] * mono[index];
    }
    frameLevels.push(Math.sqrt(squareSum / frameSize));
  }

  const sortedLevels = [...frameLevels].sort((left, right) => left - right);
  const noiseFloorRms = sortedLevels[Math.floor((sortedLevels.length - 1) * 0.2)] ?? 0;
  const onsetThresholdRms = Math.max(0.002, noiseFloorRms * 2.5);
  const releaseThresholdRms = onsetThresholdRms * 0.65;
  const rawSpans: Array<{ firstFrame: number; lastFrame: number }> = [];
  let eventStart = -1;
  let lastActiveFrame = -1;
  for (let levelIndex = 0; levelIndex < frameLevels.length; levelIndex++) {
    const level = frameLevels[levelIndex];
    if (eventStart < 0) {
      if (level >= onsetThresholdRms) {
        eventStart = levelIndex;
        lastActiveFrame = levelIndex;
      }
      continue;
    }
    if (level >= releaseThresholdRms) {
      lastActiveFrame = levelIndex;
    } else {
      rawSpans.push({ firstFrame: eventStart, lastFrame: lastActiveFrame });
      eventStart = -1;
      lastActiveFrame = -1;
    }
  }
  if (eventStart >= 0) rawSpans.push({ firstFrame: eventStart, lastFrame: lastActiveFrame });

  const mergedSpans: Array<{ firstFrame: number; lastFrame: number }> = [];
  const mergeGapFrames = Math.ceil(0.08 * sampleRateHz / hopSize);
  for (const span of rawSpans) {
    const previous = mergedSpans[mergedSpans.length - 1];
    if (previous && span.firstFrame - previous.lastFrame <= mergeGapFrames) {
      previous.lastFrame = span.lastFrame;
    } else {
      mergedSpans.push({ ...span });
    }
  }
  const minimumFrames = Math.ceil(0.04 * sampleRateHz / hopSize);
  const retainedSpans = mergedSpans.filter(
    span => span.lastFrame - span.firstFrame + 1 >= minimumFrames,
  );
  const spansForAnalysis = retainedSpans.slice(0, MAX_BIOACOUSTIC_EVENTS);
  const events: AcousticEventFeature[] = [];

  for (let index = 0; index < spansForAnalysis.length; index++) {
    if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
    if (index > 0 && index % 8 === 0) await yieldToBrowser();
    const span = spansForAnalysis[index];
    const startSample = span.firstFrame * hopSize;
    const endSample = Math.min(mono.length, span.lastFrame * hopSize + frameSize);
    const eventLength = endSample - startSample;
    let squareSum = 0;
    let peakRms = 0;
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
      squareSum += mono[sampleIndex] * mono[sampleIndex];
    }
    for (let frameIndex = span.firstFrame; frameIndex <= span.lastFrame; frameIndex++) {
      peakRms = Math.max(peakRms, frameLevels[frameIndex] ?? 0);
    }
    const meanRms = Math.sqrt(squareSum / Math.max(1, eventLength));
    const durationSeconds = eventLength / sampleRateHz;
    let dominantFrequencyHz: number | null = null;
    let spectralCentroidHz: number | null = null;
    let fftSize = 1;
    const maxFftSize = Math.min(4096, eventLength);
    while (fftSize * 2 <= maxFftSize) fftSize *= 2;
    if (fftSize >= 256) {
      const fftStart = startSample + Math.floor((eventLength - fftSize) / 2);
      const magnitudes = fftMagnitudes(mono, fftStart, fftSize);
      let magnitudeSum = 0;
      let weightedFrequencySum = 0;
      let strongestMagnitude = 0;
      let strongestBin = 0;
      for (let bin = 1; bin < magnitudes.length; bin++) {
        const magnitude = magnitudes[bin];
        const frequency = bin * sampleRateHz / fftSize;
        magnitudeSum += magnitude;
        weightedFrequencySum += magnitude * frequency;
        if (magnitude > strongestMagnitude) {
          strongestMagnitude = magnitude;
          strongestBin = bin;
        }
      }
      if (magnitudeSum > 0) {
        dominantFrequencyHz = strongestBin * sampleRateHz / fftSize;
        spectralCentroidHz = weightedFrequencySum / magnitudeSum;
      }
    }
    events.push({
      id: `event-${String(index + 1).padStart(3, '0')}`,
      startSeconds: startSample / sampleRateHz,
      endSeconds: endSample / sampleRateHz,
      durationSeconds,
      meanRms,
      peakRms,
      dominantFrequencyHz,
      spectralCentroidHz,
    });
  }

  return {
    sourceName: file.name,
    sourceChannels: decoded.channels,
    sourceSampleRateHz: sampleRateHz,
    durationSeconds: decoded.durationSeconds,
    frameDurationMs: frameSize / sampleRateHz * 1000,
    hopDurationMs: hopSize / sampleRateHz * 1000,
    noiseFloorRms,
    onsetThresholdRms,
    candidateEventCount: retainedSpans.length,
    truncated: retainedSpans.length > events.length,
    methodId: BIOACOUSTIC_SEGMENT_METHOD_ID,
    methodVersion: BIOACOUSTIC_SEGMENT_METHOD_VERSION,
    events,
  };
}
