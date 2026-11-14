import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatRecordingMetadata,
  getSupportedRecordingMimeTypes,
  getRecordingTimesliceMs,
  MAX_LOCAL_RECORDING_BYTES,
  MAX_LOCAL_RECORDING_SECONDS,
  RECORDING_AUDIO_BITRATE,
} from '@/lib/audio-recorder';

export type LocalAudioRecording = {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSeconds: number;
  inputSampleRateHz?: number;
  analysisSampleRateHz: number;
  metadata: string;
};

export function useLocalAudioRecorder() {
  const [supportedMimeTypes] = useState(() => getSupportedRecordingMimeTypes());
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [recordingError, setRecordingError] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<LocalAudioRecording | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sizeRef = useRef(0);
  const startTimeRef = useRef(0);
  const inputRateRef = useRef<number | undefined>(undefined);
  const analysisRateRef = useRef(0);
  const mimeTypeRef = useRef('');
  const objectUrlRef = useRef<string | null>(null);
  const limitReasonRef = useRef<'size' | 'duration' | null>(null);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const stopNoticeRef = useRef('');

  const clearRecordedAudio = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setRecordedAudio(null);
  }, []);

  const stopLocalRecording = useCallback(async (notice = '') => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (notice) stopNoticeRef.current = notice;
    const activeRecorder = recorder;

    await new Promise<void>(resolve => {
      let settled = false;
      const timeout = window.setTimeout(finish, 2_500);
      function finish() {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        activeRecorder.removeEventListener('stop', finish);
        resolve();
      }
      activeRecorder.addEventListener('stop', finish, { once: true });
      if (activeRecorder.state !== 'inactive') {
        try {
          activeRecorder.stop();
        } catch {
          finish();
        }
      }
    });

    if (mountedRef.current) setRecordingActive(false);
  }, []);

  const startLocalRecording = useCallback((
    stream: MediaStream,
    inputSampleRateHz: number | undefined,
    analysisSampleRateHz: number,
  ): boolean => {
    if (recorderRef.current) {
      setRecordingError('The previous recording is still closing. Stop and try again in a moment.');
      return false;
    }
    if (typeof MediaRecorder === 'undefined') {
      setRecordingError('This browser supports live analysis but does not provide local MediaRecorder recording.');
      return false;
    }

    clearRecordedAudio();
    setRecordingError('');
    setRecordingStatus('');
    chunksRef.current = [];
    sizeRef.current = 0;
    limitReasonRef.current = null;
    stopNoticeRef.current = '';
    inputRateRef.current = inputSampleRateHz;
    analysisRateRef.current = analysisSampleRateHz;
    startTimeRef.current = performance.now();

    const mimeType = getSupportedRecordingMimeTypes()[0] ?? '';
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: RECORDING_AUDIO_BITRATE })
        : new MediaRecorder(stream, { audioBitsPerSecond: RECORDING_AUDIO_BITRATE });
    } catch {
      setRecordingError('The browser could not start a local recording. Live frequency analysis is still available.');
      return false;
    }

    mimeTypeRef.current = recorder.mimeType || mimeType;
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (!event.data.size || limitReasonRef.current === 'size') return;
      if ((performance.now() - startTimeRef.current) / 1_000 >= MAX_LOCAL_RECORDING_SECONDS) {
        limitReasonRef.current = 'duration';
        if (mountedRef.current) {
          setRecordingStatus('Recording reached its 3-minute safety limit and is closing.');
        }
        void stopLocalRecording();
        return;
      }
      if (sizeRef.current + event.data.size > MAX_LOCAL_RECORDING_BYTES) {
        limitReasonRef.current = 'size';
        chunksRef.current = [];
        sizeRef.current = 0;
        if (mountedRef.current) {
          setRecordingError('The local recording reached the 24 MB safety limit and was discarded. Live analysis can continue.');
        }
        void stopLocalRecording();
        return;
      }
      chunksRef.current.push(event.data);
      sizeRef.current += event.data.size;
    };
    recorder.onerror = () => {
      if (mountedRef.current) {
        setRecordingError('The browser interrupted the local recording. Stop or restart capture; no recording was uploaded.');
      }
      void stopLocalRecording();
    };
    recorder.onstop = () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      recorderRef.current = null;
      if (mountedRef.current) setRecordingActive(false);

      if (!mountedRef.current) {
        chunksRef.current = [];
        return;
      }
      if (limitReasonRef.current === 'size') {
        chunksRef.current = [];
        return;
      }

      const mimeTypeForBlob = recorder.mimeType || mimeTypeRef.current;
      const blob = new Blob(chunksRef.current, mimeTypeForBlob ? { type: mimeTypeForBlob } : undefined);
      chunksRef.current = [];
      if (!blob.size) {
        setRecordingError('The browser ended the recording without audio data. Try another session or import a recording.');
        return;
      }
      if (blob.size > MAX_LOCAL_RECORDING_BYTES) {
        setRecordingError('The local recording exceeded the 24 MB safety limit and was discarded. Live analysis can continue.');
        setRecordingStatus('');
        return;
      }

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const durationSeconds = Math.min(
        MAX_LOCAL_RECORDING_SECONDS,
        Math.max(0, (performance.now() - startTimeRef.current) / 1_000),
      );
      const metadata = formatRecordingMetadata(
        inputRateRef.current,
        analysisRateRef.current,
        mimeTypeForBlob,
      );
      setRecordedAudio({
        blob,
        url,
        mimeType: mimeTypeForBlob,
        durationSeconds,
        inputSampleRateHz: inputRateRef.current,
        analysisSampleRateHz: analysisRateRef.current,
        metadata,
      });
      setRecordingStatus(stopNoticeRef.current
        || (limitReasonRef.current === 'duration'
          ? 'The 3-minute safety limit ended this local recording. Preview or analyze the saved clip below.'
          : 'Local recording ready. It remains on this device and is cleared when you leave this page.'));
      stopNoticeRef.current = '';
    };

    try {
      const timesliceMs = getRecordingTimesliceMs(recorder.mimeType || mimeType);
      if (timesliceMs == null) recorder.start();
      else recorder.start(timesliceMs);
      setRecordingActive(true);
      setRecordingStatus(`Recording a local copy${mimeTypeRef.current ? ` as ${mimeTypeRef.current}` : ''}. Nothing is uploaded.`);
      timerRef.current = window.setTimeout(() => {
        if (recorderRef.current !== recorder || recorder.state === 'inactive') return;
        limitReasonRef.current = 'duration';
        setRecordingStatus('Recording reached its 3-minute safety limit and is closing.');
        void stopLocalRecording();
      }, MAX_LOCAL_RECORDING_SECONDS * 1_000);
      return true;
    } catch {
      recorderRef.current = null;
      chunksRef.current = [];
      if (mountedRef.current) {
        setRecordingActive(false);
        setRecordingError('The browser could not begin the local recording. Live frequency analysis is still available.');
      }
      return false;
    }
  }, [clearRecordedAudio, stopLocalRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* the browser already stopped it */ }
      }
      chunksRef.current = [];
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  return {
    supportedMimeTypes,
    recordingActive,
    recordingStatus,
    recordingError,
    recordedAudio,
    startLocalRecording,
    stopLocalRecording,
    clearRecordedAudio,
  };
}
