import { z } from 'zod';

export const DSP_SAMPLE_RATES_HZ = [22050, 44100, 48000] as const;
export const MAX_DSP_OUTPUT_SECONDS = 10;
export const MAX_DSP_OUTPUT_SAMPLES = 480000;
export const MAX_DSP_OUTPUT_AMPLITUDE = 0.25;

export const DspConfigSchema = z.object({
  sampleRateHz: z.union([z.literal(22050), z.literal(44100), z.literal(48000)]),
  durationSeconds: z.number().finite().min(0.1).max(MAX_DSP_OUTPUT_SECONDS),
  waveform: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
  frequencyHz: z.number().finite().min(20).max(10000),
  amplitude: z.number().finite().min(0).max(MAX_DSP_OUTPUT_AMPLITUDE),
  modulation: z.enum(['none', 'am', 'fm']),
  modulationRateHz: z.number().finite().min(0.1).max(20),
  modulationDepth: z.number().finite().min(0).max(1),
  filter: z.enum(['none', 'lowpass', 'highpass', 'bandpass']),
  lowCutoffHz: z.number().finite().min(20).max(20000),
  highCutoffHz: z.number().finite().min(20).max(20000),
}).strict().superRefine((config, context) => {
  const nyquistHz = config.sampleRateHz / 2;
  if (config.frequencyHz >= nyquistHz) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['frequencyHz'],
      message: 'Carrier frequency must be below the selected sample rate’s Nyquist limit.',
    });
  }
  if (config.lowCutoffHz >= config.highCutoffHz) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['lowCutoffHz'],
      message: 'The low filter cutoff must be less than the high cutoff.',
    });
  }
  if (config.highCutoffHz >= nyquistHz) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['highCutoffHz'],
      message: 'Filter cutoffs must be below the selected sample rate’s Nyquist limit.',
    });
  }
  if (config.modulation === 'fm'
    && config.frequencyHz + config.frequencyHz * config.modulationDepth * 0.5 >= nyquistHz) {
    context.addIssue({
      code: z.ZodIssueCode.custom, path: ['modulationDepth'],
      message: 'FM deviation would reach or exceed Nyquist; reduce carrier frequency or modulation depth.',
    });
  }
});

export type DspConfig = z.infer<typeof DspConfigSchema>;

export const DEFAULT_DSP_CONFIG: DspConfig = {
  sampleRateHz: 44100,
  durationSeconds: 2,
  waveform: 'sine',
  frequencyHz: 440,
  amplitude: 0.1,
  modulation: 'none',
  modulationRateHz: 2,
  modulationDepth: 0.35,
  filter: 'none',
  lowCutoffHz: 120,
  highCutoffHz: 8000,
};

export type DspSignal = {
  config: DspConfig;
  samples: Float32Array;
  sampleCount: number;
  peakAmplitude: number;
  rmsAmplitude: number;
};

function oscillatorValue(waveform: DspConfig['waveform'], phase: number) {
  const sine = Math.sin(phase);
  switch (waveform) {
    case 'sine': return sine;
    case 'triangle': return (2 / Math.PI) * Math.asin(sine);
    case 'square': return sine >= 0 ? 1 : -1;
    case 'sawtooth': return ((phase / (2 * Math.PI)) % 1) * 2 - 1;
  }
}

export function createDspSignal(input: unknown): DspSignal {
  const config = DspConfigSchema.parse(input);
  const sampleCount = Math.round(config.sampleRateHz * config.durationSeconds);
  if (sampleCount < 1 || sampleCount > MAX_DSP_OUTPUT_SAMPLES) {
    throw new Error(`Generated signals are limited to ${MAX_DSP_OUTPUT_SAMPLES.toLocaleString()} samples.`);
  }

  const samples = new Float32Array(sampleCount);
  const fadeSamples = Math.min(Math.round(config.sampleRateHz * 0.005), Math.floor(sampleCount / 2));
  const lowpassAlpha = 1 - Math.exp(-2 * Math.PI * config.highCutoffHz / config.sampleRateHz);
  const highpassAlpha = Math.exp(-2 * Math.PI * config.lowCutoffHz / config.sampleRateHz);
  let phase = 0;
  let previousInput = 0;
  let previousHighpass = 0;
  let previousLowpass = 0;
  let peakAmplitude = 0;
  let squareSum = 0;

  for (let index = 0; index < sampleCount; index++) {
    const time = index / config.sampleRateHz;
    const modulation = Math.sin(2 * Math.PI * config.modulationRateHz * time);
    const deviationHz = config.modulation === 'fm'
      ? config.frequencyHz * config.modulationDepth * 0.5 * modulation
      : 0;
    phase += 2 * Math.PI * (config.frequencyHz + deviationHz) / config.sampleRateHz;
    if (phase >= 2 * Math.PI) phase %= 2 * Math.PI;

    let sample = oscillatorValue(config.waveform, phase) * config.amplitude;
    if (config.modulation === 'am') {
      sample *= (1 - config.modulationDepth) + config.modulationDepth * (1 + modulation) / 2;
    }
    if (config.filter === 'highpass' || config.filter === 'bandpass') {
      const filtered = highpassAlpha * (previousHighpass + sample - previousInput);
      previousInput = sample;
      previousHighpass = filtered;
      sample = filtered;
    }
    if (config.filter === 'lowpass' || config.filter === 'bandpass') {
      previousLowpass += lowpassAlpha * (sample - previousLowpass);
      sample = previousLowpass;
    }

    if (fadeSamples > 0) {
      const fade = Math.min(1, index / fadeSamples, (sampleCount - 1 - index) / fadeSamples);
      sample *= fade;
    }
    samples[index] = sample;
    peakAmplitude = Math.max(peakAmplitude, Math.abs(sample));
    squareSum += sample * sample;
  }

  return {
    config, samples, sampleCount, peakAmplitude,
    rmsAmplitude: Math.sqrt(squareSum / sampleCount),
  };
}

export function encodeDspSignalAsPcm16Wav(samples: Float32Array, sampleRateHz: number): ArrayBuffer {
  if (!DSP_SAMPLE_RATES_HZ.includes(sampleRateHz as typeof DSP_SAMPLE_RATES_HZ[number])) {
    throw new Error('WAV export sample rate is not supported.');
  }
  if (samples.length === 0 || samples.length > MAX_DSP_OUTPUT_SAMPLES) {
    throw new Error(`WAV export must contain between 1 and ${MAX_DSP_OUTPUT_SAMPLES.toLocaleString()} samples.`);
  }
  if (samples.length / sampleRateHz > MAX_DSP_OUTPUT_SECONDS) {
    throw new Error(`WAV export duration cannot exceed ${MAX_DSP_OUTPUT_SECONDS} seconds.`);
  }
  for (const sample of samples) {
    if (!Number.isFinite(sample) || Math.abs(sample) > MAX_DSP_OUTPUT_AMPLITUDE) {
      throw new Error(`WAV export samples must be finite and no greater than ${MAX_DSP_OUTPUT_AMPLITUDE.toFixed(2)} FS.`);
    }
  }

  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeFourCC = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeFourCC(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeFourCC(8, 'WAVE');
  writeFourCC(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeFourCC(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    view.setInt16(44 + index * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
