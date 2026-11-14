import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWav } from './acoustic-message';
import { segmentWavFile } from './bioacoustic-audio';

function wavFile(samples: Float32Array, sampleRateHz: number, name = 'field-recording.wav') {
  const wav = encodeWav(samples, sampleRateHz);
  return {
    name,
    size: wav.byteLength,
    arrayBuffer: async () => wav,
  };
}

test('segments bounded acoustic events and reports measurable features without species claims', async () => {
  const sampleRateHz = 16_000;
  const samples = new Float32Array(sampleRateHz);
  for (let index = sampleRateHz / 5; index < sampleRateHz * 3 / 5; index++) {
    samples[index] = 0.45 * Math.sin(2 * Math.PI * 1_200 * index / sampleRateHz);
  }
  const result = await segmentWavFile(wavFile(samples, sampleRateHz));
  assert.equal(result.sourceSampleRateHz, sampleRateHz);
  assert.equal(result.sourceName, 'field-recording.wav');
  assert.equal(result.methodId, 'short-time-rms-hysteresis');
  assert.equal(result.candidateEventCount, 1);
  assert.equal(result.events.length, 1);
  assert.ok(result.events[0].startSeconds >= 0.18 && result.events[0].startSeconds <= 0.22);
  assert.ok(result.events[0].endSeconds >= 0.58 && result.events[0].endSeconds <= 0.62);
  assert.ok(result.events[0].dominantFrequencyHz != null);
  assert.ok(Math.abs(result.events[0].dominantFrequencyHz! - 1_200) <= 80);
  assert.equal(result.events[0].id, 'event-001');
});

test('returns no events for bounded silence and reports cancellation', async () => {
  const silent = wavFile(new Float32Array(16_000), 16_000);
  const result = await segmentWavFile(silent);
  assert.equal(result.events.length, 0);
  assert.equal(result.candidateEventCount, 0);
  await assert.rejects(
    segmentWavFile(silent, () => false),
    /cancelled before processing/,
  );
});

test('rejects unsupported files, rates, channels, and duration before analysis', async () => {
  const unsupported = {
    name: 'not-wav.mp3',
    size: 4,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  };
  await assert.rejects(segmentWavFile(unsupported), /RIFF\/WAVE/);
  const lowRateWav = encodeWav(new Float32Array(8_000), 8_000);
  const lowRateView = new DataView(lowRateWav);
  lowRateView.setUint32(24, 4_000, true);
  lowRateView.setUint32(28, 8_000, true);
  const lowRateFile = {
    name: 'unsupported-rate.wav',
    size: lowRateWav.byteLength,
    arrayBuffer: async () => lowRateWav,
  };
  await assert.rejects(
    segmentWavFile(lowRateFile),
    /between 8 kHz and 192 kHz/,
  );
  await assert.rejects(
    segmentWavFile(wavFile(new Float32Array(16_000 * 61), 16_000)),
    /60-second local segmentation limit/,
  );
});
