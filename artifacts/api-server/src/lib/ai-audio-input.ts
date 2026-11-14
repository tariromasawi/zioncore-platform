import { createHash } from 'node:crypto';
import {
  AUDIO_CONSENT_VERSION,
  MAX_EXTERNAL_AUDIO_BYTES,
  MAX_EXTERNAL_AUDIO_CHUNK_BYTES,
  MAX_EXTERNAL_AUDIO_CHUNK_SECONDS,
  MAX_EXTERNAL_AUDIO_CHUNKS,
  MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
} from '@workspace/frequency-ai-contract';

export {
  MAX_EXTERNAL_AUDIO_BYTES,
  MAX_EXTERNAL_AUDIO_CHUNK_BYTES,
  MAX_EXTERNAL_AUDIO_CHUNK_SECONDS,
  MAX_EXTERNAL_AUDIO_CHUNKS,
  MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
};

export type PcmWavSegment = {
  index: number;
  durationSeconds: number;
  wav: Buffer;
};

export type PcmWavInspection = {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  durationSeconds: number;
  segments: PcmWavSegment[];
  sha256: string;
};

export class AudioInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioInputError';
  }
}

export function hasExplicitAudioConsent(consent: unknown, consentVersion: unknown): boolean {
  return consent === true && consentVersion === AUDIO_CONSENT_VERSION;
}

function makeSegmentWav(formatChunk: Buffer, pcmFrames: Buffer): Buffer {
  const wav = Buffer.alloc(12 + 8 + formatChunk.length + 8 + pcmFrames.length);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(formatChunk.length, 16);
  formatChunk.copy(wav, 20);
  const dataHeaderOffset = 20 + formatChunk.length;
  wav.write('data', dataHeaderOffset, 'ascii');
  wav.writeUInt32LE(pcmFrames.length, dataHeaderOffset + 4);
  pcmFrames.copy(wav, dataHeaderOffset + 8);
  return wav;
}

export function inspectAndChunkPcmWav(input: Buffer): PcmWavInspection {
  if (input.length === 0 || input.length > MAX_EXTERNAL_AUDIO_BYTES) {
    throw new AudioInputError('Choose a PCM WAV recording no larger than 24 MB for advanced audio review.');
  }
  if (
    input.length < 44 ||
    input.toString('ascii', 0, 4) !== 'RIFF' ||
    input.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new AudioInputError('Advanced audio review currently accepts PCM WAV recordings only.');
  }

  const declaredRiffBytes = input.readUInt32LE(4) + 8;
  if (declaredRiffBytes !== input.length) {
    throw new AudioInputError('This WAV has an invalid or unsupported container length.');
  }

  let formatChunk: Buffer | null = null;
  let dataChunk: Buffer | null = null;
  let dataOffset = 12;
  while (dataOffset + 8 <= input.length) {
    const id = input.toString('ascii', dataOffset, dataOffset + 4);
    const size = input.readUInt32LE(dataOffset + 4);
    const start = dataOffset + 8;
    if (size > input.length - start) {
      throw new AudioInputError('This WAV contains an incomplete audio chunk.');
    }
    if (id === 'fmt ') {
      if (formatChunk) throw new AudioInputError('This WAV has duplicate format chunks.');
      formatChunk = input.subarray(start, start + size);
    } else if (id === 'data') {
      if (dataChunk) throw new AudioInputError('This WAV has multiple audio data chunks.');
      dataChunk = input.subarray(start, start + size);
    }
    const nextOffset = start + size + (size % 2);
    if (nextOffset <= dataOffset) throw new AudioInputError('This WAV contains an invalid chunk offset.');
    dataOffset = nextOffset;
  }

  if (!formatChunk || formatChunk.length < 16 || !dataChunk) {
    throw new AudioInputError('This WAV is missing its audio format or sample data.');
  }
  const format = formatChunk.readUInt16LE(0);
  const channels = formatChunk.readUInt16LE(2);
  const sampleRate = formatChunk.readUInt32LE(4);
  const byteRate = formatChunk.readUInt32LE(8);
  const blockAlign = formatChunk.readUInt16LE(12);
  const bitDepth = formatChunk.readUInt16LE(14);
  if (format !== 1 || ![8, 16, 24, 32].includes(bitDepth)) {
    throw new AudioInputError('Advanced audio review needs an uncompressed integer PCM WAV.');
  }
  if (
    ![1, 2].includes(channels) ||
    !Number.isSafeInteger(sampleRate) ||
    sampleRate < 8_000 ||
    sampleRate > 192_000
  ) {
    throw new AudioInputError('Advanced audio review supports mono or stereo PCM WAV from 8–192 kHz.');
  }
  const expectedBlockAlign = channels * (bitDepth / 8);
  if (
    blockAlign !== expectedBlockAlign ||
    byteRate !== sampleRate * blockAlign ||
    dataChunk.length === 0 ||
    dataChunk.length % blockAlign !== 0
  ) {
    throw new AudioInputError('This WAV has inconsistent PCM format metadata.');
  }

  const totalFrames = dataChunk.length / blockAlign;
  const durationSeconds = totalFrames / sampleRate;
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 3 ||
    durationSeconds > MAX_EXTERNAL_AUDIO_DURATION_SECONDS
  ) {
    throw new AudioInputError('Advanced audio review accepts WAV recordings from 3 seconds to 10 minutes.');
  }

  const framesPerChunk = Math.min(
    sampleRate * MAX_EXTERNAL_AUDIO_CHUNK_SECONDS,
    Math.floor(MAX_EXTERNAL_AUDIO_CHUNK_BYTES / blockAlign),
  );
  if (framesPerChunk < sampleRate) {
    throw new AudioInputError('This WAV format exceeds the safe segment size for external analysis.');
  }
  const chunkCount = Math.ceil(totalFrames / framesPerChunk);
  if (chunkCount > MAX_EXTERNAL_AUDIO_CHUNKS) {
    throw new AudioInputError('This WAV would require too many provider requests. Use a smaller or shorter PCM WAV.');
  }

  const segments: PcmWavSegment[] = [];
  for (let index = 0, firstFrame = 0; firstFrame < totalFrames; index += 1) {
    const frameCount = Math.min(framesPerChunk, totalFrames - firstFrame);
    const start = firstFrame * blockAlign;
    const end = start + frameCount * blockAlign;
    segments.push({
      index,
      durationSeconds: frameCount / sampleRate,
      wav: makeSegmentWav(formatChunk, dataChunk.subarray(start, end)),
    });
    firstFrame += frameCount;
  }

  return {
    sampleRate,
    channels,
    bitDepth,
    durationSeconds,
    segments,
    sha256: createHash('sha256').update(input).digest('hex'),
  };
}

export function encodeBase64Strict(value: string): Buffer {
  if (
    !value ||
    value.length > Math.ceil(MAX_EXTERNAL_AUDIO_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    throw new AudioInputError('The uploaded audio data is invalid or exceeds the 24 MB limit.');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) {
    throw new AudioInputError('The uploaded audio data is not valid base64.');
  }
  if (decoded.length === 0 || decoded.length > MAX_EXTERNAL_AUDIO_BYTES) {
    throw new AudioInputError('The uploaded audio data is invalid or exceeds the 24 MB limit.');
  }
  return decoded;
}
