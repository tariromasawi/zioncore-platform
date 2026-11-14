import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
  AcousticDecodeError,
  decodeAcousticSamples,
  encodeAcousticVoiceMessage,
  encodeAcousticMessage,
} from './acoustic-message';

const fixedMessageId = '00112233445566778899aabbccddeeff';

function decodeMonoPcm16WavSamples(wav: ArrayBuffer): Float32Array {
  const view = new DataView(wav);
  assert.equal(String.fromCharCode(...Array.from({ length: 4 }, (_, index) => view.getUint8(index))), 'RIFF');
  assert.equal(String.fromCharCode(...Array.from({ length: 4 }, (_, index) => view.getUint8(8 + index))), 'WAVE');
  assert.equal(view.getUint16(22, true), 1, 'expected mono WAV');
  assert.equal(view.getUint16(34, true), 16, 'expected PCM16 WAV');
  const dataBytes = view.getUint32(40, true);
  const samples = new Float32Array(dataBytes / 2);
  for (let index = 0; index < samples.length; index += 1) {
    const value = view.getInt16(44 + index * 2, true);
    samples[index] = value < 0 ? value / 0x8000 : value / 0x7fff;
  }
  return samples;
}

test('BFSK frame round-trips English, Shona, and Unicode text with a verified checksum', () => {
  for (const text of [
    'Hello from ZionCore.',
    'Mwari ndiye Mwari.',
    '祝福 — שלום — مرحبا',
  ]) {
    const encoded = encodeAcousticMessage(text, 'text', { messageId: fixedMessageId });
    const decoded = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);

    assert.equal(decoded.payloadType, 'text');
    if (decoded.payloadType === 'voice') throw new Error('Expected a text packet.');
    assert.equal(decoded.text, text);
    assert.equal(decoded.messageId, fixedMessageId);
    assert.equal(decoded.integrity, 'verified');
    assert.equal(decoded.senderAuthenticated, false);
  }
});

test('devotional messages retain their payload type without changing the text', () => {
  const encoded = encodeAcousticMessage(
    'A private prayer for reflection.',
    'prayer',
    { messageId: fixedMessageId },
  );
  const decoded = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);

  assert.equal(decoded.payloadType, 'prayer');
  if (decoded.payloadType === 'voice') throw new Error('Expected a prayer packet.');
  assert.equal(decoded.payloadType, 'prayer');
  assert.equal(decoded.text, 'A private prayer for reflection.');
});

test('round-trips a payload exactly at the 512-byte UTF-8 boundary', () => {
  const text = '🌟'.repeat(128);
  const encoded = encodeAcousticMessage(text, 'text', {
    messageId: fixedMessageId,
  });
  const decoded = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);

  if (decoded.payloadType === 'voice') throw new Error('Expected a text packet.');
  assert.equal(encoded.payloadBytes, ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes);
  assert.equal(decoded.payloadBytes, ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes);
  assert.equal(decoded.text, text);
});

test('the output is a playable mono PCM WAV with a safe protocol sample rate', () => {
  const encoded = encodeAcousticMessage('Test signal.', 'text', {
    messageId: fixedMessageId,
  });
  const wav = new DataView(encoded.wav);
  const readAscii = (offset: number, count: number) =>
    String.fromCharCode(...Array.from({ length: count }, (_, index) => wav.getUint8(offset + index)));

  assert.equal(readAscii(0, 4), 'RIFF');
  assert.equal(readAscii(8, 4), 'WAVE');
  assert.equal(wav.getUint32(24, true), ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz);
  assert.equal(wav.getUint16(22, true), 1);
  assert.equal(wav.getUint16(34, true), 16);
});

test('an exported PCM WAV can be decoded by the compatible file-receive path', () => {
  const text = 'Mhoroi — hello 🌿';
  const encoded = encodeAcousticMessage(text, 'text', { messageId: fixedMessageId });
  const wavSamples = decodeMonoPcm16WavSamples(encoded.wav);
  const decoded = decodeAcousticSamples(wavSamples, encoded.sampleRateHz);

  assert.equal(decoded.payloadType, 'text');
  if (decoded.payloadType === 'voice') throw new Error('Expected a text packet.');
  assert.equal(decoded.text, text);
  assert.equal(decoded.integrity, 'verified');
});

