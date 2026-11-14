import { readingFromSpectrum, summarizeWaveform, type Reading } from '@/lib/live-lab';
import { MAX_BIOACOUSTIC_EVENTS, type AcousticEventFeature } from '@/lib/bioacoustic-analysis';

export const MAX_AUDIO_FILE_BYTES = 24 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 60;
export const MAX_AUDIO_SAMPLE_RATE_HZ = 96000;
export const MAX_AUDIO_CHANNELS = 2;
export const MAX_AUDIO_ANALYSIS_WINDOWS = 8;
export const BIOACOUSTIC_SEGMENT_METHOD_ID = 'short-time-rms-hysteresis';
export const BIOACOUSTIC_SEGMENT_METHOD_VERSION = '1.0.0';

type AudioFileInput = Pick<File, 'name' | 'size' | 'arrayBuffer'>;

export type DecodedWavSamples = {
  samples: Float32Array;
  sourceName: string;
  sourceChannels: number;
  sampleRateHz: number;
  durationSeconds: number;
  rms: number;
};

export type AudioFileAnalysis = {
  reading: Reading;
  sourceName: string;
  sourceChannels: number;
  sourceSampleRateHz: number;
  durationSeconds: number;
  analyzedWindows: number;
};

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

type WaveFormat = {
  encoding: 1 | 3;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseWave(view: DataView): { format: WaveFormat; dataOffset: number; dataBytes: number } {
  if (view.byteLength < 12 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('Unsupported file format. Choose a standard RIFF/WAVE .wav file.');
  }
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd !== view.byteLength || riffEnd < 12) {
    throw new Error('The WAV file has an invalid or truncated RIFF length.');
  }

  let format: WaveFormat | null = null;
  let dataOffset = -1;
  let dataBytes = 0;
  let offset = 12;
  while (offset < riffEnd) {
    if (offset + 8 > riffEnd) throw new Error('The WAV file contains an incomplete chunk header.');
    const chunkId = fourCC(view, offset);
    const chunkBytes = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkBytes;
    if (chunkEnd > riffEnd) throw new Error('The WAV file contains a truncated chunk.');

    if (chunkId === 'fmt ') {
      if (format) throw new Error('The WAV file contains multiple format chunks.');
      if (chunkBytes < 16) throw new Error('The WAV format chunk is incomplete.');
      const encoding = view.getUint16(chunkStart, true);
      if (encoding !== 1 && encoding !== 3) {
        throw new Error('Only uncompressed PCM or IEEE-float WAV audio is supported.');
      }
      format = {
        encoding,
        channels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        byteRate: view.getUint32(chunkStart + 8, true),
        blockAlign: view.getUint16(chunkStart + 12, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      };
    } else if (chunkId === 'data') {
      if (dataOffset >= 0) throw new Error('The WAV file contains multiple audio data chunks.');
      dataOffset = chunkStart;
      dataBytes = chunkBytes;
    }

    const nextOffset = chunkEnd + (chunkBytes % 2);
    if (nextOffset > riffEnd) throw new Error('The WAV file is missing a required chunk padding byte.');
    offset = nextOffset;
  }
  if (!format || dataOffset < 0) throw new Error('The WAV file must contain one format chunk and one data chunk.');
  return { format, dataOffset, dataBytes };
}

function decodeSample(view: DataView, offset: number, format: WaveFormat): number {
  if (format.encoding === 3) {
    const value = view.getFloat32(offset, true);
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new Error('The WAV contains a non-finite or out-of-range float sample.');
    }
    return value;
  }
  switch (format.bitsPerSample) {
    case 8: return (view.getUint8(offset) - 128) / 128;
    case 16: return view.getInt16(offset, true) / 32768;
    case 24: {
      let value = view.getUint8(offset)
        | (view.getUint8(offset + 1) << 8)
        | (view.getUint8(offset + 2) << 16);
      if (value & 0x800000) value -= 0x1000000;
      return value / 0x800000;
    }
    case 32: return view.getInt32(offset, true) / 0x80000000;
    default: throw new Error('Supported PCM WAV bit depths are 8, 16, 24, and 32 bits.');
  }
}

function yieldToBrowser() {
  return new Promise<void>(resolve => setTimeout(resolve, 0));
}

