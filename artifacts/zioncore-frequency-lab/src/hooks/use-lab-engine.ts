import { useCallback, useEffect, useRef, useState } from 'react';

export type Reading = {
  sampleRate: number;
  fftSize: number;
  resolution: number;
  dominant: number | null;
  peaks: number[];
  rms: number;
  bins: number[];
};

export default function useLabEngine(fftSize: number) {
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('Ready when you are. Microphone access begins only after you press Start.');
  const [error, setError] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [silent, setSilent] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number>(0);
  const startRef = useRef(0);
  const requestIdRef = useRef(0);

  const stop = useCallback(async (message = 'Capture stopped. No audio was saved.') => {
    requestIdRef.current += 1;
    setStarting(false);
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (contextRef.current) {
      const context = contextRef.current;
      contextRef.current = null;
      try { await context.close(); } catch { /* already closed */ }
    }
    setRunning(false);
    setStatus(message);
  }, []);

  const start = useCallback(async () => {
    setError('');
    setReading(null);
    setElapsed(0);
    setSilent(false);
    const requestId = ++requestIdRef.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setError('This browser does not support microphone capture with Web Audio. Try a recent browser on a secure connection.');
      setStatus('Microphone capture is unavailable.');
      return;
    }
    setStatus('Waiting for microphone permission…');
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      startRef.current = performance.now();
      setStarting(false);
      setRunning(true);
      setStatus('Measuring locally from your selected microphone.');
      const tick = () => {
        if (!contextRef.current) return;
        analyser.getByteFrequencyData(bins);
        analyser.getFloatTimeDomainData(time);
        let sum = 0;
        for (const sample of time) sum += sample * sample;
        const rms = Math.sqrt(sum / time.length);
        const peaks: { frequency: number; magnitude: number }[] = [];
        let max = 0;
        let dominantBin = 0;
        for (let i = 1; i < bins.length - 1; i++) {
          if (bins[i] > max) {
            max = bins[i];
            dominantBin = i;
          }
          if (bins[i] > bins[i - 1] && bins[i] >= bins[i + 1] && bins[i] > 32) {
            peaks.push({
              frequency: i * context.sampleRate / analyser.fftSize,
              magnitude: bins[i],
            });
          }
        }
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        const isSilent = rms < 0.0008 || max < 4;
        setSilent(isSilent);
        setElapsed((performance.now() - startRef.current) / 1000);
        setReading({
          sampleRate: context.sampleRate,
          fftSize,
          resolution: context.sampleRate / fftSize,
          dominant: isSilent || max < 4 ? null : dominantBin * context.sampleRate / analyser.fftSize,
          peaks: isSilent ? [] : peaks.slice(0, 6).map(peak => peak.frequency),
          rms,
          bins: Array.from(bins),
        });
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setStarting(false);
      const name = cause instanceof DOMException ? cause.name : '';
      const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Microphone permission was denied. Allow access in your browser settings, then try again.'
        : name === 'NotFoundError'
          ? 'No microphone was found. Connect or enable an input device and try again.'
          : name === 'NotReadableError'
            ? 'The microphone is in use or unavailable to this page. Close other recording apps and retry.'
            : `Could not start microphone capture${cause instanceof Error ? `: ${cause.message}` : '.'}`;
      setError(message);
      setStatus('Capture did not start.');
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (contextRef.current) {
        try { await contextRef.current.close(); } catch { /* no-op */ }
        contextRef.current = null;
      }
      setRunning(false);
    }
  }, [fftSize]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (contextRef.current && contextRef.current.state !== 'closed') {
      void contextRef.current.close();
    }
  }, []);

  return { running, starting, status, error, reading, elapsed, silent, start, stop };
}
