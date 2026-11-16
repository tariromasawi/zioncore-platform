export const ACOUSTIC_MESSAGE_PROTOCOL = {
  version: 1,
  sampleRateHz: 48_000,
  carrierZeroHz: 1_800,
  carrierOneHz: 2_400,
  symbolDurationMs: 20,
  maxPayloadBytes: 512,
  preambleBytes: [0x55, 0x55, 0xd3, 0x91],
  headerBytes: 24,
  leadingSilenceMs: 100,
  trailingSilenceMs: 300,
} as const;

export const ACOUSTIC_VOICE_PROTOCOL = {
  version: 2,
  sampleRateHz: 48_000,
  sourceSampleRateHz: 8_000,
  carriersHz: [1_200, 2_000, 2_800, 3_600, 4_400, 5_200, 6_000, 6_800],
  symbolDurationMs: 3,
  preambleSymbols: [0, 7, 1, 6, 2, 5, 3, 4, 7, 0, 6, 1, 5, 2, 4, 3, 0, 7, 2, 5, 1, 6, 3, 4],
  leadingSilenceMs: 120,
  trailingSilenceMs: 300,
  maxRecordingSeconds: 2,
  minRecordingSeconds: 0.25,
  maxPayloadBytes: 9_000,
} as const;

export type AcousticTextPayloadType = 'text' | 'prayer';
export type AcousticPayloadType = AcousticTextPayloadType | 'voice';

export type EncodedTextAcousticMessage = {
  messageId: string;
  payloadType: AcousticTextPayloadType;
  text: string;
  payloadBytes: number;
  protocolVersion: number;
  sampleRateHz: number;
  carrierZeroHz: number;
  carrierOneHz: number;
  bitRate: number;
  symbolCount: number;
  durationSeconds: number;
  samples: Float32Array;
  wav: ArrayBuffer;
};

export type EncodedVoiceAcousticMessage = {
  messageId: string;
  payloadType: 'voice';
  audioDurationSeconds: number;
  payloadBytes: number;
  protocolVersion: number;
  sampleRateHz: number;
  carrierFrequenciesHz: readonly number[];
  bitRate: number;
  symbolCount: number;
  durationSeconds: number;
  samples: Float32Array;
  wav: ArrayBuffer;
};

export type EncodedAcousticMessage = EncodedTextAcousticMessage | EncodedVoiceAcousticMessage;

export type DecodedTextAcousticMessage = {
  messageId: string;
  payloadType: AcousticTextPayloadType;
  text: string;
  payloadBytes: number;
  protocolVersion: number;
  sampleRateHz: number;
  integrity: 'verified';
  senderAuthenticated: false;
};

export type DecodedVoiceAcousticMessage = {
  messageId: string;
  payloadType: 'voice';
  audioSamples: Float32Array;
  audioSampleRateHz: number;
  audioDurationSeconds: number;
  payloadBytes: number;
  protocolVersion: number;
  sampleRateHz: number;
  integrity: 'verified';
  senderAuthenticated: false;
};

export type DecodedAcousticMessage = DecodedTextAcousticMessage | DecodedVoiceAcousticMessage;

export type AcousticDecodeErrorCode =
  | 'INVALID_AUDIO'
  | 'PREAMBLE_NOT_FOUND'
  | 'TRUNCATED_FRAME'
  | 'UNSUPPORTED_PROTOCOL'
  | 'UNSUPPORTED_PAYLOAD'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTEGRITY_FAILED'
  | 'INVALID_TEXT';

export class AcousticDecodeError extends Error {
  constructor(readonly code: AcousticDecodeErrorCode, message: string) {
    super(message);
    this.name = 'AcousticDecodeError';
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const preambleBits = bytesToBits(Uint8Array.from(ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes));
const magic = Uint8Array.from([0x5a, 0x43, 0x46, 0x49]); // ZCFI
const preambleSearchSeconds = 5;
const preambleMatchThreshold = Math.ceil(preambleBits.length * 0.875);
const voicePreambleThreshold = Math.ceil(ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length * 0.875);

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push((byte >> bit) & 1);
    }
  }
  return bits;
}

