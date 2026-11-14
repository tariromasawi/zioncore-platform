import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  getGetWalletQueryKey,
  getListWalletTransactionsQueryKey,
} from '@workspace/api-client-react';
import {
  Activity, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, Download,
  FileDown, History, Info, Mic, Radio, Save, ShieldCheck, Square, Trash2, Upload,
  Wallet, Waves,
} from 'lucide-react';
import AccountAccess from '@/components/account-access';
import EngineMonitor from '@/components/engine-monitor';
import MatrixRain from '@/components/matrix-rain';
import ReferenceToneControls from '@/components/reference-tone-controls';
import ResonanceMatrixGallery, { ConstellationProvider, ConstellationInterlude, ConstellationMotionControl } from '@/components/resonance-matrix-gallery';
import SeoRouteMetadata from '@/components/seo-route-metadata';
import PwaInstallPrompt from '@/components/pwa-install-prompt';
import SignalPath from '@/components/signal-path';
import NavigationEffects from '@/components/navigation-effects';
import ConnectivityNotice from '@/components/connectivity-notice';
import { ErrorBoundary } from '@/components/error-boundary';
import SpectralMatrixPanel from '@/components/spectral-matrix-panel';
import { SignalHistoryPlot, Spectrogram } from '@/components/signal-visualizations';
import type { AIInterpretationQuote, Explanation } from '@/lib/ai-analysis';
import {
  deleteCloudObservations,
  getCloudHistoryErrorMessage,
  getCloudObservation,
  listCloudObservations,
  saveCloudObservation,
} from '@/lib/cloud-observations';
import type { SocialAuthProvider } from '@/lib/firebase-auth';
import { readMembership, type MembershipSnapshot } from '@/lib/membership';
import {
  firebaseAuth,
  firebaseAuthConfigured,
  firebaseCloudReady,
  firebaseProjectMismatch,
  getFirebaseIdentityHeaders,
  getFirebaseSetupMessage,
} from '@/lib/firebase';
import { canShowAdminLink } from '@/lib/admin-access';
import type { SignupMethod } from '@/lib/project-analytics';
import {
  createMicrophoneConstraints,
  formatCaptureRateSummary,
  getMicrophoneStartErrorMessage,
  getAnalysisContextSampleRate,
  MAX_ANALYSIS_SAMPLE_RATE_HZ,
  observeAudioTrackLifecycle,
} from '@/lib/audio-capture-capabilities';
import { getRecordingFileExtension } from '@/lib/audio-recorder';
import { useLocalAudioRecorder } from '@/hooks/use-local-audio-recorder';
import {
  appendObservation, downloadFile, formatFrequency, localObservationErrorMessage,
  OBSERVATION_STORAGE_KEY, readLocalRecoveryCopy, readObservationArchive,
  toCsv, writeObservations,
  type Observation,
} from '@/lib/observations';
import {
  analyzeSignalFrame,
  downsampleSpectrum,
  type SignalFeatures,
  type TemporalSample,
} from '@/lib/signal-analysis';
import { analyzeSpectralMatrix } from '@/lib/spectral-matrix';
import { createResonanceEngineSnapshot } from '@/lib/resonance-engine';
import { signalCardCaptureSchema, type SignalCardCapture } from '@/lib/signal-cards';

const OwnerDashboard = lazy(() => import('@/components/owner-dashboard').then(module => ({
  default: module.OwnerDashboard,
})));
const PremiumComparisonPage = lazy(() => import('@/components/premium-comparison-page').then(module => ({
  default: module.PremiumComparisonPage,
})));
const DeviceConnectionCenter = lazy(() => import('@/components/device-connection-center'));
const ResonanceLibrary = lazy(() => import('@/components/resonance-library'));
const ObservationBackupRestore = lazy(() => import('@/components/observation-backup-restore'));
const SignalCardStudio = lazy(() => import('@/components/signal-card-studio'));

const pendingInterpretationStorageKey = 'zioncore.pending-interpretation';

function isNonRetryableAIRequestError(cause: unknown): boolean {
  return cause instanceof Error
    && 'retryable' in cause
    && (cause as Error & { retryable?: unknown }).retryable === false;
}

type PendingInterpretation = {
  uid: string;
  idempotencyKey: string;
  cardCapture?: SignalCardCapture;
};

function readPendingInterpretation(): PendingInterpretation | null {
  try {
    const raw = window.sessionStorage.getItem(pendingInterpretationStorageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value
      || typeof value !== 'object'
      || !('uid' in value)
      || typeof value.uid !== 'string'
      || !('idempotencyKey' in value)
      || typeof value.idempotencyKey !== 'string'
      || !/^[A-Za-z0-9._:-]{8,80}$/.test(value.idempotencyKey)
    ) {
      return null;
    }
    const capture = signalCardCaptureSchema.safeParse('cardCapture' in value ? value.cardCapture : undefined);
    return {
      uid: value.uid, idempotencyKey: value.idempotencyKey,
      ...(capture.success && capture.data.id === value.idempotencyKey ? { cardCapture: capture.data } : {}),
    };
  } catch {
    return null;
  }
}

function savePendingInterpretation(pending: PendingInterpretation) {
  try {
    window.sessionStorage.setItem(pendingInterpretationStorageKey, JSON.stringify(pending));
  } catch {
    // In-memory idempotency still protects retries in the current page.
  }
}

function clearPendingInterpretation(uid: string, idempotencyKey: string) {
  try {
    const pending = readPendingInterpretation();
    if (pending?.uid === uid && pending.idempotencyKey === idempotencyKey) {
      window.sessionStorage.removeItem(pendingInterpretationStorageKey);
    }
  } catch {
    // The result remains protected by the server-side request ledger.
  }
}
import type {
  ImportedAudioAnalysis,
  SupportedFftSize,
} from '@/lib/audio-file-analysis';

const MessagesPage = lazy(() => import('@/components/messages-page'));
const AnalysisPanel = lazy(() => import('@/components/analysis-panel'));
const FreeListeningPanel = lazy(() => import('@/components/free-listening-panel'));
const WalletPage = lazy(() => import('@/components/wallet-page'));
const DiscoverPage = lazy(() => import('@/components/discover-page'));

type Reading = {
  sampleRate: number;
  fftSize: number;
  resolution: number;
  dominant: number | null;
  peaks: number[];
  rms: number;
  bins: number[];
  spectrogram: number[][];
  spectrogramRevision: number;
  temporalSamples: TemporalSample[];
  features: SignalFeatures;
  source: 'microphone' | 'audio-file';
};

const intelligenceStages = [
  {
    number: '01',
    title: 'Receive',
    status: 'LIVE INPUT',
    detail: 'Capture sound live or import supported audio. The Device Centre also accepts receive-only SDR IQ and timestamped vibration or environmental CSV files.',
    href: '#capture',
    action: 'Open capture',
    route: false,
  },
  {
    number: '02',
    title: 'Decode',
    status: 'LOCAL ANALYSIS',
    detail: 'Read peaks, harmonics, spectral shape, drift, and timing locally; the Messages instrument also decodes ZionCore audio packets.',
    href: '/messages',
    action: 'Open decoder',
    route: true,
  },
  {
    number: '03',
    title: 'Interpret',
    status: 'PROTECTED · GATED',
    detail: 'Gemini leads with an OpenAI fallback and five analysis lenses. Interpretations require a verified account and usage-cost controls.',
    href: '#interpretation',
    action: 'View interpretation',
    route: false,
  },
  {
    number: '04',
    title: 'Learn',
    status: 'USER-CONTROLLED',
    detail: 'Compare saved, user-owned captures in the Discovery Studio. Personal records do not train models or change ZionCore automatically.',
    href: '/discover',
    action: 'Compare saved captures',
    route: true,
  },
  {
    number: '05',
    title: 'Encode',
    status: 'LOCAL PROTOCOL',
    detail: 'Compose text or a short voice message as a checksummed, versioned acoustic packet. Encoding prepares a signal; it does not send it.',
    href: '/messages',
    action: 'Compose a message',
    route: true,
  },
  {
    number: '06',
    title: 'Transmit',
    status: 'USER-INITIATED',
    detail: 'Preview, then play or download a capped acoustic signal. This browser path does not transmit radio; real two-device recovery remains unverified.',
    href: '/messages',
    action: 'Open output controls',
    route: true,
  },
  {
    number: '07',
    title: 'Observe',
    status: 'REPEAT & COMPARE',
    detail: 'Record a follow-up and compare it with a saved baseline. A measured match alone does not prove an intentional reply.',
    href: '#baseline',
    action: 'Compare a baseline',
    route: false,
  },
] as const;

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  owner: boolean;
  authNotice: string;
  clearAuthNotice: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  owner: false,
  authNotice: '',
  clearAuthNotice: () => undefined,
});

function useAuth() {
  return useContext(AuthContext);
}

