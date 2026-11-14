import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWav } from './acoustic-message';
import { decodeNativeWav, sourceRateLabel } from './voice-v2-audio';

for (const rate of [22_050, 44_100]) {
  test(`keeps a WAV at its declared ${rate} Hz rate`, () => {
    const input = new Float32Array(Math.round(rate / 4));
    input[0] = 0.5;
    const decoded = decodeNativeWav(encodeWav(input, rate));
    assert.equal(decoded.sampleRateHz, rate);
    assert.equal(decoded.channels, 1);
    assert.equal(decoded.bitDepth, 16);
    assert.ok(Math.abs(decoded.durationSeconds - .25) < 1 / rate);
    assert.ok(Math.abs(decoded.samples[0] - .5) < .0001);
  });
}

test('does not label a browser AudioBuffer rate as the original compressed-file rate', () => {
    const originalRate: number | null = null;
    const browserBufferRate = 48_000;
    assert.equal(sourceRateLabel(originalRate), 'Unavailable');
    assert.equal(sourceRateLabel(browserBufferRate), '48.00 kHz');
});
