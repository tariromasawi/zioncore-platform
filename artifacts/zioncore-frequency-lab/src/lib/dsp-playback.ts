import {
  DspConfigSchema,
  MAX_DSP_OUTPUT_AMPLITUDE,
  type DspSignal,
} from '@/lib/dsp-config';

export const DSP_PLAYBACK_GAIN = 0.5;
export const DSP_PLAYBACK_FADE_SECONDS = 0.004;

export type DspPlaybackHandle = {
  stop: () => void;
  dispose: () => void;
};

export async function startDspPlayback(
  signal: DspSignal,
  createContext: () => AudioContext = () => new AudioContext(),
  onEnded: () => void = () => {},
): Promise<DspPlaybackHandle> {
  const config = DspConfigSchema.parse(signal.config);
  if (!(signal.samples instanceof Float32Array)
    || signal.sampleCount !== signal.samples.length
    || signal.samples.length < 1
    || signal.samples.length > 480000
    || signal.samples.length !== Math.round(config.durationSeconds * config.sampleRateHz)) {
    throw new Error('Playback requires a valid, bounded generated signal.');
  }
  for (const sample of signal.samples) {
    if (!Number.isFinite(sample) || Math.abs(sample) > MAX_DSP_OUTPUT_AMPLITUDE) {
      throw new Error('Playback signal exceeds the validated amplitude limit.');
    }
  }

  const context = createContext();
  const source = context.createBufferSource();
  const gain = context.createGain();
  try {
    const buffer = context.createBuffer(1, signal.samples.length, config.sampleRateHz);
    const samples = new Float32Array(signal.samples.length);
    samples.set(signal.samples);
    buffer.copyToChannel(samples, 0);
    source.buffer = buffer;
    gain.gain.value = DSP_PLAYBACK_GAIN;
    source.connect(gain);
    gain.connect(context.destination);
    await context.resume();
    source.start();
  } catch (cause) {
    try { source.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
    void context.close().catch(() => {});
    throw cause;
  }

  let finished = false;
  let stopScheduled = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    try { source.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
    void context.close().catch(() => {});
    onEnded();
  };
  source.onended = finish;

  return {
    stop() {
      if (finished || stopScheduled) return;
      stopScheduled = true;
      try {
        const now = context.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + DSP_PLAYBACK_FADE_SECONDS * 0.75);
        source.stop(now + DSP_PLAYBACK_FADE_SECONDS);
      } catch {
        finish();
      }
    },
    dispose() {
      if (finished) return;
      const now = context.currentTime;
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
      } catch {}
      try { source.stop(now); } catch {}
      finish();
    },
  };
}
