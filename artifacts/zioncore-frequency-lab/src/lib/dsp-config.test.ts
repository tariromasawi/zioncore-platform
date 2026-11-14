import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createDspSignal,
  DEFAULT_DSP_CONFIG,
  DspConfigSchema,
  encodeDspSignalAsPcm16Wav,
  MAX_DSP_OUTPUT_AMPLITUDE,
  MAX_DSP_OUTPUT_SAMPLES,
} from '@/lib/dsp-config';

test('valid default configuration creates a bounded, faded sine signal', () => {
  const signal = createDspSignal(DEFAULT_DSP_CONFIG);
  assert.equal(signal.config.waveform, 'sine');
  assert.equal(signal.sampleCount, 44100 * 2);
  assert.equal(signal.samples.length, signal.sampleCount);
  assert.ok(signal.peakAmplitude <= DEFAULT_DSP_CONFIG.amplitude);
  assert.ok(signal.rmsAmplitude > 0);
  assert.equal(signal.samples[0], 0);
  assert.equal(signal.samples.at(-1), 0);
});

test('all waveform types use the configured conservative amplitude ceiling', () => {
  for (const waveform of ['sine', 'triangle', 'square', 'sawtooth'] as const) {
    const signal = createDspSignal({ ...DEFAULT_DSP_CONFIG, waveform });
    assert.ok(signal.peakAmplitude <= MAX_DSP_OUTPUT_AMPLITUDE);
    assert.ok(signal.samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
  }
});

test('AM and FM modulation change the generated signal while staying within bounds', () => {
  const plain = createDspSignal(DEFAULT_DSP_CONFIG);
  const am = createDspSignal({
    ...DEFAULT_DSP_CONFIG, modulation: 'am', modulationRateHz: 4, modulationDepth: 0.8,
  });
  const fm = createDspSignal({
    ...DEFAULT_DSP_CONFIG, modulation: 'fm', modulationRateHz: 4, modulationDepth: 0.8,
  });
  assert.notDeepEqual(am.samples.slice(0, 256), plain.samples.slice(0, 256));
  assert.notDeepEqual(fm.samples.slice(0, 256), plain.samples.slice(0, 256));
  assert.ok(am.peakAmplitude <= DEFAULT_DSP_CONFIG.amplitude);
  assert.ok(fm.peakAmplitude <= DEFAULT_DSP_CONFIG.amplitude);
});

test('lowpass, highpass, and bandpass filters change output using validated cutoffs', () => {
  const highTone = { ...DEFAULT_DSP_CONFIG, frequencyHz: 5000, durationSeconds: 0.5 };
  const unfilteredHigh = createDspSignal(highTone);
  const lowpassed = createDspSignal({ ...highTone, filter: 'lowpass', highCutoffHz: 500 });
  assert.ok(lowpassed.rmsAmplitude < unfilteredHigh.rmsAmplitude * 0.25);

  const lowTone = { ...DEFAULT_DSP_CONFIG, frequencyHz: 220, durationSeconds: 0.5 };
  const unfilteredLow = createDspSignal(lowTone);
  const highpassed = createDspSignal({ ...lowTone, filter: 'highpass', lowCutoffHz: 1200 });
  const bandpassed = createDspSignal({
    ...lowTone, filter: 'bandpass', lowCutoffHz: 1200, highCutoffHz: 3000,
  });
  assert.ok(highpassed.rmsAmplitude < unfilteredLow.rmsAmplitude * 0.5);
  assert.ok(bandpassed.rmsAmplitude < unfilteredLow.rmsAmplitude * 0.5);
});

test('configuration validation rejects unsafe sizes, levels, Nyquist violations, and invalid filter bands', () => {
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, durationSeconds: 11,
  }).success, false);
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, amplitude: 0.26,
  }).success, false);
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, sampleRateHz: 22050, frequencyHz: 11025,
  }).success, false);
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, filter: 'bandpass', lowCutoffHz: 9000, highCutoffHz: 8000,
  }).success, false);
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, modulation: 'fm', sampleRateHz: 22050, frequencyHz: 10000,
  }).success, false);
  assert.equal(DspConfigSchema.safeParse({
    ...DEFAULT_DSP_CONFIG, unexpected: true,
  }).success, false);
});

test('longest accepted signal and PCM16 WAV export have consistent bounded headers', () => {
  const signal = createDspSignal({
    ...DEFAULT_DSP_CONFIG, sampleRateHz: 48000, durationSeconds: 10,
  });
  assert.equal(signal.sampleCount, MAX_DSP_OUTPUT_SAMPLES);
  const wav = encodeDspSignalAsPcm16Wav(signal.samples, signal.config.sampleRateHz);
  const view = new DataView(wav);
  assert.equal(wav.byteLength, 44 + signal.sampleCount * 2);
  assert.equal(view.getUint32(4, true), wav.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), signal.sampleCount * 2);
});

test('WAV export rejects unsupported rates and invalid sample arrays', () => {
  assert.throws(() => encodeDspSignalAsPcm16Wav(new Float32Array([0]), 32000), /sample rate is not supported/);
  assert.throws(() => encodeDspSignalAsPcm16Wav(new Float32Array(), 44100), /between 1 and/);
  assert.throws(() => encodeDspSignalAsPcm16Wav(new Float32Array([0.3]), 44100), /no greater than 0.25 FS/);
  assert.throws(() => encodeDspSignalAsPcm16Wav(new Float32Array([Number.NaN]), 44100), /finite and no greater than/);
  assert.throws(() => encodeDspSignalAsPcm16Wav(new Float32Array(480000), 22050), /duration cannot exceed 10 seconds/);
});