function bitsToBytes(bits: number[]): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error('Bit count must be byte-aligned.');
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    let byte = 0;
    for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
      byte = (byte << 1) | bits[byteIndex * 8 + bitIndex];
    }
    bytes[byteIndex] = byte;
  }
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeFrame(
  payload: Uint8Array,
  payloadType: AcousticPayloadType,
  messageId: string,
  protocolVersion: number = ACOUSTIC_MESSAGE_PROTOCOL.version,
): Uint8Array {
  const header = new Uint8Array(ACOUSTIC_MESSAGE_PROTOCOL.headerBytes);
  header.set(magic, 0);
  header[4] = protocolVersion;
  header[5] = payloadType === 'prayer' ? 2 : payloadType === 'voice' ? 3 : 1;
  header[6] = (payload.length >>> 8) & 0xff;
  header[7] = payload.length & 0xff;
  for (let i = 0; i < 16; i += 1) {
    header[8 + i] = Number.parseInt(messageId.slice(i * 2, i * 2 + 2), 16);
  }

  const protectedBytes = new Uint8Array(header.length + payload.length);
  protectedBytes.set(header, 0);
  protectedBytes.set(payload, header.length);
  const checksum = crc32(protectedBytes);
  const frame = new Uint8Array(
    ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length + protectedBytes.length + 4,
  );
  frame.set(ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes, 0);
  frame.set(protectedBytes, ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length);
  const checksumOffset = frame.length - 4;
  frame[checksumOffset] = (checksum >>> 24) & 0xff;
  frame[checksumOffset + 1] = (checksum >>> 16) & 0xff;
  frame[checksumOffset + 2] = (checksum >>> 8) & 0xff;
  frame[checksumOffset + 3] = checksum & 0xff;
  return frame;
}

function messageIdFromBytes(bytes?: Uint8Array): string {
  const id = bytes ?? new Uint8Array(16);
  if (!bytes) {
    if (!globalThis.crypto?.getRandomValues) {
      throw new Error('Secure random number generation is unavailable in this browser.');
    }
    globalThis.crypto.getRandomValues(id);
  }
  return Array.from(id, value => value.toString(16).padStart(2, '0')).join('');
}

function encodeBfsk(frame: Uint8Array): {
  samples: Float32Array;
  symbolCount: number;
  durationSeconds: number;
} {
  const protocol = ACOUSTIC_MESSAGE_PROTOCOL;
  const sampleRate = protocol.sampleRateHz;
  const samplesPerSymbol = Math.round(sampleRate * protocol.symbolDurationMs / 1_000);
  const bits = bytesToBits(frame);
  const leadingSilence = Math.round(sampleRate * protocol.leadingSilenceMs / 1_000);
  const trailingSilence = Math.round(sampleRate * protocol.trailingSilenceMs / 1_000);
  const samples = new Float32Array(
    leadingSilence + bits.length * samplesPerSymbol + trailingSilence,
  );
  const rampSamples = Math.max(1, Math.round(sampleRate * 0.002));
  let outputOffset = leadingSilence;

  for (const bit of bits) {
    const frequency = bit === 1 ? protocol.carrierOneHz : protocol.carrierZeroHz;
    const angularStep = (2 * Math.PI * frequency) / sampleRate;
    for (let i = 0; i < samplesPerSymbol; i += 1) {
      const envelope = Math.min(
        1,
        (i + 1) / rampSamples,
        (samplesPerSymbol - i) / rampSamples,
      );
      samples[outputOffset + i] = 0.22 * envelope * Math.sin(angularStep * i);
    }
    outputOffset += samplesPerSymbol;
  }

  return {
    samples,
    symbolCount: bits.length,
    durationSeconds: samples.length / sampleRate,
  };
}

export function encodeWav(samples: Float32Array, sampleRateHz: number): ArrayBuffer {
  if (!Number.isSafeInteger(sampleRateHz) || sampleRateHz < 8_000 || sampleRateHz > 192_000) {
    throw new RangeError('WAV sample rate must be between 8,000 and 192,000 Hz.');
  }
  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      44 + i * bytesPerSample,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return buffer;
}

