import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Activity, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, Download,
  FileDown, History, Info, Mic, Radio, Save, ShieldCheck, Square, Trash2,
  Waves, X,
} from 'lucide-react';
import AccountAccess from '@/components/account-access';
import AnalysisPanel from '@/components/analysis-panel';
import { analyzeMeasurement, type Explanation } from '@/lib/ai-analysis';
import { ANONYMOUS_RESEARCH_SCOPE } from '@/lib/celestial-experiment';
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
  getFirebaseSetupMessage,
} from '@/lib/firebase';
import {
  downloadFile, formatFrequency, readObservations, toCsv, upsertObservation, writeObservations,
  type Observation,
} from '@/lib/observations';
import useLabEngine from '@/hooks/use-lab-engine';
import CelestialExplorationPage from '@/pages/celestial-exploration';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  authError: string;
};

const AuthContext = createContext<AuthContextValue>({ user: null, loading: false, authError: '' });

function useAuth() {
  return useContext(AuthContext);
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
  const { user } = useAuth();
  return <div className="lab-shell">
    <header className="topbar">
      <Link href="/" className="brand-lockup" data-testid="link-home"><span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span><span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span></Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-live-lab">Live lab</Link>
        <Link href="/history" className={`nav-link ${location.startsWith('/history') ? 'active' : ''}`} data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
        <Link href="/exploration" className={`nav-link ${location === '/exploration' ? 'active' : ''}`} data-testid="link-exploration">Exploration</Link>
        {user?.email && <span className="nav-account" data-testid="text-current-account">{user.email}</span>}
      </nav>
    </header>
    {children}
  </div>;
}

