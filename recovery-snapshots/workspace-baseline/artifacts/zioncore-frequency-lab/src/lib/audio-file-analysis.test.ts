import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeWavFile,
  segmentWavFile,
  MAX_AUDIO_FILE_BYTES,
  MAX_AUDIO_ANALYSIS_WINDOWS,
} from '@/lib/audio-file-analysis';

type WaveOptions = {
  sampleRate?: number;
  channels?: number;
  bits?: number;
  encoding?: number;
  frames?: number;
  amplitude?: number;
  frequencyHz?: number;
  corruptBlockAlign?: boolean;
  bursts?: Array<{ startSeconds: number; endSeconds: number; amplitude: number; frequencyHz: number }>;
};

function makeWave({
  sampleRate = 48000,
  channels = 1,
  bits = 16,
  encoding = 1,
  frames = 8192,
  amplitude = 0.7,
  frequencyHz = 40 * sampleRate / 2048,
  corruptBlockAlign = false,
  bursts,
}: WaveOptions = {}) {
  const bytesPerSample = bits / 8;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, encoding, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, corruptBlockAlign ? blockAlign + 1 : blockAlign, true);
  view.setUint16(34, bits, true);
  writeText(36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let frame = 0; frame < frames; frame++) {
    const seconds = frame / sampleRate;
    const burst = bursts?.find(item => seconds >= item.startSeconds && seconds < item.endSeconds);
    const activeAmplitude = bursts ? burst?.amplitude ?? 0 : amplitude;
    const activeFrequency = burst?.frequencyHz ?? frequencyHz;
    const sample = activeAmplitude * Math.sin(2 * Math.PI * activeFrequency * frame / sampleRate);
    for (let channel = 0; channel < channels; channel++) {
      const offset = 44 + frame * blockAlign + channel * bytesPerSample;
      if (encoding === 3) view.setFloat32(offset, sample, true);
      else if (bits === 8) view.setUint8(offset, Math.round(sample * 127 + 128));
      else if (bits === 16) view.setInt16(offset, Math.round(sample * 32767), true);
      else if (bits === 24) {
        let value = Math.round(sample * 0x7fffff);
        if (value < 0) value += 0x1000000;
        view.setUint8(offset, value & 0xff);
        view.setUint8(offset + 1, (value >> 8) & 0xff);
        view.setUint8(offset + 2, (value >> 16) & 0xff);
      } else view.setInt32(offset, Math.round(sample * 0x7fffffff), true);
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function fileFrom(blob: Blob, name = 'test.wav') {
  return {
    name,
    size: blob.size,
    arrayBuffer: () => blob.arrayBuffer(),
  };
}

test('imports each supported PCM depth and float WAV locally, preserving measured tone and source metadata', async () => {
  for (const [encoding, bits] of [[1, 8], [1, 16], [1, 24], [1, 32], [3, 32]]) {
    const blob = makeWave({ encoding, bits, frames: 8192 });
    const result = await analyzeWavFile(fileFrom(blob), 2048);
    assert.equal(result.reading.source, 'audio-file');
    assert.equal(result.reading.sampleRate, 48000);
    assert.equal(result.reading.fftSize, 2048);
    assert.equal(
      result.reading.dominant, 40 * 48000 / 2048,
      `unexpected measured peak for WAV encoding=${encoding}, bits=${bits}; peaks=${result.reading.peaks.join(',')}; bins=${result.reading.bins.slice(35, 45).join(',')}`,
    );
    assert.ok(result.reading.peaks.includes(40 * 48000 / 2048));
    assert.ok(result.reading.rms > 0.4 && result.reading.rms < 0.6);
    assert.equal(result.reading.waveform.length, 256);
    assert.ok(result.reading.waveformWindowSeconds > 0);
    assert.ok(result.reading.waveform.some(point => point.maximum > 0.6));
    assert.ok(result.reading.waveform.some(point => point.minimum < -0.6));
    assert.equal(result.sourceChannels, 1);
    assert.equal(result.analyzedWindows, 2);
  }
});

test('segments local WAV into bounded energy candidates with measured timing and spectral features', async () => {
  const blob = makeWave({
    sampleRate: 16000,
    frames: 32000,
    bursts: [
      { startSeconds: 0.25, endSeconds: 0.55, amplitude: 0.6, frequencyHz: 1000 },
      { startSeconds: 1, endSeconds: 1.35, amplitude: 0.5, frequencyHz: 2000 },
    ],
  });
  const result = await segmentWavFile(fileFrom(blob, 'field-recording.wav'));
  assert.equal(result.sourceName, 'field-recording.wav');
  assert.equal(result.sourceSampleRateHz, 16000);
  assert.equal(result.methodId, 'short-time-rms-hysteresis');
  assert.equal(result.events.length, 2);
  assert.ok(Math.abs(result.events[0].startSeconds - 0.25) < 0.03);
  assert.ok(Math.abs(result.events[0].endSeconds - 0.55) < 0.04);
  assert.ok(Math.abs((result.events[0].dominantFrequencyHz ?? 0) - 1000) < 80);
  assert.ok(Math.abs((result.events[1].dominantFrequencyHz ?? 0) - 2000) < 100);
  assert.ok(result.events.every(event => event.durationSeconds >= 0.04 && event.meanRms > 0));
});

test('silent files produce no candidate events and cancelled segmentation stops safely', async () => {
  const silent = fileFrom(makeWave({
    sampleRate: 8000,
    frames: 8000,
    amplitude: 0,
    frequencyHz: 0,
  }));
  const result = await segmentWavFile(silent);
  assert.equal(result.candidateEventCount, 0);
  assert.deepEqual(result.events, []);
  await assert.rejects(
    segmentWavFile(silent, () => false),
    /cancelled before processing/,
  );
});

test('event segmentation rejects unsupported sample rates, channels, and oversized duration', async () => {
  await assert.rejects(
    segmentWavFile(fileFrom(makeWave({ sampleRate: 4000, frames: 8000 }))),
    /sample rates must be between 8 kHz and 96 kHz/,
  );
  await assert.rejects(
    segmentWavFile(fileFrom(makeWave({ channels: 3, frames: 8192 }))),
    /Only mono or stereo/,
  );
  await assert.rejects(
    segmentWavFile(fileFrom(makeWave({ sampleRate: 8000, frames: 8000 * 61 }))),
    /60-second local analysis limit/,
  );
});

test('accepts mono and stereo only and accurately reports stereo downmix measurements', async () => {
  const stereo = await analyzeWavFile(fileFrom(makeWave({ channels: 2, frames: 4096 })), 2048);
  assert.equal(stereo.sourceChannels, 2);
  assert.ok(stereo.reading.rms > 0.4);
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ channels: 3 })), 2048),
    /Only mono or stereo/,
  );
});