export function encodeAcousticMessage(
  text: string,
  payloadType: AcousticTextPayloadType = 'text',
  options: { messageId?: string } = {},
): EncodedTextAcousticMessage {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Enter a message before encoding.');
  }
  if (payloadType !== 'text' && payloadType !== 'prayer') {
    throw new Error('Unsupported message type.');
  }
  const payload = textEncoder.encode(text);
  if (payload.length > ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes) {
    throw new RangeError(
      `This acoustic packet supports up to ${ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes} UTF-8 bytes.`,
    );
  }
  const messageId = options.messageId ?? messageIdFromBytes();
  if (!/^[0-9a-f]{32}$/i.test(messageId)) {
    throw new Error('Message ID must contain 16 bytes of hexadecimal data.');
  }
  const frame = encodeFrame(payload, payloadType, messageId);
  const modulation = encodeBfsk(frame);
  const wav = encodeWav(modulation.samples, ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz);
  return {
    messageId,
    payloadType,
    text,
    payloadBytes: payload.length,
    protocolVersion: ACOUSTIC_MESSAGE_PROTOCOL.version,
    sampleRateHz: ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz,
    carrierZeroHz: ACOUSTIC_MESSAGE_PROTOCOL.carrierZeroHz,
    carrierOneHz: ACOUSTIC_MESSAGE_PROTOCOL.carrierOneHz,
    bitRate: 1_000 / ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs,
    symbolCount: modulation.symbolCount,
    durationSeconds: modulation.durationSeconds,
    samples: modulation.samples,
    wav,
  };
}

const imaIndexTable = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8] as const;
const imaStepTable = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
  34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
  157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
  724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024,
  3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
  15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
] as const;

function resampleVoiceInput(samples: Float32Array, sampleRateHz: number): Float32Array {
  if (
    !(samples instanceof Float32Array) ||
    !Number.isSafeInteger(sampleRateHz) ||
    sampleRateHz < 8_000 ||
    sampleRateHz > 192_000 ||
    samples.length === 0
  ) {
    throw new RangeError('Choose a valid microphone recording for voice encoding.');
  }
  const durationSeconds = samples.length / sampleRateHz;
  if (
    durationSeconds < ACOUSTIC_VOICE_PROTOCOL.minRecordingSeconds ||
    durationSeconds > ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds
  ) {
    throw new RangeError(
      `Voice packets support recordings from ${ACOUSTIC_VOICE_PROTOCOL.minRecordingSeconds} to ${ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds} seconds.`,
    );
  }

  const targetRate = ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz;
  const targetLength = Math.floor(samples.length * targetRate / sampleRateHz);
  const result = new Float32Array(targetLength);
  const ratio = sampleRateHz / targetRate;
  for (let outputIndex = 0; outputIndex < targetLength; outputIndex += 1) {
    const start = outputIndex * ratio;
    const end = Math.min(samples.length, (outputIndex + 1) * ratio);
    const firstInput = Math.floor(start);
    const lastInput = Math.min(samples.length - 1, Math.ceil(end) - 1);
    let weightedTotal = 0;
    let weightTotal = 0;
    for (let inputIndex = firstInput; inputIndex <= lastInput; inputIndex += 1) {
      const overlap = Math.max(
        0,
        Math.min(end, inputIndex + 1) - Math.max(start, inputIndex),
      );
      const sample = samples[inputIndex];
      if (!Number.isFinite(sample)) {
        throw new RangeError('The voice recording contains invalid audio samples.');
      }
      weightedTotal += Math.max(-1, Math.min(1, sample)) * overlap;
      weightTotal += overlap;
    }
    result[outputIndex] = weightTotal > 0 ? weightedTotal / weightTotal : 0;
  }
  return result;
}

