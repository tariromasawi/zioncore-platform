import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AudioInputError,
  encodeBase64Strict,
  hasExplicitAudioConsent,
  inspectAndChunkPcmWav,
} from './ai-audio-input';
import { AUDIO_CONSENT_VERSION } from '@workspace/frequency-ai-contract';

function makePcmWav(sampleRate: number, durationSeconds: number, channels = 1, bitDepth = 16) {
  const blockAlign = channels * bitDepth / 8;
  const frameCount = sampleRate * durationSeconds;
  const pcm = Buffer.alloc(frameCount * blockAlign);
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitDepth, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  return wav;
}

test('chunks PCM WAV into bounded native-rate segments and reports its digest', () => {
  const wav = makePcmWav(96_000, 23, 1, 16);
  const result = inspectAndChunkPcmWav(wav);
  assert.equal(result.sampleRate, 96_000);
  assert.equal(result.channels, 1);
  assert.equal(result.durationSeconds, 23);
  assert.ok(result.segments.length >= 3);
  assert.equal(result.segments.reduce((total, part) => total + part.durationSeconds, 0), 23);
  for (const segment of result.segments) {
    assert.equal(segment.wav.toString('ascii', 0, 4), 'RIFF');
    assert.ok(segment.wav.length <= 1_500_000 + 64);
    assert.ok(segment.durationSeconds <= 10);
  }
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('rejects compressed, oversized, malformed and too-long audio before provider use', () => {
  assert.throws(() => inspectAndChunkPcmWav(Buffer.from('not wav')), AudioInputError);
  assert.throws(() => inspectAndChunkPcmWav(makePcmWav(8_000, 601)), /3 seconds to 10 minutes/);
  const compressed = makePcmWav(48_000, 3);
  compressed.writeUInt16LE(3, 20);
  assert.throws(() => inspectAndChunkPcmWav(compressed), /uncompressed integer PCM/);
});

test('accepts a ten-minute mono WAV in bounded segments without reducing its sample rate', () => {
  const wav = makePcmWav(8_000, 600);
  const result = inspectAndChunkPcmWav(wav);
  assert.equal(result.durationSeconds, 600);
  assert.equal(result.sampleRate, 8_000);
  assert.equal(result.segments.length, 60);
  assert.equal(result.segments.reduce((total, segment) => total + segment.durationSeconds, 0), 600);
});

test('strict base64 decoder rejects malformed and excess input', () => {
  assert.deepEqual(encodeBase64Strict(Buffer.from('WAVE').toString('base64')), Buffer.from('WAVE'));
  assert.throws(() => encodeBase64Strict('not base64!'), /invalid or exceeds/);
  assert.throws(() => encodeBase64Strict('YQ'), /invalid or exceeds/);
});

test('external audio consent must be affirmative and match the current disclosure version', () => {
  assert.equal(hasExplicitAudioConsent(true, AUDIO_CONSENT_VERSION), true);
  assert.equal(hasExplicitAudioConsent(false, AUDIO_CONSENT_VERSION), false);
  assert.equal(hasExplicitAudioConsent(undefined, AUDIO_CONSENT_VERSION), false);
  assert.equal(hasExplicitAudioConsent('true', AUDIO_CONSENT_VERSION), false);
  assert.equal(hasExplicitAudioConsent(true, 'old-consent-version'), false);
});
