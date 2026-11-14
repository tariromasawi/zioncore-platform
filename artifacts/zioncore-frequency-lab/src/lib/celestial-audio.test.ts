import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DtmfAudioReceiver from '@/components/dtmf-audio-receiver';
import { encodeWav } from '@/lib/acoustic-message';
import { decodeCelestialAudio, CelestialAudioDecodeError } from '@/lib/celestial-audio';
import {
  createCelestialWaveform,
  encodeCelestialMessage,
  type EncodedSignal,
} from '@/lib/celestial-experiment';
import { decodeWavMonoSamples } from '@/lib/celestial-wav';

function fileFrom(buffer: ArrayBuffer, name = 'dtmf-packet.wav') {
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return { name, size: blob.size, arrayBuffer: () => blob.arrayBuffer() };
}

function waveformFor(message: string, symbolDurationMs: 50 | 75 | 100, sampleRateHz = 44_100) {
  const encoded: EncodedSignal = {
    ...encodeCelestialMessage(message, symbolDurationMs),
    sampleRateHz,
  };
  return { encoded, samples: createCelestialWaveform(encoded, 0.04) };
}

test('generated DTMF audio decodes to symbols and text at every supported symbol duration', () => {
  const message = 'MWARI NDI MWARI.';
  for (const symbolDurationMs of [50, 75, 100] as const) {
    const { encoded, samples } = waveformFor(message, symbolDurationMs);
    const decoded = decodeCelestialAudio(samples, encoded.sampleRateHz);
    assert.equal(decoded.message, message);
    assert.equal(decoded.protocolId, encoded.protocolId);
    assert.equal(decoded.symbolDurationMs, symbolDurationMs);
    assert.equal(decoded.sampleRateHz, 44_100);
    assert.equal(decoded.checksum, 'verified');
    assert.deepEqual(decoded.symbols, encoded.symbols);
  }
});

test('audio-to-symbol recovery honors the declared rate across supported WAV rates', () => {
  const message = 'Rate check.';
  for (const sampleRateHz of [8_000, 16_000, 22_050, 44_100, 48_000, 96_000]) {
    const { encoded, samples } = waveformFor(message, 50, sampleRateHz);
    const decoded = decodeCelestialAudio(samples, sampleRateHz);
    assert.equal(decoded.message, message);
    assert.equal(decoded.sampleRateHz, sampleRateHz);
    assert.equal(decoded.symbolDurationMs, encoded.symbolDurationMs);
  }
});

test('local WAV import preserves sample rate and packet recovery after leading silence', async () => {
  const message = 'A WAV audio round trip.';
  for (const sampleRateHz of [8_000, 16_000, 22_050, 44_100, 48_000, 96_000]) {
    const { encoded, samples } = waveformFor(message, 75, sampleRateHz);
    const padded = new Float32Array(sampleRateHz + samples.length);
    padded.set(samples, sampleRateHz);
    const wav = encodeWav(padded, sampleRateHz);
    const decodedWav = await decodeWavMonoSamples(fileFrom(wav));
    const decoded = decodeCelestialAudio(decodedWav.samples, decodedWav.sampleRateHz);

    assert.equal(decodedWav.sampleRateHz, sampleRateHz);
    assert.equal(decodedWav.sourceChannels, 1);
    assert.equal(decoded.message, message);
    assert.equal(decoded.symbolDurationMs, encoded.symbolDurationMs);
    assert.ok(decoded.packetStartSeconds >= 0.99 && decoded.packetStartSeconds <= 1.01);
  }
});

test('DTMF audio receiver panel renders exact decoded text and symbol provenance', () => {
  const { encoded, samples } = waveformFor('Visible local result.', 75);
  const decoded = decodeCelestialAudio(samples, encoded.sampleRateHz);
  const html = renderToStaticMarkup(createElement(DtmfAudioReceiver, {
    fileName: 'zioncore-zc-exp-dtmf-v1.wav',
    result: decoded,
    running: false,
    error: '',
    onSelectFile: () => {},
  }));

  assert.match(html, /processed locally in this browser/);
  assert.match(html, /Visible local result\./);
  assert.match(html, /DTMF SYMBOLS/);
  assert.match(html, /CRC verified/);
  assert.match(html, /44,100/);
  assert.match(html, /text-dtmf-symbols/);
});

test('audio packet with modified data symbols is rejected by the packet checksum', () => {
  const encoded = encodeCelestialMessage('A checksum protects this payload.', 50);
  const corruptedSymbols = [...encoded.symbols];
  corruptedSymbols[20] = (corruptedSymbols[20] + 1) % 16;
  const corruptWaveform = createCelestialWaveform({ ...encoded, symbols: corruptedSymbols }, 0.04);

  assert.throws(
    () => decodeCelestialAudio(corruptWaveform, encoded.sampleRateHz, {
      symbolDurationMs: encoded.symbolDurationMs as 50 | 75 | 100,
    }),
    error => error instanceof CelestialAudioDecodeError && error.code === 'CHECKSUM_FAILED',
  );
});

test('silence, unsupported rates, invalid samples, and truncated packets fail clearly', () => {
  assert.throws(
    () => decodeCelestialAudio(new Float32Array(44_100), 44_100),
    /No measurable DTMF tone energy/,
  );
  assert.throws(
    () => decodeCelestialAudio(new Float32Array(100), 7_999),
    error => error instanceof CelestialAudioDecodeError && error.code === 'INVALID_SAMPLE_RATE',
  );
  const invalidSamples = new Float32Array([0, Number.NaN, 0]);
  assert.throws(
    () => decodeCelestialAudio(invalidSamples, 44_100),
    error => error instanceof CelestialAudioDecodeError && error.code === 'INVALID_AUDIO',
  );

  const { encoded, samples } = waveformFor('Truncated packet fixture.', 50);
  const symbolSamples = Math.round(encoded.sampleRateHz * encoded.symbolDurationMs / 1000);
  const gapSamples = Math.round(encoded.sampleRateHz * encoded.interSymbolGapMs / 1000);
  const headerOnly = samples.slice(0, (4 + 10) * (symbolSamples + gapSamples));
  assert.throws(
    () => decodeCelestialAudio(headerOnly, encoded.sampleRateHz, {
      symbolDurationMs: encoded.symbolDurationMs as 50 | 75 | 100,
    }),
    error => error instanceof CelestialAudioDecodeError && error.code === 'INVALID_FRAME',
  );
});