function encodeImaAdpcm(samples: Float32Array): Uint8Array {
  const sampleCount = samples.length;
  const dataBytes = Math.ceil((sampleCount - 1) / 2);
  const payload = new Uint8Array(8 + dataBytes);
  payload[0] = 1; // IMA ADPCM, 4-bit samples
  payload[1] = ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz & 0xff;
  payload[2] = ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz >>> 8;
  payload[3] = sampleCount & 0xff;
  payload[4] = sampleCount >>> 8;

  let predictor = Math.max(-32_768, Math.min(32_767, Math.round(samples[0] * 32_767)));
  const initialPredictor = predictor;
  let stepIndex = 0;
  payload[5] = initialPredictor & 0xff;
  payload[6] = (initialPredictor >>> 8) & 0xff;
  payload[7] = stepIndex;

  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    const target = Math.max(-32_768, Math.min(32_767, Math.round(samples[sampleIndex] * 32_767)));
    const step = imaStepTable[stepIndex];
    let difference = target - predictor;
    let code = 0;
    if (difference < 0) {
      code = 8;
      difference = -difference;
    }
    let delta = step >> 3;
    if (difference >= step) {
      code |= 4;
      difference -= step;
      delta += step;
    }
    if (difference >= step >> 1) {
      code |= 2;
      difference -= step >> 1;
      delta += step >> 1;
    }
    if (difference >= step >> 2) {
      code |= 1;
      delta += step >> 2;
    }
    predictor += (code & 8) !== 0 ? -delta : delta;
    predictor = Math.max(-32_768, Math.min(32_767, predictor));
    stepIndex = Math.max(0, Math.min(88, stepIndex + imaIndexTable[code]));

    const byteIndex = 8 + Math.floor((sampleIndex - 1) / 2);
    if ((sampleIndex - 1) % 2 === 0) payload[byteIndex] = code;
    else payload[byteIndex] |= code << 4;
  }
  return payload;
}

function bytesToEightFskSymbols(bytes: Uint8Array): number[] {
  const symbols: number[] = [];
  const bitCount = bytes.length * 8;
  for (let bitIndex = 0; bitIndex < bitCount; bitIndex += 3) {
    const bitAt = (index: number) => {
      if (index >= bitCount) return 0;
      return (bytes[Math.floor(index / 8)] >> (7 - (index % 8))) & 1;
    };
    symbols.push((bitAt(bitIndex) << 2) | (bitAt(bitIndex + 1) << 1) | bitAt(bitIndex + 2));
  }
  return symbols;
}

function encodeEightFsk(symbols: number[]): {
  samples: Float32Array;
  symbolCount: number;
  durationSeconds: number;
} {
  const protocol = ACOUSTIC_VOICE_PROTOCOL;
  const sampleRate = protocol.sampleRateHz;
  const samplesPerSymbol = Math.round(sampleRate * protocol.symbolDurationMs / 1_000);
  const allSymbols = [...protocol.preambleSymbols, ...symbols];
  const leadingSilence = Math.round(sampleRate * protocol.leadingSilenceMs / 1_000);
  const trailingSilence = Math.round(sampleRate * protocol.trailingSilenceMs / 1_000);
  const samples = new Float32Array(
    leadingSilence + allSymbols.length * samplesPerSymbol + trailingSilence,
  );
  const rampSamples = Math.max(1, Math.round(sampleRate * 0.00035));
  let outputOffset = leadingSilence;
  for (const symbol of allSymbols) {
    const frequency = protocol.carriersHz[symbol];
    const angularStep = (2 * Math.PI * frequency) / sampleRate;
    for (let sampleIndex = 0; sampleIndex < samplesPerSymbol; sampleIndex += 1) {
      const envelope = Math.min(
        1,
        (sampleIndex + 1) / rampSamples,
        (samplesPerSymbol - sampleIndex) / rampSamples,
      );
      samples[outputOffset + sampleIndex] = 0.22 * envelope * Math.sin(angularStep * sampleIndex);
    }
    outputOffset += samplesPerSymbol;
  }
  return {
    samples,
    symbolCount: allSymbols.length,
    durationSeconds: samples.length / sampleRate,
  };
}

export function encodeAcousticVoiceMessage(
  recording: Float32Array,
  sourceSampleRateHz: number,
  options: { messageId?: string } = {},
): EncodedVoiceAcousticMessage {
  const resampled = resampleVoiceInput(recording, sourceSampleRateHz);
  const payload = encodeImaAdpcm(resampled);
  if (payload.length > ACOUSTIC_VOICE_PROTOCOL.maxPayloadBytes) {
    throw new RangeError('This voice recording exceeds the acoustic packet limit.');
  }
  const messageId = options.messageId ?? messageIdFromBytes();
  if (!/^[0-9a-f]{32}$/i.test(messageId)) {
    throw new Error('Message ID must contain 16 bytes of hexadecimal data.');
  }
  const frameWithLegacyPreamble = encodeFrame(
    payload,
    'voice',
    messageId,
    ACOUSTIC_VOICE_PROTOCOL.version,
  );
  const frame = frameWithLegacyPreamble.slice(ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length);
  const modulation = encodeEightFsk(bytesToEightFskSymbols(frame));
  const sampleRateHz = ACOUSTIC_VOICE_PROTOCOL.sampleRateHz;
  return {
    messageId,
    payloadType: 'voice',
    audioDurationSeconds: resampled.length / ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz,
    payloadBytes: payload.length,
    protocolVersion: ACOUSTIC_VOICE_PROTOCOL.version,
    sampleRateHz,
    carrierFrequenciesHz: ACOUSTIC_VOICE_PROTOCOL.carriersHz,
    bitRate: 3_000 / ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs,
    symbolCount: modulation.symbolCount,
    durationSeconds: modulation.durationSeconds,
    samples: modulation.samples,
    wav: encodeWav(modulation.samples, sampleRateHz),
  };
}

