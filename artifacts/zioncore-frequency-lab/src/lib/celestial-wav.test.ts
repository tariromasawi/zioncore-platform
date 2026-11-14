import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWav } from '@/lib/acoustic-message';
import { decodeWavMonoSamples } from '@/lib/celestial-wav';

function fileFrom(buffer: ArrayBuffer, name = 'local-signal.wav') {
  return {
    name,
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  };
}

test('local WAV adapter preserves source rate, channels, duration, and measured RMS', async () => {
  const samples = Float32Array.from({ length: 16_000 }, (_, index) =>
    index < 8_000 ? 0 : Math.sin((2 * Math.PI * 440 * index) / 16_000) * 0.2,
  );
  const decoded = await decodeWavMonoSamples(fileFrom(encodeWav(samples, 16_000)));
  assert.equal(decoded.sampleRateHz, 16_000);
  assert.equal(decoded.sourceChannels, 1);
  assert.equal(decoded.durationSeconds, 1);
  assert.ok(decoded.rms > 0 && decoded.rms < 0.2);
  assert.equal(decoded.samples.length, 16_000);
});

test('local WAV adapter rejects unsupported decoder rates and long files before decoding', async () => {
  await assert.rejects(
    decodeWavMonoSamples(fileFrom(encodeWav(new Float32Array(192_000), 192_000))),
    /supports 8–96 kHz/,
  );
  await assert.rejects(
    decodeWavMonoSamples(fileFrom(encodeWav(new Float32Array(36 * 8_000), 8_000))),
    /35-second local packet-decoding limit/,
  );
});

test('local WAV adapter rejects oversized, changed, and cancelled files', async () => {
  await assert.rejects(
    decodeWavMonoSamples({ ...fileFrom(encodeWav(new Float32Array(8_000), 8_000)), size: 25 * 1024 * 1024 }),
    /no larger than 24 MiB/,
  );
  const source = encodeWav(new Float32Array(8_000), 8_000);
  await assert.rejects(
    decodeWavMonoSamples({ ...fileFrom(source), size: source.byteLength + 1 }),
    /changed or exceeded/,
  );
  await assert.rejects(
    decodeWavMonoSamples(fileFrom(source), () => false),
    /cancelled before processing/,
  );
});