test('deterministic room-noise fixture allows moderate noise but rejects a harsher noisy-room signal', () => {
  const encoded = encodeAcousticMessage('A nearby acoustic test.', 'text', {
    messageId: fixedMessageId,
  });
  const addDeterministicNoise = (amplitude: number) => {
    const samples = encoded.samples.slice();
    let state = 123_456_789;
    for (let index = 0; index < samples.length; index += 1) {
      state = (1_664_525 * state + 1_013_904_223) >>> 0;
      samples[index] += amplitude * ((state / 0x1_0000_0000) * 2 - 1);
    }
    return samples;
  };

  const moderate = decodeAcousticSamples(addDeterministicNoise(0.06), encoded.sampleRateHz);
  assert.equal(moderate.payloadType, 'text');
  if (moderate.payloadType === 'voice') throw new Error('Expected a text packet.');
  assert.equal(moderate.text, 'A nearby acoustic test.');

  assert.throws(
    () => decodeAcousticSamples(addDeterministicNoise(0.18), encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError && error.code === 'INTEGRITY_FAILED',
    'high interference must fail integrity instead of yielding a partial or invented message',
  );
});

test('corrupted signal data is rejected by the frame checksum', () => {
  const encoded = encodeAcousticMessage('Integrity matters.', 'text', {
    messageId: fixedMessageId,
  });
  const samples = encoded.samples.slice();
  const preambleSymbols = ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length * 8;
  const headerSymbols = ACOUSTIC_MESSAGE_PROTOCOL.headerBytes * 8;
  const payloadBit = preambleSymbols + headerSymbols + 3;
  const samplesPerSymbol = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const leadingSilence = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.leadingSilenceMs / 1_000,
  );
  const start = leadingSilence + payloadBit * samplesPerSymbol;
  const frequency = ACOUSTIC_MESSAGE_PROTOCOL.carrierOneHz;
  for (let i = 0; i < samplesPerSymbol; i += 1) {
    samples[start + i] = 0.22 * Math.sin((2 * Math.PI * frequency * i) / encoded.sampleRateHz);
  }

  assert.throws(
    () => decodeAcousticSamples(samples, encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError && error.code === 'INTEGRITY_FAILED',
  );
});

test('unsupported or oversized payloads fail explicitly', () => {
  assert.throws(
    () => encodeAcousticMessage('   '),
    /Enter a message/,
  );
  assert.throws(
    () => encodeAcousticMessage('x'.repeat(ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes + 1)),
    /supports up to/,
  );
});

test('noise without a supported preamble is not reported as a decoded message', () => {
  assert.throws(
    () => decodeAcousticSamples(new Float32Array(48_000), 48_000),
    error => error instanceof AcousticDecodeError && error.code === 'PREAMBLE_NOT_FOUND',
  );
});

test('rejects a packet truncated during the payload and invalid audio sample rates', () => {
  const encoded = encodeAcousticMessage('This frame will be cut short.', 'text', {
    messageId: fixedMessageId,
  });
  const trailingSilence = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.trailingSilenceMs / 1_000,
  );
  const samplesPerSymbol = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const truncated = encoded.samples.slice(
    0,
    encoded.samples.length - trailingSilence - samplesPerSymbol * 2,
  );

  assert.throws(
    () => decodeAcousticSamples(truncated, encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError && error.code === 'TRUNCATED_FRAME',
  );

  for (const sampleRateHz of [0, 7_999, 192_001, 48_000.5, Number.NaN]) {
    assert.throws(
      () => decodeAcousticSamples(new Float32Array([0]), sampleRateHz),
      error => error instanceof AcousticDecodeError && error.code === 'INVALID_AUDIO',
    );
  }
});

test('finds a packet after a leading capture delay and rejects a dropped symbol', () => {
  const encoded = encodeAcousticMessage('Recover after capture delay.', 'text', {
    messageId: fixedMessageId,
  });
  const leadingDelaySamples = Math.round(encoded.sampleRateHz * 0.25);
  const delayed = new Float32Array(leadingDelaySamples + encoded.samples.length);
  delayed.set(encoded.samples, leadingDelaySamples);
  const recovered = decodeAcousticSamples(delayed, encoded.sampleRateHz);
  assert.equal(recovered.payloadType, 'text');
  if (recovered.payloadType === 'voice') throw new Error('Expected a text packet.');
  assert.equal(recovered.text, 'Recover after capture delay.');

  const samplesPerSymbol = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const dropSymbolIndex = ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length * 8
    + ACOUSTIC_MESSAGE_PROTOCOL.headerBytes * 8 + 8;
  const dropStart = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.leadingSilenceMs / 1_000,
  ) + dropSymbolIndex * samplesPerSymbol;
  const packetWithDroppedSymbol = new Float32Array(encoded.samples.length - samplesPerSymbol);
  packetWithDroppedSymbol.set(encoded.samples.subarray(0, dropStart), 0);
  packetWithDroppedSymbol.set(
    encoded.samples.subarray(dropStart + samplesPerSymbol),
    dropStart,
  );
  assert.throws(
    () => decodeAcousticSamples(packetWithDroppedSymbol, encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError
      && ['TRUNCATED_FRAME', 'INTEGRITY_FAILED'].includes(error.code),
  );
});

test('a repeated valid packet remains decodable and retains its same untrusted ID', () => {
  const encoded = encodeAcousticMessage('Replay test packet.', 'text', {
    messageId: fixedMessageId,
  });
  const first = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);
  const second = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);
  assert.equal(first.messageId, fixedMessageId);
  assert.equal(second.messageId, first.messageId);
  assert.equal(second.integrity, 'verified');
  assert.equal(second.senderAuthenticated, false);
});