function toneEnergy(
  samples: Float32Array,
  start: number,
  end: number,
  sampleRateHz: number,
  frequencyHz: number,
): number {
  const omega = (2 * Math.PI * frequencyHz) / sampleRateHz;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let previousPrevious = 0;
  for (let index = start; index < end; index += 1) {
    const current = samples[index] + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = current;
  }
  return previous * previous +
    previousPrevious * previousPrevious -
    coefficient * previous * previousPrevious;
}

function classifySymbol(
  samples: Float32Array,
  symbolStart: number,
  samplesPerSymbol: number,
  sampleRateHz: number,
): number {
  const analysisStart = symbolStart + Math.round(samplesPerSymbol * 0.18);
  const analysisEnd = Math.min(
    samples.length,
    symbolStart + Math.round(samplesPerSymbol * 0.9),
  );
  const zeroEnergy = toneEnergy(
    samples,
    analysisStart,
    analysisEnd,
    sampleRateHz,
    ACOUSTIC_MESSAGE_PROTOCOL.carrierZeroHz,
  );
  const oneEnergy = toneEnergy(
    samples,
    analysisStart,
    analysisEnd,
    sampleRateHz,
    ACOUSTIC_MESSAGE_PROTOCOL.carrierOneHz,
  );
  return oneEnergy > zeroEnergy ? 1 : 0;
}

function classifyVoiceSymbol(
  samples: Float32Array,
  symbolStart: number,
  samplesPerSymbol: number,
  sampleRateHz: number,
): number {
  const analysisStart = symbolStart + Math.round(samplesPerSymbol * 0.18);
  const analysisEnd = Math.min(
    samples.length,
    symbolStart + Math.round(samplesPerSymbol * 0.9),
  );
  let strongestSymbol = 0;
  let strongestEnergy = -Infinity;
  for (let symbol = 0; symbol < ACOUSTIC_VOICE_PROTOCOL.carriersHz.length; symbol += 1) {
    const energy = toneEnergy(
      samples,
      analysisStart,
      analysisEnd,
      sampleRateHz,
      ACOUSTIC_VOICE_PROTOCOL.carriersHz[symbol],
    );
    if (energy > strongestEnergy) {
      strongestEnergy = energy;
      strongestSymbol = symbol;
    }
  }
  return strongestSymbol;
}

function findVoicePreambleOffset(
  samples: Float32Array,
  sampleRateHz: number,
  samplesPerSymbol: number,
): number {
  const preambleSamples = ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length * samplesPerSymbol;
  const lastCandidate = Math.min(
    samples.length - preambleSamples,
    Math.round(sampleRateHz * preambleSearchSeconds),
  );
  if (lastCandidate < 0) {
    throw new AcousticDecodeError('TRUNCATED_FRAME', 'The recording is too short to contain a voice packet.');
  }
  const coarseStep = Math.max(1, Math.floor(samplesPerSymbol / 4));
  const refineStep = Math.max(1, Math.floor(samplesPerSymbol / 12));
  const checkOffset = (offset: number) => {
    let matches = 0;
    for (let index = 0; index < ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length; index += 1) {
      if (
        classifyVoiceSymbol(
          samples,
          offset + index * samplesPerSymbol,
          samplesPerSymbol,
          sampleRateHz,
        ) === ACOUSTIC_VOICE_PROTOCOL.preambleSymbols[index]
      ) matches += 1;
    }
    return matches;
  };

  for (let coarseOffset = 0; coarseOffset <= lastCandidate; coarseOffset += coarseStep) {
    if (checkOffset(coarseOffset) < voicePreambleThreshold - 3) continue;
    const refineFrom = Math.max(0, coarseOffset - coarseStep);
    const refineTo = Math.min(lastCandidate, coarseOffset + coarseStep);
    for (let offset = refineFrom; offset <= refineTo; offset += refineStep) {
      if (checkOffset(offset) >= voicePreambleThreshold) return offset;
    }
  }
  throw new AcousticDecodeError(
    'PREAMBLE_NOT_FOUND',
    'No supported ZionCore acoustic packet was found in this recording.',
  );
}

