export type AudioPlaybackController = {
  play(
    samples: Float32Array,
    sampleRateHz: number,
    peakGain: number,
    playingStatus: string,
    completedStatus: string,
  ): Promise<boolean>;
  stop(): void;
  dispose(): void;
};

type PlaybackOptions = {
  onPlayingChange(playing: boolean): void;
  onStatusChange(status: string): void;
  createContext?: () => AudioContext;
  scheduleClose?: (callback: () => void, delayMs: number) => void;
};

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : 'Audio playback could not be started.';

export function createAudioPlaybackController(
  options: PlaybackOptions,
): AudioPlaybackController {
  const createContext = options.createContext ?? (() => new AudioContext());
  const scheduleClose = options.scheduleClose ?? ((callback, delayMs) => {
    window.setTimeout(callback, delayMs);
  });
  let request = 0;
  let starting = false;
  let context: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  let gain: GainNode | null = null;

  const close = (target: AudioContext, delayMs = 0) => {
    const finish = () => {
      if (target.state !== 'closed') void target.close().catch(() => undefined);
    };
    if (delayMs > 0) scheduleClose(finish, delayMs);
    else finish();
  };

  const stop = () => {
    const targetContext = context;
    const targetGain = gain;
    const targetSource = source;
    const wasActive = starting || targetContext !== null || targetSource !== null;
    request += 1;
    starting = false;
    context = null;
    source = null;
    gain = null;
    if (!wasActive) return;

    if (targetContext && targetGain && targetSource) {
      const now = targetContext.currentTime;
      targetGain.gain.cancelScheduledValues(now);
      targetGain.gain.setValueAtTime(targetGain.gain.value, now);
      targetGain.gain.linearRampToValueAtTime(0, now + 0.06);
      try {
        targetSource.stop(now + 0.07);
      } catch {
        // The source may already have ended.
      }
      close(targetContext, 100);
    } else if (targetContext) {
      close(targetContext);
    }
    options.onPlayingChange(false);
    options.onStatusChange('Playback stopped.');
  };

  const play: AudioPlaybackController['play'] = async (
    samples,
    sampleRateHz,
    peakGain,
    playingStatus,
    completedStatus,
  ) => {
    if (starting) return false;
    if (
      !(samples instanceof Float32Array) ||
      samples.length === 0 ||
      !Number.isSafeInteger(sampleRateHz) ||
      sampleRateHz < 8_000 ||
      sampleRateHz > 192_000 ||
      !Number.isFinite(peakGain) ||
      peakGain <= 0 ||
      peakGain > 0.7 ||
      samples.some(sample => !Number.isFinite(sample))
    ) {
      options.onStatusChange('Audio playback settings or samples are invalid.');
      return false;
    }

    stop();
    const currentRequest = ++request;
    starting = true;
    let nextContext: AudioContext | null = null;

    try {
      const createdContext = createContext();
      nextContext = createdContext;
      context = createdContext;
      await createdContext.resume();
      if (request !== currentRequest || context !== createdContext) return false;

      const buffer = createdContext.createBuffer(1, samples.length, sampleRateHz);
      buffer.getChannelData(0).set(samples);
      const nextSource = createdContext.createBufferSource();
      const nextGain = createdContext.createGain();
      const durationSeconds = samples.length / sampleRateHz;
      nextSource.buffer = buffer;
      nextGain.gain.setValueAtTime(0, createdContext.currentTime);
      nextGain.gain.linearRampToValueAtTime(peakGain, createdContext.currentTime + 0.04);
      nextGain.gain.setValueAtTime(
        peakGain,
        createdContext.currentTime + Math.max(0.05, durationSeconds - 0.06),
      );
      nextGain.gain.linearRampToValueAtTime(0, createdContext.currentTime + durationSeconds);
      nextSource.connect(nextGain);
      nextGain.connect(createdContext.destination);
      source = nextSource;
      gain = nextGain;
      nextSource.onended = () => {
        if (request !== currentRequest || source !== nextSource) return;
        source = null;
        gain = null;
        context = null;
        options.onPlayingChange(false);
        options.onStatusChange(completedStatus);
        close(createdContext);
      };
      options.onPlayingChange(true);
      options.onStatusChange(playingStatus);
      nextSource.start();
      return true;
    } catch (error) {
      if (request === currentRequest) {
        context = null;
        source = null;
        gain = null;
        options.onPlayingChange(false);
        options.onStatusChange(messageFor(error));
        const failedContext = nextContext;
        if (failedContext) close(failedContext);
      }
      return false;
    } finally {
      if (request === currentRequest) starting = false;
    }
  };

  return {
    play,
    stop,
    dispose() {
      const targetContext = context;
      const targetSource = source;
      request += 1;
      starting = false;
      context = null;
      source = null;
      gain = null;
      if (targetSource) {
        try {
          targetSource.stop();
        } catch {
          // The source may already have ended.
        }
      }
      if (targetContext) close(targetContext);
    },
  };
}