test('version 2 voice packets round-trip locally with an independently playable decoded payload', () => {
  const sourceRate = 48_000;
  const sourceDuration = 0.25;
  const samples = new Float32Array(sourceRate * sourceDuration);
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sourceRate;
    const envelope = Math.min(1, time * 30, (sourceDuration - time) * 30);
    samples[index] = 0.55 * envelope * Math.sin(2 * Math.PI * 440 * time);
  }

  const encoded = encodeAcousticVoiceMessage(samples, sourceRate, {
    messageId: fixedMessageId,
  });
  const decoded = decodeAcousticSamples(encoded.samples, encoded.sampleRateHz);

  assert.equal(encoded.payloadType, 'voice');
  assert.equal(encoded.protocolVersion, ACOUSTIC_VOICE_PROTOCOL.version);
  assert.equal(decoded.payloadType, 'voice');
  if (decoded.payloadType !== 'voice') throw new Error('Expected a voice packet.');
  assert.equal(decoded.messageId, fixedMessageId);
  assert.equal(decoded.integrity, 'verified');
  assert.equal(decoded.senderAuthenticated, false);
  assert.equal(decoded.audioSampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz);
  assert.equal(decoded.audioSamples.length, 2_000);
  assert.ok(decoded.audioSamples.every(Number.isFinite));
});

test('voice protocol accepts its exact maximum duration and stays under its payload limit', () => {
  const maximumDurationSamples = new Float32Array(
    ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz * ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds,
  ).fill(0.1);
  const encoded = encodeAcousticVoiceMessage(
    maximumDurationSamples,
    ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz,
    { messageId: fixedMessageId },
  );

  assert.equal(encoded.audioDurationSeconds, ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds);
  assert.ok(encoded.payloadBytes <= ACOUSTIC_VOICE_PROTOCOL.maxPayloadBytes);
  assert.ok(encoded.durationSeconds > encoded.audioDurationSeconds);
});

test('rejects voice corruption, unsupported durations, and invalid source rates', () => {
  const sourceRate = 48_000;
  const samples = new Float32Array(sourceRate * 0.25);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = 0.5 * Math.sin((2 * Math.PI * 330 * index) / sourceRate);
  }
  const encoded = encodeAcousticVoiceMessage(samples, sourceRate, {
    messageId: fixedMessageId,
  });
  const corrupted = encoded.samples.slice();
  const samplesPerSymbol = Math.round(
    encoded.sampleRateHz * ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const dataSymbolIndex = ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length + 64 + 64;
  const symbolStart = Math.round(
    encoded.sampleRateHz * ACOUSTIC_VOICE_PROTOCOL.leadingSilenceMs / 1_000,
  ) + dataSymbolIndex * samplesPerSymbol;
  for (let index = 0; index < samplesPerSymbol; index += 1) {
    corrupted[symbolStart + index] = 0.22 * Math.sin(
      (2 * Math.PI * 6_800 * index) / encoded.sampleRateHz,
    );
  }
  assert.throws(
    () => decodeAcousticSamples(corrupted, encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError && error.code === 'INTEGRITY_FAILED',
  );
  assert.throws(() => encodeAcousticVoiceMessage(new Float32Array(sourceRate * 0.1), sourceRate));
  assert.throws(() => encodeAcousticVoiceMessage(new Float32Array(sourceRate * 2.1), sourceRate));
  assert.throws(() => encodeAcousticVoiceMessage(samples, 7_999));
  const invalidSamples = samples.slice();
  invalidSamples[0] = Number.NaN;
  assert.throws(() => encodeAcousticVoiceMessage(invalidSamples, sourceRate), /invalid audio samples/);
});
