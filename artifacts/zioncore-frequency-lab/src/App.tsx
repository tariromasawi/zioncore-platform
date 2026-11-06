import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, AudioLines, BookOpen, Check, Download,
  FileDown, History, Info, Mic, Radio, Save, ShieldCheck, Square, Trash2,
  Waves, X,
} from 'lucide-react';
import {
  downloadFile, formatFrequency, readObservations, toCsv, writeObservations,
  type Observation,
} from '@/lib/observations';

type Reading = {
  sampleRate: number;
  fftSize: number;
  resolution: number;
  dominant: number | null;
  peaks: number[];
  rms: number;
  bins: number[];
};

function useLabEngine(fftSize: number) {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
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
          if (bins[i] > max) { max = bins[i]; dominantBin = i; }
          if (bins[i] > bins[i - 1] && bins[i] >= bins[i + 1] && bins[i] > 32) {
            peaks.push({ frequency: i * context.sampleRate / analyser.fftSize, magnitude: bins[i] });
          }
        }
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        const isSilent = rms < 0.0008 || max < 4;
        setSilent(isSilent);
        setElapsed((performance.now() - startRef.current) / 1000);
        setReading({
          sampleRate: context.sampleRate, fftSize, resolution: context.sampleRate / fftSize,
          dominant: isSilent || max < 4 ? null : dominantBin * context.sampleRate / analyser.fftSize,
          peaks: isSilent ? [] : peaks.slice(0, 6).map(peak => peak.frequency),
          rms, bins: Array.from(bins),
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
        : name === 'NotFoundError' ? 'No microphone was found. Connect or enable an input device and try again.'
          : name === 'NotReadableError' ? 'The microphone is in use or unavailable to this page. Close other recording apps and retry.'
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
    if (contextRef.current && contextRef.current.state !== 'closed') void contextRef.current.close();
  }, []);

  return { running, starting, status, error, reading, elapsed, silent, start, stop };
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
  return <div className="lab-shell">
    <header className="topbar">
      <Link href="/" className="brand-lockup" data-testid="link-home"><span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span><span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span></Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-live-lab">Live lab</Link>
        <Link href="/history" className={`nav-link ${location.startsWith('/history') ? 'active' : ''}`} data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
      </nav>
    </header>
    {children}
  </div>;
}

function LabPage() {
  const [fftSize, setFftSize] = useState(4096);
  const [observations, setObservations] = useState<Observation[]>(readObservations);
  const [notes, setNotes] = useState('');
  const [reflection, setReflection] = useState(false);
  const [saved, setSaved] = useState(false);
  const engine = useLabEngine(fftSize);
  const hasReading = Boolean(engine.reading);
  const save = () => {
    if (!engine.reading) return;
    const item: Observation = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(),
      sampleRate: engine.reading.sampleRate, fftSize: engine.reading.fftSize,
      frequencyResolutionHz: engine.reading.resolution, dominantFrequencyHz: engine.reading.dominant,
      topPeaksHz: engine.reading.peaks, rmsLevel: engine.reading.rms,
      durationSeconds: engine.elapsed, mode: 'microphone',
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const next = [item, ...observations];
    try {
      writeObservations(next); setObservations(next); setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch { setSaved(false); window.alert('Could not save to this browser. Check available local storage and try again.'); }
  };
  const level = engine.reading ? Math.min(100, Math.round(engine.reading.rms * 5000)) : null;
  return <Shell>
    <main className="page-wrap">
      <div className="eyebrow">Observation instrument / 01</div>
      <h1 className="page-title">Listen closely.<br />Measure honestly.</h1>
      <p className="lead">A quiet place to observe sound through your microphone. Every reading is local, physical, and separate from personal meaning.</p>
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
            {engine.running || engine.starting ? <button className="btn btn-stop" onClick={() => void engine.stop()} data-testid="button-stop"><Square size={15} fill="currentColor" />{engine.starting ? 'Cancel / stop' : 'Stop capture'}</button> : <button className="btn btn-primary" onClick={() => void engine.start()} data-testid="button-start"><Mic size={16} />Start microphone</button>}
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
            <label className="label-row" htmlFor="observation-notes"><span>Notes <span className="small-note">(optional)</span></span><span className="small-note">local only</span></label>
            <textarea id="observation-notes" className="text-control" placeholder="Describe the room, source, or context…" value={notes} onChange={event => setNotes(event.target.value)} data-testid="input-notes" />
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!hasReading} onClick={save} data-testid="button-save-observation">{saved ? <Check size={15} /> : <Save size={15} />}{saved ? 'Saved to this browser' : 'Save observation'}</button>
            <p className="permission-note">A snapshot of the current measurement is saved only when you choose this action. Audio itself is never stored.</p>
          </div>
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
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Local-first by design. Microphone data is processed in memory in your browser. Saved observations stay in this browser’s local storage until you export or clear them.</p>
    </main>
  </Shell>;
}

