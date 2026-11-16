import { createContext, useContext, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, Download,
  FileDown, History, Info, Mic, Radio, Save, ShieldCheck, Square, Trash2,
  Waves, X,
} from 'lucide-react';
import AccountAccess from '@/components/account-access';
import AnalysisPanel from '@/components/analysis-panel';
import LocalSignalStudio from '@/components/local-signal-studio';
import WaveformChart from '@/components/waveform-chart';
import AccessGuidePage from '@/pages/access-guide';
import VoiceV2Page from '@/pages/voice-v2';
import { analyzeMeasurement, type Explanation } from '@/lib/ai-analysis';
import {
  ANONYMOUS_RESEARCH_SCOPE,
  readResearchSessions,
  type ResearchSession,
} from '@/lib/celestial-experiment';
import {
  deleteCloudObservations,
  getCloudHistoryErrorMessage,
  getCloudObservation,
  listCloudObservations,
  saveCloudObservation,
} from '@/lib/cloud-observations';
import {
  authenticateWithEmail,
  getAuthErrorMessage,
  getAuthRedirectResult,
  refreshCurrentUser,
  sendVerificationEmail,
  sendPasswordReset,
  signInOrLinkWithGoogle,
  signOutCurrentUser,
} from '@/lib/firebase-auth';
import {
  firebaseAuth,
  firebaseAuthConfigured,
  firebaseAiReady,
  firebaseCloudReady,
  firebaseProjectMismatch,
  getFirebaseAiSetupMessage,
  getFirebaseSetupMessage,
} from '@/lib/firebase';
import {
  deleteObservationsFromStorage, downloadFile, formatFrequency, readObservations,
  readObservationsForExport, readVerifiedObservations, toCsv, upsertObservation, writeObservations,
  type Observation,
} from '@/lib/observations';
import { createInstrumentProvenance } from '@/lib/instrument-provenance';
import useLabEngine from '@/hooks/use-lab-engine';
import { createAccountExport } from '@/lib/account-export';
import { analyzeWavFile } from '@/lib/audio-file-analysis';
import CelestialExplorationPage from '@/pages/celestial-exploration';
import CustomerDashboard from '@/pages/customer-dashboard';
import BioacousticLibraryPage from '@/pages/bioacoustic-library';
import AstronomicalDataPage from '@/pages/astronomical-data';
import DevotionalWorkspacePage from '@/pages/devotional-workspace';
import ResearchMissionsPage from '@/pages/research-missions';
import { MISSION_ANONYMOUS_SCOPE } from '@/lib/research-missions';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authError: string;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: false, authError: '' });

function useAuth() {
  return useContext(AuthContext);
}

function Spectrum({ bins, fftSize, sampleRate }: { bins: number[] | null; fftSize: number; sampleRate: number | null }) {
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
  const displayBinCount = Math.floor((fftSize / 2) * 0.42);
  const maxFrequencyHz = sampleRate == null ? null : displayBinCount * sampleRate / fftSize;
  return <canvas
    className="chart-canvas"
    ref={canvasRef}
    aria-label={`Frequency spectrum from 0 to ${maxFrequencyHz == null ? 'the measured maximum' : `${Math.round(maxFrequencyHz)} Hz`}; relative magnitude display scale 0 to 255; ${fftSize} point FFT`}
    data-testid="visual-spectrum"
  />;
}