function findPreambleOffset(
  samples: Float32Array,
  sampleRateHz: number,
  samplesPerSymbol: number,
): number {
  const preambleSamples = preambleBits.length * samplesPerSymbol;
  const lastCandidate = Math.min(
    samples.length - preambleSamples,
    Math.round(sampleRateHz * preambleSearchSeconds),
  );
  if (lastCandidate < 0) {
    throw new AcousticDecodeError('TRUNCATED_FRAME', 'The recording is too short to contain a packet.');
  }
  const step = Math.max(1, Math.floor(samplesPerSymbol / 8));
  for (let offset = 0; offset <= lastCandidate; offset += step) {
    let matches = 0;
    for (let bitIndex = 0; bitIndex < preambleBits.length; bitIndex += 1) {
      const bit = classifySymbol(
        samples,
        offset + bitIndex * samplesPerSymbol,
        samplesPerSymbol,
        sampleRateHz,
      );
      if (bit === preambleBits[bitIndex]) matches += 1;
    }
    if (matches >= preambleMatchThreshold) return offset;
  }
  throw new AcousticDecodeError(
    'PREAMBLE_NOT_FOUND',
    'No supported ZionCore acoustic packet was found in this recording.',
  );
}

function decodeFrameBytes(
  samples: Float32Array,
  start: number,
  byteCount: number,
  samplesPerSymbol: number,
  sampleRateHz: number,
): Uint8Array {
  const bits: number[] = [];
  for (let bitIndex = 0; bitIndex < byteCount * 8; bitIndex += 1) {
    const symbolStart = start + bitIndex * samplesPerSymbol;
    if (symbolStart + samplesPerSymbol > samples.length) {
      throw new AcousticDecodeError('TRUNCATED_FRAME', 'The packet ended before all message data was received.');
    }
    bits.push(classifySymbol(samples, symbolStart, samplesPerSymbol, sampleRateHz));
  }
  return bitsToBytes(bits);
}

function decodeTextAcousticSamples(
  samples: Float32Array,
  sampleRateHz: number,
): DecodedTextAcousticMessage {
  if (
    !(samples instanceof Float32Array) ||
    !Number.isSafeInteger(sampleRateHz) ||
    sampleRateHz < 8_000 ||
    sampleRateHz > 192_000 ||
    samples.length === 0
  ) {
    throw new AcousticDecodeError('INVALID_AUDIO', 'Choose a decodable audio recording.');
  }
  const samplesPerSymbol = Math.round(
    sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const preambleOffset = findPreambleOffset(samples, sampleRateHz, samplesPerSymbol);
  const bodyOffset = preambleOffset + preambleBits.length * samplesPerSymbol;
  const header = decodeFrameBytes(
    samples,
    bodyOffset,
    ACOUSTIC_MESSAGE_PROTOCOL.headerBytes,
    samplesPerSymbol,
    sampleRateHz,
  );
  if (!magic.every((byte, index) => header[index] === byte)) {
    throw new AcousticDecodeError('UNSUPPORTED_PROTOCOL', 'The signal is not a supported ZionCore packet.');
  }
  const protocolVersion = header[4];
  if (protocolVersion !== ACOUSTIC_MESSAGE_PROTOCOL.version) {
    throw new AcousticDecodeError('UNSUPPORTED_PROTOCOL', `Protocol version ${protocolVersion} is not supported.`);
  }
  const payloadType = header[5] === 1
    ? 'text'
    : header[5] === 2
      ? 'prayer'
      : null;
  if (!payloadType) {
    throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'This packet contains an unsupported payload type.');
  }
  const payloadLength = (header[6] << 8) | header[7];
  if (payloadLength > ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes) {
    throw new AcousticDecodeError('PAYLOAD_TOO_LARGE', 'The packet exceeds this receiver’s supported message size.');
  }

  const remainder = decodeFrameBytes(
    samples,
    bodyOffset + ACOUSTIC_MESSAGE_PROTOCOL.headerBytes * 8 * samplesPerSymbol,
    payloadLength + 4,
    samplesPerSymbol,
    sampleRateHz,
  );
  const payload = remainder.slice(0, payloadLength);
  const protectedBytes = new Uint8Array(header.length + payload.length);
  protectedBytes.set(header, 0);
  protectedBytes.set(payload, header.length);
  const expectedChecksum = crc32(protectedBytes);
  const storedChecksum = (
    (remainder[payloadLength] * 0x1000000) +
    (remainder[payloadLength + 1] << 16) +
    (remainder[payloadLength + 2] << 8) +
    remainder[payloadLength + 3]
  ) >>> 0;
  if (expectedChecksum !== storedChecksum) {
    throw new AcousticDecodeError(
      'INTEGRITY_FAILED',
      'The packet checksum does not match. The recovered message may be incomplete or corrupted.',
    );
  }

  let text: string;
  try {
    text = textDecoder.decode(payload);
  } catch {
    throw new AcousticDecodeError('INVALID_TEXT', 'The verified packet does not contain valid UTF-8 text.');
  }
  return {
    messageId: Array.from(header.slice(8, 24), value => value.toString(16).padStart(2, '0')).join(''),
    payloadType,
    text,
    payloadBytes: payload.length,
    protocolVersion,
    sampleRateHz,
    integrity: 'verified',
    senderAuthenticated: false,
  };
}