function useLabEngine(fftSize: number, requestHighBandInput: boolean) {
  const localRecorder = useLocalAudioRecorder();
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analysisPaused, setAnalysisPaused] = useState(false);
  const [status, setStatus] = useState('Ready when you are. Microphone access begins only after you press Start.');
  const [error, setError] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [silent, setSilent] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackLifecycleCleanupRef = useRef<(() => void) | null>(null);
  const contextLifecycleCleanupRef = useRef<(() => void) | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const captureStatusRef = useRef('');
  const frameRef = useRef<number>(0);
  const startRef = useRef(0);
  const requestIdRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastSampleRef = useRef(0);
  const lastSpectrogramSampleRef = useRef(0);
  const spectrogramRef = useRef<number[][]>([]);
  const spectrogramRevisionRef = useRef(0);
  const temporalSamplesRef = useRef<TemporalSample[]>([]);

  const stop = useCallback(async (message = 'Capture stopped. Any opted-in local recording is available below.') => {
    requestIdRef.current += 1;
    setStarting(false);
    setAnalysisPaused(false);
    cancelAnimationFrame(frameRef.current);
    await localRecorder.stopLocalRecording();
    trackLifecycleCleanupRef.current?.();
    trackLifecycleCleanupRef.current = null;
    contextLifecycleCleanupRef.current?.();
    contextLifecycleCleanupRef.current = null;
    visibilityCleanupRef.current?.();
    visibilityCleanupRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (contextRef.current) {
      const context = contextRef.current;
      contextRef.current = null;
      try { await context.close(); } catch { /* already closed */ }
    }
    setRunning(false);
    setStatus(message);
  }, [localRecorder.stopLocalRecording]);

  const start = useCallback(async (saveLocalCopy = false) => {
    setError('');
    setReading(null);
    setElapsed(0);
    setSilent(false);
    setAnalysisPaused(false);
    lastUiUpdateRef.current = 0;
    lastSampleRef.current = 0;
    lastSpectrogramSampleRef.current = 0;
    spectrogramRef.current = [];
    spectrogramRevisionRef.current = 0;
    temporalSamplesRef.current = [];
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
        audio: createMicrophoneConstraints(requestHighBandInput),
      });
      if (requestId !== requestIdRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        trackLifecycleCleanupRef.current?.();
        trackLifecycleCleanupRef.current = observeAudioTrackLifecycle(audioTrack, {
          onMute: () => {
            if (requestId === requestIdRef.current) {
              setStatus('Microphone input is temporarily unavailable. ZionCore is waiting for the device or browser to resume it.');
              void localRecorder.stopLocalRecording('Microphone input was interrupted; the partial local recording was saved on this device.');
            }
          },
          onUnmute: () => {
            if (requestId === requestIdRef.current) {
              const contextIsRunning = contextRef.current?.state === 'running';
              setAnalysisPaused(!contextIsRunning);
              setStatus(contextIsRunning
                ? `${captureStatusRef.current} Microphone input resumed.`
                : 'Microphone input resumed, but browser audio analysis is still paused. Tap Resume analysis.');
            }
          },
          onEnded: () => {
            if (requestId === requestIdRef.current) {
              void stop('Microphone input ended. Capture stopped; reconnect the device and start again.');
            }
          },
        });
        if (audioTrack.readyState === 'ended') {
          void stop('Microphone input ended before capture could start. Reconnect the device and try again.');
          return;
        }
      }
      const reportedInputRate = audioTrack?.getSettings?.().sampleRate;
      const contextSampleRate = getAnalysisContextSampleRate(reportedInputRate);
      let context: AudioContext;
      try {
        context = contextSampleRate
          ? new AudioContext({ sampleRate: contextSampleRate })
          : new AudioContext();
      } catch {
        context = new AudioContext();
      }
      contextRef.current = context;
      const onContextStateChange = () => {
        if (requestId !== requestIdRef.current) return;
        const state = context.state as string;
        if (state === 'suspended' || state === 'interrupted') {
          setAnalysisPaused(true);
          setStatus('Audio analysis was paused by the browser or an interruption. Return to ZionCore and tap Resume analysis, or stop and start again.');
          void localRecorder.stopLocalRecording('The local recording stopped after an audio interruption. Its partial clip is saved on this device.');
        } else if (state === 'running') {
          const inputTrack = stream.getAudioTracks()[0];
          const inputUnavailable = inputTrack?.muted || inputTrack?.readyState === 'ended';
          setAnalysisPaused(Boolean(inputUnavailable));
          setStatus(inputUnavailable
            ? 'Audio processing resumed, but the microphone is still unavailable. Wait for input or stop and start again.'
            : `${captureStatusRef.current} Audio analysis resumed.`);
        } else if (state === 'closed') {
          void stop('Audio processing ended unexpectedly. Capture stopped; reconnect the microphone and start again.');
        }
      };
      context.addEventListener('statechange', onContextStateChange);
      contextLifecycleCleanupRef.current = () => context.removeEventListener('statechange', onContextStateChange);
      const onVisibilityChange = () => {
        if (requestId !== requestIdRef.current) return;
        if (document.hidden) {
          setStatus('Safari or the browser is in the background. The operating system may pause microphone capture; return and check the input status.');
          void localRecorder.stopLocalRecording('The local recording stopped when the page moved to the background. Its partial clip is saved on this device.');
        } else if (
          context.state !== 'running'
          || stream.getAudioTracks()[0]?.muted
          || stream.getAudioTracks()[0]?.readyState === 'ended'
        ) {
          setAnalysisPaused(true);
          setStatus('The browser or microphone has not resumed audio input. Tap Resume analysis, or stop and start again.');
        } else {
          setStatus(`${captureStatusRef.current} Capture is active again.`);
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      visibilityCleanupRef.current = () => document.removeEventListener('visibilitychange', onVisibilityChange);
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -20;
      analyser.smoothingTimeConstant = 0.32;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      startRef.current = performance.now();
      setStarting(false);
      setRunning(true);
      const highBandNote = requestHighBandInput && context.sampleRate <= 48_000
        ? ' This input path did not provide a high-band sample rate; use a compatible high-rate WAV for ultrasound-range analysis.'
        : '';
      captureStatusRef.current = `${formatCaptureRateSummary(reportedInputRate, context.sampleRate)} Microphone response is device-dependent.${highBandNote}`;
      setStatus(captureStatusRef.current);
      if (saveLocalCopy) {
        localRecorder.startLocalRecording(stream, reportedInputRate, context.sampleRate);
      }
      const tick = () => {
        if (!contextRef.current) return;
        const now = performance.now();
        if (now - lastUiUpdateRef.current >= 100) {
          lastUiUpdateRef.current = now;
          analyser.getByteFrequencyData(bins);
          analyser.getFloatTimeDomainData(time);
          const elapsedSeconds = (now - startRef.current) / 1000;
          const frame = analyzeSignalFrame(
            bins,
            time,
            context.sampleRate,
            analyser.fftSize,
            temporalSamplesRef.current,
            elapsedSeconds,
            'dbfs-byte',
          );
          if (now - lastSampleRef.current >= 200) {
            lastSampleRef.current = now;
            temporalSamplesRef.current = [
              ...temporalSamplesRef.current,
              {
                timeSeconds: elapsedSeconds,
                dominantFrequencyHz: frame.dominantFrequencyHz,
                rmsLevel: frame.rmsLevel,
              },
            ].filter(sample => sample.timeSeconds >= elapsedSeconds - 30);
          }
          if (now - lastSpectrogramSampleRef.current >= 250) {
            lastSpectrogramSampleRef.current = now;
            spectrogramRef.current = [
              ...spectrogramRef.current.slice(-119),
              downsampleSpectrum(bins),
            ];
            spectrogramRevisionRef.current += 1;
          }
          const reading = analyzeSignalFrame(
            bins,
            time,
            context.sampleRate,
            analyser.fftSize,
            temporalSamplesRef.current,
            elapsedSeconds,
            'dbfs-byte',
          );
          setSilent(reading.silent);
          setElapsed(elapsedSeconds);
          setReading({
            sampleRate: context.sampleRate,
            fftSize,
            resolution: context.sampleRate / fftSize,
            dominant: reading.dominantFrequencyHz,
            peaks: reading.peakFrequenciesHz,
            rms: reading.rmsLevel,
            bins: Array.from(bins),
            spectrogram: spectrogramRef.current,
            spectrogramRevision: spectrogramRevisionRef.current,
            temporalSamples: [...temporalSamplesRef.current],
            features: reading.features,
            source: 'microphone',
          });
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (cause) {
      if (requestId !== requestIdRef.current) return;
      setStarting(false);
      setAnalysisPaused(false);
      setError(getMicrophoneStartErrorMessage(cause));
      setStatus('Capture did not start.');
      trackLifecycleCleanupRef.current?.();
      trackLifecycleCleanupRef.current = null;
      contextLifecycleCleanupRef.current?.();
      contextLifecycleCleanupRef.current = null;
      visibilityCleanupRef.current?.();
      visibilityCleanupRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (contextRef.current) {
        try { await contextRef.current.close(); } catch { /* no-op */ }
        contextRef.current = null;
      }
      setRunning(false);
    }
  }, [fftSize, localRecorder.startLocalRecording, requestHighBandInput, stop]);

  const loadImportedAudio = useCallback(async (analysis: ImportedAudioAnalysis) => {
    requestIdRef.current += 1;
    await localRecorder.stopLocalRecording();
    cancelAnimationFrame(frameRef.current);
    trackLifecycleCleanupRef.current?.();
    trackLifecycleCleanupRef.current = null;
    contextLifecycleCleanupRef.current?.();
    contextLifecycleCleanupRef.current = null;
    visibilityCleanupRef.current?.();
    visibilityCleanupRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (contextRef.current) {
      const context = contextRef.current;
      contextRef.current = null;
      try { await context.close(); } catch { /* already closed */ }
    }
    setStarting(false);
    setRunning(false);
    setAnalysisPaused(false);
    setError('');
    setReading({
      sampleRate: analysis.sampleRate,
      fftSize: analysis.fftSize,
      resolution: analysis.resolution,
      dominant: analysis.dominant,
      peaks: analysis.peaks,
      rms: analysis.rms,
      bins: analysis.bins,
      spectrogram: analysis.spectrogram,
      spectrogramRevision: spectrogramRevisionRef.current + 1,
      temporalSamples: analysis.temporalSamples,
      features: analysis.features,
      source: 'audio-file',
    });
    spectrogramRevisionRef.current += 1;
    setElapsed(analysis.durationSeconds);
    setSilent(analysis.dominant == null);
    setStatus(`Recording analyzed locally across ${analysis.analyzedFrames} audio frames. Original audio was not uploaded.`);
  }, [localRecorder.stopLocalRecording]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    trackLifecycleCleanupRef.current?.();
    trackLifecycleCleanupRef.current = null;
    contextLifecycleCleanupRef.current?.();
    contextLifecycleCleanupRef.current = null;
    visibilityCleanupRef.current?.();
    visibilityCleanupRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (contextRef.current && contextRef.current.state !== 'closed') void contextRef.current.close();
  }, []);

  const resume = useCallback(async () => {
    const context = contextRef.current;
    if (!context || context.state === 'closed') {
      setError('Audio analysis cannot resume. Stop capture and start the microphone again.');
      return;
    }
    try {
      await context.resume();
        const inputTrack = streamRef.current?.getAudioTracks()[0];
        if (context.state === 'running' && !inputTrack?.muted && inputTrack?.readyState !== 'ended') {
        setAnalysisPaused(false);
        setError('');
        setStatus(`${captureStatusRef.current} Audio analysis resumed.`);
      } else {
        setAnalysisPaused(true);
          setError('The browser or microphone is still unavailable. Wait for input to resume, or stop and start the microphone again.');
      }
    } catch {
      setAnalysisPaused(true);
      setError('The browser could not resume audio. Tap Resume again, or stop and start the microphone again.');
    }
  }, []);

  return {
    running,
    starting,
    analysisPaused,
    status,
    error,
    reading,
    elapsed,
    silent,
    start,
    stop,
    resume,
    loadImportedAudio,
    ...localRecorder,
  };
}

