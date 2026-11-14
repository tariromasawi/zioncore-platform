import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
  AcousticDecodeError,
  decodeAcousticSamples,
  encodeAcousticMessage,
  encodeAcousticVoiceMessage,
  encodeWav,
  resampleAcousticSamples,
} from './acoustic-message';

const messageId = '00112233445566778899aabbccddeeff';

function resampleLinear(input: Float32Array, fromRate: number, toRate: number) {
  const output = new Float32Array(Math.round(input.length * toRate / fromRate));
  for (let i = 0; i < output.length; i++) {
    const source = i * fromRate / toRate;
    const left = Math.floor(source);
    const fraction = source - left;
    const a = input[Math.min(left, input.length - 1)];
    const b = input[Math.min(left + 1, input.length - 1)];
    output[i] = a + (b - a) * fraction;
  }
  return output;
}

function downmixStereo(left: Float32Array, right: Float32Array) {
  const mono = new Float32Array(left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (left[i] + right[i]) / 2;
  return mono;
}

function createVoicePacket() {
  const sourceRate = 48_000;
  const samples = new Float32Array(sourceRate / 4);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.35 * Math.sin(2 * Math.PI * 330 * i / sourceRate);
  }
  return encodeAcousticVoiceMessage(samples, sourceRate, { messageId });
}

function readMonoPcm16Wav(wav: ArrayBuffer) {
  const view = new DataView(wav);
  assert.equal(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)), 'RIFF');
  assert.equal(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)), 'WAVE');
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint16(34, true), 16);
  const sampleRateHz = view.getUint32(24, true);
  const dataBytes = view.getUint32(40, true);
  const samples = new Float32Array(dataBytes / 2);
  for (let i = 0; i < samples.length; i++) {
    const value = view.getInt16(44 + i * 2, true);
    samples[i] = value < 0 ? value / 0x8000 : value / 0x7fff;
  }
  return { samples, sampleRateHz };
}

test('text v1 round-trips Unicode across common browser recording sample rates', () => {
  const text = 'Mhoroi — Shona, English, שלום, and 🌿';
  const encoded = encodeAcousticMessage(text, 'text', { messageId });
  for (const rate of [8_000, 16_000, 22_050, 24_000, 32_000, 44_100, 48_000, 96_000]) {
    const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
    const decoded = decodeAcousticSamples(downmixStereo(samples, samples), rate);
    assert.equal(decoded.payloadType, 'text', `sample rate ${rate}`);
    if (decoded.payloadType === 'text') {
      assert.equal(decoded.text, text, `sample rate ${rate}`);
      assert.equal(decoded.protocolVersion, ACOUSTIC_MESSAGE_PROTOCOL.version);
      assert.equal(decoded.sampleRateHz, rate);
    }
  }
});

test('voice v2 packet round-trips after resampling at supported browser rates', () => {
  const encoded = createVoicePacket();
  for (const rate of [16_000, 22_050, 24_000, 32_000, 44_100, 48_000, 96_000]) {
    const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
    const decoded = decodeAcousticSamples(downmixStereo(samples, samples), rate);
    assert.equal(decoded.payloadType, 'voice', `sample rate ${rate}`);
    if (decoded.payloadType === 'voice') {
      assert.equal(decoded.messageId, messageId);
      assert.equal(decoded.protocolVersion, ACOUSTIC_VOICE_PROTOCOL.version);
      assert.equal(decoded.sampleRateHz, rate, 'preserve the source rate in the result');
      assert.equal(decoded.decoderSampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sampleRateHz);
      assert.equal(decoded.audioSampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz);
      assert.equal(decoded.integrity, 'verified');
    }
  }
});

test('voice v2 decodes from a PCM WAV carrying a 44.1 kHz device rate', () => {
  const encoded = createVoicePacket();
  const deviceRate = 44_100;
  const deviceSamples = resampleLinear(encoded.samples, encoded.sampleRateHz, deviceRate);
  const wav = encodeWav(deviceSamples, deviceRate);
  const received = readMonoPcm16Wav(wav);
  const decoded = decodeAcousticSamples(received.samples, received.sampleRateHz);

  assert.equal(received.sampleRateHz, deviceRate);
  assert.equal(decoded.payloadType, 'voice');
  if (decoded.payloadType === 'voice') {
    assert.equal(decoded.messageId, messageId);
    assert.equal(decoded.decoderSampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sampleRateHz);
    assert.equal(decoded.integrity, 'verified');
  }
});

test('8 kHz can receive text but gives a clear unsupported-rate error for voice v2', () => {
  const encoded = createVoicePacket();
  const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, 8_000);
  assert.throws(
    () => decodeAcousticSamples(samples, 8_000),
    error => error instanceof AcousticDecodeError
      && error.code === 'UNSUPPORTED_SAMPLE_RATE'
      && /6,800 Hz carrier/.test(error.message),
  );
});

test('windowed-sinc resampling preserves in-band tone and suppresses an aliased tone', () => {
  const sourceRate = 96_000;
  const seconds = 0.1;
  const makeTone = (frequencyHz: number) => {
    const samples = new Float32Array(sourceRate * seconds);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5 * Math.sin(2 * Math.PI * frequencyHz * i / sourceRate);
    }
    return samples;
  };
  const inBand = resampleAcousticSamples(makeTone(5_000), sourceRate, 48_000);
  const aboveTargetNyquist = resampleAcousticSamples(makeTone(30_000), sourceRate, 48_000);
  const rms = (samples: Float32Array) =>
    Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);

  assert.equal(inBand.length, 4_800);
  assert.ok(rms(inBand) > 0.32, 'in-band 5 kHz signal should be preserved');
  assert.ok(rms(aboveTargetNyquist) < 0.01, '30 kHz content should be attenuated before 48 kHz decoding');
});

test('resampled 44.1 kHz voice still rejects payload corruption with a checksum error', () => {
  const encoded = createVoicePacket();
  const rate = 44_100;
  const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
  const symbolIndex = ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length + 64 + 64;
  const samplesPerSymbol = rate * ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs / 1_000;
  const symbolStart = Math.round(rate * ACOUSTIC_VOICE_PROTOCOL.leadingSilenceMs / 1_000)
    + Math.round(symbolIndex * samplesPerSymbol);
  for (let i = 0; i < Math.ceil(samplesPerSymbol); i++) {
    samples[symbolStart + i] = 0.22 * Math.sin(
      2 * Math.PI * ACOUSTIC_VOICE_PROTOCOL.carriersHz[7] * i / rate,
    );
  }
  assert.throws(
    () => decodeAcousticSamples(samples, rate),
    error => error instanceof AcousticDecodeError && error.code === 'INTEGRITY_FAILED',
  );
});

test('malformed rates, non-finite samples, and oversized input are rejected explicitly', () => {
  assert.throws(
    () => resampleAcousticSamples(new Float32Array([0]), 44_100, 0),
    error => error instanceof AcousticDecodeError && error.code === 'INVALID_AUDIO',
  );
  assert.throws(
    () => resampleAcousticSamples(new Float32Array([Number.NaN]), 44_100),
    error => error instanceof AcousticDecodeError && /non-finite/.test(error.message),
  );
  assert.throws(
    () => resampleAcousticSamples(new Float32Array(81 * 8_000), 8_000),
    error => error instanceof AcousticDecodeError && /duration/.test(error.message),
  );
  assert.throws(
    () => decodeAcousticSamples(new Float32Array(81 * 16_000), 16_000),
    error => error instanceof AcousticDecodeError && /80-second/.test(error.message),
  );
});
