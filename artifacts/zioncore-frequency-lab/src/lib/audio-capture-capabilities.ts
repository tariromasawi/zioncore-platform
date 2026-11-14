export const MAX_ANALYSIS_SAMPLE_RATE_HZ = 192_000;

export interface AudioTrackLifecycleHandlers {
  onMute: () => void;
  onUnmute: () => void;
  onEnded: () => void;
}

export function observeAudioTrackLifecycle(
  track: MediaStreamTrack,
  handlers: AudioTrackLifecycleHandlers,
): () => void {
  const onMute = () => handlers.onMute();
  const onUnmute = () => handlers.onUnmute();
  const onEnded = () => handlers.onEnded();
  track.addEventListener('mute', onMute);
  track.addEventListener('unmute', onUnmute);
  track.addEventListener('ended', onEnded, { once: true });
  return () => {
    track.removeEventListener('mute', onMute);
    track.removeEventListener('unmute', onUnmute);
    track.removeEventListener('ended', onEnded);
  };
}

export function getMicrophoneStartErrorMessage(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Allow access in your browser settings, then try again.';
  }
  if (name === 'NotFoundError') {
    return 'No microphone was found. Connect or enable an input device and try again.';
  }
  if (name === 'NotReadableError') {
    return 'The microphone is in use or unavailable to this page. Close other recording apps and retry.';
  }
  return `Could not start microphone capture${cause instanceof Error ? `: ${cause.message}` : '.'}`;
}

export function createMicrophoneConstraints(requestHighBand: boolean): MediaTrackConstraints {
  return {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    ...(requestHighBand
      ? { sampleRate: { ideal: MAX_ANALYSIS_SAMPLE_RATE_HZ } }
      : {}),
  };
}

export function getAnalysisContextSampleRate(
  reportedSampleRate: number | undefined,
): number | undefined {
  if (!Number.isSafeInteger(reportedSampleRate) || reportedSampleRate! < 8_000) {
    return undefined;
  }
  return Math.min(reportedSampleRate!, MAX_ANALYSIS_SAMPLE_RATE_HZ);
}

export function formatCaptureRateSummary(
  reportedSampleRate: number | undefined,
  analysisContextSampleRate: number,
): string {
  const reported = Number.isFinite(reportedSampleRate) && (reportedSampleRate ?? 0) > 0
    ? `${(reportedSampleRate! / 1_000).toFixed(1)} kHz`
    : 'unreported';
  const context = Number.isFinite(analysisContextSampleRate) && analysisContextSampleRate > 0
    ? `${(analysisContextSampleRate / 1_000).toFixed(1)} kHz`
    : 'unavailable';
  const nyquist = Number.isFinite(analysisContextSampleRate) && analysisContextSampleRate > 0
    ? `${(analysisContextSampleRate / 2 / 1_000).toFixed(1)} kHz`
    : 'unavailable';
  return `Device-reported input sample rate ${reported}; analysis context ${context}; digital Nyquist ${nyquist}.`;
}