function Spectrum({ bins, fftSize }: { bins: number[] | null; fftSize: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#233e43';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#426065';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (height * i) / 5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const x = (width * i) / 6;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    if (bins?.length) {
      const usable = bins.slice(0, Math.min(bins.length, Math.floor(bins.length * 0.42)));
      const step = width / usable.length;
      ctx.beginPath();
      ctx.moveTo(0, height);
      usable.forEach((value, i) => ctx.lineTo(i * step, height - (value / 255) * (height - 14) - 5));
      ctx.lineTo(width, height);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#e6ad55aa');
      gradient.addColorStop(1, '#63a99817');
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.beginPath();
      usable.forEach((value, i) => {
        const x = i * step;
        const y = height - (value / 255) * (height - 14) - 5;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#e8b257';
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }
  }, [bins, fftSize]);
  return <canvas className="chart-canvas" ref={canvasRef} aria-label={`Live audio spectrum at ${fftSize} point FFT`} data-testid="visual-spectrum" />;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, owner, loading, authNotice, clearAuthNotice } = useAuth();
  const showAdminLink = canShowAdminLink(user, owner);
  const accountName = user?.displayName?.trim() || user?.email?.trim() || 'Your account';
  const accountInitials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] ?? '')
    .join('')
    .toUpperCase();
  const [matrixEnabled, setMatrixEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('zioncore-matrix-rain');
      return saved == null
        ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : saved === 'on';
    } catch {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('zioncore-matrix-rain', matrixEnabled ? 'on' : 'off');
    } catch {
      // The visual preference remains active for this visit if storage is unavailable.
    }
  }, [matrixEnabled]);

  return <div className="lab-shell">
    <MatrixRain enabled={matrixEnabled} />
    <header className="topbar">
      <div className="brand-toolbar">
        <Link href="/" className="brand-lockup" data-testid="link-home"><span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span><span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span></Link>
        <button
          type="button"
          className="nav-link matrix-toggle"
          aria-label={`Matrix rain ${matrixEnabled ? 'on' : 'off'}`}
          aria-pressed={matrixEnabled}
          onClick={() => setMatrixEnabled(enabled => !enabled)}
          data-testid="button-matrix-toggle"
        >
          Matrix {matrixEnabled ? 'on' : 'off'}
        </button>
        <ConstellationMotionControl />
      </div>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-live-lab">Live lab</Link>
        <Link href="/discover" className={`nav-link ${location === '/discover' ? 'active' : ''}`} data-testid="link-discover">Field guide</Link>
        <Link href="/history" className={`nav-link ${location.startsWith('/history') ? 'active' : ''}`} data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
        <Link href="/cards" className={`nav-link ${location === '/cards' ? 'active' : ''}`} data-testid="link-signal-cards">Signal Cards</Link>
        <Link href="/messages" className={`nav-link ${location === '/messages' ? 'active' : ''}`} data-testid="link-messages"><AudioLines size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Messages</Link>
        <Link href="/devices" className={`nav-link ${location === '/devices' ? 'active' : ''}`} data-testid="link-devices"><Radio size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Devices</Link>
        <Link href="/wallet" className={`nav-link ${location === '/wallet' ? 'active' : ''}`} aria-label="Plans and wallet" data-testid="link-wallet"><Wallet size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Plans</Link>
        {showAdminLink && <Link href="/admin" className={`nav-link ${location === '/admin' || location === '/owner' ? 'active' : ''}`} data-testid="link-owner"><ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Admin</Link>}
        {!user && (loading
          ? <span className="nav-link" role="status" data-testid="status-nav-auth-checking">Checking account…</span>
          : <Link href="/history" className="nav-link nav-link-join" data-testid="link-join-free-nav">Sign in / Join <span aria-hidden="true">→</span></Link>)}
        {user && <Link
          href="/dashboard"
          className="nav-account nav-account-dashboard"
          aria-label={`Open account dashboard for ${accountName}`}
          aria-current={location === '/dashboard' || location === '/wallet' ? 'page' : undefined}
          data-testid="link-account-dashboard"
        >
          <span className="nav-account-avatar" aria-hidden="true">{accountInitials || 'U'}</span>
          <span className="nav-account-label">{accountName}</span>
          <span className="nav-account-dashboard-label">Dashboard</span>
        </Link>}
      </nav>
      <div className="mobile-account-actions">
        {!user && loading && <span
          className="nav-account-dashboard mobile-quick-link"
          role="status"
          data-testid="status-mobile-auth-checking"
        >
          Checking account…
        </span>}
        {!user && !loading && <Link
          href="/history"
          className="nav-account-dashboard mobile-quick-link"
          aria-label="Sign in or create a free ZionCore account"
          data-testid="link-mobile-sign-in"
        >
          Sign in / Join free <span aria-hidden="true">→</span>
        </Link>}
        {user && <Link
          href="/dashboard"
          className="nav-account-dashboard mobile-quick-link"
          aria-label={`Open account dashboard for ${accountName}`}
          data-testid="link-mobile-account-dashboard"
        >
          <span className="nav-account-avatar" aria-hidden="true">{accountInitials || 'U'}</span>
          <span className="nav-account-label">{accountName}</span>
          <span className="nav-account-dashboard-label">Dashboard</span>
        </Link>}
        <Link
          href="/wallet"
          className="nav-account-dashboard mobile-quick-link"
          aria-label="Browse plans, credit packs, and Premium"
          data-testid="link-mobile-plans"
        >
          <Wallet size={14} aria-hidden="true" />
          <span>Plans &amp; credits</span>
        </Link>
        {showAdminLink && <Link
          href="/admin"
          className="nav-account-dashboard mobile-quick-link mobile-admin-link"
          aria-label="Open administrator dashboard"
          data-testid="link-mobile-admin"
        >
          <ShieldCheck size={14} aria-hidden="true" />
          <span>Admin</span>
        </Link>}
      </div>
    </header>
    <ConnectivityNotice />
    {authNotice && <div className="status-box alert-box" role="alert" data-testid="status-auth-notice">
      <span>{authNotice}</span>
      <button type="button" className="btn btn-subtle" onClick={clearAuthNotice} data-testid="button-dismiss-auth-notice">Dismiss</button>
    </div>}
    {children}
  </div>;
}

