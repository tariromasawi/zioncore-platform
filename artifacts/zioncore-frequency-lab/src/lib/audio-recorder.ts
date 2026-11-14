export const MAX_LOCAL_RECORDING_BYTES = 24 * 1024 * 1024;
export const MIN_LOCAL_RECORDING_SECONDS = 3;
export const MAX_LOCAL_RECORDING_SECONDS = 3 * 60;
export const RECORDING_AUDIO_BITRATE = 96_000;
export const RECORDING_TIMESLICE_MS = 1_000;

const recordingMimeTypeCandidates = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export type MediaRecorderSupportProbe = {
  isTypeSupported: (mimeType: string) => boolean;
};

export function getSupportedRecordingMimeTypes(
  probe: MediaRecorderSupportProbe | null | undefined =
    typeof MediaRecorder === 'undefined' ? undefined : MediaRecorder,
): string[] {
  if (!probe || typeof probe.isTypeSupported !== 'function') return [];
  return recordingMimeTypeCandidates.filter(mimeType => {
    try {
      return probe.isTypeSupported(mimeType);
    } catch {
      return false;
    }
  });
}

export function getRecordingFileExtension(mimeType: string): string {
  const mediaType = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType === 'audio/mp4' || mediaType === 'audio/x-m4a') return 'm4a';
  if (mediaType === 'audio/webm') return 'webm';
  if (mediaType === 'audio/ogg' || mediaType === 'audio/opus') return 'ogg';
  if (mediaType === 'audio/aac') return 'aac';
  return '';
}

export function getRecordingTimesliceMs(mimeType: string): number | undefined {
  // Chromium's fragmented MP4 chunks can lose earlier fragments when joined as a
  // standalone Blob. Keep MP4 whole; other supported browser formats are chunked
  // so their size limit can be enforced as data arrives.
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() === 'audio/mp4'
    ? undefined
    : RECORDING_TIMESLICE_MS;
}

export function formatRecordingMetadata(
  inputSampleRate: number | undefined,
  analysisSampleRate: number,
  mimeType: string,
): string {
  const inputRate = Number.isFinite(inputSampleRate) && (inputSampleRate ?? 0) > 0
    ? `${(inputSampleRate! / 1_000).toFixed(1)} kHz`
    : 'not reported by the input device';
  const analysisRate = Number.isFinite(analysisSampleRate) && analysisSampleRate > 0
    ? `${(analysisSampleRate / 1_000).toFixed(1)} kHz`
    : 'unavailable';
  const recorderType = mimeType || 'browser-selected format';
  return `Input rate ${inputRate}; analysis AudioContext ${analysisRate}; MediaRecorder format ${recorderType}. MediaRecorder does not expose its encoded sample rate directly.`;
}