export async function decodeWavMonoSamples(
  file: AudioFileInput,
  isCurrent: () => boolean = () => true,
): Promise<DecodedWavSamples> {
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error(`Choose a non-empty WAV file no larger than ${Math.floor(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MiB.`);
  }
  const buffer = await file.arrayBuffer();
  if (!isCurrent()) throw new Error('Audio import was cancelled before processing.');
  if (buffer.byteLength !== file.size || buffer.byteLength > MAX_AUDIO_FILE_BYTES) {
    throw new Error('The selected file changed or exceeded the import limit while being read.');
  }
  const view = new DataView(buffer);
  const { format, dataOffset, dataBytes } = parseWave(view);
  if (format.channels < 1 || format.channels > MAX_AUDIO_CHANNELS) {
    throw new Error('Only mono or stereo WAV channel layouts are supported.');
  }
  if (!Number.isInteger(format.sampleRate)
    || format.sampleRate < 8000
    || format.sampleRate > MAX_AUDIO_SAMPLE_RATE_HZ) {
    throw new Error('WAV sample rates must be between 8 kHz and 96 kHz.');
  }
  const supportedPcmDepth = [8, 16, 24, 32].includes(format.bitsPerSample);
  const supportedFloatDepth = format.encoding === 3 && format.bitsPerSample === 32;
  if (!(format.encoding === 1 && supportedPcmDepth) && !supportedFloatDepth) {
    throw new Error('Supported audio is PCM WAV at 8/16/24/32 bits or IEEE-float WAV at 32 bits.');
  }
  const bytesPerSample = format.bitsPerSample / 8;
  const expectedBlockAlign = format.channels * bytesPerSample;
  if (format.blockAlign !== expectedBlockAlign
    || format.byteRate !== format.sampleRate * expectedBlockAlign
    || dataBytes === 0
    || dataBytes % format.blockAlign !== 0) {
    throw new Error('The WAV format, sample layout, and data length do not agree.');
  }
  const frameCount = dataBytes / format.blockAlign;
  const durationSeconds = frameCount / format.sampleRate;
  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error(`WAV duration exceeds the ${MAX_AUDIO_DURATION_SECONDS}-second local analysis limit.`);
  }
  if (!isCurrent()) throw new Error('Audio import was cancelled before processing.');

  const samples = new Float32Array(frameCount);
  let squareSum = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    if ((frame & 0xffff) === 0 && !isCurrent()) {
      throw new Error('Audio import was cancelled during local processing.');
    }
    let sampleSum = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      const sampleOffset = dataOffset + frame * format.blockAlign + channel * bytesPerSample;
      sampleSum += decodeSample(view, sampleOffset, format);
    }
    const sample = sampleSum / format.channels;
    samples[frame] = sample;
    squareSum += sample * sample;
  }
  return {
    samples,
    sourceName: file.name,
    sourceChannels: format.channels,
    sampleRateHz: format.sampleRate,
    durationSeconds,
    rms: Math.sqrt(squareSum / frameCount),
  };
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

export async function analyzeWavFile(
  file: AudioFileInput,
  fftSize: number,
  isCurrent: () => boolean = () => true,
): Promise<AudioFileAnalysis> {
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error(`Choose a non-empty WAV file no larger than ${Math.floor(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MiB.`);
  }
  if (![2048, 4096, 8192].includes(fftSize)) {
    throw new Error('Choose a supported FFT size before importing audio.');
  }
  const decoded = await decodeWavMonoSamples(file, isCurrent);
  const { samples: mono, sampleRateHz, durationSeconds, rms, sourceName, sourceChannels } = decoded;
  const frameCount = mono.length;
  if (frameCount < fftSize) {
    throw new Error(`The WAV is too short for a ${fftSize.toLocaleString()}-sample FFT window.`);
  }
  const possibleWindows = 1 + Math.floor((frameCount - fftSize) / (fftSize * 2));
  const analyzedWindows = Math.min(MAX_AUDIO_ANALYSIS_WINDOWS, possibleWindows);
  const accumulated = new Float64Array(fftSize / 2);
  const windowStarts: number[] = [];
  for (let windowIndex = 0; windowIndex < analyzedWindows; windowIndex++) {
    if (!isCurrent()) throw new Error('Audio import was cancelled during local processing.');
    const start = analyzedWindows === 1
      ? Math.floor((frameCount - fftSize) / 2)
      : Math.round((frameCount - fftSize) * windowIndex / (analyzedWindows - 1));
    windowStarts.push(start);
    const magnitudes = fftMagnitudes(mono, start, fftSize);
    for (let bin = 0; bin < accumulated.length; bin++) accumulated[bin] += magnitudes[bin];
  }
  const bins = new Uint8Array(fftSize / 2);
  for (let bin = 0; bin < bins.length; bin++) {
    const meanMagnitude = accumulated[bin] / analyzedWindows;
    const decibels = meanMagnitude > 0 ? 20 * Math.log10(meanMagnitude) : -100;
    bins[bin] = Math.round(Math.max(0, Math.min(255, (decibels + 100) / 100 * 255)));
  }
  const waveformStart = windowStarts[Math.floor(windowStarts.length / 2)];

  return {
    reading: readingFromSpectrum(
      bins, sampleRateHz, fftSize, rms, 'audio-file',
      summarizeWaveform(mono, waveformStart, fftSize),
    ),
    sourceName,
    sourceChannels,
    sourceSampleRateHz: sampleRateHz,
    durationSeconds,
    analyzedWindows,
  };
}