function AccountSection() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [membershipUserId, setMembershipUserId] = useState<string | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipError, setMembershipError] = useState('');

  useEffect(() => setError(''), [user?.uid]);

  useEffect(() => {
    let active = true;
    setMembership(null);
    setMembershipUserId(null);
    setMembershipError('');

    if (authLoading) {
      setMembershipLoading(true);
      return () => { active = false; };
    }

    if (!user) {
      setMembershipLoading(false);
      return () => { active = false; };
    }

    if (!firebaseCloudReady) {
      setMembershipLoading(false);
      setMembershipUserId(user.uid);
      setMembershipError('Membership status is unavailable until Firebase sign-in is ready.');
      return () => { active = false; };
    }

    setMembershipLoading(true);
    void readMembership(user.uid)
      .then(record => {
        if (active) {
          setMembershipUserId(user.uid);
          setMembership(record);
        }
      })
      .catch(() => {
        if (active) {
          setMembershipUserId(user.uid);
          setMembershipError('Membership status could not be verified. No Premium entitlement is assumed.');
        }
      })
      .finally(() => {
        if (active) setMembershipLoading(false);
      });

    return () => { active = false; };
  }, [authLoading, user?.uid]);

  const membershipForUser = membershipUserId === user?.uid ? membership : null;
  const membershipErrorForUser = membershipUserId === user?.uid ? membershipError : '';
  const membershipLoadingForUser = Boolean(
    user && (membershipLoading || membershipUserId !== user.uid),
  );

  const authenticate = async (mode: 'sign-in' | 'create', email: string, password: string) => {
    setBusy(true);
    setError('');
    try {
      const { authenticateWithEmail } = await import('@/lib/firebase-auth');
      await authenticateWithEmail(mode, email, password);
      if (mode === 'create') reportSignupSuccess('email_password');
      setLocation('/dashboard');
    } catch (cause) {
      const { getAuthErrorMessage } = await import('@/lib/firebase-auth');
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const authenticateWithSocialProvider = async (provider: SocialAuthProvider) => {
    setBusy(true);
    setError('');
    try {
      const { authenticateWithProvider } = await import('@/lib/firebase-auth');
      await authenticateWithProvider(provider);
    } catch (cause) {
      const { getAuthErrorMessage } = await import('@/lib/firebase-auth');
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      const { signOutCurrentUser } = await import('@/lib/firebase-auth');
      await signOutCurrentUser();
    } catch (cause) {
      const { getAuthErrorMessage } = await import('@/lib/firebase-auth');
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const readinessMessage = firebaseAuthConfigured && !firebaseCloudReady
    ? getFirebaseSetupMessage()
    : '';

  return <AccountAccess
    configured={firebaseAuthConfigured}
    projectMismatch={firebaseProjectMismatch}
    userEmail={user?.email ?? null}
    membership={membershipForUser}
    membershipLoading={membershipLoadingForUser}
    membershipError={membershipErrorForUser}
    busy={busy}
    error={error}
    statusMessage={readinessMessage}
    onAuth={authenticate}
    onProviderAuth={authenticateWithSocialProvider}
    onSignOut={signOut}
  />;
}

function reportSignupSuccess(method: SignupMethod) {
  void import('@/lib/project-analytics')
    .then(({ trackSignupSuccess }) => trackSignupSuccess(method))
    .catch(() => {
      // Optional analytics must never affect authentication.
    });
}

function LabPage() {
  const [fftSize, setFftSize] = useState<SupportedFftSize>(4096);
  const [requestHighBandInput, setRequestHighBandInput] = useState(false);
  const [saveLocalRecording, setSaveLocalRecording] = useState(false);
  const [localRecordingFileDuration, setLocalRecordingFileDuration] = useState<{ url: string; seconds: number } | null>(null);
  const [localArchive, setLocalArchive] = useState(readObservationArchive);
  const observations = localArchive.items;
  const [localSaving, setLocalSaving] = useState(false);
  const [localSaveError, setLocalSaveError] = useState('');
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === OBSERVATION_STORAGE_KEY || event.key === null) {
        setLocalArchive(readObservationArchive());
        setLocalSaveError('');
        setSaved(false);
      }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);
  const [baselineId, setBaselineId] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [analysis, setAnalysis] = useState<Explanation | null>(null);
  const [analysisCapture, setAnalysisCapture] = useState<SignalCardCapture | null>(null);
  const [analysisOwnerUid, setAnalysisOwnerUid] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const { user } = useAuth();
  const activeAnalysisUserRef = useRef(user?.uid);
  activeAnalysisUserRef.current = user?.uid;
  const analysisEpochRef = useRef(0);
  const pendingAnalysisRequestRef = useRef<{
    fingerprint: string;
    idempotencyKey: string;
  } | null>(null);
  useEffect(() => {
    analysisEpochRef.current += 1;
    pendingAnalysisRequestRef.current = null;
    setAnalysis(null);
    setAnalysisCapture(null);
    setAnalysisOwnerUid(null);
    setAnalysisLoading(false);
    setAnalysisError('');
  }, [user?.uid]);
  useEffect(() => {
    if (!user || !firebaseCloudReady || firebaseProjectMismatch) return;
    const pending = readPendingInterpretation();
    if (!pending) return;
    if (pending.uid !== user.uid) {
      try {
        window.sessionStorage.removeItem(pendingInterpretationStorageKey);
      } catch {
        // Ignore unavailable browser storage.
      }
      return;
    }

    pendingAnalysisRequestRef.current = {
      fingerprint: 'recovering-saved-request',
      idempotencyKey: pending.idempotencyKey,
    };
    let current = true;
    setAnalysisLoading(true);
    setAnalysisError('');
    void import('@/lib/ai-analysis')
      .then(({ recoverAIInterpretation }) => recoverAIInterpretation(pending.idempotencyKey))
      .then(result => {
      if (!current) return;
      setAnalysis(result);
      setAnalysisOwnerUid(user.uid);
      setAnalysisCapture(pending.cardCapture ?? {
        id: pending.idempotencyKey, createdAt: new Date().toISOString(),
        measurement: null, listeningContext: '', spectrumImage: null,
      });
      pendingAnalysisRequestRef.current = null;
      clearPendingInterpretation(user.uid, pending.idempotencyKey);
    }).catch(cause => {
      if (!current) return;
      if (isNonRetryableAIRequestError(cause)) {
        pendingAnalysisRequestRef.current = null;
        clearPendingInterpretation(user.uid, pending.idempotencyKey);
      }
      setAnalysisError(cause instanceof Error ? cause.message : 'ZionCore could not recover this interpretation.');
    }).finally(() => {
      if (current) setAnalysisLoading(false);
    });
    return () => { current = false; };
  }, [user?.uid, firebaseCloudReady, firebaseProjectMismatch]);
  const [audioImportLoading, setAudioImportLoading] = useState(false);
  const [audioImportError, setAudioImportError] = useState('');
  const [audioImportStatus, setAudioImportStatus] = useState('');
  const [externalAudioFile, setExternalAudioFile] = useState<File | null>(null);
  const audioImportAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => audioImportAbortRef.current?.abort(), []);
  const engine = useLabEngine(fftSize, requestHighBandInput);
  const hasReading = Boolean(engine.reading);
  const spectralMatrixAnalysis = useMemo(
    () => engine.reading
      ? analyzeSpectralMatrix(engine.reading.spectrogram, engine.reading.sampleRate)
      : null,
    [engine.reading?.sampleRate, engine.reading?.spectrogram],
  );
  const resonanceEngineSnapshot = useMemo(
    () => createResonanceEngineSnapshot({
      starting: engine.starting,
      running: engine.running,
      silent: engine.silent,
      elapsedSeconds: engine.elapsed,
      reading: engine.reading
        ? {
            sampleRate: engine.reading.sampleRate,
            fftSize: engine.reading.fftSize,
            frequencyResolutionHz: engine.reading.resolution,
            dominantFrequencyHz: engine.reading.dominant,
            peakFrequenciesHz: engine.reading.peaks,
            rmsLevel: engine.reading.rms,
            source: engine.reading.source,
            features: engine.reading.features,
            temporalSamples: engine.reading.temporalSamples,
          }
        : null,
      matrix: spectralMatrixAnalysis,
      interpretationLoading: analysisLoading,
      hasInterpretation: Boolean(analysis),
      captureError: engine.error || undefined,
      interpretationError: analysisError || undefined,
    }),
    [
      engine.starting,
      engine.running,
      engine.silent,
      engine.elapsed,
      engine.reading,
      engine.error,
      spectralMatrixAnalysis,
      analysisLoading,
      analysis,
      analysisError,
    ],
  );
  const baseline = observations.find(item => item.id === baselineId) ?? null;
  const createObservation = (): Observation | null => {
    if (!engine.reading) return null;
    return {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      sampleRate: engine.reading.sampleRate, fftSize: engine.reading.fftSize,
      frequencyResolutionHz: engine.reading.resolution, dominantFrequencyHz: engine.reading.dominant,
      topPeaksHz: engine.reading.peaks, rmsLevel: engine.reading.rms,
      durationSeconds: engine.elapsed, mode: engine.reading.source,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
  };
  const save = async () => {
    const item = createObservation();
    if (!item || localSaving) return;
    setLocalSaving(true);
    setLocalSaveError('');
    setSaved(false);
    try {
      const next = await appendObservation(item);
      setLocalArchive({ items: next, status: 'ready', issue: '' });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch (cause) {
      setLocalSaveError(localObservationErrorMessage(cause));
      setLocalArchive(readObservationArchive());
    } finally {
      setLocalSaving(false);
    }
  };
  const downloadRecovery = () => {
    try {
      downloadFile('zioncore-browser-history-recovery.txt', readLocalRecoveryCopy(), 'text/plain;charset=utf-8');
    } catch {
      setLocalSaveError('Could not download a recovery copy. Check browser storage and download permissions. The archive has not been changed.');
    }
  };
  const saveToCloud = async () => {
    const item = createObservation();
    if (!item || !user || !firebaseCloudReady) return;
    setCloudSaving(true);
    setCloudSaved(false);
    setCloudError('');
    try {
      await saveCloudObservation(item);
      setCloudSaved(true);
      window.setTimeout(() => setCloudSaved(false), 2600);
    } catch (cause) {
      setCloudError(getCloudHistoryErrorMessage(cause));
    } finally {
      setCloudSaving(false);
    }
  };
  const requestAnalysis = async (
    includeFaithReflection: boolean,
    listeningContext: string,
    quote: AIInterpretationQuote,
    requestedAudioFile?: File,
  ) => {
    if (!engine.reading || !spectralMatrixAnalysis || !user) return;
    const requestUid = user.uid;
    const requestEpoch = ++analysisEpochRef.current;
    const measurement = {
      captureSource: engine.reading.source,
      sampleRate: engine.reading.sampleRate,
      fftSize: engine.reading.fftSize,
      frequencyResolutionHz: engine.reading.resolution,
      dominantFrequencyHz: engine.reading.dominant,
      topPeaksHz: engine.reading.peaks,
      rmsLevel: engine.reading.rms,
      durationSeconds: engine.elapsed,
      signalFeatures: engine.reading.features,
      spectralMatrixAnalysis,
    };
    const fingerprint = JSON.stringify({
      measurement,
      includeFaithReflection,
      listeningContext,
      quote: {
        quoteId: quote.quoteId,
        credits: quote.credits,
        pricingVersion: quote.pricingVersion,
      },
      externalAudioFile: requestedAudioFile
        ? {
            name: requestedAudioFile.name,
            size: requestedAudioFile.size,
            lastModified: requestedAudioFile.lastModified,
          }
        : null,
    });
    if (pendingAnalysisRequestRef.current?.fingerprint !== fingerprint) {
      const savedPending = readPendingInterpretation();
      pendingAnalysisRequestRef.current = {
        fingerprint,
        idempotencyKey: user?.uid && savedPending?.uid === user.uid
          ? savedPending.idempotencyKey
          : `ai-${crypto.randomUUID()}`,
      };
    }
    const idempotencyKey = pendingAnalysisRequestRef.current.idempotencyKey;
    let spectrumImage: string | null = null;
    try {
      const image = document.querySelector<HTMLCanvasElement>('[data-testid="visual-spectrum"]')
        ?.toDataURL('image/png');
      if (image && image.length <= 200_000) spectrumImage = image;
    } catch {
      // A spectrum picture is optional; never fabricate an unavailable snapshot.
    }
    const captureResult = signalCardCaptureSchema.safeParse({
      id: idempotencyKey, createdAt: new Date().toISOString(),
      measurement: {
        captureSource: measurement.captureSource, sampleRate: measurement.sampleRate,
        fftSize: measurement.fftSize, frequencyResolutionHz: measurement.frequencyResolutionHz,
        dominantFrequencyHz: measurement.dominantFrequencyHz, topPeaksHz: [...measurement.topPeaksHz],
        rmsLevel: measurement.rmsLevel, durationSeconds: measurement.durationSeconds,
      },
      listeningContext: listeningContext.trim().slice(0, 700), spectrumImage,
    });
    if (!captureResult.success) {
      setAnalysisError('This capture could not be preserved safely. Start a new observation before requesting a reading.');
      return;
    }
    const cardCapture = captureResult.data;
    if (user?.uid) {
      savePendingInterpretation({ uid: user.uid, idempotencyKey, cardCapture });
    }
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const { analyzeAudioMeasurement, analyzeMeasurement } = await import('@/lib/ai-analysis');
      const result = requestedAudioFile
        ? await analyzeAudioMeasurement(
            measurement,
            requestedAudioFile,
            includeFaithReflection,
            quote,
            listeningContext,
            idempotencyKey,
          )
        : await analyzeMeasurement(
            measurement,
            includeFaithReflection,
            quote,
            listeningContext,
            idempotencyKey,
          );
      if (analysisEpochRef.current !== requestEpoch || activeAnalysisUserRef.current !== requestUid) return;
      setAnalysis(result);
      setAnalysisCapture(cardCapture);
      setAnalysisOwnerUid(requestUid);
      pendingAnalysisRequestRef.current = null;
      if (user?.uid) clearPendingInterpretation(user.uid, idempotencyKey);
    } catch (cause) {
      if (analysisEpochRef.current !== requestEpoch || activeAnalysisUserRef.current !== requestUid) return;
      if (isNonRetryableAIRequestError(cause)) {
        pendingAnalysisRequestRef.current = null;
        if (user?.uid) clearPendingInterpretation(user.uid, idempotencyKey);
      }
      setAnalysis(null);
      setAnalysisError(cause instanceof Error ? cause.message : 'ZionCore could not complete this interpretation.');
    } finally {
      if (analysisEpochRef.current === requestEpoch) setAnalysisLoading(false);
      void queryClient.invalidateQueries({
        queryKey: [...getGetWalletQueryKey(), requestUid],
      });
      void queryClient.invalidateQueries({
        queryKey: [...getListWalletTransactionsQueryKey({ limit: 12 }), requestUid],
      });
    }
  };
  const processAudioFile = async (file: File) => {
    setExternalAudioFile(null);
    audioImportAbortRef.current?.abort();
    const controller = new AbortController();
    audioImportAbortRef.current = controller;
    setAudioImportError('');
    setAudioImportStatus('');
    setAudioImportLoading(true);
    try {
      const { analyzeAudioFile } = await import('@/lib/audio-file-analysis');
      const imported = await analyzeAudioFile(file, fftSize, controller.signal);
      if (controller.signal.aborted) return;
      await engine.loadImportedAudio(imported);
      if (controller.signal.aborted) return;
      setExternalAudioFile(file);
      setAudioImportStatus(`Imported ${file.name} · ${imported.durationSeconds.toFixed(1)} seconds · decoded analysis rate ${(imported.sampleRate / 1_000).toFixed(1)} kHz · ${(imported.sampleRate / 2 / 1_000).toFixed(1)} kHz digital Nyquist · ${imported.analyzedFrames} local analysis frames · ${imported.fftSize.toLocaleString()}-point FFT.`);
      setAnalysis(null);
      setAnalysisCapture(null);
      setAnalysisError('');
    } catch (cause) {
      if (controller.signal.aborted) return;
      setAudioImportError(cause instanceof Error ? cause.message : 'Could not analyze this audio file.');
    } finally {
      if (!controller.signal.aborted) {
        setAudioImportLoading(false);
        audioImportAbortRef.current = null;
      }
    }
  };
  const importAudioFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) await processAudioFile(file);
  };
  const analyzeRecordedAudio = async () => {
    const recording = engine.recordedAudio;
    if (!recording) return;
    const extension = getRecordingFileExtension(recording.mimeType);
    const file = new File(
      [recording.blob],
      extension ? `zioncore-capture.${extension}` : 'zioncore-capture',
      { type: recording.mimeType },
    );
    await processAudioFile(file);
  };
  const level = engine.reading ? Math.min(100, Math.round(engine.reading.rms * 5000)) : null;
  const checkoutStatus = typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('checkout');
  return <Shell>
    <main className="page-wrap">
      {checkoutStatus === 'success' && (
        <div className="zc-billing-return" role="status" data-testid="status-checkout-return">
          Checkout returned to ZionCore. Credits or membership update after server verification. If you started from an open reading, return to that tab to continue; the reading does not run automatically.
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="zc-billing-return" role="status" data-testid="status-checkout-cancelled">
          Checkout was canceled. No payment was taken and no analysis was run.
        </div>
      )}
      <section className="zc-first-impression" aria-labelledby="zc-home-title">
        <div className="zc-hero-copy">
          <div className="eyebrow"><span className="zc-eyebrow-mark" aria-hidden="true" /> The universal language of existence / 01</div>
          <h1 className="page-title" id="zc-home-title">Listen beyond.<br /><em>Decode deeper.</em></h1>
          <p className="zc-motto" data-testid="text-zioncore-motto">ZionCore — the universal language of existence.</p>
          <p className="zc-motto zc-motto-deep" data-testid="text-zioncore-motto-deep">ZionCore a product for those who understands life deeply</p>
          <p className="lead">What if existence has been speaking all along? Begin with a bird’s call, a pulsing tone, or the soundscape around you. ZionCore analyzes acoustic frequency patterns and turns each listening session into a rich, personalized exploration shaped by your questions, perspective, and spiritual practice.</p>
          <div className="zc-hero-actions">
            <a className="btn btn-primary" href="#capture" data-testid="link-hero-capture"><Mic size={15} aria-hidden="true" /> Start a free capture <ArrowRight size={14} aria-hidden="true" /></a>
            <Link className="btn btn-subtle" href="#capture" data-testid="link-hero-plans">Capture a signal · see your reading quote <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <p className="zc-free-note" data-testid="text-free-vs-paid"><ShieldCheck size={13} aria-hidden="true" /> Free: measured readings computed on your device, with a deterministic local reading and lens. Optional, paid: deeper AI interpretation for verified accounts.</p>
          <p className="zc-free-note"><ShieldCheck size={13} aria-hidden="true" /> Begin with a free capture, then use credits to unlock ZionCore’s complete personalized interpretation.</p>
          {!user && <Link className="zc-hero-signup" href="/history" data-testid="link-hero-signup">Sign in or create your free account <ArrowRight size={13} aria-hidden="true" /></Link>}
          <a className="zc-hero-signup" href="#free-reading" data-testid="link-hero-free-reading">Open the 19 free reading tools <ArrowRight size={13} aria-hidden="true" /></a>
          <Link className="zc-hero-signup" href="/wallet" data-testid="link-hero-pricing">Explore plans &amp; credit packs <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="zc-hero-instrument" aria-label="Illustration of an acoustic frequency pattern">
          <div className="zc-instrument-top"><span>FIELD NOTE / 001</span><span><i /> READY TO LISTEN</span></div>
          <div className="zc-instrument-visual" aria-hidden="true">
            <span className="zc-wave-line wave-a" /><span className="zc-wave-line wave-b" /><span className="zc-wave-line wave-c" />
            <span className="zc-wave-center" />
            <span className="zc-wave-label label-a">SIGNAL</span><span className="zc-wave-label label-b">CONTEXT</span>
          </div>
          <div className="zc-instrument-bottom"><span>MEASURE LOCALLY</span><span>INTERPRET WITH CARE</span></div>
          <div className="zc-instrument-caption"><strong>Signal meets meaning.</strong><span>Explore measured patterns through a personal reflection shaped by your perspective.</span></div>
        </div>
      </section>
      <ConstellationInterlude start={0} count={4} label="Interlude I" variant="orbit" />
      <SignalPath />
      <section className="panel zc-capability-summary" aria-labelledby="zc-capability-title" data-testid="panel-intelligence-cycle">
        <div className="panel-head">
          <span className="panel-title" id="zc-capability-title">The ZionCore intelligence cycle</span>
          <span className="live-badge">Seven-stage cycle</span>
        </div>
        <div className="section-body">
          <div className="zc-capability-grid">
            {intelligenceStages.map(stage => (
              <article className="zc-capability-item" key={stage.number} data-testid={`intelligence-stage-${stage.number}`}>
                <div className="zc-stage-meta">
                  <span className="zc-stage-number">{stage.number} / 07</span>
                  <span className="zc-stage-status">{stage.status}</span>
                </div>
                <strong>{stage.title}</strong>
                <p>{stage.detail}</p>
                {stage.route
                  ? <Link className="zc-stage-link" href={stage.href}>{stage.action}<ArrowRight size={12} aria-hidden="true" /></Link>
                  : <a className="zc-stage-link" href={stage.href}>{stage.action}<ArrowRight size={12} aria-hidden="true" /></a>}
              </article>
            ))}
          </div>
          <p className="zc-capability-boundary">
            <strong>Frequency first:</strong> ZionCore measures signals locally. You choose when to add personal context, request interpretation, save observations, compare records, or create an acoustic message.
          </p>
        </div>
      </section>
      <section className="zc-journey-promo" aria-labelledby="zc-journey-title" data-testid="panel-journey-promo">
        <div className="zc-journey-copy">
          <span className="zc-journey-kicker">Listen beyond · Decode deeper · Explore existence</span>
          <h2 id="zc-journey-title">The universal language is yours to explore.</h2>
          <p>Turn every capture into a deeper inquiry. Save the patterns that matter, bring your own context, and build a personal listening journal that grows with your practice. Choose a frequency reading or a personalised spiritual interpretation; ZionCore shows your current credit quote before you approve any paid work.</p>
          <p className="zc-journey-kicker">Created by HRH SAINT TARIRO MASAWI — THE ANOINTED COMMANDER · MWARI NDI MWARI</p>
        </div>
        <div className="zc-journey-actions">
          {!user && <Link href="/history" className="btn btn-primary" data-testid="link-journey-join">Create a free account <span aria-hidden="true">→</span></Link>}
          <Link href="/wallet" className="btn btn-subtle" data-testid="link-journey-plans">Explore plans</Link>
        </div>
      </section>
      <ConstellationInterlude start={4} count={3} label="Interlude II" variant="drift" />
      <Suspense fallback={<p className="empty-inline" role="status">Preparing the resonance library…</p>}>
        <ResonanceLibrary />
      </Suspense>
      <div className="live-grid" id="capture">
        <section className="panel" aria-label="Live spectrum">
          <div className="panel-head"><span className="panel-title">Frequency spectrum</span><span className="live-badge" data-testid="status-capture"><i className={`live-dot ${engine.running ? 'on' : ''}`} />{engine.running ? 'Live capture' : 'Standby'}</span></div>
          <div className="chart-wrap"><Spectrum bins={engine.reading?.bins ?? null} fftSize={engine.reading?.fftSize ?? fftSize} /><div className="chart-legend"><span>0 Hz</span><span>Amplitude · relative</span><span>{engine.reading ? `${Math.round(engine.reading.sampleRate / 2 / 1000)} kHz` : 'Nyquist'}</span></div></div>
          <div className="zc-signal-visuals">
            <div className="zc-visual-heading">
              <strong>Signal spectrogram</strong>
              <span>Time → · frequency ↑ · recent measured frames</span>
            </div>
            <Spectrogram
              frames={engine.reading?.spectrogram ?? []}
              revision={engine.reading?.spectrogramRevision ?? 0}
            />
          </div>
          <div className="metrics">
            <div className="metric"><div className="metric-label">Dominant peak</div><div className="metric-value" data-testid="value-dominant">{engine.reading ? formatFrequency(engine.reading.dominant) : '—'}</div></div>
            <div className="metric"><div className="metric-label">RMS level</div><div className="metric-value" data-testid="value-rms">{level == null ? '—' : `${level}`}<span className="metric-unit">{level == null ? '' : 'rel.'}</span></div></div>
            <div className="metric"><div className="metric-label">Elapsed</div><div className="metric-value" data-testid="value-duration">{hasReading ? engine.elapsed.toFixed(1) : '—'}<span className="metric-unit">{hasReading ? 'sec' : ''}</span></div></div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Capture settings</span><AudioLines size={17} color="#758681" /></div>
          <div className="controls">
            <div className={`status-box ${engine.error ? 'alert-box' : ''}`} role={engine.error ? 'alert' : 'status'} data-testid="status-message">{engine.error || engine.status}</div>
            <div className="control-row"><label className="label-row" htmlFor="fft-size"><span>FFT size</span><span className="small-note">next recording</span></label><select id="fft-size" className="select-control" value={fftSize} disabled={engine.running || engine.starting || audioImportLoading} onChange={event => setFftSize(Number(event.target.value) as SupportedFftSize)} data-testid="select-fft-size"><option value={2048}>2,048 points</option><option value={4096}>4,096 points</option><option value={8192}>8,192 points</option></select></div>
            <div className="control-row">
              <span className="label-row"><span>High-band microphone request</span><span className="small-note">next recording</span></span>
              <button
                type="button"
                className={`btn ${requestHighBandInput ? 'btn-primary' : 'btn-subtle'}`}
                aria-pressed={requestHighBandInput}
                disabled={engine.running || engine.starting || audioImportLoading}
                onClick={() => setRequestHighBandInput(value => !value)}
                data-testid="button-toggle-high-band-input"
              >
                {requestHighBandInput ? 'Requesting up to 192 kHz' : 'Request high-band input'}
              </button>
            </div>
            <p className="permission-note">This asks the browser-selected microphone for up to {MAX_ANALYSIS_SAMPLE_RATE_HZ.toLocaleString()} Hz; the browser and receiver may negotiate less. The measured sample rate and Nyquist limit appear after capture. A high sample rate alone cannot confirm the microphone’s physical response or calibration.</p>
            <label className="permission-note" htmlFor="save-local-recording" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                id="save-local-recording"
                type="checkbox"
                checked={saveLocalRecording}
                disabled={engine.running || engine.starting || audioImportLoading || engine.supportedMimeTypes.length === 0}
                onChange={event => setSaveLocalRecording(event.target.checked)}
                data-testid="checkbox-save-recording"
              />
              <span>Also record a local copy for playback or download. This is off by default and remains on this device only.</span>
            </label>
            {engine.supportedMimeTypes.length > 0
              ? <p className="permission-note" data-testid="status-recorder-capabilities">This browser reports recording support for: {engine.supportedMimeTypes.join(', ')}.</p>
              : <p className="permission-note" role="status" data-testid="status-recorder-capabilities">Local recording is unavailable in this browser; live frequency analysis and audio import can still work.</p>}
            <p className="permission-note">If Safari is backgrounded or the microphone is interrupted, an opted-in recording stops and preserves its partial clip. Start a new capture to continue; interrupted audio is never silently described as complete.</p>
            {engine.reading && <p className="permission-note" role="status" data-testid="status-fft-settings">Displayed reading: {engine.reading.fftSize.toLocaleString()}-point FFT.{engine.reading.fftSize !== fftSize ? ` Your next recording will use ${fftSize.toLocaleString()} points; this reading has not been reprocessed.` : ''}</p>}
            {engine.running || engine.starting ? <>
              {engine.running && engine.analysisPaused && <button className="btn btn-subtle" onClick={() => void engine.resume()} data-testid="button-resume-capture">Resume analysis</button>}
              <button className="btn btn-stop" onClick={() => void engine.stop()} data-testid="button-stop"><Square size={15} fill="currentColor" />{engine.starting ? 'Cancel / stop' : 'Stop capture'}</button>
            </> : <button className="btn btn-primary" onClick={() => { setExternalAudioFile(null); void engine.start(saveLocalRecording); }} disabled={audioImportLoading} data-testid="button-start"><Mic size={16} />Start microphone</button>}
            {engine.recordingStatus && <p className="permission-note" role="status" data-testid="status-local-recording">{engine.recordingStatus}</p>}
            {engine.recordingError && <div className="status-box alert-box" role="alert" data-testid="error-local-recording">{engine.recordingError}</div>}
            {engine.recordedAudio && <div className="panel" data-testid="panel-local-recording" style={{ padding: 16 }}>
              <div className="eyebrow">LOCAL RECORDING · {localRecordingFileDuration?.url === engine.recordedAudio.url && Number.isFinite(localRecordingFileDuration.seconds)
                ? `${localRecordingFileDuration.seconds.toFixed(1)}s FILE`
                : 'READING FILE DURATION'}</div>
              {localRecordingFileDuration?.url === engine.recordedAudio.url && Number.isFinite(localRecordingFileDuration.seconds)
                && Math.abs(localRecordingFileDuration.seconds - engine.recordedAudio.durationSeconds) > 0.5
                && <p className="permission-note" role="status" data-testid="status-recorded-duration-difference">Capture session was {engine.recordedAudio.durationSeconds.toFixed(1)} seconds; the browser reports {localRecordingFileDuration.seconds.toFixed(1)} seconds of playable audio.</p>}
              <p className="permission-note">{engine.recordedAudio.metadata}</p>
              <audio
                controls
                preload="metadata"
                src={engine.recordedAudio.url}
                onLoadedMetadata={event => {
                  if (Number.isFinite(event.currentTarget.duration)) {
                    setLocalRecordingFileDuration({ url: engine.recordedAudio!.url, seconds: event.currentTarget.duration });
                  }
                }}
                style={{ display: 'block', width: '100%', margin: '12px 0' }}
                data-testid="audio-local-recording"
              />
              <div className="control-row">
                <a
                  className="btn btn-subtle"
                  href={engine.recordedAudio.url}
                  download={`zioncore-capture${getRecordingFileExtension(engine.recordedAudio.mimeType) ? `.${getRecordingFileExtension(engine.recordedAudio.mimeType)}` : ''}`}
                  data-testid="link-download-recording"
                >Download local recording</a>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void analyzeRecordedAudio()}
                  disabled={(localRecordingFileDuration?.url === engine.recordedAudio.url && localRecordingFileDuration.seconds < 3) || audioImportLoading}
                  data-testid="button-analyze-local-recording"
                >Analyze locally</button>
                <button type="button" className="btn btn-subtle" onClick={engine.clearRecordedAudio} data-testid="button-discard-local-recording">Discard</button>
              </div>
              {localRecordingFileDuration?.url === engine.recordedAudio.url && localRecordingFileDuration.seconds < 3 && <p className="permission-note">This file contains less than the 3 seconds required for analysis. Record a longer clip or import another recording.</p>}
              <p className="permission-note">Playback, download and local analysis do not send the recording to a provider. The in-memory recording is cleared when you leave this page. Browser recordings are encoded copies; for high-rate or ultrasound analysis, use a native WAV from a compatible receiver.</p>
            </div>}
            <label className="zc-audio-import">
              <Upload size={15} aria-hidden="true" />
              <span>{audioImportLoading ? 'Analyzing recording locally…' : 'Import audio for deep analysis'}</span>
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm"
                onChange={event => void importAudioFile(event)}
                disabled={engine.running || engine.starting || audioImportLoading}
                data-testid="input-audio-import"
              />
            </label>
            <p className="permission-note">Choose a browser-supported recording up to 24 MB and 3 seconds to 10 minutes for local analysis, within the device’s safe memory limit. Browser microphone recordings are capped at 3 minutes and 24 MB. For ultrasound-range experiments, use a WAV from a purpose-built receiver; ZionCore preserves native WAV rates through {MAX_ANALYSIS_SAMPLE_RATE_HZ.toLocaleString()} Hz when supported and stops rather than silently resampling. A separate, optional paid audio review can send an eligible 3-second to 10-minute PCM WAV to Gemini only after you enable it and review its duration- and size-based credit quote.</p>
            {audioImportError && <div className="status-box alert-box" role="alert" data-testid="status-audio-import-error">{audioImportError}</div>}
            {audioImportStatus && <div className="status-box" role="status" data-testid="status-audio-import">{audioImportStatus}</div>}
            <p className="permission-note">Microphone permission is requested only when you press Start. Live microphone audio and imported files are analyzed locally by default. The premium external-audio option applies only to an imported eligible WAV and requires a separate explicit choice.</p>
            <ReferenceToneControls />
          </div>
        </section>
      </div>
      {engine.error && <div className="section-grid"><div className="panel"><div className="section-body"><div className="eyebrow">Troubleshooting</div><p className="empty-inline">Make sure this page is served over HTTPS or localhost, choose an available input device in your browser, and allow microphone access. If another app has exclusive access, close it and retry.</p></div></div></div>}
      <EngineMonitor snapshot={resonanceEngineSnapshot} />
      <div className="section-grid">
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Measurement details</span><Activity size={16} color="#758681" /></div>
          <div className="section-body">
            <div className="label-row"><span>Sample rate</span><span className="mono" data-testid="value-sample-rate">{engine.reading ? `${(engine.reading.sampleRate / 1000).toFixed(1)} kHz` : '—'}</span></div>
            <div className="label-row"><span>Digital upper limit (Nyquist)</span><span className="mono" data-testid="value-nyquist">{engine.reading ? `${(engine.reading.sampleRate / 2 / 1000).toFixed(1)} kHz` : '—'}</span></div>
            <div className="label-row"><span>Resolution</span><span className="mono" data-testid="value-resolution">{engine.reading ? `${engine.reading.resolution.toFixed(2)} Hz / bin` : '—'}</span></div>
            <div className="label-row"><span>FFT window</span><span className="mono">{fftSize.toLocaleString()}</span></div>
            <div style={{ borderTop: '1px solid #e4dfd4', margin: '14px 0' }} />
            <div className="label-row"><span>Spectral peaks</span><span className="small-note">local maxima</span></div>
            {engine.reading?.peaks.length ? <div className="peak-list">{engine.reading.peaks.map((peak, index) => <span className="peak-chip" key={`${peak}-${index}`} data-testid={`peak-${index}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">{engine.silent ? 'No clear spectral peaks: input is at or near silence.' : 'Peaks appear here while the microphone is measuring.'}</p>}
            {engine.silent && engine.running && <p className="empty-inline" role="status" data-testid="status-silence">Very low input detected. Check microphone placement or input level.</p>}
            <div className="zc-baseline-compare" id="baseline">
              <label className="label-row" htmlFor="baseline-observation">
                <span>Compare with a saved baseline</span>
                <span className="small-note">local history</span>
              </label>
              <select
                id="baseline-observation"
                className="select-control"
                value={baselineId}
                onChange={event => setBaselineId(event.target.value)}
                data-testid="select-baseline-observation"
              >
                <option value="">Choose an observation</option>
                {observations.map(item => (
                  <option value={item.id} key={item.id}>
                    {new Date(item.createdAt).toLocaleString()} · {formatFrequency(item.dominantFrequencyHz)}
                  </option>
                ))}
              </select>
              {baseline && engine.reading ? (
                <div className="zc-baseline-result" role="status" data-testid="status-baseline-comparison">
                  {baseline.dominantFrequencyHz != null && engine.reading.dominant != null ? (
                    <strong>
                      Peak shift {engine.reading.dominant - baseline.dominantFrequencyHz >= 0 ? '+' : ''}
                      {(engine.reading.dominant - baseline.dominantFrequencyHz).toFixed(2)} Hz
                    </strong>
                  ) : <strong>A dominant peak is not available for both readings.</strong>}
                  <span>
                    Baseline {formatFrequency(baseline.dominantFrequencyHz)} · current {formatFrequency(engine.reading.dominant)}
                  </span>
                  <p>This is a direct comparison, not a statistical anomaly or cause determination.</p>
                </div>
              ) : (
                <p className="permission-note">Save a measurement first, then compare its measured peak with the current reading.</p>
              )}
            </div>
            <div className="zc-temporal-visual">
              <div className="zc-visual-heading">
                <strong>Recent measurement trend</strong>
                <span>Peak frequency and relative RMS</span>
              </div>
              <SignalHistoryPlot samples={engine.reading?.temporalSamples ?? []} />
              <div className="zc-temporal-legend"><span><i className="zc-legend-frequency" />Dominant frequency</span><span><i className="zc-legend-rms" />Relative RMS</span></div>
            </div>
            <div className="zc-measurement-signature" data-testid="panel-measurement-signature">
              <div className="zc-signature-title"><span>Advanced signal signature</span><span className="small-note">relative measures</span></div>
              <div className="zc-signature-grid">
                <div className="zc-signature-cell"><span>Spectral centroid</span><strong data-testid="value-spectral-centroid">{formatFrequency(engine.reading?.features.spectralCentroidHz)}</strong></div>
                <div className="zc-signature-cell"><span>Spectral flatness</span><strong data-testid="value-spectral-flatness">{engine.reading ? `${(engine.reading.features.spectralFlatness * 100).toFixed(1)}%` : '—'}</strong></div>
                <div className="zc-signature-cell"><span>Normalized entropy</span><strong data-testid="value-spectral-entropy">{engine.reading ? `${(engine.reading.features.spectralEntropy * 100).toFixed(1)}%` : '—'}</strong></div>
                <div className="zc-signature-cell"><span>Peak / floor contrast</span><strong data-testid="value-peak-floor-contrast">{engine.reading?.features.peakToMedianContrastDb == null ? '—' : `${engine.reading.features.peakToMedianContrastDb.toFixed(1)} dB est.`}</strong></div>
                <div className="zc-signature-cell"><span>Harmonicity</span><strong data-testid="value-harmonicity">{engine.reading ? `${(engine.reading.features.harmonicity * 100).toFixed(1)}%` : '—'}</strong></div>
                <div className="zc-signature-cell"><span>Frequency stability</span><strong data-testid="value-frequency-stability">{engine.reading?.features.dominantFrequencyStabilityHz == null ? '—' : `${engine.reading.features.dominantFrequencyStabilityHz.toFixed(1)} Hz σ`}</strong></div>
                <div className="zc-signature-cell"><span>Frequency drift</span><strong data-testid="value-frequency-drift">{engine.reading?.features.dominantFrequencyDriftHz == null ? '—' : `${engine.reading.features.dominantFrequencyDriftHz.toFixed(1)} Hz`}</strong></div>
              </div>
              <p className="permission-note">Peak/floor contrast compares the strongest spectral bin with the median bin. It is a relative estimate, not calibrated sound pressure or laboratory SNR.</p>
            </div>
            {spectralMatrixAnalysis && <SpectralMatrixPanel analysis={spectralMatrixAnalysis} />}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Save an observation</span><Save size={16} color="#758681" /></div>
          <div className="section-body">
            <label className="label-row" htmlFor="observation-notes"><span>Notes <span className="small-note">(optional)</span></span><span className="small-note">not sent with a ZionCore reading</span></label>
            <textarea id="observation-notes" className="text-control" maxLength={4000} placeholder="Describe the room, source, or context…" value={notes} onChange={event => setNotes(event.target.value)} data-testid="input-notes" />
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!hasReading || localSaving || localArchive.status !== 'ready'} onClick={() => void save()} data-testid="button-save-observation">{saved ? <Check size={15} /> : <Save size={15} />}{localSaving ? 'Saving to this browser…' : saved ? 'Saved to this browser' : 'Save observation'}</button>
            {(localSaveError || localArchive.issue) && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-local-save-error">{localSaveError || localArchive.issue}</p>}
            {localArchive.status !== 'ready' && <button type="button" className="btn btn-subtle" style={{ marginTop: 10 }} data-testid="button-recheck-local-storage" onClick={() => {
              setLocalArchive(readObservationArchive()); setLocalSaveError(''); setSaved(false);
            }}>Check local history again</button>}
            {localArchive.status === 'damaged' && <><button type="button" className="btn btn-subtle" style={{ marginTop: 10 }} onClick={downloadRecovery} data-testid="button-download-local-recovery">Download local recovery copy</button><p className="permission-note">The recovery copy can contain your notes. Keep it private; it is downloaded to your device, not uploaded.</p></>}
            <button className="btn btn-subtle zc-cloud-save" style={{ marginTop: 10, width: '100%' }} disabled={!hasReading || !user || !firebaseCloudReady || cloudSaving} onClick={() => void saveToCloud()} data-testid="button-save-cloud-observation">
              <Save size={14} />{cloudSaving ? 'Saving privately…' : cloudSaved ? 'Saved to your private cloud history' : 'Save to private cloud'}
            </button>
            {cloudError && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-cloud-save-error">{cloudError}</p>}
            {!user && <p className="permission-note">To save across devices, sign in from the History page. Local saving remains available.</p>}
            {user && !firebaseCloudReady && <p className="permission-note" role="status">Cloud saves are paused until Firebase sign-in is configured.</p>}
            <p className="permission-note">A snapshot is saved only when you choose a save action. Audio is never stored or uploaded.</p>
          </div>
        </section>
      </div>
      <ConstellationInterlude start={7} count={4} label="Interlude III" variant="lattice" />
      <Suspense fallback={<section id="free-reading" className="panel" role="status"><div className="section-body">Preparing the 19 free discovery tools…</div></section>}>
      <FreeListeningPanel
        userUid={user?.uid ?? null}
        hasPaidInterpretation={Boolean(user && analysisOwnerUid === user.uid && analysis)}
        input={engine.reading ? {
          dominantFrequencyHz: engine.reading.dominant,
          rmsLevel: engine.reading.rms,
          sampleRate: engine.reading.sampleRate,
          durationSeconds: engine.elapsed,
          features: engine.reading.features,
          silent: engine.silent,
          fftSize: engine.reading.fftSize,
          captureSource: engine.reading.source,
        } : null}
      />
      </Suspense>
      <div className="section-grid" id="interpretation">
        <Suspense fallback={<section className="panel" role="status" data-testid="status-analysis-tools-loading"><div className="section-body">Preparing interpretation tools…</div></section>}>
          <AnalysisPanel
            hasMeasurement={hasReading}
            canAnalyze={hasReading && engine.elapsed >= 3}
            loading={analysisLoading}
            error={analysisError}
            explanation={analysisOwnerUid === user?.uid ? analysis : null}
            externalAudioFile={externalAudioFile}
            externalAudioDurationSeconds={engine.elapsed}
            cardCapture={analysisOwnerUid === user?.uid ? analysisCapture : null}
            onAnalyze={requestAnalysis}
            user={user}
            firebaseReady={firebaseCloudReady}
            projectMismatch={firebaseProjectMismatch}
          />
        </Suspense>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Analysis privacy</span><ShieldCheck size={16} color="#758681" /></div>
            <div className="section-body"><p className="empty-inline" style={{ marginTop: 0 }}>A standard ZionCore interpretation runs only after you request it and after a three-second observation window. It receives derived frequency features, the context you choose to share, and a compact ZionCore brief; the original audio, full spectrum bins, and saved observation notes stay out of that standard request. A separate premium audio review is available only after you select an eligible PCM WAV, enable the explicit sharing checkbox, and confirm the current credit quote. That request sends short WAV segments to Gemini; the source file is processed in memory and is not stored by ZionCore. Gemini’s short observations and the chosen context may then be sent to OpenAI as text-only fallback. The optional spiritual reading begins with the measured features, prioritises the context you provide, and may compare relevant traditions without treating scripture as signal evidence.</p><p className="empty-inline">Each report identifies the text provider, model, and whether a direct audio review was used. A verified Firebase sign-in is required; App Check is optional. Credits are reserved first, settled only after a valid report, and released if generation fails. Advanced audio pricing must be owner-approved before the option can be purchased.</p></div>
        </section>
      </div>
      <div className="section-grid">
        <section className="panel">
          <div className="panel-head"><span className="panel-title">How to read this instrument</span><Info size={16} color="#758681" /></div>
            <div className="section-body"><p className="empty-inline" style={{ marginTop: 0 }}>Frequency analysis is the primary instrument. Live microphone capture and supported local recordings are analyzed as acoustic waveforms; the FFT measures relative amplitude by frequency, with resolution equal to sample rate divided by FFT size. ZionCore examines peaks, harmonics, stability, drift, and amplitude variation. A microphone can hear tones played by a speaker, but it is not a direct RF or ultrasound receiver.</p><p className="empty-inline">The Device Centre now imports high-rate WAV, raw receive-only SDR IQ, accelerometer CSV, and environmental logger CSV for local, domain-specific analysis. Live specialist receivers still need a documented compatible bridge; imported digital samples do not verify a physical sensor or its calibration. The Messages instrument can decode its supported versioned text/prayer packet protocol. Spiritual meaning can be explored through the faith and context you choose to share. <Link href="/devices">Open the Device Centre</Link> or <Link href="/discover">explore the ZionCore field guide</Link>.</p></div>
        </section>
        <section className="panel faith-card">
          <div className="panel-head"><span className="panel-title">Personalised spiritual reflection</span><BookOpen size={16} color="#758681" /></div>
          <div className="section-body">
            <p className="empty-inline" style={{ marginTop: 0, marginBottom: 16 }}>No verse stands in for the reading. ZionCore begins with the measured frequency pattern, then uses the context you choose to shape a substantial personal interpretation. If no tradition is named, it can offer a comparative perspective without guessing your faith. Any relevant sacred-text quote appears separately and is never used as evidence for the signal.</p>
            <a className="btn btn-subtle" href="#interpretation" data-testid="link-faith-reading">Shape a personalised reading <ArrowRight size={14} /></a>
          </div>
        </section>
      </div>
      <ConstellationInterlude start={11} count={4} label="Interlude IV" variant="orbit" />
      <section className="zc-discovery-links" aria-labelledby="zc-discovery-links-title">
        <div className="zc-discovery-links-head">
          <span className="eyebrow">Learn · Listen · Experiment</span>
          <h2 id="zc-discovery-links-title">Explore ZionCore by interest.</h2>
          <p>Start with a working instrument or follow a clear guide to sound, frequency, and personal meaning.</p>
        </div>
        <div className="zc-discovery-link-grid">
          <Link href="/devices"><strong>Universal device centre</strong><span>Check browser support and import acoustic, SDR IQ, vibration, or environmental recordings.</span></Link>
          <a href="/audio-spectrum-analyzer/"><strong>Audio spectrum analyzer</strong><span>Inspect FFT peaks, harmonics, spectrograms, and temporal change.</span></a>
          <a href="/online-tone-generator/"><strong>Online tone generator</strong><span>Create short reference tones, including 432 Hz and 528 Hz presets.</span></a>
          <a href="/sound-message-encoder/"><strong>ZionCore Frequency Messenger</strong><span>Encode a short text or prayer into a nearby acoustic packet.</span></a>
          <a href="/spiritual-frequency-exploration/"><strong>Spiritual frequency exploration</strong><span>Bring your own faith context to a personal listening reflection.</span></a>
          <a href="/plant-bioacoustics/"><strong>Plant bioacoustics</strong><span>Learn what an environmental recording can—and cannot—show.</span></a>
          <a href="/frequency-signal-guide/"><strong>Frequency and FFT guide</strong><span>Understand resolution, harmonics, and measured signal patterns.</span></a>
          <a href="#resonance-gallery"><strong>Resonance Matrix</strong><span>Find the constellation controls and follow 19 complete artworks across five changing areas.</span></a>
        </div>
      </section>
      <ResonanceMatrixGallery />
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Audio stays on your device for local analysis and standard readings. Only a separately selected premium review sends an eligible WAV to Gemini; ZionCore does not persist the source file. Saved histories contain measurement metadata and notes, not original audio.</p>
    </main>
  </Shell>;
}

function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const scope = authLoading ? 'loading' : user && firebaseCloudReady ? user.uid : 'local';
  const [items, setItems] = useState<Observation[]>([]);
  const [itemsScope, setItemsScope] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [clearError, setClearError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [localArchiveIssue, setLocalArchiveIssue] = useState('');
  const [localArchiveDamaged, setLocalArchiveDamaged] = useState(false);
  const isCloudHistory = scope !== 'local' && scope !== 'loading';

  useEffect(() => {
    if (scope === 'loading') return;
    let active = true;
    setItems([]);
    setItemsScope('loading');
    setLoading(true);
    setHistoryError('');
    setLocalArchiveIssue('');
    setLocalArchiveDamaged(false);
    if (scope === 'local') {
      const archive = readObservationArchive();
      setItems(archive.items);
      setLocalArchiveIssue(archive.issue);
      setLocalArchiveDamaged(archive.status === 'damaged');
      setItemsScope('local');
      setLoading(false);
      const refresh = (event: StorageEvent) => {
        if (event.key !== OBSERVATION_STORAGE_KEY && event.key !== null) return;
        const latest = readObservationArchive();
        setItems(latest.items);
        setLocalArchiveIssue(latest.issue);
        setLocalArchiveDamaged(latest.status === 'damaged');
        setConfirmClear(false);
      };
      window.addEventListener('storage', refresh);
      return () => { active = false; window.removeEventListener('storage', refresh); };
    }
    void listCloudObservations().then(result => {
      if (active) {
        setItems(result);
        setItemsScope(scope);
      }
    }).catch(cause => {
      if (active) setHistoryError(getCloudHistoryErrorMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [scope]);

  const visibleItems = itemsScope === scope ? items : [];
  const exportJson = () => downloadFile('zioncore-observations.json', JSON.stringify(visibleItems, null, 2), 'application/json');
  const exportCsv = () => downloadFile('zioncore-observations.csv', toCsv(visibleItems), 'text/csv;charset=utf-8');
  const clear = async () => {
    setClearError('');
    try {
      if (isCloudHistory) {
        await deleteCloudObservations(visibleItems.map(item => item.id));
      } else {
        await writeObservations([]);
        setLocalArchiveIssue('');
        setLocalArchiveDamaged(false);
      }
      setItems([]);
      setConfirmClear(false);
    } catch (cause) {
      setClearError(isCloudHistory ? getCloudHistoryErrorMessage(cause) : 'Could not clear local history. Check browser storage permissions and retry.');
    }
  };
  return <Shell>
    <main className="page-wrap">
      <div className="eyebrow">{isCloudHistory ? 'Private cloud / archive' : 'Your browser / archive'}</div>
      <h1 className="page-title">Observation<br />history.</h1>
      <p className="lead">{isCloudHistory ? 'Only observations you explicitly saved to your account appear here. This private archive follows your sign-in across devices.' : 'Only measurements you explicitly saved appear here. This archive lives in local browser storage on this device.'}</p>
      <p className="footnote" data-testid="text-history-retention">
        {isCloudHistory
          ? 'Cloud observations remain in this account until you delete them. Export a copy before clearing; backup import restores to local browser history, not directly to cloud.'
          : 'Local observations remain in this browser profile until deleted or browser data is cleared. ZionCore does not encrypt this local archive; anyone with access to this profile may be able to read it. Backup imports merge into local history without replacing existing records.'}
      </p>
      <div style={{ marginTop: 24 }}><AccountSection /></div>
      {historyError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-history-error">{historyError}</div>}
      {clearError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-history-clear-error">{clearError}</div>}
      {!isCloudHistory && localArchiveIssue && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-local-history-error">{localArchiveIssue}</div>}
      {!isCloudHistory && localArchiveIssue && <button type="button" className="btn btn-subtle" style={{ marginTop: 12 }} data-testid="button-recheck-local-storage" onClick={() => {
        const latest = readObservationArchive();
        setItems(latest.items); setLocalArchiveIssue(latest.issue); setLocalArchiveDamaged(latest.status === 'damaged'); setClearError('');
      }}>Check local history again</button>}
      {!isCloudHistory && localArchiveDamaged && <><button type="button" className="btn btn-subtle" style={{ marginTop: 12 }} data-testid="button-download-local-recovery" onClick={() => {
        try { downloadFile('zioncore-browser-history-recovery.txt', readLocalRecoveryCopy(), 'text/plain;charset=utf-8'); }
        catch { setClearError('Could not download a recovery copy. Check browser storage and download permissions. The archive has not been changed.'); }
      }}>Download local recovery copy</button><p className="permission-note">Contains the original browser archive and may include private notes. Keep this downloaded copy private.</p></>}
      <div className="history-toolbar" style={{ marginTop: 25 }}>
        <Link href="/cards" className="btn btn-subtle" data-testid="link-signal-cards-history">Saved Signal Cards</Link>
        <button className="btn btn-subtle" onClick={exportJson} disabled={!visibleItems.length} data-testid="button-export-json"><Download size={14} />Export JSON</button>
        <button className="btn btn-subtle" onClick={exportCsv} disabled={!visibleItems.length} data-testid="button-export-csv"><FileDown size={14} />Export CSV</button>
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={!visibleItems.length} data-testid="button-clear-history"><Trash2 size={14} />Clear history</button>
      </div>
      {scope === 'local' && itemsScope === 'local' && (
        <Suspense fallback={<p className="empty-inline" role="status">Preparing local recovery…</p>}>
          <ObservationBackupRestore onRestored={() => {
            const currentArchive = readObservationArchive();
            setItems(currentArchive.items); setLocalArchiveIssue(currentArchive.issue);
            setLocalArchiveDamaged(currentArchive.status === 'damaged');
            setConfirmClear(false); setClearError('');
          }} />
        </Suspense>
      )}
      {loading ? <div className="panel empty-state" role="status" data-testid="status-history-loading"><p>Loading your saved observations…</p></div>
        : historyError ? <div className="panel empty-state" role="status" data-testid="status-history-unavailable"><span className="empty-glyph"><Info size={22} /></span><h2>History could not be loaded.</h2><p>Retry the page after checking the Firebase connection. No local history was substituted for the cloud archive.</p></div>
        : visibleItems.length ? <div className="history-list">{visibleItems.map(item => <Link key={item.id} href={`/history/${item.id}`} className="panel history-item" data-testid={`link-observation-${item.id}`}>
        <span><span className="history-date">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="history-freq">{formatFrequency(item.dominantFrequencyHz)}</span><span className="history-meta">{item.fftSize.toLocaleString()} FFT · {(item.sampleRate / 1000).toFixed(1)} kHz sample rate · {item.durationSeconds.toFixed(1)} sec</span></span><ArrowRight className="history-arrow" size={17} />
      </Link>)}</div> : <div className="panel empty-state" style={{ marginTop: 30 }}>
        <span className="empty-glyph"><History size={23} /></span><h2>{!isCloudHistory && localArchiveIssue ? 'Browser history needs attention.' : 'Your record begins with an observation.'}</h2><p>{!isCloudHistory && localArchiveIssue ? 'Existing history could not be read. This does not mean it was empty or deleted. Check storage permissions or download a private recovery copy when offered.' : isCloudHistory ? 'No cloud observations are saved to this account yet. Local browser records remain separate.' : 'Capture microphone sound or import a supported recording in the live lab, then choose “Save observation.” Nothing is added automatically.'}</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-empty-start"><Mic size={14} />Go to live lab</Link>
      </div>}
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Exports contain measurement metadata and your notes, never original microphone or imported audio.</p>
    </main>
    {confirmClear && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmClear(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" data-testid="dialog-clear-history">
        <h2 id="clear-title">Clear saved observations?</h2>
        <p>This permanently removes {visibleItems.length} {visibleItems.length === 1 ? 'observation' : 'observations'} from {isCloudHistory ? 'your private cloud archive' : 'this browser'}. Export first if you want to keep a copy.</p>
        {!isCloudHistory && localArchiveDamaged && <p className="zc-callout zc-callout-alert">Unreadable entries in this browser archive will also be erased. Download the original recovery copy first if you want to preserve them.</p>}
        <div className="modal-actions"><button className="btn btn-subtle" onClick={() => setConfirmClear(false)} data-testid="button-cancel-clear">Keep history</button><button className="btn btn-danger" onClick={() => void clear()} data-testid="button-confirm-clear"><Trash2 size={14} />Clear permanently</button></div>
      </section>
    </div>}
  </Shell>;
}

function DetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const scope = authLoading ? 'loading' : user && firebaseCloudReady ? user.uid : 'local';
  const [item, setItem] = useState<Observation | undefined>();
  const [loadedScope, setLoadedScope] = useState('');
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (scope === 'loading') return;
    let active = true;
    setItem(undefined);
    setLoadedScope('');
    setDetailError('');
    setDetailLoading(true);
    if (scope === 'local') {
      const archive = readObservationArchive();
      const match = archive.items.find(entry => entry.id === params.id);
      setItem(match);
      if (!match && archive.issue) setDetailError(archive.issue);
      setLoadedScope('local');
      setDetailLoading(false);
      return () => { active = false; };
    }
    void getCloudObservation(params.id).then(result => {
      if (active) {
        setItem(result);
        setLoadedScope(scope);
      }
    }).catch(cause => {
      if (active) {
        setDetailError(getCloudHistoryErrorMessage(cause));
        setLoadedScope(scope);
      }
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [scope, params.id]);

  if (detailLoading || loadedScope !== scope) return <Shell><main className="page-wrap"><div className="panel empty-state" role="status" data-testid="status-detail-loading"><p>Loading this observation…</p></div></main></Shell>;
  if (detailError) return <Shell><main className="page-wrap"><Link href="/history" className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="status-box alert-box" role="alert" data-testid="status-detail-error">{detailError}</div></main></Shell>;
  if (!item) return <Shell><main className="page-wrap"><Link href="/history" className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="panel empty-state"><span className="empty-glyph"><Info size={22} /></span><h2>Observation not found</h2><p>It may have been cleared from this browser or the link may be incomplete.</p><Link href="/history" className="btn btn-subtle" data-testid="link-return-history">Return to history</Link></div></main></Shell>;
  return <Shell>
    <main className="page-wrap">
      <Link href="/history" className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link>
       <div className="eyebrow">{item.mode === 'audio-file' ? 'Imported audio' : 'Microphone observation'} / {new Date(item.createdAt).toLocaleDateString()}</div>
      <h1 className="page-title">{formatFrequency(item.dominantFrequencyHz)}</h1>
      <p className="lead">Saved {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}. This is a measurement record, not an interpretation of its source.</p>
      <section className="panel" style={{ marginTop: 29 }}>
        <div className="panel-head"><span className="panel-title">Measurement record</span><span className="live-badge"><i className="live-dot" />Saved locally</span></div>
        <div className="detail-stats">
         <div className="detail-stat"><span className="metric-label">Sample rate</span><strong>{(item.sampleRate / 1000).toFixed(1)} kHz</strong></div><div className="detail-stat"><span className="metric-label">Resolution</span><strong>{item.frequencyResolutionHz.toFixed(2)} Hz/bin</strong></div><div className="detail-stat"><span className="metric-label">FFT size</span><strong>{item.fftSize.toLocaleString()}</strong></div><div className="detail-stat"><span className="metric-label">Duration</span><strong>{item.durationSeconds.toFixed(1)} sec</strong></div><div className="detail-stat"><span className="metric-label">RMS level</span><strong>{Math.round(item.rmsLevel * 5000)} rel.</strong></div><div className="detail-stat"><span className="metric-label">Source</span><strong>{item.mode === 'audio-file' ? 'Imported audio' : 'Microphone'}</strong></div><div className="detail-stat"><span className="metric-label">Dominant peak</span><strong>{formatFrequency(item.dominantFrequencyHz)}</strong></div><div className="detail-stat"><span className="metric-label">Peak count</span><strong>{item.topPeaksHz.length}</strong></div>
        </div>
        <div className="section-body" style={{ borderTop: '1px solid #e4dfd4' }}><div className="label-row"><span>Spectral peaks</span><span className="small-note">Hz</span></div>{item.topPeaksHz.length ? <div className="peak-list">{item.topPeaksHz.map((peak, i) => <span className="peak-chip" key={`${peak}-${i}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">No clear peaks were detected in this observation.</p>}{item.notes && <><div className="label-row" style={{ marginTop: 22 }}><span>Notes</span></div><p className="empty-inline" style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</p></>}</div>
      </section>
      <p className="footnote"><Info size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />This record preserves the sound patterns measured in that moment. Environmental, personal, and spiritual meaning is open for you to explore.</p>
    </main>
  </Shell>;
}

function NotFound() {
  return <Shell><main className="page-wrap"><div className="panel empty-state"><span className="empty-glyph"><Radio size={22} /></span><h2>Page not found</h2><p>Choose a live measurement, a saved observation, or the acoustic message instrument.</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-not-found-home">Return to lab</Link></div></main></Shell>;
}

function MessagesRoute() {
  return <Shell>
    <ErrorBoundary>
    <Suspense fallback={<RouteLoadingFallback />}>
      <MessagesPage />
    </Suspense>
    </ErrorBoundary>
  </Shell>;
}

function WalletRoute() {
  const { user, loading } = useAuth();
  return <Shell>
    <ErrorBoundary>
    <Suspense fallback={<RouteLoadingFallback />}>
      <WalletPage
        user={user}
        authLoading={loading}
        firebaseReady={firebaseCloudReady}
        projectMismatch={firebaseProjectMismatch}
      />
    </Suspense>
    </ErrorBoundary>
  </Shell>;
}

function DiscoverRoute() {
  return <Shell><ErrorBoundary><Suspense fallback={<RouteLoadingFallback />}><DiscoverPage /></Suspense></ErrorBoundary></Shell>;
}

function SignalCardsRoute() {
  const { user, loading } = useAuth();
  return <Shell><main className="page-wrap">
    <div className="eyebrow">YOUR PRIVATE COLLECTION</div>
    <h1>Signal Cards</h1>
    <p className="lead">Reopen, edit, and export saved readings on this browser without using more credits. Cards are not cloud-synced or encrypted; anyone with access to this browser profile may be able to read browser storage.</p>
    {loading ? <p role="status">Checking your account…</p>
      : <Suspense fallback={<p role="status">Opening your signal-card collection…</p>}>
        <SignalCardStudio key={user?.uid ?? 'signed-out'} userId={user?.uid ?? null} explanation={null} capture={null} />
      </Suspense>}
    {!loading && !user && <Link href="/history" className="btn btn-subtle">Sign in to open your collection</Link>}
    <Link href="/" className="detail-back" style={{ marginTop: 24 }}>Return to the listening lab</Link>
  </main></Shell>;
}

function PremiumRoute() {
  const { user, loading } = useAuth();
  return <Shell><main className="page-wrap">
    <Suspense fallback={<RouteLoadingFallback />}>
      <PremiumComparisonPage user={user} authLoading={loading} />
    </Suspense>
  </main></Shell>;
}

function OwnerRoute() {
  const { user, loading } = useAuth();
  return <Shell><Suspense fallback={<RouteLoadingFallback />}>
    <OwnerDashboard user={user} authLoading={loading} />
  </Suspense></Shell>;
}

function DevicesRoute() {
  return <Shell><Suspense fallback={<RouteLoadingFallback />}>
    <DeviceConnectionCenter />
  </Suspense></Shell>;
}

function RouteLoadingFallback() {
  return <main className="page-wrap">
    <div className="panel empty-state" role="status">
      <p>Loading this instrument…</p>
    </div>
  </main>;
}

function App() {
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));
  const [owner, setOwner] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        await firebaseAuth.authStateReady();
        const { completeProviderRedirect } = await import('@/lib/firebase-auth');
        const outcome = await completeProviderRedirect();
        if (!active || !outcome) return;
        if (outcome.isNewUser && outcome.method) reportSignupSuccess(outcome.method);
        if (outcome.hadPendingRedirect && outcome.user) {
          setAuthNotice('');
          setLocation('/dashboard');
        } else if (outcome.hadPendingRedirect) {
          setAuthNotice('Google or Apple returned to ZionCore without completing sign-in. Try again; if it repeats, check the Firebase error code shown after the next attempt.');
        }
      } catch (cause) {
        if (active) {
          const { getAuthErrorMessage } = await import('@/lib/firebase-auth');
          setAuthNotice(getAuthErrorMessage(cause));
        }
      }
    })();
    const unsubscribe = onAuthStateChanged(firebaseAuth, currentUser => {
      setUser(currentUser);
      setLoading(false);
      setOwner(false);
      if (currentUser) {
        void currentUser.getIdTokenResult(true)
          .then(token => {
            if (firebaseAuth?.currentUser?.uid === currentUser.uid) {
              setOwner(token.claims.zioncoreOwner === true);
            }
          })
          .catch(() => {
            if (firebaseAuth?.currentUser?.uid === currentUser.uid) setOwner(false);
          });
      }
      if (currentUser && firebaseCloudReady && !firebaseProjectMismatch) {
        void getFirebaseIdentityHeaders(currentUser)
          .then(headers => fetch('/api/wallet', {
            headers,
            cache: 'no-store',
          }))
          .then(response => {
            if (!response.ok) {
              console.error('ZionCore could not initialize the signed-in wallet.');
            }
          })
          .catch(() => {
            console.error('ZionCore could not initialize the signed-in wallet.');
          });
      }
    }, () => {
      setUser(null);
      setOwner(false);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading, owner, authNotice, clearAuthNotice: () => setAuthNotice('') }}>
    <SeoRouteMetadata />
    <PwaInstallPrompt />
    <NavigationEffects />
    <ConstellationProvider>
    <Switch><Route path="/" component={LabPage} /><Route path="/discover" component={DiscoverRoute} /><Route path="/cards" component={SignalCardsRoute} /><Route path="/history" component={HistoryPage} /><Route path="/history/:id" component={DetailPage} /><Route path="/messages" component={MessagesRoute} /><Route path="/devices" component={DevicesRoute} /><Route path="/premium" component={PremiumRoute} /><Route path="/admin" component={OwnerRoute} /><Route path="/owner" component={OwnerRoute} /><Route path="/dashboard" component={WalletRoute} /><Route path="/wallet" component={WalletRoute} /><Route component={NotFound} /></Switch>
    </ConstellationProvider>
  </AuthContext.Provider>;
}

export default App;
