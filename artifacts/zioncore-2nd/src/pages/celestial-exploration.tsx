import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { z } from 'zod';
import {
  Activity, AlertTriangle, AudioLines, Check, Download, History,
  Info, Mic, Play, Radio, Save, ShieldCheck, Square, Trash2, Waves,
} from 'lucide-react';
import {
  CELESTIAL_MAX_MESSAGE_BYTES, CELESTIAL_OUTPUT_LEVEL_OPTIONS, CELESTIAL_PROTOCOL_ID,
  CELESTIAL_SYMBOL_DURATION_OPTIONS, createCelestialWaveform, createResearchSession,
  createUniversalExperiment,
  decodeCelestialSymbols, encodeCelestialMessage, readResearchSessions,
  summarizeResearchPatterns, validateResearchSession, writeResearchSessions,
  type HypothesisStatus, type ResearchIdentityType, type ResearchObservation, type ResearchSession,
} from '@/lib/celestial-experiment';
import { downloadFile } from '@/lib/observations';
import { researchAgentRouter, researchGridRegistry } from '@/lib/research-grid';
import { instrumentRegistry } from '@/lib/hardware-instruments';
import useLabEngine from '@/hooks/use-lab-engine';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import './celestial-exploration.css';

const composeSchema = z.object({
  text: z.string().max(CELESTIAL_MAX_MESSAGE_BYTES, `Maximum ${CELESTIAL_MAX_MESSAGE_BYTES} UTF-8 bytes.`),
  domain: z.string().refine(value => Boolean(researchGridRegistry.getDomain(value)), 'Choose a registered research domain.'),
  intent: z.enum(['research-message', 'prayer']),
  symbolDurationMs: z.enum(['50', '75', '100']),
  outputLevel: z.enum(['0.04', '0.08']),
});
type ComposeValues = z.infer<typeof composeSchema>;