function Shell({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'voice' }) {
  const [location] = useLocation();
  const { user } = useAuth();
  return <div className={`lab-shell ${variant === 'voice' ? 'voice-shell' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link href="/" className="brand-lockup" data-testid="link-home"><span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span><span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span></Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} aria-current={location === '/' ? 'page' : undefined} data-testid="link-live-lab">Live lab</Link>
        <Link href="/dashboard" className={`nav-link ${location === '/dashboard' ? 'active' : ''}`} aria-current={location === '/dashboard' ? 'page' : undefined} data-testid="link-dashboard">Dashboard</Link>
        <Link href="/history" className={`nav-link ${location.startsWith('/history') ? 'active' : ''}`} aria-current={location.startsWith('/history') ? 'page' : undefined} data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
        <Link href="/exploration" className={`nav-link ${location === '/exploration' ? 'active' : ''}`} aria-current={location === '/exploration' ? 'page' : undefined} data-testid="link-exploration">Exploration</Link>
        <Link href="/missions" className={`nav-link ${location === '/missions' ? 'active' : ''}`} aria-current={location === '/missions' ? 'page' : undefined} data-testid="link-missions">Missions</Link>
        <Link href="/astronomy" className={`nav-link ${location === '/astronomy' ? 'active' : ''}`} aria-current={location === '/astronomy' ? 'page' : undefined} data-testid="link-astronomy">Astronomy</Link>
        {user && <Link href="/devotional" className={`nav-link ${location === '/devotional' ? 'active' : ''}`} aria-current={location === '/devotional' ? 'page' : undefined} data-testid="link-devotional">Devotional</Link>}
        <Link href="/bioacoustics" className={`nav-link ${location === '/bioacoustics' ? 'active' : ''}`} aria-current={location === '/bioacoustics' ? 'page' : undefined} data-testid="link-bioacoustics">Bioacoustics</Link>
        <Link href="/voice-v2" className={`nav-link ${location === '/voice-v2' ? 'active' : ''}`} aria-current={location === '/voice-v2' ? 'page' : undefined} data-testid="link-voice-v2">Voice V2</Link>
        <Link href="/access" className={`nav-link ${location === '/access' ? 'active' : ''}`} aria-current={location === '/access' ? 'page' : undefined} data-testid="link-access">Access</Link>
        {user?.email && <span className="nav-account" data-testid="text-current-account">{user.email}</span>}
      </nav>
    </header>
    {children}
  </div>;
}

function VoiceV2Route() {
  return <Shell variant="voice"><VoiceV2Page /></Shell>;
}

function AccountSection({ required = false }: { required?: boolean } = {}) {
  const { user, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.emailVerified));

  useEffect(() => {
    setError('');
    setEmailVerified(Boolean(user?.emailVerified));
  }, [user?.uid]);

  useEffect(() => {
    let active = true;
    void getAuthRedirectResult()
      .then(result => {
        if (!active || !result) return;
        setAuthStatus(result.operationType === 'link'
          ? 'Google sign-in is now connected to this account.'
          : 'Signed in with Google.');
      })
      .catch(cause => {
        if (active) setError(getAuthErrorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  const authenticate = async (mode: 'sign-in' | 'create', email: string, password: string) => {
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      const authenticatedUser = await authenticateWithEmail(mode, email, password);
      setEmailVerified(Boolean(authenticatedUser.emailVerified));
      if (mode === 'create') {
        try {
          await sendVerificationEmail(authenticatedUser);
          setAuthStatus('Account created. Check your inbox for a verification link.');
        } catch (cause) {
          setAuthStatus(`Account created, but the verification email could not be sent: ${getAuthErrorMessage(cause)} You can retry below.`);
        }
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      await signOutCurrentUser();
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const googleAuth = async () => {
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      await signInOrLinkWithGoogle();
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!email) {
      setError('Enter your account email address first.');
      return;
    }
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      await sendPasswordReset(email);
      setAuthStatus('If an account uses that email, a password reset link will arrive by email.');
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : '';
      if (code.includes('user-not-found')) {
        setAuthStatus('If an account uses that email, a password reset link will arrive by email.');
      } else {
        setError(getAuthErrorMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      await sendVerificationEmail(user);
      setAuthStatus('Verification email sent. Check your inbox and follow its link.');
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const checkVerification = async () => {
    setBusy(true);
    setError('');
    setAuthStatus('');
    try {
      const refreshedUser = await refreshCurrentUser();
      if (!refreshedUser) throw new Error('Sign in again to check your email verification status.');
      setEmailVerified(Boolean(refreshedUser.emailVerified));
      setAuthStatus(refreshedUser.emailVerified
        ? 'Your email address is verified.'
        : 'Firebase has not recorded verification yet. Open the latest email link, then check again.');
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const readinessMessage = firebaseAuthConfigured && !firebaseCloudReady
    ? getFirebaseSetupMessage()
    : '';

  return <AccountAccess
    heading={required ? 'Research archive sign-in' : undefined}
    footnote={required
      ? 'Sign-in is required. Research records stay in this browser and are not uploaded to Firebase.'
      : undefined}
    configured={firebaseAuthConfigured}
    projectMismatch={firebaseProjectMismatch}
    userEmail={user?.email ?? null}
    emailVerified={emailVerified}
    googleConnected={Boolean(user?.providerData.some(item => item.providerId === 'google.com'))}
    busy={busy}
    error={error || authError}
    statusMessage={authStatus || readinessMessage}
    onAuth={authenticate}
    onGoogleAuth={googleAuth}
    onSendVerification={resendVerification}
    onCheckVerification={checkVerification}
    onPasswordReset={resetPassword}
    onSignOut={signOut}
  />;
}

function LabPage() {
  const { user, loading: authLoading } = useAuth();
  const [fftSize, setFftSize] = useState(4096);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [draftCreatedAt, setDraftCreatedAt] = useState(() => new Date().toISOString());
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [analysis, setAnalysis] = useState<Explanation | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [fileImporting, setFileImporting] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSummary, setFileSummary] = useState('');
  const fileImportRequestRef = useRef(0);
  useEffect(() => () => { fileImportRequestRef.current += 1; }, []);
  const engine = useLabEngine(fftSize);
  const hasReading = Boolean(engine.reading);
  useEffect(() => {
    if (authLoading) return;
    setObservations(readObservations(user?.uid));
    setSaved(false);
  }, [authLoading, user?.uid]);
  const createObservation = (): Observation | null => {
    if (!engine.reading) return null;
    return {
      id: draftId, createdAt: draftCreatedAt,
      sampleRate: engine.reading.sampleRate, fftSize: engine.reading.fftSize,
      frequencyResolutionHz: engine.reading.resolution, dominantFrequencyHz: engine.reading.dominant,
      topPeaksHz: engine.reading.peaks, rmsLevel: engine.reading.rms,
      durationSeconds: engine.elapsed, mode: engine.reading.source === 'audio-file' ? 'audio-file' : 'microphone',
      instrumentProvenance: createInstrumentProvenance(
        engine.reading.source === 'audio-file' ? 'local-wav-file' : 'browser-microphone',
        engine.instrumentDiscovery?.instrument,
      ),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(analysis ? { interpretation: analysis } : {}),
    };
  };
  const save = () => {
    const item = createObservation();
    if (!item) return;
    const next = upsertObservation(observations, item);
    try {
      writeObservations(next, user?.uid); setObservations(next); setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch { setSaved(false); window.alert('Could not save to this browser. Check available local storage and try again.'); }
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
  const requestAnalysis = async (includeFaithReflection: boolean) => {
    if (!engine.reading || engine.running || engine.starting) return;
    if (!user) {
      setAnalysis(null);
      setAnalysisError('Sign in before requesting cloud AI. Local capture and measurement remain free.');
      return;
    }
    if (!firebaseAiReady) {
      setAnalysis(null);
      setAnalysisError(getFirebaseAiSetupMessage() || 'Cloud AI is not ready for this environment. Your local measurement remains available.');
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const result = await analyzeMeasurement({
        sampleRate: engine.reading.sampleRate,
        fftSize: engine.reading.fftSize,
        frequencyResolutionHz: engine.reading.resolution,
        dominantFrequencyHz: engine.reading.dominant,
        topPeaksHz: engine.reading.peaks,
        rmsLevel: engine.reading.rms,
        durationSeconds: engine.elapsed,
      }, includeFaithReflection, draftId);
      setAnalysis(result);
    } catch (cause) {
      setAnalysis(null);
      setAnalysisError(cause instanceof Error ? cause.message : 'The AI service could not explain this measurement.');
    } finally {
      setAnalysisLoading(false);
    }
  };
  const startCapture = async () => {
    setFileName('');
    setFileSummary('');
    setFileError('');
    setDraftId(crypto.randomUUID());
    setDraftCreatedAt(new Date().toISOString());
    setAnalysis(null);
    setAnalysisError('');
    setSaved(false);
    setCloudSaved(false);
    setCloudError('');
    await engine.start();
  };
  const importAudioFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setFileError('');
    if (engine.running || engine.starting || analysisLoading || cloudSaving) {
      setFileError('Wait for the current capture or analysis to finish before importing a file.');
      return;
    }
    const requestId = ++fileImportRequestRef.current;
    const isCurrent = () => requestId === fileImportRequestRef.current;
    setFileImporting(true);
    try {
      const result = await analyzeWavFile(file, fftSize, isCurrent);
      if (!isCurrent()) return;
      if (!engine.loadReading(result.reading, result.durationSeconds)) {
        throw new Error('The capture changed during import. The previous measurement was kept.');
      }
      setFileName(result.sourceName);
      setFileSummary(
        `${(result.sourceSampleRateHz / 1000).toFixed(1)} kHz · ${result.sourceChannels === 1 ? 'mono' : 'stereo downmixed to mono'} · ${result.analyzedWindows} bounded analysis windows`,
      );
      setDraftId(crypto.randomUUID());
      setDraftCreatedAt(new Date().toISOString());
      setAnalysis(null);
      setAnalysisError('');
      setSaved(false);
      setCloudSaved(false);
      setCloudError('');
    } catch (cause) {
      if (isCurrent()) {
        setFileError(`${cause instanceof Error ? cause.message : 'The selected WAV could not be analyzed locally.'} The current measurement was not changed.`);
      }
    } finally {
      if (isCurrent()) setFileImporting(false);
    }
  };
  const rmsFullScale = engine.reading ? engine.reading.rms.toFixed(4) : null;
  const calibration = engine.instrumentDiscovery?.instrument.calibration;
  const calibrationLimits = engine.reading?.source === 'audio-file'
    ? 'The WAV file’s calibration metadata is not interpreted or applied. Its declared sample rate is used for the frequency axis.'
    : calibration
      ? `Instrument calibration status: ${calibration.status}. ${calibration.reference} No sound-pressure conversion is applied.`
      : 'Microphone sound-pressure calibration is unavailable; this display cannot report dB SPL.';
  return <Shell>
    <main id="main-content" className="page-wrap" tabIndex={-1}>
      <div className="eyebrow">Observation instrument / 01</div>
      <h1 className="page-title">Listen closely.<br />Measure honestly.</h1>
      <p className="lead">A quiet place to observe sound through your microphone or a selected WAV file. Free measurement stays in this tab; audio is processed locally and is not uploaded.</p>
      <div className="live-grid">
        <section className="panel" aria-label="Live spectrum">
          <div className="panel-head"><span className="panel-title">Frequency spectrum</span><span className="live-badge" data-testid="status-capture"><i className={`live-dot ${engine.running ? 'on' : ''}`} />{engine.running ? 'Live capture' : 'Standby'}</span></div>
          <div className="chart-wrap">
            <Spectrum bins={engine.reading?.bins ?? null} fftSize={fftSize} sampleRate={engine.reading?.sampleRate ?? null} />
            <div className="chart-legend"><span>0 Hz</span><span>Relative magnitude · 0–255</span><span>{engine.reading ? `${(Math.floor((engine.reading.fftSize / 2) * 0.42) * engine.reading.resolution / 1000).toFixed(2)} kHz max` : 'Max plotted frequency'}</span></div>
            {engine.reading && <p className="small-note" data-testid="text-spectrum-resolution">Bin spacing {engine.reading.resolution.toFixed(2)} Hz; spectrum display ends below Nyquist.</p>}
          </div>
          <div className="metrics">
            <div className="metric"><div className="metric-label">Dominant peak</div><div className="metric-value" data-testid="value-dominant">{engine.reading ? formatFrequency(engine.reading.dominant) : '—'}</div></div>
            <div className="metric"><div className="metric-label">RMS amplitude</div><div className="metric-value" data-testid="value-rms">{rmsFullScale ?? '—'}<span className="metric-unit">{rmsFullScale == null ? '' : 'FS'}</span></div></div>
            <div className="metric"><div className="metric-label">{engine.reading?.source === 'audio-file' ? 'File duration' : 'Elapsed'}</div><div className="metric-value" data-testid="value-duration">{hasReading ? engine.elapsed.toFixed(1) : '—'}<span className="metric-unit">{hasReading ? 'sec' : ''}</span></div></div>
          </div>
          <div className="waveform-block">
            <div className="waveform-heading">Time-domain waveform</div>
            <WaveformChart ranges={engine.reading?.waveform ?? null} durationSeconds={engine.reading?.waveformWindowSeconds ?? 0} />
            <div className="chart-legend"><span>0 ms</span><span>Normalized amplitude · FS</span><span>{engine.reading ? `${(engine.reading.waveformWindowSeconds * 1000).toFixed(1)} ms` : 'One FFT window'}</span></div>
            <p className="small-note" data-testid="text-waveform-window">{engine.reading?.source === 'audio-file' ? 'Min–max envelope from one representative WAV window.' : 'Min–max envelope from the current microphone window.'} The waveform is a time view; it is not the frequency spectrum.</p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Capture settings</span><AudioLines size={17} color="#758681" /></div>
          <div className="controls">
            <div className={`status-box ${engine.error ? 'alert-box' : ''}`} role={engine.error ? 'alert' : 'status'} data-testid="status-message">{engine.error || engine.status}</div>
            <div className="control-row"><label className="label-row" htmlFor="fft-size"><span>FFT size</span><span className="small-note">frequency detail</span></label><select id="fft-size" className="select-control" value={fftSize} disabled={engine.running || engine.starting || fileImporting} onChange={event => setFftSize(Number(event.target.value))} data-testid="select-fft-size"><option value={2048}>2,048 points</option><option value={4096}>4,096 points</option><option value={8192}>8,192 points</option></select></div>
            {engine.running || engine.starting ? <button className="btn btn-stop" onClick={() => void engine.stop()} data-testid="button-stop"><Square size={15} fill="currentColor" />{engine.starting ? 'Cancel / stop' : 'Stop capture'}</button> : <button className="btn btn-primary" onClick={() => void startCapture()} disabled={analysisLoading || cloudSaving || fileImporting} data-testid="button-start"><Mic size={16} />Start microphone</button>}
            <p className="permission-note">Starting requests microphone permission. Capture and imported WAV analysis stay in this tab; source audio is never uploaded or stored.</p>
            <div className="control-row">
              <label className="label-row" htmlFor="audio-file-input"><span>Analyze a local WAV file</span><span className="small-note">PCM / float, mono / stereo</span></label>
              <input id="audio-file-input" className="select-control" type="file" accept=".wav,audio/wav,audio/x-wav" disabled={engine.running || engine.starting || fileImporting || analysisLoading || cloudSaving} onChange={event => void importAudioFile(event)} data-testid="input-audio-file" />
              <span className="small-note">Maximum 24 MiB and 60 seconds; 8–96 kHz; mono or stereo. Selected audio is not saved.</span>
              {fileImporting && <p role="status" data-testid="status-file-importing">Analyzing locally…</p>}
              {fileError && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-file-import-error">{fileError}</p>}
              {fileName && <p className="permission-note" role="status" data-testid="status-file-imported"><strong>{fileName}</strong><br />{fileSummary}. Audio bytes remain in memory only.</p>}
            </div>
          </div>
        </section>
      </div>
      {engine.error && <div className="section-grid"><div className="panel"><div className="section-body"><div className="eyebrow">Troubleshooting</div><p className="empty-inline">Make sure this page is served over HTTPS or localhost, choose an available input device in your browser, and allow microphone access. If another app has exclusive access, close it and retry.</p></div></div></div>}
      <div className="section-grid">
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Measurement details</span><Activity size={16} color="#758681" /></div>
          <div className="section-body">
            <div className="label-row"><span>Sample rate</span><span className="mono" data-testid="value-sample-rate">{engine.reading ? `${(engine.reading.sampleRate / 1000).toFixed(1)} kHz` : '—'}</span></div>
            <div className="label-row"><span>Resolution</span><span className="mono" data-testid="value-resolution">{engine.reading ? `${engine.reading.resolution.toFixed(2)} Hz / bin` : '—'}</span></div>
            <div className="label-row"><span>FFT window</span><span className="mono">{fftSize.toLocaleString()}</span></div>
            {engine.reading && <div className="label-row"><span>Signal source</span><span className="mono" data-testid="value-reading-source">{engine.reading.source === 'audio-file' ? 'Imported WAV' : 'Microphone'}</span></div>}
            {engine.reading && <div className="label-row"><span>RMS amplitude</span><span className="mono" data-testid="value-rms-full-scale">{engine.reading.rms.toFixed(4)} FS</span></div>}
            <div style={{ borderTop: '1px solid #e4dfd4', margin: '14px 0' }} />
            <div className="label-row"><span>Spectral peaks</span><span className="small-note">local maxima</span></div>
            {engine.reading?.peaks.length ? <div className="peak-list">{engine.reading.peaks.map((peak, index) => <span className="peak-chip" key={`${peak}-${index}`} data-testid={`peak-${index}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">{engine.silent ? 'No clear spectral peaks: this input is at or near silence.' : engine.reading?.source === 'audio-file' ? 'No clear peaks were detected across the sampled WAV windows.' : 'Start the microphone or import a WAV to inspect spectral peaks.'}</p>}
            {engine.silent && (engine.running || engine.reading?.source === 'audio-file') && <p className="empty-inline" role="status" data-testid="status-silence">Very low signal level detected. The source or cause is not identified.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Save an observation</span><Save size={16} color="#758681" /></div>
          <div className="section-body">
            <label className="label-row" htmlFor="observation-notes"><span>Notes <span className="small-note">(optional)</span></span><span className="small-note">not sent to AI</span></label>
            <textarea id="observation-notes" className="text-control" maxLength={4000} placeholder="Describe the room, source, or context…" value={notes} onChange={event => setNotes(event.target.value)} data-testid="input-notes" />
            {analysis && <p className="permission-note" role="status" data-testid="status-analysis-save-guidance">Saving now attaches this interpretation to the same stopped measurement. The measured values remain unchanged.</p>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!hasReading || authLoading || fileImporting} onClick={save} data-testid="button-save-observation">{saved ? <Check size={15} /> : <Save size={15} />}{saved ? analysis ? user ? 'Saved on this device with interpretation' : 'Saved with interpretation' : user ? 'Saved on this device for this account' : 'Saved to this browser' : analysis ? 'Save interpreted observation' : 'Save observation'}</button>
            <button className="btn btn-subtle zc-cloud-save" style={{ marginTop: 10, width: '100%' }} disabled={!hasReading || !user || !firebaseCloudReady || cloudSaving || fileImporting} onClick={() => void saveToCloud()} data-testid="button-save-cloud-observation">
              <Save size={14} />{cloudSaving ? 'Saving to account cloud…' : cloudSaved ? analysis ? 'Cloud interpretation updated' : 'Saved to your account cloud history' : analysis ? 'Save interpreted observation to cloud' : 'Save to account cloud'}
            </button>
            {cloudError && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-cloud-save-error">{cloudError}</p>}
            {!user && <p className="permission-note">To save across devices, sign in from the History page. Local saving remains available.</p>}
            {user && !firebaseCloudReady && <p className="permission-note" role="status">Cloud saves are paused until Firestore rules and App Check are reviewed and verified.</p>}
          </div>
        </section>
      </div>
      <div className="section-grid dsp-section">
        <LocalSignalStudio />
      </div>
      <div className="section-grid">
        <AnalysisPanel
          hasMeasurement={hasReading}
          captureActive={engine.running || engine.starting || fileImporting}
          canAnalyze={Boolean(user && firebaseAiReady)}
          requiresAccount={!user}
          unavailableMessage={getFirebaseAiSetupMessage()}
          loading={analysisLoading}
          error={analysisError}
          explanation={analysis}
          onAnalyze={requestAnalysis}
        />
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Analysis privacy</span><ShieldCheck size={16} color="#758681" /></div>
          <div className="section-body"><p className="empty-inline" style={{ marginTop: 0 }}>Cloud AI requires sign-in and runs only after you request it. Only the selected measurement values are sent: sampling rate, FFT size, resolution, dominant frequency, peaks, relative RMS, and duration. Audio, spectrum bins, and your notes are not sent.</p><p className="empty-inline">The current explanation model is {`gemini-3.5-flash-lite`}. AI requests require App Check and available project quota. If the project quota is exhausted, the app reports the issue and keeps your local measurements unchanged.</p></div>
        </section>
      </div>
      <div className="section-grid">
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Measurement units &amp; calibration limits</span><Info size={16} color="#758681" /></div>
          <div className="section-body">
            <p className="empty-inline" style={{ marginTop: 0 }}>The waveform shows time (ms) against normalized digital amplitude (FS), as a min–max envelope for one FFT window. The spectrum is a separate frequency view (Hz) with relative display magnitudes from 0–255; its plotted range ends below Nyquist. Bin spacing is sample rate divided by FFT size. A peak is a measured bin, not an explanation of its source.</p>
            <p className="empty-inline" data-testid="text-calibration-limits">{calibrationLimits} Neither view is calibrated sound pressure (dB SPL); microphone sensitivity, gain, room response, and file calibration are not corrected.</p>
            <p className="empty-inline">A microphone cannot receive radio-frequency (RF) signals. This version cannot detect divine or supernatural communication, and it does not decode messages. Spiritual meaning is a matter of faith, not a sensor result.</p>
          </div>
        </section>
        <section className="panel faith-card">
          <div className="panel-head"><span className="panel-title">Faith reflection</span><BookOpen size={16} color="#758681" /></div>
          <div className="section-body">{!reflection ? <><p className="empty-inline" style={{ marginTop: 0, marginBottom: 16 }}>An optional scripture passage for personal reflection, kept separate from the measurements.</p><button className="btn btn-subtle" onClick={() => setReflection(true)} data-testid="button-open-reflection"><BookOpen size={14} />Open reflection</button></> : <><blockquote>“Be still, and know that I am God.”</blockquote><p>Psalm 46:10 · A passage for reflection, not a scientific interpretation or measurement.</p><button className="btn btn-subtle" style={{ marginTop: 14 }} onClick={() => setReflection(false)} data-testid="button-close-reflection"><X size={14} />Close reflection</button></>}</div>
        </section>
      </div>
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Microphone and selected WAV audio are processed in browser memory and are never uploaded. Saved measurements stay on this device unless you explicitly save one to account cloud history after its access controls are verified.</p>
    </main>
  </Shell>;
}

function HistoryPage({ deviceOnly = false }: { deviceOnly?: boolean } = {}) {
  const { user, loading: authLoading } = useAuth();
  const scope = authLoading
    ? 'loading'
    : user && firebaseCloudReady && !deviceOnly
      ? `cloud:${user.uid}`
      : user
        ? `device:${user.uid}`
        : 'browser';
  const [items, setItems] = useState<Observation[]>([]);
  const [itemsScope, setItemsScope] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearTarget, setClearTarget] = useState<{ scope: string; ids: string[] } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const clearDialogRef = useRef<HTMLElement | null>(null);
  const keepHistoryRef = useRef<HTMLButtonElement | null>(null);
  const isCloudHistory = scope.startsWith('cloud:');
  const confirmClear = clearTarget !== null;

  useEffect(() => {
    if (clearTarget && clearTarget.scope !== scope) {
      setClearTarget(null);
      setClearError('The account or archive changed. Nothing was deleted; review the current archive before trying again.');
    }
  }, [clearTarget?.scope, scope]);

  useEffect(() => {
    if (!confirmClear) return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    keepHistoryRef.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!clearing) setClearTarget(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = clearDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      if (returnFocus && !('disabled' in returnFocus && returnFocus.disabled)) returnFocus.focus();
      else document.getElementById('main-content')?.focus();
    };
  }, [confirmClear, clearing]);

  useEffect(() => {
    if (scope === 'loading') return;
    let active = true;
    setItems([]);
    setItemsScope('loading');
    setLoading(true);
    setHistoryError('');
    if (!isCloudHistory) {
      setItems(readObservations(user?.uid));
      setItemsScope(scope);
      setLoading(false);
      return () => { active = false; };
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
  }, [scope, user?.uid, isCloudHistory, historyRetry]);

  const visibleItems = itemsScope === scope ? items : [];
  const exportJson = () => downloadFile('zioncore-observations.json', JSON.stringify(visibleItems, null, 2), 'application/json');
  const exportCsv = () => downloadFile('zioncore-observations.csv', toCsv(visibleItems), 'text/csv;charset=utf-8');
  const requestClear = () => {
    if (!visibleItems.length || itemsScope !== scope || loading) return;
    setClearError('');
    setClearTarget({ scope, ids: visibleItems.map(item => item.id) });
  };
  const clear = async () => {
    if (!clearTarget || clearing) return;
    if (clearTarget.scope !== scope || itemsScope !== scope || loading) {
      setClearTarget(null);
      setClearError('The account or archive changed. Nothing was deleted; review the current archive before trying again.');
      return;
    }
    setClearError('');
    setClearing(true);
    try {
      if (isCloudHistory) {
        await deleteCloudObservations(clearTarget.ids);
      } else {
        deleteObservationsFromStorage(clearTarget.ids, user?.uid);
      }
      const deletedIds = new Set(clearTarget.ids);
      setItems(current => current.filter(item => !deletedIds.has(item.id)));
      setClearTarget(null);
    } catch (cause) {
      setClearError(isCloudHistory
        ? getCloudHistoryErrorMessage(cause)
        : cause instanceof Error
          ? cause.message
          : 'Could not clear local history. Check browser storage permissions and retry.');
    } finally {
      setClearing(false);
    }
  };
  return <Shell>
    <main id="main-content" className="page-wrap" tabIndex={-1}>
      <div className="eyebrow">{isCloudHistory ? 'Account cloud / archive' : user ? 'Account device / archive' : 'Your browser / archive'}</div>
      <h1 className="page-title">Observation<br />history.</h1>
      <p className="lead">{isCloudHistory
        ? 'Only observations you explicitly saved to your account appear here. This account-linked archive follows your sign-in across devices.'
        : user
          ? 'These records are saved on this device under your signed-in account. They are not uploaded, encrypted, or synced. The older signed-out browser archive remains separate.'
          : 'Only measurements you explicitly saved appear here. This archive lives in local browser storage on this device.'}</p>
      <div style={{ marginTop: 24 }}><AccountSection /></div>
      {user && isCloudHistory && <p className="permission-note" data-testid="status-device-history-separate">Device-only records are separate from cloud history. <Link href="/history/device" data-testid="link-device-history">View this account’s device archive</Link></p>}
      {user && !isCloudHistory && !deviceOnly && <p className="permission-note" role="status" data-testid="status-device-history-fallback">Cloud history is paused pending rules and App Check verification; showing this account’s unsynced device records.</p>}
      {user && deviceOnly && firebaseCloudReady && <p className="permission-note" data-testid="status-cloud-history-separate">Account cloud history is separate. <Link href="/history" data-testid="link-cloud-history">View cloud archive</Link></p>}
      {historyError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-history-error">{historyError}</div>}
      {clearError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-history-clear-error">{clearError}</div>}
      <div className="history-toolbar" style={{ marginTop: 25 }}>
        <button className="btn btn-subtle" onClick={exportJson} disabled={!visibleItems.length} data-testid="button-export-json"><Download size={14} />Export JSON</button>
        <button className="btn btn-subtle" onClick={exportCsv} disabled={!visibleItems.length} data-testid="button-export-csv"><FileDown size={14} />Export CSV</button>
        <button className="btn btn-danger" onClick={requestClear} disabled={isCloudHistory || !visibleItems.length || itemsScope !== scope || loading} data-testid="button-clear-history"><Trash2 size={14} />Clear history</button>
      </div>
      {isCloudHistory && <p className="permission-note" role="status" data-testid="status-cloud-delete-gated">Cloud deletion is paused until an authenticated server endpoint can record the deletion audit. You can still export these records.</p>}
      {loading ? <div className="panel empty-state" role="status" data-testid="status-history-loading"><p>Loading your saved observations…</p></div>
        : historyError ? <div className="panel empty-state" role="status" data-testid="status-history-unavailable"><span className="empty-glyph"><Info size={22} /></span><h2>History could not be loaded.</h2><p>Check the Firebase connection and retry. No local history was substituted for the cloud archive.</p><button className="btn btn-subtle" onClick={() => setHistoryRetry(value => value + 1)} data-testid="button-retry-history">Retry cloud history</button></div>
        : visibleItems.length ? <div className="history-list">{visibleItems.map(item => <Link key={item.id} href={deviceOnly && user ? `/history/device/${item.id}` : `/history/${item.id}`} className="panel history-item" data-testid={`link-observation-${item.id}`}>
        <span><span className="history-date">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="history-freq">{formatFrequency(item.dominantFrequencyHz)}</span><span className="history-meta">{item.fftSize.toLocaleString()} FFT · {(item.sampleRate / 1000).toFixed(1)} kHz sample rate · {item.durationSeconds.toFixed(1)} sec</span></span><ArrowRight className="history-arrow" size={17} />
      </Link>)}</div> : <div className="panel empty-state" style={{ marginTop: 30 }}>
        <span className="empty-glyph"><History size={23} /></span><h2>Your record begins with an observation.</h2><p>{isCloudHistory ? 'No cloud observations are saved to this account yet. Local browser records remain separate.' : 'Start a microphone measurement in the live lab, then choose “Save observation.” Nothing is added automatically.'}</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-empty-start"><Mic size={14} />Go to live lab</Link>
      </div>}
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Exports contain measurement metadata and your notes, never microphone audio.</p>
      <details className="permission-note" style={{ marginTop: 18 }} data-testid="details-history-retention">
        <summary>Storage, retention, and deletion</summary>
        <p>Browser records have no automatic expiry; they remain until you delete them or clear this browser’s storage. Cloud history is paused until Firestore rules and App Check are verified. This workspace does not yet provide a durable server-side deletion audit.</p>
      </details>
    </main>
    {confirmClear && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (!clearing && event.target === event.currentTarget) setClearTarget(null); }}>
        <section ref={clearDialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description" data-testid="dialog-clear-history"><h2 id="clear-title">Clear saved observations?</h2><p id="clear-description">This permanently removes {clearTarget.ids.length} {clearTarget.ids.length === 1 ? 'observation' : 'observations'} from {clearTarget.scope.startsWith('cloud:') ? 'your account cloud archive' : clearTarget.scope.startsWith('device:') ? 'this account’s device archive' : 'this browser'}. Only the records selected when this confirmation opened will be removed. Export first if you want to keep a copy.</p><div className="modal-actions"><button ref={keepHistoryRef} className="btn btn-subtle" onClick={() => setClearTarget(null)} disabled={clearing} data-testid="button-cancel-clear">Keep history</button><button className="btn btn-danger" onClick={() => void clear()} disabled={clearing || clearTarget.scope !== scope || itemsScope !== scope || loading} data-testid="button-confirm-clear"><Trash2 size={14} />{clearing ? 'Clearing…' : 'Clear permanently'}</button></div></section>
    </div>}
  </Shell>;
}

function DetailPage({ deviceOnly = false }: { deviceOnly?: boolean } = {}) {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const scope = authLoading
    ? 'loading'
    : user && firebaseCloudReady && !deviceOnly
      ? `cloud:${user.uid}`
      : user
        ? `device:${user.uid}`
        : 'browser';
  const isCloudHistory = scope.startsWith('cloud:');
  const historyHref = deviceOnly && user ? '/history/device' : '/history';
  const [item, setItem] = useState<Observation | undefined>();
  const [loadedScope, setLoadedScope] = useState('');
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);

  useEffect(() => {
    if (scope === 'loading') return;
    let active = true;
    setItem(undefined);
    setLoadedScope('');
    setDetailError('');
    setDeleteError('');
    setDetailLoading(true);
    if (!isCloudHistory) {
      setItem(readObservations(user?.uid).find(entry => entry.id === params.id));
      setLoadedScope(scope);
      setDetailLoading(false);
      return () => { active = false; };
    }
    void getCloudObservation(params.id).then(result => {
      if (active) {
        setItem(result);
        setLoadedScope(scope);
      }
    }).catch(cause => {
      if (active) setDetailError(getCloudHistoryErrorMessage(cause));
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [scope, params.id, user?.uid, isCloudHistory, detailRetry]);

  const deleteObservation = async () => {
    if (!item || deleting) return;
    const archiveName = isCloudHistory
      ? 'your account cloud history'
      : user
        ? 'this account’s device archive'
        : 'this browser';
    if (!window.confirm(`Delete this observation permanently from ${archiveName}? Export a copy first if you need it.`)) return;
    setDeleting(true);
    setDeleteError('');
    try {
      if (isCloudHistory) {
        await deleteCloudObservations([item.id]);
      } else {
        deleteObservationsFromStorage([item.id], user?.uid);
      }
      setDeleting(false);
      setLocation(historyHref);
    } catch (cause) {
      setDeleteError(isCloudHistory
        ? getCloudHistoryErrorMessage(cause)
        : 'Could not delete this browser observation. Check browser storage and retry.');
      setDeleting(false);
    }
  };

  if (detailLoading || loadedScope !== scope) return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><div className="panel empty-state" role="status" data-testid="status-detail-loading"><p>Loading this observation…</p></div></main></Shell>;
  if (detailError) return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="status-box alert-box" role="alert" data-testid="status-detail-error">{detailError}</div><button className="btn btn-subtle" onClick={() => setDetailRetry(value => value + 1)} data-testid="button-retry-observation">Retry loading observation</button></main></Shell>;
  if (!item) return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="panel empty-state"><span className="empty-glyph"><Info size={22} /></span><h2>Observation not found</h2><p>It may have been cleared from this browser or the link may be incomplete.</p><Link href={historyHref} className="btn btn-subtle" data-testid="link-return-history">Return to history</Link></div></main></Shell>;
  return <Shell>
    <main id="main-content" className="page-wrap" tabIndex={-1}>
      <Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link>
      <div className="eyebrow">Saved observation / {new Date(item.createdAt).toLocaleDateString()}</div>
      <h1 className="page-title">{formatFrequency(item.dominantFrequencyHz)}</h1>
      <p className="lead">Saved {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}. This is a measurement record, not an interpretation of its source.</p>
      <div className="history-toolbar" style={{ marginTop: 20 }}>
        <button className="btn btn-subtle" onClick={() => downloadFile(`zioncore-observation-${item.id}.json`, JSON.stringify(item, null, 2), 'application/json')} data-testid="button-export-observation"><Download size={14} />Export record</button>
        <button className="btn btn-danger" onClick={() => void deleteObservation()} disabled={deleting || isCloudHistory} data-testid="button-delete-observation"><Trash2 size={14} />{isCloudHistory ? 'Cloud deletion unavailable' : deleting ? 'Deleting…' : 'Delete record'}</button>
        <Link href="/" className="btn btn-subtle" data-testid="link-new-observation"><Mic size={14} />New observation</Link>
        {isCloudHistory && user && <Link href="/history/device" className="btn btn-subtle" data-testid="link-detail-device-history">Device-only records</Link>}
        {!isCloudHistory && user && firebaseCloudReady && <Link href="/history" className="btn btn-subtle" data-testid="link-detail-cloud-history">Cloud history</Link>}
      </div>
      {isCloudHistory && <p className="permission-note" role="status" data-testid="status-cloud-delete-gated">Cloud deletion is paused until an authenticated server endpoint can record the deletion audit.</p>}
      {deleteError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-detail-delete-error">{deleteError}</div>}
      <section className="panel" style={{ marginTop: 29 }}>
        <div className="panel-head"><span className="panel-title">Measurement record</span><span className="live-badge"><i className="live-dot" />{isCloudHistory ? 'Account cloud' : user ? 'Account device only' : 'This browser'}</span></div>
        <div className="detail-stats">
          <div className="detail-stat"><span className="metric-label">Sample rate</span><strong>{(item.sampleRate / 1000).toFixed(1)} kHz</strong></div><div className="detail-stat"><span className="metric-label">Resolution</span><strong>{item.frequencyResolutionHz.toFixed(2)} Hz/bin</strong></div><div className="detail-stat"><span className="metric-label">FFT size</span><strong>{item.fftSize.toLocaleString()}</strong></div><div className="detail-stat"><span className="metric-label">Duration</span><strong>{item.durationSeconds.toFixed(1)} sec</strong></div><div className="detail-stat"><span className="metric-label">RMS amplitude</span><strong>{item.rmsLevel.toFixed(4)} FS</strong></div><div className="detail-stat"><span className="metric-label">Mode</span><strong>{item.mode}</strong></div><div className="detail-stat"><span className="metric-label">Dominant peak</span><strong>{formatFrequency(item.dominantFrequencyHz)}</strong></div><div className="detail-stat"><span className="metric-label">Peak count</span><strong>{item.topPeaksHz.length}</strong></div>
        </div>
        <div className="section-body" style={{ borderTop: '1px solid #e4dfd4' }}><div className="label-row"><span>Spectral peaks</span><span className="small-note">Hz</span></div>{item.topPeaksHz.length ? <div className="peak-list">{item.topPeaksHz.map((peak, i) => <span className="peak-chip" key={`${peak}-${i}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">No clear peaks were detected in this observation.</p>}{item.notes && <><div className="label-row" style={{ marginTop: 22 }}><span>Notes</span></div><p className="empty-inline" style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</p></>}</div>
      </section>
      <details className="permission-note" style={{ marginTop: 18 }} data-testid="details-instrument-provenance">
        <summary>Instrument provenance</summary>
        {item.instrumentProvenance
          ? <div className="section-body">
            <p><strong>Instrument:</strong> {item.instrumentProvenance.instrumentName} ({item.instrumentProvenance.instrumentId})</p>
            <p><strong>Acquisition:</strong> {item.instrumentProvenance.acquisitionMethod}; {item.instrumentProvenance.inputChannels ?? 'unknown'} input channels. Physical device IDs and labels were not collected.</p>
            <p><strong>Units:</strong> frequency {item.instrumentProvenance.units.frequency}, resolution {item.instrumentProvenance.units.frequencyResolution}, amplitude {item.instrumentProvenance.units.amplitude}, duration {item.instrumentProvenance.units.duration}.</p>
            <p><strong>Calibration:</strong> {item.instrumentProvenance.calibration.status}. {item.instrumentProvenance.calibration.reference}</p>
            <p><strong>Software:</strong> {item.instrumentProvenance.softwareVersion}</p>
          </div>
          : <p>This older record has no instrument provenance.</p>}
      </details>
      {item.interpretation && <section className="panel zc-analysis-output" style={{ marginTop: 24 }} data-testid="detail-saved-interpretation">
        <div className="panel-head"><span className="panel-title">Saved AI interpretation</span></div>
        <div className="section-body">
          <section className="zc-output-section zc-output-science">
            <div className="zc-output-heading"><Mic size={14} aria-hidden="true" /><h3>AI interpretation</h3><span className={`zc-confidence confidence-${item.interpretation.confidence}`}>{item.interpretation.confidence} interpretation confidence</span></div>
            <p>{item.interpretation.scientificInterpretation}</p>
            {item.interpretation.evidenceUsed && <small>Confidence is capped at moderate because no raw audio, environmental context, or ground-truth source label is supplied.</small>}
          </section>
          <section className="zc-output-section" data-testid="detail-interpretation-evidence">
            <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Measured evidence used</h3></div>
            {item.interpretation.evidenceUsed?.length
              ? <ul className="zc-source-list">{item.interpretation.evidenceUsed.map((evidence, index) => <li key={`${evidence}-${index}`}>{evidence}</li>)}</ul>
              : <p>Evidence details are not available for this older interpretation.</p>}
          </section>
          <section className="zc-output-section">
            <div className="zc-output-heading"><Info size={14} aria-hidden="true" /><h3>Uncertainty</h3></div>
            <p>{item.interpretation.uncertainty}</p>
          </section>
          <section className="zc-output-section" data-testid="detail-interpretation-limitations">
            <div className="zc-output-heading"><Info size={14} aria-hidden="true" /><h3>Technical limitations</h3></div>
            {item.interpretation.limitations?.length
              ? <ul className="zc-source-list">{item.interpretation.limitations.map((limitation, index) => <li key={`${limitation}-${index}`}>{limitation}</li>)}</ul>
              : <p>Limitations were not recorded for this older interpretation.</p>}
          </section>
          {item.interpretation.possibleSources.length > 0 && <section className="zc-output-section">
            <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Possible acoustic explanations</h3></div>
            <ul className="zc-source-list">{item.interpretation.possibleSources.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul>
          </section>}
          {item.interpretation.faithReflection && <section className="zc-output-section zc-output-reflection">
            <div className="zc-output-heading"><BookOpen size={14} aria-hidden="true" /><h3>Separate faith reflection</h3></div>
            <p>{item.interpretation.faithReflection}</p>
            <small>This is personal reflection, not a measurement or scientific finding.</small>
          </section>}
          {item.interpretation.provenance
            ? <div className="zc-analysis-meta" data-testid="text-saved-interpretation-provenance">
              AI output · observation {item.interpretation.provenance.observationId} · method {item.interpretation.provenance.methodId} v{item.interpretation.provenance.methodVersion} · prompt v{item.interpretation.provenance.promptVersion} · provider {item.interpretation.provenance.provider} · model {item.interpretation.provenance.modelId} · generated {new Date(item.interpretation.provenance.generatedAt).toLocaleString()}. The measured values remain unchanged. Provenance is client-recorded, not cryptographically signed.
            </div>
            : <div className="zc-analysis-meta">Model · {item.interpretation.model}. This older interpretation has no recorded method or observation-link metadata; the saved measurement remains separate.</div>}
        </div>
      </section>}
      <p className="footnote"><Info size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />An audio spectrum reflects sound pressure at the microphone. Microphones do not receive RF; this instrument does not detect supernatural communication. Spiritual meaning is a matter of faith, not a sensor result.</p>
    </main>
  </Shell>;
}

function NotFound() {
  return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><div className="panel empty-state"><span className="empty-glyph"><Radio size={22} /></span><h2>Page not found</h2><p>This lab includes live analysis, saved history, and experimental exploration.</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-not-found-home">Return to lab</Link></div></main></Shell>;
}

function AccessRoute() {
  return <Shell><AccessGuidePage /></Shell>;
}

function BioacousticLibraryRoute() {
  return <Shell><BioacousticLibraryPage /></Shell>;
}

function AstronomyDataRoute() {
  return <Shell><AstronomicalDataPage /></Shell>;
}

function DevotionalWorkspaceRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><p className="lead" role="status">Checking account access…</p></main></Shell>;
  }
  if (!user) {
    return <Shell><main id="main-content" className="page-wrap devotional-page" tabIndex={-1}>
      <div className="eyebrow">Personal practice / account session</div>
      <h1 className="page-title">Private devotional workspace</h1>
      <p className="lead">Sign in to open a temporary devotional session. Entries are not written to your account or to shared research.</p>
      <AccountSection required />
    </main></Shell>;
  }
  return <Shell><DevotionalWorkspacePage key={user.uid} /></Shell>;
}

function DeviceHistoryRoute() {
  return <HistoryPage deviceOnly />;
}

function HistoryRoute() {
  return <HistoryPage />;
}

function DeviceDetailRoute() {
  return <DetailPage deviceOnly />;
}

function DetailRoute() {
  return <DetailPage />;
}

function CelestialRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><p className="lead" role="status" data-testid="status-exploration-auth">Preparing the local research archive…</p></main></Shell>;
  }
  const archiveScope = user?.uid ?? ANONYMOUS_RESEARCH_SCOPE;
  const identityType = user ? 'firebase-uid' : 'anonymous-browser';
  return <CelestialExplorationPage
    key={archiveScope}
    archiveScope={archiveScope}
    identityType={identityType}
    ownerEmail={user?.email ?? null}
  />;
}

function ResearchMissionsRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <Shell><main id="main-content" className="page-wrap" tabIndex={-1}><p className="lead" role="status" data-testid="status-missions-auth">Preparing your local mission archive…</p></main></Shell>;
  }
  const scopeRef = user?.uid ?? MISSION_ANONYMOUS_SCOPE;
  return <Shell><ResearchMissionsPage key={scopeRef} scopeRef={scopeRef} /></Shell>;
}

function CustomerDashboardRoute() {
  const { user, loading, authError } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [accountWork, setAccountWork] = useState<{
    uid: string;
    observations: Observation[];
    researchSessions: ResearchSession[];
    error: string;
    observationError: string;
    researchSessionsError: string;
  } | null>(null);

  useEffect(() => {
    setExportError('');
    setExportStatus('');
  }, [user?.uid]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAccountWork(null);
      return;
    }
    let active = true;
    let observations: Observation[] = [];
    let researchSessions: ResearchSession[] = [];
    let observationError = '';
    let researchSessionsError = '';
    try {
      observations = readVerifiedObservations(user.uid);
    } catch (cause) {
      observationError = cause instanceof Error
        ? cause.message
        : 'Account-device observations could not be read from this browser.';
    }
    try {
      researchSessions = readResearchSessions(user.uid, 'firebase-uid');
    } catch (cause) {
      researchSessionsError = cause instanceof Error
        ? cause.message
        : 'Account research sessions could not be read from this browser.';
    }
    if (active) setAccountWork({
      uid: user.uid, observations, researchSessions,
      observationError, researchSessionsError,
      error: [observationError, researchSessionsError].filter(Boolean).join(' '),
    });
    return () => {
      active = false;
    };
  }, [loading, user?.uid]);

  const workMatchesAccount = Boolean(user && accountWork?.uid === user.uid);
  const profile = user
    ? {
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      providers: user.providerData.map(provider => provider.providerId),
    }
    : null;

  const exportAccountData = async () => {
    if (!user || !workMatchesAccount || !accountWork || accountWork.error || exporting) return;
    setExporting(true);
    setExportError('');
    setExportStatus('');
    try {
      if (firebaseAuth?.currentUser?.uid !== user.uid) {
        throw new Error('Your signed-in account changed. Refresh the dashboard and retry the export.');
      }
      const accountCloudObservations = firebaseCloudReady
        ? await listCloudObservations()
        : null;
      if (firebaseAuth?.currentUser?.uid !== user.uid) {
        throw new Error('Your signed-in account changed during export. No file was created.');
      }
      const accountDeviceObservations = readObservationsForExport(user.uid);
      const accountResearchSessions = readResearchSessions(user.uid, 'firebase-uid');
      const bundle = createAccountExport({
        profile: {
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          providers: user.providerData.map(provider => provider.providerId),
        },
        accountDeviceObservations,
        accountCloudObservations,
        accountResearchSessions,
        exportedAt: new Date().toISOString(),
      });
      downloadFile('zioncore-account-export.json', JSON.stringify(bundle, null, 2), 'application/json');
      setExportStatus('Your available account data was prepared as a JSON download. Cloud or billing records not connected here are excluded.');
    } catch (cause) {
      setExportError(cause instanceof Error
        ? cause.message
        : 'Account data could not be exported. No file was created.');
    } finally {
      setExporting(false);
    }
  };

  return <Shell>
    <CustomerDashboard
      profile={profile}
      observations={workMatchesAccount ? accountWork?.observations ?? [] : []}
      researchSessions={workMatchesAccount ? accountWork?.researchSessions ?? [] : []}
      loading={loading || Boolean(user && !workMatchesAccount)}
      authError={authError}
      dataError={workMatchesAccount ? accountWork?.error ?? '' : ''}
      observationError={workMatchesAccount ? accountWork?.observationError ?? '' : ''}
      researchSessionsError={workMatchesAccount ? accountWork?.researchSessionsError ?? '' : ''}
      onExport={exportAccountData}
      exporting={exporting}
      exportError={exportError}
      exportStatus={exportStatus}
    />
  </Shell>;
}

function App() {
  const [user, setUser] = useState<User | null>(firebaseAuth?.currentUser ?? null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, currentUser => {
      setUser(currentUser);
      setAuthError('');
      setLoading(false);
    }, cause => {
      setUser(null);
      setAuthError(getAuthErrorMessage(cause));
      setLoading(false);
    });
  }, []);

  return <AuthContext.Provider value={{ user, loading, authError }}>
    <Switch><Route path="/" component={LabPage} /><Route path="/voice-v2" component={VoiceV2Route} /><Route path="/dashboard" component={CustomerDashboardRoute} /><Route path="/history" component={HistoryRoute} /><Route path="/history/device" component={DeviceHistoryRoute} /><Route path="/history/device/:id" component={DeviceDetailRoute} /><Route path="/history/:id" component={DetailRoute} /><Route path="/exploration" component={CelestialRoute} /><Route path="/missions" component={ResearchMissionsRoute} /><Route path="/astronomy" component={AstronomyDataRoute} /><Route path="/devotional" component={DevotionalWorkspaceRoute} /><Route path="/bioacoustics" component={BioacousticLibraryRoute} /><Route path="/access" component={AccessRoute} /><Route component={NotFound} /></Switch>
  </AuthContext.Provider>;
}

export default App;