function HistoryPage() {
  const [items, setItems] = useState<Observation[]>(readObservations);
  const [confirmClear, setConfirmClear] = useState(false);
  const exportJson = () => downloadFile('zioncore-observations.json', JSON.stringify(items, null, 2), 'application/json');
  const exportCsv = () => downloadFile('zioncore-observations.csv', toCsv(items), 'text/csv;charset=utf-8');
  const clear = () => {
    try { writeObservations([]); setItems([]); setConfirmClear(false); }
    catch { window.alert('Could not clear local history. Check browser storage permissions and retry.'); }
  };
  return <Shell>
    <main className="page-wrap">
      <div className="eyebrow">Your browser / archive</div>
      <h1 className="page-title">Observation<br />history.</h1>
      <p className="lead">Only measurements you explicitly saved appear here. This archive lives in local browser storage on this device.</p>
      <div className="history-toolbar" style={{ marginTop: 25 }}>
        <button className="btn btn-subtle" onClick={exportJson} disabled={!items.length} data-testid="button-export-json"><Download size={14} />Export JSON</button>
        <button className="btn btn-subtle" onClick={exportCsv} disabled={!items.length} data-testid="button-export-csv"><FileDown size={14} />Export CSV</button>
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={!items.length} data-testid="button-clear-history"><Trash2 size={14} />Clear history</button>
      </div>
      {items.length ? <div className="history-list">{items.map(item => <Link key={item.id} href={`/history/${item.id}`} className="panel history-item" data-testid={`link-observation-${item.id}`}>
        <span><span className="history-date">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><span className="history-freq">{formatFrequency(item.dominantFrequencyHz)}</span><span className="history-meta">{item.fftSize.toLocaleString()} FFT · {(item.sampleRate / 1000).toFixed(1)} kHz sample rate · {item.durationSeconds.toFixed(1)} sec</span></span><ArrowRight className="history-arrow" size={17} />
      </Link>)}</div> : <div className="panel empty-state" style={{ marginTop: 30 }}>
        <span className="empty-glyph"><History size={23} /></span><h2>Your record begins with an observation.</h2><p>Start a microphone measurement in the live lab, then choose “Save observation.” Nothing is added automatically.</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-empty-start"><Mic size={14} />Go to live lab</Link>
      </div>}
      <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Exports contain measurement metadata and your notes, never microphone audio.</p>
    </main>
    {confirmClear && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setConfirmClear(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" data-testid="dialog-clear-history"><h2 id="clear-title">Clear saved observations?</h2><p>This permanently removes {items.length} {items.length === 1 ? 'observation' : 'observations'} from this browser. Export first if you want to keep a copy.</p><div className="modal-actions"><button className="btn btn-subtle" onClick={() => setConfirmClear(false)} data-testid="button-cancel-clear">Keep history</button><button className="btn btn-danger" onClick={clear} data-testid="button-confirm-clear"><Trash2 size={14} />Clear permanently</button></div></section>
    </div>}
  </Shell>;
}

function DetailPage() {
  const params = useParams<{ id: string }>();
  const [item] = useState(() => readObservations().find(entry => entry.id === params.id));
  if (!item) return <Shell><main className="page-wrap"><Link href="/history" className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link><div className="panel empty-state"><span className="empty-glyph"><Info size={22} /></span><h2>Observation not found</h2><p>It may have been cleared from this browser or the link may be incomplete.</p><Link href="/history" className="btn btn-subtle" data-testid="link-return-history">Return to history</Link></div></main></Shell>;
  return <Shell>
    <main className="page-wrap">
      <Link href="/history" className="detail-back" data-testid="link-back-history"><ArrowLeft size={14} />Back to history</Link>
      <div className="eyebrow">Saved observation / {new Date(item.createdAt).toLocaleDateString()}</div>
      <h1 className="page-title">{formatFrequency(item.dominantFrequencyHz)}</h1>
      <p className="lead">Saved {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}. This is a measurement record, not an interpretation of its source.</p>
      <section className="panel" style={{ marginTop: 29 }}>
        <div className="panel-head"><span className="panel-title">Measurement record</span><span className="live-badge"><i className="live-dot" />Saved locally</span></div>
        <div className="detail-stats">
          <div className="detail-stat"><span className="metric-label">Sample rate</span><strong>{(item.sampleRate / 1000).toFixed(1)} kHz</strong></div><div className="detail-stat"><span className="metric-label">Resolution</span><strong>{item.frequencyResolutionHz.toFixed(2)} Hz/bin</strong></div><div className="detail-stat"><span className="metric-label">FFT size</span><strong>{item.fftSize.toLocaleString()}</strong></div><div className="detail-stat"><span className="metric-label">Duration</span><strong>{item.durationSeconds.toFixed(1)} sec</strong></div><div className="detail-stat"><span className="metric-label">RMS level</span><strong>{Math.round(item.rmsLevel * 5000)} rel.</strong></div><div className="detail-stat"><span className="metric-label">Mode</span><strong>{item.mode}</strong></div><div className="detail-stat"><span className="metric-label">Dominant peak</span><strong>{formatFrequency(item.dominantFrequencyHz)}</strong></div><div className="detail-stat"><span className="metric-label">Peak count</span><strong>{item.topPeaksHz.length}</strong></div>
        </div>
        <div className="section-body" style={{ borderTop: '1px solid #e4dfd4' }}><div className="label-row"><span>Spectral peaks</span><span className="small-note">Hz</span></div>{item.topPeaksHz.length ? <div className="peak-list">{item.topPeaksHz.map((peak, i) => <span className="peak-chip" key={`${peak}-${i}`}>{formatFrequency(peak)}</span>)}</div> : <p className="empty-inline">No clear peaks were detected in this observation.</p>}{item.notes && <><div className="label-row" style={{ marginTop: 22 }}><span>Notes</span></div><p className="empty-inline" style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</p></>}</div>
      </section>
      <p className="footnote"><Info size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />An audio spectrum reflects sound pressure at the microphone. Microphones do not receive RF; this instrument does not detect supernatural communication. Spiritual meaning is a matter of faith, not a sensor result.</p>
    </main>
  </Shell>;
}

function NotFound() {
  return <Shell><main className="page-wrap"><div className="panel empty-state"><span className="empty-glyph"><Radio size={22} /></span><h2>Page not found</h2><p>This lab has one live instrument and one local archive.</p><Link href="/" className="btn btn-primary" style={{ width: 'auto', padding: '12px 16px' }} data-testid="link-not-found-home">Return to lab</Link></div></main></Shell>;
}

function App() {
  return <Switch><Route path="/" component={LabPage} /><Route path="/history" component={HistoryPage} /><Route path="/history/:id" component={DetailPage} /><Route component={NotFound} /></Switch>;
}

export default App;