function decodeEightFskFrameBytes(
  samples: Float32Array,
  start: number,
  byteCount: number,
  samplesPerSymbol: number,
  sampleRateHz: number,
): Uint8Array {
  const bitCount = byteCount * 8;
  const symbolCount = Math.ceil(bitCount / 3);
  const bits: number[] = [];
  for (let symbolIndex = 0; symbolIndex < symbolCount; symbolIndex += 1) {
    const symbolStart = start + symbolIndex * samplesPerSymbol;
    if (symbolStart + samplesPerSymbol > samples.length) {
      throw new AcousticDecodeError(
        'TRUNCATED_FRAME',
        'The voice packet ended before all message data was received.',
      );
    }
    const symbol = classifyVoiceSymbol(samples, symbolStart, samplesPerSymbol, sampleRateHz);
    bits.push((symbol >> 2) & 1, (symbol >> 1) & 1, symbol & 1);
  }
  return bitsToBytes(bits.slice(0, bitCount));
}

function decodeImaAdpcm(payload: Uint8Array): {
  audioSamples: Float32Array;
  audioSampleRateHz: number;
} {
  if (payload.length < 9 || payload[0] !== 1) {
    throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'This voice codec version is not supported.');
  }
  const sampleRateHz = payload[1] | (payload[2] << 8);
  const sampleCount = payload[3] | (payload[4] << 8);
  if (
    sampleRateHz !== ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz ||
    sampleCount < ACOUSTIC_VOICE_PROTOCOL.minRecordingSeconds * sampleRateHz ||
    sampleCount > ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds * sampleRateHz ||
    payload.length !== 8 + Math.ceil((sampleCount - 1) / 2)
  ) {
    throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'The voice packet contains invalid audio metadata.');
  }
  let predictor = (payload[5] | (payload[6] << 8));
  if (predictor & 0x8000) predictor -= 0x1_0000;
  let stepIndex = payload[7];
  if (stepIndex > 88) {
    throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'The voice packet contains an invalid codec state.');
  }
  const decoded = new Float32Array(sampleCount);
  decoded[0] = predictor / 32_768;
  for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
    const encodedByte = payload[8 + Math.floor((sampleIndex - 1) / 2)];
    const code = (sampleIndex - 1) % 2 === 0 ? encodedByte & 0x0f : encodedByte >> 4;
    const step = imaStepTable[stepIndex];
    let difference = step >> 3;
    if (code & 4) difference += step;
    if (code & 2) difference += step >> 1;
    if (code & 1) difference += step >> 2;
    predictor += (code & 8) !== 0 ? -difference : difference;
    predictor = Math.max(-32_768, Math.min(32_767, predictor));
    stepIndex = Math.max(0, Math.min(88, stepIndex + imaIndexTable[code]));
    decoded[sampleIndex] = predictor / 32_768;
  }
  return { audioSamples: decoded, audioSampleRateHz: sampleRateHz };
}

