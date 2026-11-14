import {
  CELESTIAL_INTER_SYMBOL_GAP_MS,
  CELESTIAL_MAX_MESSAGE_BYTES,
  CELESTIAL_MAX_SYMBOLS,
  CELESTIAL_PROTOCOL_ID,
  CELESTIAL_SAMPLE_RATE_HZ,
  CELESTIAL_SYMBOL_DURATION_OPTIONS,
  DTMF_HIGH_HZ,
  DTMF_LOW_HZ,
  decodeCelestialSymbols,
} from '@/lib/celestial-experiment';

const MIN_DTMF_AUDIO_SAMPLE_RATE_HZ = 8_000;
const MAX_DTMF_AUDIO_SAMPLE_RATE_HZ = 96_000;
const MAX_DTMF_AUDIO_DURATION_SECONDS = 35;
const SYNC_SYMBOLS = [15, 15, 10, 5] as const;
const HEADER_SYMBOL_COUNT = SYNC_SYMBOLS.length + 10;
const HEADER_MAGIC = [0x5a, 0x43] as const;
const HEADER_VERSION = 1;

export type CelestialAudioDecodeErrorCode =
  | 'INVALID_SAMPLE_RATE'
  | 'INVALID_AUDIO'
  | 'NO_PACKET'
  | 'INVALID_FRAME'
  | 'CHECKSUM_FAILED';

export class CelestialAudioDecodeError extends Error {
  constructor(
    public readonly code: CelestialAudioDecodeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CelestialAudioDecodeError';
  }
}

export type CelestialAudioDecodeResult = {
  protocolId: typeof CELESTIAL_PROTOCOL_ID;
  message: string;
  symbols: number[];
  payloadByteLength: number;
  sampleRateHz: number;
  symbolDurationMs: (typeof CELESTIAL_SYMBOL_DURATION_OPTIONS)[number];
  packetStartSeconds: number;
  checksum: 'verified';
};

type DtmfClassifier = (samples: Float32Array, symbolStart: number) => number | null;

function makeDtmfClassifier(sampleRateHz: number, symbolDurationMs: number): DtmfClassifier {
  const symbolSamples = Math.round(sampleRateHz * symbolDurationMs / 1000);
  const analysisLength = Math.floor(symbolSamples * 0.68);
  const analysisOffset = Math.round(symbolSamples * 0.16);
  const frequencies = [...DTMF_LOW_HZ, ...DTMF_HIGH_HZ];
  const coefficients = frequencies.map(frequency => (
    2 * Math.cos((2 * Math.PI * frequency) / sampleRateHz)
  ));
  const window = Float64Array.from({ length: analysisLength }, (_, index) => (
    0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (analysisLength - 1))
  ));
  const windowSum = window.reduce((sum, value) => sum + value, 0);

  return (samples, symbolStart) => {
    const start = symbolStart + analysisOffset;
    if (start < 0 || start + analysisLength > samples.length) return null;

    const state1 = new Float64Array(frequencies.length);
    const state2 = new Float64Array(frequencies.length);
    let rawSquareSum = 0;
    for (let sampleIndex = 0; sampleIndex < analysisLength; sampleIndex += 1) {
      const rawSample = samples[start + sampleIndex];
      rawSquareSum += rawSample * rawSample;
      const value = rawSample * window[sampleIndex];
      for (let toneIndex = 0; toneIndex < frequencies.length; toneIndex += 1) {
        const next = value + coefficients[toneIndex] * state1[toneIndex] - state2[toneIndex];
        state2[toneIndex] = state1[toneIndex];
        state1[toneIndex] = next;
      }
    }

    const amplitudes = frequencies.map((_, toneIndex) => {
      const power = Math.max(
        0,
        state1[toneIndex] ** 2
          + state2[toneIndex] ** 2
          - coefficients[toneIndex] * state1[toneIndex] * state2[toneIndex],
      );
      return 2 * Math.sqrt(power) / windowSum;
    });
    const lowIndexes = [0, 1, 2, 3];
    const highIndexes = [4, 5, 6, 7];
    const lowOrder = lowIndexes.sort((a, b) => amplitudes[b] - amplitudes[a]);
    const highOrder = highIndexes.sort((a, b) => amplitudes[b] - amplitudes[a]);
    const lowIndex = lowOrder[0];
    const highIndex = highOrder[0];
    const lowAmplitude = amplitudes[lowIndex];
    const highAmplitude = amplitudes[highIndex];
    const segmentRms = Math.sqrt(rawSquareSum / analysisLength);
    const energyFloor = Math.max(1e-7, segmentRms * 0.14);
    if (lowAmplitude < energyFloor || highAmplitude < energyFloor) return null;
    if (lowAmplitude / amplitudes[lowOrder[1]] < 1.22
      || highAmplitude / amplitudes[highOrder[1]] < 1.22) return null;
    const toneBalance = lowAmplitude / highAmplitude;
    if (toneBalance < 0.12 || toneBalance > 8) return null;
    return (lowIndex * 4) + (highIndex - 4);
  };
}