function byteCount(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function downloadJson(name: string, value: unknown) {
  downloadFile(name, JSON.stringify(value, null, 2), 'application/json');
}

export default function CelestialExplorationPage({
  archiveScope,
  identityType,
  ownerEmail,
}: {
  archiveScope: string;
  identityType: ResearchIdentityType;
  ownerEmail: string | null;
}) {
  const form = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { text: '', domain: 'celestial-exploration', intent: 'research-message', symbolDurationMs: '75', outputLevel: '0.04' },
    mode: 'onChange',
  });
  useSyncExternalStore(researchGridRegistry.subscribe, researchGridRegistry.getRevision, researchGridRegistry.getRevision);
  const values = form.watch();
  const text = values.text;
  const domains = researchGridRegistry.listDomains();
  const selectedDomain = researchGridRegistry.getDomain(values.domain);
  const [draft, setDraft] = useState<ResearchSession>(() => createResearchSession());
  const formSignature = JSON.stringify([
    values.text,
    values.domain,
    values.intent,
    values.symbolDurationMs,
    values.outputLevel,
  ]);
  const previewIsCurrent = Boolean(
    draft.signal
      && draft.message.text === values.text
      && draft.message.intent === values.intent
      && draft.encoding.symbolDurationMs === Number(values.symbolDurationMs)
      && draft.encoding.outputLevel === Number(values.outputLevel),
  );
  const [signalError, setSignalError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [playbackStatus, setPlaybackStatus] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [storageError, setStorageError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [observationNote, setObservationNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const engine = useLabEngine(4096);
  const latestReading = useRef(engine.reading);
  latestReading.current = engine.reading;
  const captureStarted = useRef<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);
  const playbackStoppedEarly = useRef(false);
  const endingPlayback = useRef(false);
  const previousFormSignature = useRef(formSignature);

  const loadHistory = () => {
    try {
      setSessions(readResearchSessions(archiveScope, identityType));
      setStorageError('');
      setLoaded(true);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Local research history could not be read.');
      setLoaded(false);
    }
  };
  useEffect(() => { loadHistory(); }, [archiveScope, identityType]);
  useEffect(() => {
    if (previousFormSignature.current === formSignature) return;
    previousFormSignature.current = formSignature;
    setAuthorized(false);
    setPlaybackError('');
    if (draft.signal) {
      setPlaybackStatus('Research settings changed. Review the current preview and authorize playback again.');
    }
  }, [formSignature, draft.signal]);
  useEffect(() => {
    if (engine.error) captureStarted.current = null;
    else if (engine.running && !captureStarted.current) captureStarted.current = new Date().toISOString();
  }, [engine.error, engine.running]);

  const patchDraft = (update: Partial<ResearchSession>) => {
    setDraft(current => ({ ...current, ...update, updatedAt: new Date().toISOString() }));
  };

  const generatePreview = form.handleSubmit(values => {
    setSignalError('');
    try {
      const encoded = encodeCelestialMessage(values.text, Number(values.symbolDurationMs));
      const decoded = decodeCelestialSymbols(encoded.symbols);
      patchDraft({
        domain: values.domain,
        message: {
          text: values.text,
          intent: values.intent,
          source: { type: 'human-authored', label: 'User-composed text', capturedAt: new Date().toISOString() },
        },
        encoding: {
          ...draft.encoding,
          protocolId: CELESTIAL_PROTOCOL_ID,
          symbolDurationMs: Number(values.symbolDurationMs) as 50 | 75 | 100,
          outputLevel: Number(values.outputLevel) as 0.04 | 0.08,
        },
        signal: encoded,
        transmission: null,
      });
      setAuthorized(false);
      setPlaybackStatus(decoded === values.text ? 'Preview generated and checksum verified locally.' : 'Preview generated; decoded text differs.');
    } catch (cause) {
      setSignalError(cause instanceof Error ? cause.message : 'Could not encode this message.');
    }
  });

  const closePlayback = async () => {
    const source = audioSource.current;
    const context = audioContext.current;
    audioSource.current = null;
    audioContext.current = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* source may have ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* already closed */ }
    }
  };
  const startPlayback = async () => {
    if (!draft.signal || !authorized || playing) return;
    if (!previewIsCurrent) {
      setPlaybackError('The preview does not match the current composition. Generate a fresh preview before playback.');
      return;
    }
    if (engine.running || engine.starting) {
      setPlaybackError('Stop microphone capture before starting speaker playback.');
      return;
    }
    setPlaybackError('');
    if (typeof AudioContext === 'undefined') {
      setPlaybackError('Web Audio is unavailable in this browser. The preview remains inspectable, but playback cannot start.');
      return;
    }
    let context: AudioContext | null = null;
    try {
      // Constructed and resumed only from this explicit button gesture.
      context = new AudioContext();
      audioContext.current = context;
      await context.resume();
      const waveform = createCelestialWaveform(draft.signal, draft.encoding.outputLevel);
      const buffer = context.createBuffer(1, waveform.length, draft.signal.sampleRateHz);
      buffer.getChannelData(0).set(waveform);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      audioSource.current = source;
      endingPlayback.current = false;
      playbackStoppedEarly.current = false;
      const authorizedAt = new Date().toISOString();
      patchDraft({
        transmission: { authorizedAt, completedAt: null, outputChannel: 'local-speaker', stoppedEarly: false },
      });
      setPlaying(true);
      setPlaybackStatus('Playing the encoded packet through this device’s local speaker.');
      source.onended = () => {
        if (endingPlayback.current) return;
        endingPlayback.current = true;
        const completedAt = new Date().toISOString();
        setPlaying(false);
        setPlaybackStatus(playbackStoppedEarly.current ? 'Playback stopped. No external transmission occurred.' : 'Packet playback completed locally.');
        setDraft(current => ({
          ...current,
          updatedAt: completedAt,
          transmission: current.transmission
            ? { ...current.transmission, completedAt, stoppedEarly: playbackStoppedEarly.current }
            : null,
        }));
        void closePlayback();
      };
      source.start();
    } catch (cause) {
      setPlaying(false);
      setPlaybackError(cause instanceof Error ? `Playback could not start: ${cause.message}` : 'Playback could not start. Check your audio output and try again.');
      await closePlayback();
    }
  };
  const stopPlayback = () => {
    if (!audioSource.current || endingPlayback.current) return;
    playbackStoppedEarly.current = true;
    try { audioSource.current.stop(); } catch { /* playback already ended */ }
  };
  useEffect(() => () => {
    endingPlayback.current = true;
    const source = audioSource.current;
    const context = audioContext.current;
    audioSource.current = null;
    audioContext.current = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const addObservation = async () => {
    const reading = latestReading.current;
    const startedAt = captureStarted.current;
    if (!reading || !startedAt) return;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(0.1, engine.elapsed);
    const observation: ResearchObservation = {
      id: crypto.randomUUID(),
      instrumentId: engine.instrumentDiscovery?.instrument.id ?? 'instrument.browser-microphone-web-audio',
      source: {
        type: 'microphone-observation',
        label: 'Local browser microphone',
        capturedAt: endedAt,
      },
      window: { startedAt, endedAt, durationSeconds, source: 'browser-microphone' },
      sampleRateHz: reading.sampleRate,
      fftSize: reading.fftSize,
      frequencyResolutionHz: reading.sampleRate / reading.fftSize,
      dominantFrequencyHz: reading.dominant,
      topPeaksHz: reading.peaks.slice(0, 6),
      rmsLevel: Math.max(0, Math.min(1, reading.rms)),
      notes: observationNote.trim().slice(0, 2000),
    };
    await engine.stop('Capture stopped. A summary was added to this draft; raw audio was not saved.');
    patchDraft({
      observations: [...draft.observations, observation],
      observationWindow: observation.window,
    });
    captureStarted.current = null;
    setObservationNote('');
  };
  const updateInterpretation = (key: 'measuredPattern' | 'uncertainty' | 'personalReflection', value: string) => {
      const current = draft.interpretation ?? {
        measuredPattern: '', uncertainty: '', personalReflection: '', createdAt: new Date().toISOString(),
      };
      patchDraft({ interpretation: { ...current, [key]: value } });
  };
  const updateHypothesis = (key: 'statement' | 'status', value: string) => {
    const current = draft.hypothesis ?? { statement: '', status: 'open' as HypothesisStatus, updatedAt: new Date().toISOString() };
    patchDraft({
      hypothesis: {
        ...current,
        [key]: key === 'status' ? value as HypothesisStatus : value,
        updatedAt: new Date().toISOString(),
      },
    });
  };
  const saveSession = () => {
    if (!loaded) return;
    setSaveStatus('');
    const values = form.getValues();
    if (!values.text.trim()) {
      setSaveStatus('Write a research message or prayer before saving this session.');
      return;
    }
    if (draft.signal && (
      decodeCelestialSymbols(draft.signal.symbols) !== values.text
      || draft.signal.symbolDurationMs !== Number(values.symbolDurationMs)
      || draft.encoding.outputLevel !== Number(values.outputLevel)
    )) {
      setSaveStatus('The message or encoding changed after preview. Generate a fresh preview before saving.');
      return;
    }
    const sessionWithoutExperiment: ResearchSession = {
      ...draft,
      domain: values.domain,
      updatedAt: new Date().toISOString(),
      message: {
        ...draft.message,
        text: values.text,
        intent: values.intent,
        source: { type: 'human-authored', label: 'User-composed text', capturedAt: new Date().toISOString() },
      },
      encoding: {
        ...draft.encoding,
        symbolDurationMs: Number(values.symbolDurationMs) as 50 | 75 | 100,
        outputLevel: Number(values.outputLevel) as 0.04 | 0.08,
      },
    };
    let nextDraft: ResearchSession;
    try {
      nextDraft = {
        ...sessionWithoutExperiment,
        universalExperiment: createUniversalExperiment(sessionWithoutExperiment, archiveScope, identityType),
      };
    } catch (cause) {
      setSaveStatus(cause instanceof Error ? cause.message : 'Could not prepare the universal experiment record.');
      return;
    }
    const validation = validateResearchSession(nextDraft);
    if (!validation.success) {
      setSaveStatus(validation.error.issues[0]?.message ?? 'This draft is not valid yet.');
      return;
    }
    try {
      const nextSessions = [validation.data, ...sessions.filter(item => item.id !== validation.data.id)];
      writeResearchSessions(archiveScope, nextSessions, identityType);
      setSessions(nextSessions);
      setDraft(createResearchSession());
      form.reset({ text: '', domain: 'celestial-exploration', intent: 'research-message', symbolDurationMs: '75', outputLevel: '0.04' });
      setAuthorized(false);
      setSaveStatus('Session saved in this browser only.');
    } catch (cause) {
      setSaveStatus(cause instanceof Error ? cause.message : 'Could not save this session. Check browser storage and retry.');
    }
  };
  const addManualNote = () => {
    const note = observationNote.trim();
    if (!note) return;
    patchDraft({
      findings: [...draft.findings, {
        statement: note.slice(0, 1000),
        basis: 'User-authored manual note; not an instrument measurement or inferred response.',
        confidence: 'low',
        createdAt: new Date().toISOString(),
      }],
    });
    setObservationNote('');
  };
  const deleteSession = (id: string) => {
    if (!window.confirm('Delete this local research session? This cannot be undone.')) return;
    try {
      const next = sessions.filter(item => item.id !== id);
      writeResearchSessions(archiveScope, next, identityType);
      setSessions(next);
      setSelectedIds(ids => ids.filter(value => value !== id));
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Could not delete this local session.');
    }
  };
  const comparisonAgent = researchAgentRouter.select({
    task: 'pattern-comparison',
    modalities: ['acoustic'],
    maxCostUsd: 0,
  });
  const compared = comparisonAgent
    ? summarizeResearchPatterns(sessions.filter(item => selectedIds.includes(item.id)))
    : null;
  const canGenerate = Boolean(text.trim()) && byteCount(text) <= CELESTIAL_MAX_MESSAGE_BYTES;

  return <div className="lab-shell cex-shell">
    <header className="topbar">
      <Link href="/" className="brand-lockup" data-testid="link-exploration-home">
        <span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span>
        <span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className="nav-link" data-testid="link-live-lab">Live lab</Link>
        <Link href="/history" className="nav-link" data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
        <span className="nav-link active" aria-current="page">Exploration</span>
        <Link href="/genesis" className="nav-link genesis-nav-link" data-testid="link-genesis">Genesis</Link>
        {ownerEmail && <span className="nav-account" data-testid="text-exploration-account">{ownerEmail}</span>}
      </nav>
    </header>

    <main className="page-wrap cex-page">
      <div className="cex-hero">
        <div>
          <div className="eyebrow">Research session / 01</div>
          <h1 className="page-title">{selectedDomain?.label ?? 'Research Exploration'}.</h1>
          <p className="lead">{selectedDomain?.description} Current instruments remain symbolic text, local speaker output, and microphone acoustics; they do not identify a domain source.</p>
        </div>
        <aside className="cex-privacy" data-testid="notice-local-privacy">
          <ShieldCheck size={18} />
          <div><strong>{identityType === 'anonymous-browser' ? 'Free visitor browser archive' : 'Account-scoped browser archive'}</strong><p>Sessions stay in this browser under {identityType === 'anonymous-browser' ? 'this visitor profile' : 'your signed-in account'}. Browser storage is not encrypted and may be visible to other people using this browser profile. Avoid sensitive family details. Raw audio is never saved; no cloud or AI calls are made.</p></div>
        </aside>
      </div>

      {storageError && <div className="cex-alert" role="alert" data-testid="status-storage-error"><AlertTriangle size={17} /><span>{storageError}</span><button className="cex-text-button" onClick={loadHistory} data-testid="button-retry-history">Retry history</button></div>}

      <section className="cex-step">
        <div className="cex-step-index">01</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Compose & encode</div><h2>Your words, as a test signal.</h2></div><span className="cex-protocol-tag">{CELESTIAL_PROTOCOL_ID}</span></div>
          <div className="panel cex-panel">
            <Form {...form}>
              <form onSubmit={generatePreview}>
                <div className="cex-form-grid">
                  <FormField control={form.control} name="text" render={({ field }) => <FormItem className="cex-message-field">
                    <FormLabel>Research message or prayer</FormLabel>
                    <FormControl><textarea {...field} className="text-control cex-message" maxLength={CELESTIAL_MAX_MESSAGE_BYTES} placeholder="Write a short, human-authored message…" data-testid="input-research-message" /></FormControl>
                    <div className="cex-field-foot"><FormDescription>UTF-8 text encoded locally; no claim of external contact.</FormDescription><span className="mono" data-testid="value-message-bytes">{byteCount(text)} / {CELESTIAL_MAX_MESSAGE_BYTES} bytes</span></div>
                    <FormMessage />
                  </FormItem>} />
                  <div className="cex-controls">
                    <FormField control={form.control} name="domain" render={({ field }) => <FormItem>
                      <FormLabel>Research domain</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-research-domain">{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.label}</option>)}</select></FormControl>
                      <FormDescription>{selectedDomain?.description ?? 'Choose a registered research framing.'}</FormDescription>
                    </FormItem>} />
                    <FormField control={form.control} name="intent" render={({ field }) => <FormItem>
                      <FormLabel>Message type</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-message-intent"><option value="research-message">Research message</option><option value="prayer">Prayer</option></select></FormControl>
                    </FormItem>} />
                    <FormField control={form.control} name="symbolDurationMs" render={({ field }) => <FormItem>
                      <FormLabel>Symbol timing</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-symbol-duration">{CELESTIAL_SYMBOL_DURATION_OPTIONS.map(value => <option key={value} value={value}>{value} ms per symbol</option>)}</select></FormControl>
                    </FormItem>} />
                    <FormField control={form.control} name="outputLevel" render={({ field }) => <FormItem>
                      <FormLabel>Speaker level</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-output-level">{CELESTIAL_OUTPUT_LEVEL_OPTIONS.filter(value => value <= 0.08).map(value => <option key={value} value={value}>{Math.round(value * 100)}% low output</option>)}</select></FormControl>
                      <FormDescription>Limited to a conservative level.</FormDescription>
                    </FormItem>} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary cex-generate" disabled={!canGenerate} data-testid="button-generate-preview"><AudioLines size={16} />Generate inspectable preview</button>
              </form>
            </Form>
            {signalError && <div className="cex-inline-error" role="alert" data-testid="status-encoding-error">{signalError}</div>}
            {draft.signal ? <div className="cex-signal-preview" data-testid="panel-signal-preview">
              <div className="cex-preview-top"><div><span className="cex-overline">Encoded packet</span><strong>{draft.signal.symbols.length} symbols</strong></div><span className="cex-check"><Check size={13} />CRC-16 / {draft.signal.checksum.toString(16).toUpperCase().padStart(4, '0')}</span></div>
              <div className="cex-symbols" aria-label="Encoded tone-symbol sequence" data-testid="value-tone-symbols">{draft.signal.symbols.slice(0, 68).map((symbol, index) => <span key={`${index}-${symbol}`} title={`Symbol ${index + 1}: ${symbol}`} className={`cex-symbol ${index < 4 ? 'sync' : ''}`}>{symbol.toString(16).toUpperCase()}</span>)}{draft.signal.symbols.length > 68 && <span className="cex-symbol-more">+{draft.signal.symbols.length - 68} more</span>}</div>
              <div className="cex-signal-meta"><span>{draft.signal.payloadByteLength} payload bytes</span><span>{draft.signal.durationSeconds.toFixed(2)} sec</span><span>4 × 4 dual-tone / {draft.signal.sampleRateHz.toLocaleString()} Hz</span><span>Carrier pair map: {draft.signal.carrierFrequenciesHz.slice(0, 4).join(' / ')} + {draft.signal.carrierFrequenciesHz.slice(4).join(' / ')} Hz</span></div>
              <div className="cex-authorize">
                <label className="cex-consent"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} data-testid="checkbox-authorize-playback" /><span><strong>I authorize local-speaker playback</strong><small>This plays only the encoded packet on this device. It does not contact or signal an external intelligence.</small></span></label>
                 {!playing ? <button className="btn btn-primary cex-play" onClick={() => void startPlayback()} disabled={!authorized || !previewIsCurrent || engine.running || engine.starting} data-testid="button-play-packet"><Play size={15} />Play packet</button> : <button className="btn btn-stop cex-play" onClick={stopPlayback} data-testid="button-stop-packet"><Square size={14} fill="currentColor" />Stop playback</button>}
              </div>
               {draft.signal && !previewIsCurrent && <p className="cex-status" role="status" data-testid="status-stale-preview">Message or encoding settings changed. Generate a fresh preview before playback.</p>}
              {playbackStatus && <p className="cex-status" role="status" data-testid="status-playback">{playbackStatus}</p>}
              {playbackError && <p className="cex-inline-error" role="alert" data-testid="status-playback-error">{playbackError}</p>}
            </div> : <div className="cex-preview-empty"><AudioLines size={18} /><span>Generate a preview to inspect the exact tone-symbol packet before choosing whether to play it.</span></div>}
          </div>
          <p className="cex-caution"><Info size={14} />This encoding is an experimental data representation, not a transmission to space and not evidence of a reply.</p>
        </div>
      </section>

      <section className="cex-step">
        <div className="cex-step-index">02</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Optional observation</div><h2>Listen after the pattern.</h2></div><span className={`cex-capture-state ${engine.running ? 'active' : ''}`} data-testid="status-capture"><i />{engine.running ? 'Mic active' : 'Standby'}</span></div>
          <div className="cex-observe-grid">
            <div className="panel cex-panel cex-observe-panel">
              <div className="cex-capture-copy"><div className="cex-icon-disc"><Mic size={17} /></div><div><h3>Local microphone window</h3><p>{engine.error || engine.status}</p></div></div>
              <div className="cex-instrument-status" data-testid="panel-instrument-status">
                <div><span>Instrument</span><strong>{engine.instrumentDiscovery?.instrument.name ?? 'Browser microphone'}</strong></div>
                <div><span>Operational status</span><strong data-testid="value-instrument-status">{(engine.instrumentDiscovery?.status ?? 'checking').replaceAll('-', ' ')}</strong></div>
                <p>Audio inputs found: {engine.instrumentDiscovery?.availableInputCount ?? 'not reported'} · calibration: {engine.instrumentDiscovery?.instrument.calibration.status ?? 'pending'}. Device labels and identifiers are not collected.</p>
              </div>
              {instrumentRegistry.list().some(instrument => instrument.sourceType === 'simulated') && <p className="cex-simulator-note" data-testid="notice-development-simulator">Development-only synthetic test source is registered. It is not connected to microphone capture and cannot be saved as a live measurement.</p>}
              {engine.reading && <div className="cex-reading-grid" data-testid="panel-live-summary">
                <div><span>Dominant peak</span><strong data-testid="value-observation-dominant">{engine.reading.dominant == null ? 'No clear peak' : `${engine.reading.dominant.toFixed(1)} Hz`}</strong></div>
                <div><span>RMS level</span><strong data-testid="value-observation-rms">{engine.reading.rms.toFixed(4)}</strong></div>
                <div><span>Sample / FFT</span><strong data-testid="value-observation-sample">{engine.reading.sampleRate.toLocaleString()} / {engine.reading.fftSize.toLocaleString()}</strong></div>
              </div>}
              <label className="cex-label" htmlFor="observation-note">Manual observation note</label>
              <textarea id="observation-note" className="text-control cex-note" maxLength={2000} value={observationNote} onChange={event => setObservationNote(event.target.value)} placeholder="Room conditions, device placement, or what you noticed…" data-testid="input-observation-note" />
               {!engine.running && !engine.starting && <button className="btn btn-subtle cex-note-add" onClick={addManualNote} disabled={!observationNote.trim() || playing} data-testid="button-add-manual-note"><Check size={14} />Add note to session</button>}
               {engine.starting && !engine.reading
                 ? <button className="btn btn-stop cex-capture-button" onClick={() => void engine.stop('Capture cancelled. No audio was saved.')} data-testid="button-cancel-capture"><Square size={14} fill="currentColor" />Cancel microphone request</button>
                 : engine.running
                   ? <button className="btn btn-stop cex-capture-button" onClick={() => void addObservation()} disabled={!engine.reading} data-testid="button-stop-capture"><Square size={14} fill="currentColor" />Stop & add summary</button>
                   : <button className="btn btn-primary cex-capture-button" onClick={() => void engine.start()} disabled={playing} data-testid="button-start-capture"><Mic size={15} />Start microphone observation</button>}
              <p className="permission-note">Microphone permission begins only after you start. Analysis stays in memory in this tab; only summary values and your note can be added to the session.</p>
              {engine.error && <p className="cex-inline-error" role="alert" data-testid="status-microphone-error">{engine.error}</p>}
            </div>
            <aside className="cex-instrument-note">
              <div className="eyebrow">What this sensor measures</div>
              <p>A microphone measures audible sound pressure at the device. It cannot receive radio-frequency signals or identify a source.</p>
              <div className="cex-note-rule" />
              <p className="cex-small">A sound after playback is an observation, not a decoded response. Timing alone cannot establish communication.</p>
            </aside>
          </div>
              {draft.observations.length > 0 && <div className="cex-observation-list" data-testid="list-observations">{draft.observations.map((item, index) => <div className="cex-observation-row" key={item.id} data-testid={`row-observation-${item.id}`}><Activity size={15} /><span><strong>Window {index + 1}</strong><small>{item.dominantFrequencyHz == null ? 'No dominant peak' : `${item.dominantFrequencyHz.toFixed(1)} Hz dominant`} · {item.window.durationSeconds.toFixed(1)} sec</small></span><span className="mono">RMS {item.rmsLevel.toFixed(4)}</span></div>)}</div>}
        </div>
      </section>

      <section className="cex-step">
        <div className="cex-step-index">03</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Interpret carefully</div><h2>Keep the record in separate layers.</h2></div></div>
          <div className="cex-interpret-grid">
            <div className="panel cex-panel cex-interpret-card">
              <div className="cex-card-label"><span className="cex-layer-mark measured" />Measured pattern <small>describe observations, not a source</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.measuredPattern ?? ''} onChange={event => updateInterpretation('measuredPattern', event.target.value)} maxLength={1500} placeholder="What did the instrument record?" data-testid="input-measured-pattern" />
            </div>
            <div className="panel cex-panel cex-interpret-card">
              <div className="cex-card-label"><span className="cex-layer-mark uncertain" />Uncertainty <small>limits, alternatives, missing context</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.uncertainty ?? ''} onChange={event => updateInterpretation('uncertainty', event.target.value)} maxLength={1500} placeholder="What remains unknown or could explain it?" data-testid="input-uncertainty" />
            </div>
            <div className="panel cex-panel cex-interpret-card cex-reflection-card">
              <div className="cex-card-label"><span className="cex-layer-mark reflection" />Personal reflection <small>meaning is yours; not a sensor output</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.personalReflection ?? ''} onChange={event => updateInterpretation('personalReflection', event.target.value)} maxLength={1500} placeholder="What does this experience mean to you personally?" data-testid="input-personal-reflection" />
            </div>
          </div>
          <div className="panel cex-panel cex-hypothesis">
            <div className="cex-hypothesis-heading"><div><div className="eyebrow">User-authored hypothesis</div><h3>A question to revisit—not a conclusion.</h3></div><select className="select-control cex-status-select" value={draft.hypothesis?.status ?? 'open'} onChange={event => updateHypothesis('status', event.target.value)} data-testid="select-hypothesis-status"><option value="open">Open</option><option value="tentative">Tentative</option><option value="not-observed">Not observed</option></select></div>
            <textarea className="text-control cex-note" value={draft.hypothesis?.statement ?? ''} onChange={event => updateHypothesis('statement', event.target.value)} maxLength={1200} placeholder="What do you predict or wonder about this observation?" data-testid="input-hypothesis" />
          </div>
        </div>
      </section>

      <section className="cex-savebar">
        <div><div className="eyebrow">Your browser / account-scoped record</div><p>Save this session locally when you are ready. Nothing is added automatically.</p>{saveStatus && <span className={saveStatus.includes('saved') ? 'cex-save-success' : 'cex-save-error'} role="status" data-testid="status-session-save">{saveStatus}</span>}</div>
        <button className="btn btn-primary cex-save-button" onClick={saveSession} disabled={!loaded} data-testid="button-save-session"><Save size={15} />Save session locally</button>
      </section>

      <section className="cex-history">
        <div className="cex-history-head"><div><div className="eyebrow">Local archive</div><h2>Research sessions</h2></div><button className="btn btn-subtle" onClick={() => downloadJson('zioncore-celestial-sessions.json', sessions)} disabled={!sessions.length} data-testid="button-export-sessions"><Download size={14} />Export JSON</button></div>
        {loaded && sessions.length === 0 ? <div className="panel cex-empty" data-testid="status-empty-history"><span className="empty-glyph"><Radio size={22} /></span><h3>No saved sessions yet.</h3><p>Completed sessions appear here only after you save them to this browser.</p></div>
          : sessions.length > 0 && <div className="cex-archive">
             <div className="cex-compare-banner"><div><strong>Compare measured summaries</strong><p>{comparisonAgent ? `${comparisonAgent.label} runs locally at an estimated $0 cost. ` : 'No compatible agent fits the current budget. ' }Select records below to compare microphone observations. Statistics do not identify a source or establish a reply.</p></div>{compared && <div className="cex-compare-stats" data-testid="panel-comparison-summary"><span><strong>{compared.observationCount}</strong> windows</span><span><strong>{compared.sessionsWithObservations}</strong> sessions</span><span><strong>{compared.medianDominantFrequencyHz == null ? '—' : `${compared.medianDominantFrequencyHz.toFixed(1)} Hz`}</strong> median peak</span><span><strong>{compared.meanRmsLevel.toFixed(4)}</strong> mean RMS</span></div>}</div>
            {sessions.map(session => <article className="panel cex-session-card" key={session.id} data-testid={`card-session-${session.id}`}>
              <div className="cex-session-main"><label className="cex-select-session"><input type="checkbox" checked={selectedIds.includes(session.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, session.id] : current.filter(id => id !== session.id))} data-testid={`checkbox-compare-${session.id}`} /><span className="sr-only">Compare session {session.id}</span></label>
                 <div className="cex-session-info"><span className="cex-session-date">{new Date(session.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><h3>{session.message.text || 'Untitled research session'}</h3><p>{researchGridRegistry.getDomain(session.domain)?.label ?? session.domain} · {session.message.intent === 'prayer' ? 'Prayer' : 'Research message'} · {session.signal ? `${session.signal.symbols.length} symbols` : 'No encoded signal'} · {session.observations.length} mic {session.observations.length === 1 ? 'window' : 'windows'}</p></div>
                <button className="cex-icon-button" onClick={() => deleteSession(session.id)} aria-label="Delete session" data-testid={`button-delete-session-${session.id}`}><Trash2 size={15} /></button>
              </div>
              <details className="cex-details"><summary data-testid={`button-review-session-${session.id}`}>Review session</summary><div className="cex-detail-content">
                <div className="cex-detail-row"><span>Protocol</span><strong>{session.encoding.protocolId} · {session.encoding.symbolDurationMs} ms · {Math.round(session.encoding.outputLevel * 100)}% level</strong></div>
                {session.signal && <div className="cex-detail-row"><span>Signal</span><strong>{session.signal.durationSeconds.toFixed(2)} sec · checksum {session.signal.checksum.toString(16).toUpperCase().padStart(4, '0')}</strong></div>}
                {session.transmission && <div className="cex-detail-row"><span>Playback</span><strong>{session.transmission.stoppedEarly ? 'Stopped early' : session.transmission.completedAt ? 'Completed locally' : 'Authorized; completion not recorded'}</strong></div>}
                {session.observations.map(observation => <div className="cex-saved-observation" key={observation.id}><span>{observation.dominantFrequencyHz == null ? 'No dominant peak' : `${observation.dominantFrequencyHz.toFixed(1)} Hz`} · RMS {observation.rmsLevel.toFixed(4)} · {observation.window.durationSeconds.toFixed(1)} sec</span>{observation.notes && <p>{observation.notes}</p>}</div>)}
                {session.hypothesis?.statement && <p className="cex-saved-reflection"><b>Hypothesis · {session.hypothesis.status}:</b> {session.hypothesis.statement}</p>}
                {session.findings.map((finding, index) => <p className="cex-saved-reflection" key={`${finding.createdAt}-${index}`}><b>Manual note:</b> {finding.statement}</p>)}
                {session.interpretation && <div className="cex-saved-layers"><p><b>Measured:</b> {session.interpretation.measuredPattern || '—'}</p><p><b>Uncertainty:</b> {session.interpretation.uncertainty || '—'}</p><p><b>Reflection:</b> {session.interpretation.personalReflection || '—'}</p></div>}
              </div></details>
            </article>)}
          </div>}
        <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />This experimental archive is stored only in your browser, separated by signed-in account but not encrypted. Browser storage may be cleared by device settings; export a JSON copy if you need a separate record.</p>
      </section>
    </main>
  </div>;
}