/**
 * Finds energy-bounded acoustic-event candidates in a local WAV file.
 * These spans are not animal-call detections or species identifications.
 */
export async function segmentWavFile(
  file: AudioFileInput,
  isCurrent: () => boolean = () => true,
): Promise<AudioEventSegmentationResult> {
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error(`Choose a non-empty WAV file no larger than ${Math.floor(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MiB.`);
  }
  const buffer = await file.arrayBuffer();
  if (!isCurrent()) throw new Error('Audio segmentation was cancelled before processing.');
  if (buffer.byteLength !== file.size || buffer.byteLength > MAX_AUDIO_FILE_BYTES) {
    throw new Error('The selected file changed or exceeded the import limit while being read.');
  }
  const view = new DataView(buffer);
  const { format, dataOffset, dataBytes } = parseWave(view);
  if (format.channels < 1 || format.channels > MAX_AUDIO_CHANNELS) {
    throw new Error('Only mono or stereo WAV channel layouts are supported.');
  }
  if (!Number.isInteger(format.sampleRate)
    || format.sampleRate < 8000
    || format.sampleRate > MAX_AUDIO_SAMPLE_RATE_HZ) {
    throw new Error('WAV sample rates must be between 8 kHz and 96 kHz.');
  }
  const supportedPcmDepth = [8, 16, 24, 32].includes(format.bitsPerSample);
  const supportedFloatDepth = format.encoding === 3 && format.bitsPerSample === 32;
  if (!(format.encoding === 1 && supportedPcmDepth) && !supportedFloatDepth) {
    throw new Error('Supported audio is PCM WAV at 8/16/24/32 bits or IEEE-float WAV at 32 bits.');
  }
  const bytesPerSample = format.bitsPerSample / 8;
  const expectedBlockAlign = format.channels * bytesPerSample;
  if (format.blockAlign !== expectedBlockAlign
    || format.byteRate !== format.sampleRate * expectedBlockAlign
    || dataBytes === 0
    || dataBytes % format.blockAlign !== 0) {
    throw new Error('The WAV format, sample layout, and data length do not agree.');
  }

  const frameCount = dataBytes / format.blockAlign;
  const durationSeconds = frameCount / format.sampleRate;
  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error(`WAV duration exceeds the ${MAX_AUDIO_DURATION_SECONDS}-second local analysis limit.`);
  }
  const mono = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    if ((frame & 0xffff) === 0) {
      if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
      if (frame > 0) await yieldToBrowser();
    }
    let sampleSum = 0;
    for (let channel = 0; channel < format.channels; channel++) {
      const sampleOffset = dataOffset + frame * format.blockAlign + channel * bytesPerSample;
      sampleSum += decodeSample(view, sampleOffset, format);
    }
    mono[frame] = sampleSum / format.channels;
  }

  const frameSize = Math.max(1, Math.round(format.sampleRate * 0.02));
  const hopSize = Math.max(1, Math.round(format.sampleRate * 0.01));
  if (mono.length < frameSize) {
    throw new Error('The WAV is too short for a 20 ms event-analysis window.');
  }
  const frameLevels: number[] = [];
  let frameIndex = 0;
  for (let start = 0; start + frameSize <= mono.length; start += hopSize) {
    if ((frameIndex & 0x7f) === 0) {
      if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
      if (frameIndex > 0) await yieldToBrowser();
    }
    let squareSum = 0;
    for (let index = start; index < start + frameSize; index++) {
      squareSum += mono[index] * mono[index];
    }
    frameLevels.push(Math.sqrt(squareSum / frameSize));
    frameIndex++;
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
  const mergeGapFrames = Math.ceil(0.08 * format.sampleRate / hopSize);
  for (const span of rawSpans) {
    const previous = mergedSpans[mergedSpans.length - 1];
    if (previous && span.firstFrame - previous.lastFrame <= mergeGapFrames) {
      previous.lastFrame = span.lastFrame;
    } else {
      mergedSpans.push({ ...span });
    }
  }
  const minimumFrames = Math.ceil(0.04 * format.sampleRate / hopSize);
  const retainedSpans = mergedSpans.filter(span => span.lastFrame - span.firstFrame + 1 >= minimumFrames);
  const events: AcousticEventFeature[] = [];
  const spansForAnalysis = retainedSpans.slice(0, MAX_BIOACOUSTIC_EVENTS);
  for (let index = 0; index < spansForAnalysis.length; index++) {
    const span = spansForAnalysis[index];
    if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
    if (index > 0 && index % 8 === 0) await yieldToBrowser();
    const startSample = span.firstFrame * hopSize;
    const endSample = Math.min(mono.length, span.lastFrame * hopSize + frameSize);
    const samplesInEvent = mono.subarray(startSample, endSample);
    let squareSum = 0;
    let peakRms = 0;
    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex++) {
      squareSum += mono[sampleIndex] * mono[sampleIndex];
      if (((sampleIndex - startSample) & 0x3ffff) === 0 && sampleIndex > startSample) {
        if (!isCurrent()) throw new Error('Audio segmentation was cancelled during local processing.');
        await yieldToBrowser();
      }
    }
    for (let frameIndex = span.firstFrame; frameIndex <= span.lastFrame; frameIndex++) {
      peakRms = Math.max(peakRms, frameLevels[frameIndex] ?? 0);
    }
    const rms = Math.sqrt(squareSum / Math.max(1, samplesInEvent.length));
    const durationSeconds = samplesInEvent.length / format.sampleRate;
    let dominantFrequencyHz: number | null = null;
    let spectralCentroidHz: number | null = null;
    let fftSize = 1;
    const maxFftSize = Math.min(4096, samplesInEvent.length);
    while (fftSize * 2 <= maxFftSize) fftSize *= 2;
    if (fftSize >= 256) {
      const fftStart = startSample + Math.floor((samplesInEvent.length - fftSize) / 2);
      const magnitudes = fftMagnitudes(mono, fftStart, fftSize);
      let magnitudeSum = 0;
      let weightedFrequencySum = 0;
      let strongestMagnitude = 0;
      let strongestBin = 0;
      for (let bin = 1; bin < magnitudes.length; bin++) {
        const magnitude = magnitudes[bin];
        const frequency = bin * format.sampleRate / fftSize;
        magnitudeSum += magnitude;
        weightedFrequencySum += magnitude * frequency;
        if (magnitude > strongestMagnitude) {
          strongestMagnitude = magnitude;
          strongestBin = bin;
        }
      }
      if (magnitudeSum > 0) {
        dominantFrequencyHz = strongestBin * format.sampleRate / fftSize;
        spectralCentroidHz = weightedFrequencySum / magnitudeSum;
      }
    }
    events.push({
      id: `event-${String(index + 1).padStart(3, '0')}`,
      startSeconds: startSample / format.sampleRate,
      endSeconds: endSample / format.sampleRate,
      durationSeconds,
      meanRms: rms,
      peakRms,
      dominantFrequencyHz,
      spectralCentroidHz,
    });
  }

  return {
    sourceName: file.name,
    sourceChannels: format.channels,
    sourceSampleRateHz: format.sampleRate,
    durationSeconds,
    frameDurationMs: frameSize / format.sampleRate * 1000,
    hopDurationMs: hopSize / format.sampleRate * 1000,
    noiseFloorRms,
    onsetThresholdRms,
    candidateEventCount: retainedSpans.length,
    truncated: retainedSpans.length > events.length,
    methodId: BIOACOUSTIC_SEGMENT_METHOD_ID,
    methodVersion: BIOACOUSTIC_SEGMENT_METHOD_VERSION,
    events,
  };
}