function decodeVoiceAcousticSamples(
  samples: Float32Array,
  sampleRateHz: number,
): DecodedVoiceAcousticMessage {
  if (
    !(samples instanceof Float32Array) ||
    !Number.isSafeInteger(sampleRateHz) ||
    sampleRateHz < 8_000 ||
    sampleRateHz > 192_000 ||
    samples.length === 0
  ) {
    throw new AcousticDecodeError('INVALID_AUDIO', 'Choose a decodable audio recording.');
  }
  const samplesPerSymbol = Math.round(
    sampleRateHz * ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const preambleOffset = findVoicePreambleOffset(samples, sampleRateHz, samplesPerSymbol);
  const bodyOffset = preambleOffset +
    ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length * samplesPerSymbol;
  const header = decodeEightFskFrameBytes(
    samples,
    bodyOffset,
    ACOUSTIC_MESSAGE_PROTOCOL.headerBytes,
    samplesPerSymbol,
    sampleRateHz,
  );
  if (!magic.every((byte, index) => header[index] === byte)) {
    throw new AcousticDecodeError('UNSUPPORTED_PROTOCOL', 'The signal is not a supported ZionCore voice packet.');
  }
  if (header[4] !== ACOUSTIC_VOICE_PROTOCOL.version) {
    throw new AcousticDecodeError(
      'UNSUPPORTED_PROTOCOL',
      `Voice protocol version ${header[4]} is not supported.`,
    );
  }
  if (header[5] !== 3) {
    throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'This voice packet contains an unsupported payload type.');
  }
  const payloadLength = (header[6] << 8) | header[7];
  if (payloadLength > ACOUSTIC_VOICE_PROTOCOL.maxPayloadBytes) {
    throw new AcousticDecodeError('PAYLOAD_TOO_LARGE', 'The voice packet exceeds this receiver’s supported size.');
  }
  const remainder = decodeEightFskFrameBytes(
    samples,
    bodyOffset + ACOUSTIC_MESSAGE_PROTOCOL.headerBytes * 8 / 3 * samplesPerSymbol,
    payloadLength + 4,
    samplesPerSymbol,
    sampleRateHz,
  );
  const payload = remainder.slice(0, payloadLength);
  const protectedBytes = new Uint8Array(header.length + payload.length);
  protectedBytes.set(header, 0);
  protectedBytes.set(payload, header.length);
  const expectedChecksum = crc32(protectedBytes);
  const storedChecksum = (
    (remainder[payloadLength] * 0x1000000) +
    (remainder[payloadLength + 1] << 16) +
    (remainder[payloadLength + 2] << 8) +
    remainder[payloadLength + 3]
  ) >>> 0;
  if (expectedChecksum !== storedChecksum) {
    throw new AcousticDecodeError(
      'INTEGRITY_FAILED',
      'The voice packet checksum does not match. The recovered audio may be incomplete or corrupted.',
    );
  }
  const audio = decodeImaAdpcm(payload);
  return {
    messageId: Array.from(header.slice(8, 24), value => value.toString(16).padStart(2, '0')).join(''),
    payloadType: 'voice',
    audioSamples: audio.audioSamples,
    audioSampleRateHz: audio.audioSampleRateHz,
    audioDurationSeconds: audio.audioSamples.length / audio.audioSampleRateHz,
    payloadBytes: payload.length,
    protocolVersion: header[4],
    sampleRateHz,
    integrity: 'verified',
    senderAuthenticated: false,
  };
}

export function decodeAcousticSamples(
  samples: Float32Array,
  sampleRateHz: number,
): DecodedAcousticMessage {
  try {
    return decodeTextAcousticSamples(samples, sampleRateHz);
  } catch (textError) {
    if (!(textError instanceof AcousticDecodeError)) throw textError;
    try {
      return decodeVoiceAcousticSamples(samples, sampleRateHz);
    } catch (voiceError) {
      if (
        voiceError instanceof AcousticDecodeError &&
        voiceError.code !== 'PREAMBLE_NOT_FOUND'
      ) throw voiceError;
      throw textError;
    }
  }
}