test('validates the file-size bound before reading file contents', async () => {
  let readCount = 0;
  await assert.rejects(
    analyzeWavFile({
      name: 'too-large.wav',
      size: MAX_AUDIO_FILE_BYTES + 1,
      arrayBuffer: async () => {
        readCount++;
        return new ArrayBuffer(0);
      },
    }, 2048),
    /no larger than 24 MiB/,
  );
  assert.equal(readCount, 0);
});

test('cancels before decoding or processing when the user leaves the import flow', async () => {
  let current = true;
  const blob = makeWave();
  await assert.rejects(
    analyzeWavFile(
      { name: 'cancelled.wav', size: blob.size, arrayBuffer: async () => {
        current = false;
        return blob.arrayBuffer();
      } },
      2048,
      () => current,
    ),
    /cancelled before processing/i,
  );
});

test('rejects unrecognized, truncated, inconsistent, and unsupported WAV files', async () => {
  await assert.rejects(
    analyzeWavFile(fileFrom(new Blob(['not audio'])), 2048),
    /Unsupported file format/,
  );
  const valid = await makeWave().arrayBuffer();
  await assert.rejects(
    analyzeWavFile(fileFrom(new Blob([valid.slice(0, 35)])), 2048),
    /invalid or truncated RIFF length/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ corruptBlockAlign: true })), 2048),
    /format, sample layout, and data length do not agree/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ encoding: 6 })), 2048),
    /Only uncompressed PCM or IEEE-float/,
  );
});

test('rejects unsupported rates, excessive duration, short input, and out-of-range float samples', async () => {
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ sampleRate: 7999 })), 2048),
    /between 8 kHz and 96 kHz/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ sampleRate: 96001 })), 2048),
    /between 8 kHz and 96 kHz/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ sampleRate: 8000, frames: 480001 })), 2048),
    /duration exceeds the 60-second/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ frames: 1024 })), 2048),
    /too short for a 2,048-sample FFT/,
  );
  await assert.rejects(
    analyzeWavFile(fileFrom(makeWave({ encoding: 3, bits: 32, amplitude: 1.2 })), 2048),
    /out-of-range float sample/,
  );
});

test('samples at most the fixed number of bounded FFT windows for long recordings', async () => {
  const result = await analyzeWavFile(
    fileFrom(makeWave({ sampleRate: 8000, frames: 480000 })),
    2048,
  );
  assert.equal(result.durationSeconds, 60);
  assert.equal(result.analyzedWindows, MAX_AUDIO_ANALYSIS_WINDOWS);
});