function findFirstActiveFrame(samples: Float32Array, sampleRateHz: number) {
  const frameSize = Math.max(1, Math.round(sampleRateHz * 0.002));
  const hopSize = Math.max(1, Math.round(sampleRateHz * 0.001));
  const frameRmsValues: Array<{ start: number; rms: number }> = [];
  let maximumFrameRms = 0;

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let squareSum = 0;
    for (let index = start; index < start + frameSize; index += 1) {
      squareSum += samples[index] * samples[index];
    }
    const rms = Math.sqrt(squareSum / frameSize);
    frameRmsValues.push({ start, rms });
    maximumFrameRms = Math.max(maximumFrameRms, rms);
  }

  if (maximumFrameRms < 1e-6) return null;
  const threshold = Math.max(1e-6, maximumFrameRms * 0.22);
  return frameRmsValues.find(frame => frame.rms >= threshold)?.start ?? null;
}

function candidatePacketStarts(firstActiveSample: number, sampleRateHz: number) {
  const step = Math.max(1, Math.round(sampleRateHz * 0.0005));
  const searchBefore = Math.round(sampleRateHz * 0.006);
  const starts: number[] = [];
  for (let distance = 0; distance <= searchBefore; distance += step) {
    starts.push(Math.max(0, firstActiveSample - distance));
  }
  return [...new Set(starts)];
}

function headerPayloadLength(symbols: number[]) {
  if (!SYNC_SYMBOLS.every((symbol, index) => symbols[index] === symbol)) return null;
  const headerSymbols = symbols.slice(SYNC_SYMBOLS.length, HEADER_SYMBOL_COUNT);
  if (headerSymbols.length !== 10 || headerSymbols.some(symbol => symbol < 0)) return null;
  const bytes = new Uint8Array(5);
  for (let index = 0; index < headerSymbols.length; index += 2) {
    bytes[index / 2] = (headerSymbols[index] << 4) | headerSymbols[index + 1];
  }
  if (bytes[0] !== HEADER_MAGIC[0] || bytes[1] !== HEADER_MAGIC[1] || bytes[2] !== HEADER_VERSION) {
    return null;
  }
  const payloadByteLength = (bytes[3] << 8) | bytes[4];
  if (payloadByteLength < 1 || payloadByteLength > CELESTIAL_MAX_MESSAGE_BYTES) return null;
  return payloadByteLength;
}

function decodeAtStart(
  samples: Float32Array,
  sampleRateHz: number,
  symbolDurationMs: (typeof CELESTIAL_SYMBOL_DURATION_OPTIONS)[number],
  packetStart: number,
  classify: DtmfClassifier,
) {
  const symbolSamples = Math.round(sampleRateHz * symbolDurationMs / 1000);
  const gapSamples = Math.round(sampleRateHz * CELESTIAL_INTER_SYMBOL_GAP_MS / 1000);
  const samplesPerStep = symbolSamples + gapSamples;
  const symbols: number[] = [];
  for (let index = 0; index < HEADER_SYMBOL_COUNT; index += 1) {
    const symbol = classify(samples, packetStart + index * samplesPerStep);
    if (symbol === null) return { syncMatched: false, headerMatched: false } as const;
    symbols.push(symbol);
  }
  if (!SYNC_SYMBOLS.every((symbol, index) => symbols[index] === symbol)) {
    return { syncMatched: false, headerMatched: false } as const;
  }

  const payloadByteLength = headerPayloadLength(symbols);
  if (payloadByteLength === null) return { syncMatched: true, headerMatched: false } as const;
  const symbolCount = SYNC_SYMBOLS.length + 2 * (5 + payloadByteLength + 2);
  if (symbolCount > CELESTIAL_MAX_SYMBOLS) {
    return { syncMatched: true, headerMatched: false } as const;
  }
  if (packetStart + (symbolCount - 1) * samplesPerStep + symbolSamples > samples.length) {
    return { syncMatched: true, headerMatched: true, truncated: true } as const;
  }

  for (let index = HEADER_SYMBOL_COUNT; index < symbolCount; index += 1) {
    const symbol = classify(samples, packetStart + index * samplesPerStep);
    if (symbol === null) {
      return { syncMatched: true, headerMatched: true, truncated: false } as const;
    }
    symbols.push(symbol);
  }
  try {
    const message = decodeCelestialSymbols(symbols);
    return {
      syncMatched: true,
      headerMatched: true,
      truncated: false,
      message,
      symbols,
      payloadByteLength,
    } as const;
  } catch (error) {
    return {
      syncMatched: true,
      headerMatched: true,
      truncated: false,
      checksumFailed: error instanceof Error && error.message.includes('checksum failed'),
    } as const;
  }
}