function AccountSection({ required = false }: { required?: boolean } = {}) {
  const { user, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authStatus, setAuthStatus] = useState('');

  useEffect(() => {
    setError('');
    setAuthStatus('');
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
    try {
      await authenticateWithEmail(mode, email, password);
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
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
    googleConnected={Boolean(user?.providerData.some(item => item.providerId === 'google.com'))}
    busy={busy}
    error={error || authError}
    statusMessage={authStatus || readinessMessage}
    onAuth={authenticate}
    onGoogleAuth={googleAuth}
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
      durationSeconds: engine.elapsed, mode: 'microphone',
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
      setAnalysisError('Cloud AI is not configured for this environment. Your local measurement remains available.');
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
      }, includeFaithReflection);
      setAnalysis(result);
    } catch (cause) {
      setAnalysis(null);
      setAnalysisError(cause instanceof Error ? cause.message : 'The AI service could not explain this measurement.');
    } finally {
      setAnalysisLoading(false);
    }
  };
  const startCapture = async () => {
    setDraftId(crypto.randomUUID());
    setDraftCreatedAt(new Date().toISOString());
    setAnalysis(null);
    setAnalysisError('');
    setSaved(false);
    setCloudSaved(false);
    setCloudError('');
    await engine.start();
  };
  const level = engine.reading ? Math.min(100, Math.round(engine.reading.rms * 5000)) : null;
  return <Shell>
    <main className="page-wrap">
      <div className="eyebrow">Observation instrument / 01</div>
      <h1 className="page-title">Listen closely.<br />Measure honestly.</h1>
      <p className="lead">A quiet place to observe sound through your microphone. Free local capture and measurement need no account or payment; every reading stays in this tab, separate from personal meaning.</p>
      <div className="live-grid">
        <section className="panel" aria-label="Live spectrum">
          <div className="panel-head"><span className="panel-title">Frequency spectrum</span><span className="live-badge" data-testid="status-capture"><i className={`live-dot ${engine.running ? 'on' : ''}`} />{engine.running ? 'Live capture' : 'Standby'}</span></div>
          <div className="chart-wrap"><Spectrum bins={engine.reading?.bins ?? null} fftSize={fftSize} /><div className="chart-legend"><span>0 Hz</span><span>Amplitude · relative</span><span>{engine.reading ? `${Math.round(engine.reading.sampleRate / 2 / 1000)} kHz` : 'Nyquist'}</span></div></div>
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
            <div className="control-row"><label className="label-row" htmlFor="fft-size"><span>FFT size</span><span className="small-note">frequency detail</span></label><select id="fft-size" className="select-control" value={fftSize} disabled={engine.running} onChange={event => setFftSize(Number(event.target.value))} data-testid="select-fft-size"><option value={2048}>2,048 points</option><option value={4096}>4,096 points</option><option value={8192}>8,192 points</option></select></div>
            {engine.running || engine.starting ? <button className="btn btn-stop" onClick={() => void engine.stop()} data-testid="button-stop"><Square size={15} fill="currentColor" />{engine.starting ? 'Cancel / stop' : 'Stop capture'}</button> : <button className="btn btn-primary" onClick={() => void startCapture()} disabled={analysisLoading || cloudSaving} data-testid="button-start"><Mic size={16} />Start microphone</button>}
            <p className="permission-note">Starting requests browser microphone permission. Audio is analyzed in this tab only and is never uploaded or recorded.</p>
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
            <div style={{ borderTop: '1px solid #e4dfd4', margin: '14px 0' }} />
            <div className="label-row"><span>Spectral peaks</span><span className="small-note">local maxima</span></div>
            {engine.reading?.peaks.length ? <div className="peak-list">{engine.reading.peaks.map((peak, index) => <span className="peak-chip" key={`${peak}-${index}`} data-testid={`peak-${index}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">{engine.silent ? 'No clear spectral peaks: input is at or near silence.' : 'Peaks appear here while the microphone is measuring.'}</p>}
            {engine.silent && engine.running && <p className="empty-inline" role="status" data-testid="status-silence">Very low input detected. Check microphone placement or input level.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><span className="panel-title">Save an observation</span><Save size={16} color="#758681" /></div>
          <div className="section-body">
            <label className="label-row" htmlFor="observation-notes"><span>Notes <span className="small-note">(optional)</span></span><span className="small-note">not sent to AI</span></label>
            <textarea id="observation-notes" className="text-control" maxLength={4000} placeholder="Describe the room, source, or context…" value={notes} onChange={event => setNotes(event.target.value)} data-testid="input-notes" />
            {analysis && <p className="permission-note" role="status" data-testid="status-analysis-save-guidance">Saving now attaches this interpretation to the same stopped measurement. The measured values remain unchanged.</p>}
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!hasReading || authLoading} onClick={save} data-testid="button-save-observation">{saved ? <Check size={15} /> : <Save size={15} />}{saved ? analysis ? user ? 'Saved on this device with interpretation' : 'Saved with interpretation' : user ? 'Saved on this device for this account' : 'Saved to this browser' : analysis ? 'Save interpreted observation' : 'Save observation'}</button>
            <button className="btn btn-subtle zc-cloud-save" style={{ marginTop: 10, width: '100%' }} disabled={!hasReading || !user || !firebaseCloudReady || cloudSaving} onClick={() => void saveToCloud()} data-testid="button-save-cloud-observation">
              <Save size={14} />{cloudSaving ? 'Saving to account cloud…' : cloudSaved ? analysis ? 'Cloud interpretation updated' : 'Saved to your account cloud history' : analysis ? 'Save interpreted observation to cloud' : 'Save to account cloud'}
            </button>
            {cloudError && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-cloud-save-error">{cloudError}</p>}
            {!user && <p className="permission-note">To save across devices, sign in from the History page. Local saving remains available.</p>}
            {user && !firebaseCloudReady && <p className="permission-note" role="status">Cloud saves are paused until Firestore rules and App Check are reviewed and verified.</p>}
          </div>
        </section>
      </div>
      <div className="section-grid">
        <AnalysisPanel
          hasMeasurement={hasReading}
          captureActive={engine.running || engine.starting}
          canAnalyze={Boolean(user && firebaseAiReady)}
          requiresAccount={!user}
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
          <div className="panel-head"><span className="panel-title">How to read this instrument</span><Info size={16} color="#758681" /></div>
          <div className="section-body"><p className="empty-inline" style={{ marginTop: 0 }}>This display analyzes audible sound pressure reaching your device’s microphone. Its FFT shows relative amplitude by frequency; resolution is sample rate divided by FFT size. A dominant peak is the strongest measured bin, not an explanation of its source.</p><p className="empty-inline">A microphone cannot receive radio-frequency (RF) signals. This version cannot detect divine or supernatural communication, and it does not decode messages. Spiritual meaning is a matter of faith, not a sensor result.</p></div>
        </section>
        <section className="panel faith-card">
          <div className="panel-head"><span className="panel-title">Faith reflection</span><BookOpen size={16} color="#758681" /></div>
          <div className="section-body">{!reflection ? <><p className="empty-inline" style={{ marginTop: 0, marginBottom: 16 }}>An optional scripture passage for personal reflection, kept separate from the measurements.</p><button className="btn btn-subtle" onClick={() => setReflection(true)} data-testid="button-open-reflection"><BookOpen size={14} />Open reflection</button></> : <><blockquote>“Be still, and know that I am God.”</blockquote><p>Psalm 46:10 · A passage for reflection, not a scientific interpretation or measurement.</p><button className="btn btn-subtle" style={{ marginTop: 14 }} onClick={() => setReflection(false)} data-testid="button-close-reflection"><X size={14} />Close reflection</button></>}</div>
        </section>
      </div>
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Microphone data is processed in memory in your browser and is never uploaded. Saved measurements stay on this device unless you explicitly save one to account cloud history after its access controls are verified.</p>
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
  const [confirmClear, setConfirmClear] = useState(false);
  const isCloudHistory = scope.startsWith('cloud:');

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
  }, [scope, user?.uid, isCloudHistory]);

  const visibleItems = itemsScope === scope ? items : [];
  const exportJson = () => downloadFile('zioncore-observations.json', JSON.stringify(visibleItems, null, 2), 'application/json');
  const exportCsv = () => downloadFile('zioncore-observations.csv', toCsv(visibleItems), 'text/csv;charset=utf-8');
  const clear = async () => {
    setClearError('');
    try {
      if (isCloudHistory) {
        await deleteCloudObservations(visibleItems.map(item => item.id));
      } else {
        writeObservations([], user?.uid);
      }
      setItems([]);
      setConfirmClear(false);
    } catch (cause) {
      setClearError(isCloudHistory ? getCloudHistoryErrorMessage(cause) : 'Could not clear local history. Check browser storage permissions and retry.');
    }
  };
  return <Shell>
    <main className="page-wrap">
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
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={!visibleItems.length} data-testid="button-clear-history"><Trash2 size={14} />Clear history</button>
      </div>
      {loading ? <div className="panel empty-state" role="status" data-testid="status-history-loading"><p>Loading your saved observations…</p></div>
        : historyError ? <div className="panel empty-state" role="status" data-testid="status-history-unavailable"><span className="empty-glyph"><Info size={22} /></span><h2>History could not be loaded.</h2><p>Retry the page after checking the Firebase connection. No local history was substituted for the cloud archive.</p></div>
        : visibleItems.length ? <div className="history-list">{visibleItems.map(item => <Link key={item.id} href={deviceOnly && user ? `/history/device/${item.id}` : `/history/${item.id}`} className="panel history-item" data-testid={`link-observation-${item.id}`}>
        <span><span className="history-date">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="history-freq">{formatFrequency(item.dominantFrequencyHz)}</span><span className="history-meta">{item.fftSize.toLocaleString()} FFT · {(item.sampleRate / 1000).toFixed(1)} kHz sample rate · {item.durationSeconds.toFixed(1)} sec</span></span><ArrowRight className="history-arrow" size={17} />
      </Link>)}</div> : <div className="panel empty-state" style={{ marginTop: 30 }}>
        <span className="empty-glyph"><History size={23} /></span><h2>Your record begins with an observation.</h2><p>{isCloudHistory ? 'No cloud observations are saved to this account yet. Local browser records remain separate.' : 'Start a microphone measurement in the live lab, then choose “Save observation.” Nothing is added automatically.'}</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-empty-start"><Mic size={14} />Go to live lab</Link>
      </div>}
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Exports contain measurement metadata and your notes, never microphone audio.</p>
    </main>
    {confirmClear && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmClear(false); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" data-testid="dialog-clear-history"><h2 id="clear-title">Clear saved observations?</h2><p>This permanently removes {visibleItems.length} {visibleItems.length === 1 ? 'observation' : 'observations'} from {isCloudHistory ? 'your account cloud archive' : 'this browser'}. Export first if you want to keep a copy.</p><div className="modal-actions"><button className="btn btn-subtle" onClick={() => setConfirmClear(false)} data-testid="button-cancel-clear">Keep history</button><button className="btn btn-danger" onClick={() => void clear()} data-testid="button-confirm-clear"><Trash2 size={14} />Clear permanently</button></div></section>
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
  }, [scope, params.id, user?.uid, isCloudHistory]);

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
        writeObservations(readObservations(user?.uid).filter(observation => observation.id !== item.id), user?.uid);
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

  if (detailLoading || loadedScope !== scope) return <Shell><main className="page-wrap"><div className="panel empty-state" role="status" data-testid="status-detail-loading"><p>Loading this observation…</p></div></main></Shell>;
  if (detailError) return <Shell><main className="page-wrap"><Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="status-box alert-box" role="alert" data-testid="status-detail-error">{detailError}</div></main></Shell>;
  if (!item) return <Shell><main className="page-wrap"><Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="panel empty-state"><span className="empty-glyph"><Info size={22} /></span><h2>Observation not found</h2><p>It may have been cleared from this browser or the link may be incomplete.</p><Link href={historyHref} className="btn btn-subtle" data-testid="link-return-history">Return to history</Link></div></main></Shell>;
  return <Shell>
    <main className="page-wrap">
      <Link href={historyHref} className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link>
      <div className="eyebrow">Saved observation / {new Date(item.createdAt).toLocaleDateString()}</div>
      <h1 className="page-title">{formatFrequency(item.dominantFrequencyHz)}</h1>
      <p className="lead">Saved {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}. This is a measurement record, not an interpretation of its source.</p>
      <div className="history-toolbar" style={{ marginTop: 20 }}>
        <button className="btn btn-subtle" onClick={() => downloadFile(`zioncore-observation-${item.id}.json`, JSON.stringify(item, null, 2), 'application/json')} data-testid="button-export-observation"><Download size={14} />Export record</button>
        <button className="btn btn-danger" onClick={() => void deleteObservation()} disabled={deleting} data-testid="button-delete-observation"><Trash2 size={14} />{deleting ? 'Deleting…' : 'Delete record'}</button>
        <Link href="/" className="btn btn-subtle" data-testid="link-new-observation"><Mic size={14} />New observation</Link>
        {isCloudHistory && user && <Link href="/history/device" className="btn btn-subtle" data-testid="link-detail-device-history">Device-only records</Link>}
        {!isCloudHistory && user && firebaseCloudReady && <Link href="/history" className="btn btn-subtle" data-testid="link-detail-cloud-history">Cloud history</Link>}
      </div>
      {deleteError && <div className="status-box alert-box" role="alert" style={{ marginTop: 18 }} data-testid="status-detail-delete-error">{deleteError}</div>}
      <section className="panel" style={{ marginTop: 29 }}>
        <div className="panel-head"><span className="panel-title">Measurement record</span><span className="live-badge"><i className="live-dot" />{isCloudHistory ? 'Account cloud' : user ? 'Account device only' : 'This browser'}</span></div>
        <div className="detail-stats">
          <div className="detail-stat"><span className="metric-label">Sample rate</span><strong>{(item.sampleRate / 1000).toFixed(1)} kHz</strong></div><div className="detail-stat"><span className="metric-label">Resolution</span><strong>{item.frequencyResolutionHz.toFixed(2)} Hz/bin</strong></div><div className="detail-stat"><span className="metric-label">FFT size</span><strong>{item.fftSize.toLocaleString()}</strong></div><div className="detail-stat"><span className="metric-label">Duration</span><strong>{item.durationSeconds.toFixed(1)} sec</strong></div><div className="detail-stat"><span className="metric-label">RMS level</span><strong>{Math.round(item.rmsLevel * 5000)} rel.</strong></div><div className="detail-stat"><span className="metric-label">Mode</span><strong>{item.mode}</strong></div><div className="detail-stat"><span className="metric-label">Dominant peak</span><strong>{formatFrequency(item.dominantFrequencyHz)}</strong></div><div className="detail-stat"><span className="metric-label">Peak count</span><strong>{item.topPeaksHz.length}</strong></div>
        </div>
        <div className="section-body" style={{ borderTop: '1px solid #e4dfd4' }}><div className="label-row"><span>Spectral peaks</span><span className="small-note">Hz</span></div>{item.topPeaksHz.length ? <div className="peak-list">{item.topPeaksHz.map((peak, i) => <span className="peak-chip" key={`${peak}-${i}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">No clear peaks were detected in this observation.</p>}{item.notes && <><div className="label-row" style={{ marginTop: 22 }}><span>Notes</span></div><p className="empty-inline" style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</p></>}</div>
      </section>
      {item.interpretation && <section className="panel zc-analysis-output" style={{ marginTop: 24 }} data-testid="detail-saved-interpretation">
        <div className="panel-head"><span className="panel-title">Saved AI interpretation</span></div>
        <div className="section-body">
          <section className="zc-output-section zc-output-science">
            <div className="zc-output-heading"><Mic size={14} aria-hidden="true" /><h3>Scientific interpretation</h3><span className={`zc-confidence confidence-${item.interpretation.confidence}`}>{item.interpretation.confidence} confidence</span></div>
            <p>{item.interpretation.scientificInterpretation}</p>
          </section>
          <section className="zc-output-section">
            <div className="zc-output-heading"><Info size={14} aria-hidden="true" /><h3>Uncertainty</h3></div>
            <p>{item.interpretation.uncertainty}</p>
          </section>
          {item.interpretation.possibleSources.length > 0 && <section className="zc-output-section">
            <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Possible sound sources</h3></div>
            <ul className="zc-source-list">{item.interpretation.possibleSources.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul>
          </section>}
          {item.interpretation.faithReflection && <section className="zc-output-section zc-output-reflection">
            <div className="zc-output-heading"><BookOpen size={14} aria-hidden="true" /><h3>Separate faith reflection</h3></div>
            <p>{item.interpretation.faithReflection}</p>
            <small>This is personal reflection, not a measurement or scientific finding.</small>
          </section>}
          <div className="zc-analysis-meta">Model · {item.interpretation.model}. The saved measurement remains separate from its interpretation.</div>
        </div>
      </section>}
      <p className="footnote"><Info size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />An audio spectrum reflects sound pressure at the microphone. Microphones do not receive RF; this instrument does not detect supernatural communication. Spiritual meaning is a matter of faith, not a sensor result.</p>
    </main>
  </Shell>;
}

function NotFound() {
  return <Shell><main className="page-wrap"><div className="panel empty-state"><span className="empty-glyph"><Radio size={22} /></span><h2>Page not found</h2><p>This lab includes live analysis, saved history, and experimental exploration.</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-not-found-home">Return to lab</Link></div></main></Shell>;
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
    return <Shell><main className="page-wrap"><p className="lead" role="status" data-testid="status-exploration-auth">Preparing the local research archive…</p></main></Shell>;
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
    <Switch><Route path="/" component={LabPage} /><Route path="/history" component={HistoryRoute} /><Route path="/history/device" component={DeviceHistoryRoute} /><Route path="/history/device/:id" component={DeviceDetailRoute} /><Route path="/history/:id" component={DetailRoute} /><Route path="/exploration" component={CelestialRoute} /><Route component={NotFound} /></Switch>
  </AuthContext.Provider>;
}

export default App;
