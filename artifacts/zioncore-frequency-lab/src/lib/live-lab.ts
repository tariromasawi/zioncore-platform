import type { InstrumentAdapter } from '@/lib/hardware-instruments';

export type Reading = {
  source: 'microphone' | 'audio-file';
  sampleRate: number;
  fftSize: number;
  resolution: number;
  waveformWindowSeconds: number;
  waveform: WaveformRange[];
  dominant: number | null;
  peaks: number[];
  rms: number;
  bins: number[];
};

export type WaveformRange = { minimum: number; maximum: number };
export const WAVEFORM_DISPLAY_BUCKETS = 256;

export function summarizeWaveform(
  samples: Float32Array,
  start = 0,
  length = samples.length,
): WaveformRange[] {
  const ranges: WaveformRange[] = [];
  for (let bucket = 0; bucket < WAVEFORM_DISPLAY_BUCKETS; bucket++) {
    const bucketStart = start + Math.floor(bucket * length / WAVEFORM_DISPLAY_BUCKETS);
    const bucketEnd = start + Math.floor((bucket + 1) * length / WAVEFORM_DISPLAY_BUCKETS);
    let minimum = 1;
    let maximum = -1;
    for (let index = bucketStart; index < bucketEnd; index++) {
      const sample = samples[index];
      minimum = Math.min(minimum, sample);
      maximum = Math.max(maximum, sample);
    }
    ranges.push({ minimum, maximum });
  }
  return ranges;
}

export function readingFromSpectrum(
  bins: Uint8Array,
  sampleRate: number,
  fftSize: number,
  rms: number,
  source: Reading['source'],
  waveform: WaveformRange[],
): Reading {
  const peaks: { frequency: number; magnitude: number }[] = [];
  let max = 0;
  let dominantBin = 0;
  for (let i = 1; i < bins.length - 1; i++) {
    if (bins[i] > max) {
      max = bins[i];
      dominantBin = i;
    }
    if (bins[i] > bins[i - 1] && bins[i] >= bins[i + 1] && bins[i] > 32) {
      peaks.push({ frequency: i * sampleRate / fftSize, magnitude: bins[i] });
    }
  }
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  const silent = rms < 0.0008 || max < 4;
  return {
    source, sampleRate, fftSize, resolution: sampleRate / fftSize,
    waveformWindowSeconds: fftSize / sampleRate, waveform,
    dominant: silent ? null : dominantBin * sampleRate / fftSize,
    peaks: silent ? [] : peaks.slice(0, 6).map(peak => peak.frequency),
    rms, bins: Array.from(bins),
  };
}

// Web Audio supplies the FFT bins. This only interprets the measured frame;
// it neither synthesizes a signal nor identifies its source.
export function analyseLabFrame(bins: Uint8Array, time: Float32Array, sampleRate: number): Reading {
  let sum = 0;
  for (const sample of time) sum += sample * sample;
  const rms = Math.sqrt(sum / time.length);
  return readingFromSpectrum(bins, sampleRate, time.length, rms, 'microphone', summarizeWaveform(time));
}

export async function acquireCurrentInstrument(
  adapter: InstrumentAdapter,
  isCurrent: () => boolean,
) {
  const lease = await adapter.acquire();
  if (!isCurrent()) {
    await adapter.release(lease);
    return null;
  }
  return lease;
}