export function decodeCelestialAudio(
  samples: Float32Array,
  sampleRateHz: number,
  options: {
    symbolDurationMs?: (typeof CELESTIAL_SYMBOL_DURATION_OPTIONS)[number];
  } = {},
): CelestialAudioDecodeResult {
  if (!Number.isInteger(sampleRateHz)
    || sampleRateHz < MIN_DTMF_AUDIO_SAMPLE_RATE_HZ
    || sampleRateHz > MAX_DTMF_AUDIO_SAMPLE_RATE_HZ) {
    throw new CelestialAudioDecodeError(
      'INVALID_SAMPLE_RATE',
      `DTMF audio must use a sample rate between ${MIN_DTMF_AUDIO_SAMPLE_RATE_HZ.toLocaleString()} and ${MAX_DTMF_AUDIO_SAMPLE_RATE_HZ.toLocaleString()} Hz.`,
    );
  }
  if (!(samples instanceof Float32Array)
    || samples.length === 0
    || samples.length / sampleRateHz > MAX_DTMF_AUDIO_DURATION_SECONDS
    || samples.some(sample => !Number.isFinite(sample))) {
    throw new CelestialAudioDecodeError(
      'INVALID_AUDIO',
      `Choose finite mono audio no longer than ${MAX_DTMF_AUDIO_DURATION_SECONDS} seconds.`,
    );
  }
  if (options.symbolDurationMs !== undefined
    && !CELESTIAL_SYMBOL_DURATION_OPTIONS.some(value => value === options.symbolDurationMs)) {
    throw new CelestialAudioDecodeError('INVALID_AUDIO', 'Choose a supported DTMF symbol duration.');
  }

  const firstActive = findFirstActiveFrame(samples, sampleRateHz);
  if (firstActive === null) {
    throw new CelestialAudioDecodeError('NO_PACKET', 'No measurable DTMF tone energy was found in this audio.');
  }
  const starts = candidatePacketStarts(firstActive, sampleRateHz);
  const durations = options.symbolDurationMs === undefined
    ? [...CELESTIAL_SYMBOL_DURATION_OPTIONS]
    : [options.symbolDurationMs];
  let syncMatched = false;
  let headerMatched = false;
  let truncated = false;
  let checksumFailed = false;

  for (const symbolDurationMs of durations) {
    const classify = makeDtmfClassifier(sampleRateHz, symbolDurationMs);
    for (const packetStart of starts) {
      const result = decodeAtStart(samples, sampleRateHz, symbolDurationMs, packetStart, classify);
      syncMatched ||= result.syncMatched;
      headerMatched ||= result.headerMatched;
      truncated ||= 'truncated' in result && result.truncated === true;
      checksumFailed ||= 'checksumFailed' in result && result.checksumFailed === true;
      if ('message' in result && result.message !== undefined) {
        return {
          protocolId: CELESTIAL_PROTOCOL_ID,
          message: result.message,
          symbols: result.symbols,
          payloadByteLength: result.payloadByteLength,
          sampleRateHz,
          symbolDurationMs,
          packetStartSeconds: packetStart / sampleRateHz,
          checksum: 'verified',
        };
      }
    }
  }

  if (checksumFailed) {
    throw new CelestialAudioDecodeError(
      'CHECKSUM_FAILED',
      'DTMF tones matched a packet, but its checksum failed. The audio may be clipped, noisy, truncated, or misaligned.',
    );
  }
  if (truncated) {
    throw new CelestialAudioDecodeError(
      'INVALID_FRAME',
      'The DTMF packet header was found, but the audio ends before the complete packet.',
    );
  }
  if (syncMatched && !headerMatched) {
    throw new CelestialAudioDecodeError(
      'INVALID_FRAME',
      'DTMF synchronization tones were found, but the packet header or version is not supported.',
    );
  }
  if (headerMatched) {
    throw new CelestialAudioDecodeError(
      'INVALID_FRAME',
      'The DTMF packet tones were incomplete or could not be recovered reliably.',
    );
  }
  throw new CelestialAudioDecodeError(
    'NO_PACKET',
    `No valid ${CELESTIAL_PROTOCOL_ID} packet was found. Check that the WAV contains a complete packet and that its symbol timing is supported.`,
  );
}

export const CELESTIAL_AUDIO_DECODER_LIMITS = Object.freeze({
  minimumSampleRateHz: MIN_DTMF_AUDIO_SAMPLE_RATE_HZ,
  maximumSampleRateHz: MAX_DTMF_AUDIO_SAMPLE_RATE_HZ,
  maximumDurationSeconds: MAX_DTMF_AUDIO_DURATION_SECONDS,
  outputSampleRateHz: CELESTIAL_SAMPLE_RATE_HZ,
});
