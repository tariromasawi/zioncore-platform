import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight, Cpu, Download, Search, ShieldCheck, FlaskConical, Bookmark, GitCompare, Trash2, NotebookPen, Sparkles, X,
} from 'lucide-react';
import type { FreeListeningInput } from '@/lib/free-listening';
import {
  FRONTIER_TOOLS, DISCOVERY_STATES, buildFrontierReport, compareFrontierCaptures, createFrontierExperiment,
  type FrontierToolId, type ReportedFeeling, type DiscoveryState, type FrontierReport,
} from '@/lib/frontier-discovery';
import { readResearchExperimentArchive, appendResearchExperiment, removeResearchExperiment } from '@/lib/research-experiments';
import { getLocalAIAvailability, generateLocalDiscoveryInsight } from '@/lib/local-discovery-ai';
import SpaceWeatherContext from './space-weather-context';
import ResponseProductAccess from './response-product-access';
import ComprehensiveListeningReport from './comprehensive-listening-report';
import LocalAISetup from './local-ai-setup';
import { buildListeningDossier } from '@/lib/listening-dossier';

const MAX_CONTEXT = 300;
const FEELINGS: ReportedFeeling[] = ['unspecified', 'uplifting', 'unsettled', 'neutral'];
const LENS_FILTERS = ['all', 'environment', 'animal', 'spiritual', 'celestial'] as const;
type LensFilter = typeof LENS_FILTERS[number];
type AIState = 'checking' | 'available' | 'downloadable' | 'downloading' | 'unavailable';
type Insight = { reflection: string; question: string; nextStep: string; model: string };

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fmtHz = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? 'unavailable' : `${v.toFixed(1)} Hz`);
const fmtNum = (v: number | null | undefined, d = 3) => (v == null || !Number.isFinite(v) ? 'unavailable' : v.toFixed(d));
const errText = (e: unknown) => (e instanceof Error ? e.message : 'The action failed. Nothing was changed.');

export default function FreeListeningPanel({ input, userUid = null, hasPaidInterpretation = false }: {
  input: FreeListeningInput | null; userUid?: string | null; hasPaidInterpretation?: boolean;
}) {
  useEffect(() => {
    if (window.location.hash !== '#free-reading') return;
    const frame = requestAnimationFrame(() => document.getElementById('free-reading')?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [toolId, setToolId] = useState<FrontierToolId>('acoustic');
  const [query, setQuery] = useState('');
  const [lensFilter, setLensFilter] = useState<LensFilter>('all');
  const [context, setContext] = useState('');
  const [feeling, setFeeling] = useState<ReportedFeeling>('unspecified');
  const [hypothesis, setHypothesis] = useState('');
  const [planOpen, setPlanOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [baseline, setBaseline] = useState<FreeListeningInput | null>(null);
  const [comparison, setComparison] = useState<ReturnType<typeof compareFrontierCaptures> | null>(null);
  const [compareError, setCompareError] = useState('');
  const [exported, setExported] = useState('');
  const ids = { ctx: useId(), hyp: useId(), search: useId(), draft: useId(), ev: useId(), state: useId(), consent: useId() };

  const report = useMemo<FrontierReport | null>(() => {
    if (!input) return null;
    try { return buildFrontierReport(input, { toolId, context, feeling, hypothesis }); } catch { return null; }
  }, [input, toolId, context, feeling, hypothesis]);
  const reportError = input && !report ? 'This capture could not be measured reliably. Try a new capture.' : '';
  const tool = FRONTIER_TOOLS.find(t => t.id === toolId)!;

  const visibleTools = FRONTIER_TOOLS.filter(t =>
    (lensFilter === 'all' || t.lens === lensFilter) &&
    (`${t.title} ${t.description} ${t.output}`.toLowerCase().includes(query.trim().toLowerCase())));

  // Response draft follows report message until edited
  const draftTouched = useRef(false);
  useEffect(() => { if (!draftTouched.current && report) setDraft(report.message); }, [report?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Notebook ---------- */
  const [archive, setArchive] = useState(() => readResearchExperimentArchive());
  const [state, setState] = useState<DiscoveryState>('Observed');
  const [evidence, setEvidence] = useState('');
  const [parentId, setParentId] = useState('');
  const [nbMsg, setNbMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const records = archive.items.filter(r => r.provenance.algorithmVersion === 'frontier-discovery-v1');
  const advanced = DISCOVERY_STATES.indexOf(state) >= 4;

  const saveRecord = async () => {
    if (!input || !report) return;
    setNbMsg(null); setBusy(true);
    try {
      const record = createFrontierExperiment(input, report, {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(), state, evidence, parentId: parentId || undefined,
      });
      await appendResearchExperiment(record);
      setArchive(readResearchExperimentArchive());
      setNbMsg({ kind: 'ok', text: parentId ? 'Revision saved as a new record. The earlier record is unchanged.' : 'Record saved to this browser.' });
      setEvidence(''); setParentId('');
    } catch (e) {
      setArchive(readResearchExperimentArchive());
      setNbMsg({ kind: 'err', text: errText(e) });
    } finally { setBusy(false); }
  };
  const deleteRecord = async (id: string) => {
    setNbMsg(null); setBusy(true);
    try {
      await removeResearchExperiment(id);
      setArchive(readResearchExperimentArchive());
      setNbMsg({ kind: 'ok', text: 'Selected local record removed.' });
      if (parentId === id) setParentId('');
    } catch (e) {
      setArchive(readResearchExperimentArchive());
      setNbMsg({ kind: 'err', text: errText(e) });
    } finally { setBusy(false); setConfirmDelete(null); }
  };

  /* ---------- Local AI ---------- */
  const [ai, setAi] = useState<AIState>('checking');
  const [consent, setConsent] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<{ insight: Insight; snapshot: FrontierReport } | null>(null);
  const [aiError, setAiError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const aiCheckRef = useRef(0);
  const recheckAI = async () => {
    const check = ++aiCheckRef.current;
    setAi('checking');
    try {
      const availability = await getLocalAIAvailability();
      if (check === aiCheckRef.current) setAi(availability);
    } catch {
      if (check === aiCheckRef.current) setAi('unavailable');
    }
  };
  useEffect(() => {
    void recheckAI();
    return () => { aiCheckRef.current++; abortRef.current?.abort(); };
  }, []);
  const hasInput = !!input;
  const source = input?.captureSource;
  useEffect(() => {
    abortRef.current?.abort(); abortRef.current = null;
    setAiResult(null); setAiError(''); setAiRunning(false);
  }, [toolId, context, feeling, hypothesis, hasInput, source]);
  const runAI = async () => {
    if (!report || !consent || aiRunning) return;
    const snapshot = structuredClone(report);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setAiRunning(true); setAiError(''); setAiResult(null); setAiProgress(null);
    try {
      const insight = await generateLocalDiscoveryInsight(snapshot, { signal: ctrl.signal, onProgress: p => setAiProgress(p) });
      if (!ctrl.signal.aborted) setAiResult({ insight, snapshot });
    } catch (e) {
      if (!ctrl.signal.aborted) setAiError(errText(e));
    } finally {
      if (abortRef.current === ctrl) { abortRef.current = null; setAiRunning(false); }
    }
  };
  const cancelAI = () => { abortRef.current?.abort(); abortRef.current = null; setAiRunning(false); setAiError('Cancelled. No result was produced.'); };

  /* ---------- Baseline ---------- */
  const takeBaseline = () => { if (input) { setBaseline(structuredClone(input)); setComparison(null); setCompareError(''); } };
  const runCompare = () => {
    if (!baseline || !input) return;
    try { setComparison(compareFrontierCaptures(baseline, input)); setCompareError(''); } catch (e) { setComparison(null); setCompareError(errText(e)); }
  };

  const exportReport = () => {
    if (!report || !input) return;
    downloadJson(`zioncore-discovery-${toolId}-${Date.now()}.json`, {
      app: 'ZionCore Frequency Lab', kind: 'frontier-discovery-report', createdAt: new Date().toISOString(),
      measurement: { dominantFrequencyHz: input.dominantFrequencyHz, rmsLevel: input.rmsLevel, sampleRate: input.sampleRate, fftSize: input.fftSize ?? null, captureSource: input.captureSource ?? null, durationSeconds: input.durationSeconds, silent: input.silent, features: input.features },
      selfReport: { feeling, context },
      report,
      comprehensiveFreeReport: buildListeningDossier(input, report, context),
      onDeviceAISnapshot: aiResult,
    });
    setExported('report'); window.setTimeout(() => setExported(''), 2400);
  };
  const exportNotebook = () => { downloadJson(`zioncore-notebook-${Date.now()}.json`, records); setExported('notebook'); window.setTimeout(() => setExported(''), 2400); };

  const f = input?.features;

  /* ---------- Tool-specific view ---------- */
  const renderToolView = () => {
    if (!report || !input) return null;
    const measuredGrid = (
      <dl className="zc-fx-grid" data-testid="grid-measurements">
        <div><dt>Dominant peak</dt><dd>{fmtHz(input.dominantFrequencyHz)}</dd></div>
        <div><dt>Relative RMS</dt><dd>{fmtNum(input.rmsLevel, 4)}</dd></div>
        <div><dt>Sample rate</dt><dd>{(input.sampleRate / 1000).toFixed(1)} kHz</dd></div>
        <div><dt>Resolution</dt><dd>{input.fftSize ? `${(input.sampleRate / input.fftSize).toFixed(2)} Hz/bin` : 'unavailable'}</dd></div>
        <div><dt>Duration</dt><dd>{input.durationSeconds.toFixed(1)} s</dd></div>
        <div><dt>Source</dt><dd>{input.captureSource === 'audio-file' ? 'Imported file' : input.captureSource === 'microphone' ? 'Microphone' : 'unknown'}</dd></div>
        <div><dt>Harmonicity</dt><dd>{fmtNum(f?.harmonicity)}</dd></div>
        <div><dt>Spectral flatness</dt><dd>{fmtNum(f?.spectralFlatness)}</dd></div>
        <div><dt>Frequency drift</dt><dd>{fmtHz(f?.dominantFrequencyDriftHz)}</dd></div>
        <div><dt>Amplitude variation</dt><dd>{fmtNum(f?.amplitudeVariationCoefficient)}</dd></div>
      </dl>
    );
    switch (toolId) {
      case 'acoustic': case 'environment': case 'animal': return measuredGrid;
      case 'harmonics': {
        const h = f?.harmonicity ?? 0, fl = f?.spectralFlatness ?? 1;
        return (<div className="zc-fx-meters">
          <Meter label="Harmonicity" value={h} note={h >= 0.45 ? 'Strong harmonic alignment' : 'Weak harmonic alignment'} />
          <Meter label="Tonal concentration (1 - flatness)" value={1 - fl} note={fl < 0.2 ? 'Concentrated, tone-like' : 'Spread, noise-like'} />
          <p className="zc-fx-note">Drift across capture: {fmtHz(f?.dominantFrequencyDriftHz)}. Peak: {fmtHz(input.dominantFrequencyHz)}.</p>
        </div>);
      }
      case 'quality': {
        const checks = [
          { ok: input.durationSeconds >= 5, label: `Duration ${input.durationSeconds.toFixed(1)} s`, tip: 'Aim for at least 5 seconds.' },
          { ok: !input.silent && input.rmsLevel >= 0.005, label: `Level ${fmtNum(input.rmsLevel, 4)}`, tip: 'Move closer or reduce background noise.' },
          { ok: input.sampleRate >= 44100, label: `Sample rate ${(input.sampleRate / 1000).toFixed(1)} kHz`, tip: 'Higher rates are needed above ~20 kHz.' },
          { ok: !!input.fftSize, label: input.fftSize ? `FFT ${input.fftSize}` : 'FFT size unknown', tip: 'Record FFT size to compare sessions.' },
        ];
        const score = checks.filter(c => c.ok).length;
        return (<div><p className="zc-fx-score" data-testid="text-quality-score">{score}/4 sufficiency checks passed</p>
          <ul className="zc-fx-checks">{checks.map((c, i) => <li key={i} className={c.ok ? 'ok' : 'warn'}><strong>{c.ok ? 'Pass' : 'Check'}</strong> {c.label}{!c.ok && <span> - {c.tip}</span>}</li>)}</ul></div>);
      }
      case 'spiritual': case 'divine': case 'guidance':
        return (<div className="zc-fx-reflect"><div className="zc-fx-tag interp">Reflection - your framework</div>
          <blockquote>{report.reading.interpretation}</blockquote><p>{report.reading.advice}</p>
          <p className="zc-fx-note">{context.trim() ? 'Shaped by the context you wrote.' : 'Add your own context above for a more personal reflection.'} Spiritual meaning is offered as reflection; the source remains an open research question.</p></div>);
      case 'vibe':
        return (<div className="zc-fx-split">
          <div><div className="zc-fx-tag self">Your self-report</div><p data-testid="text-feeling">{report.feeling}</p></div>
          <div><div className="zc-fx-tag measured">Acoustic texture</div><p>Flatness {fmtNum(f?.spectralFlatness)}, amplitude variation {fmtNum(f?.amplitudeVariationCoefficient)}, level {fmtNum(input.rmsLevel, 4)}.</p></div>
        </div>);
      case 'matrix':
        return (<div className="zc-fx-matrix">{report.matrix.map(m => (
          <div key={m.lens} className="zc-fx-cell" data-testid={`card-matrix-${m.lens}`}><div className="zc-fx-tag interp">{m.lens}</div><strong>{m.title}</strong><p>{m.interpretation}</p></div>))}</div>);
      case 'alternatives': case 'unknown': case 'celestial':
        return (<div><ol className="zc-fx-hyp">{report.hypotheses.map((h, i) => (
          <li key={i}><strong>{h.explanation}</strong><span>Test: {h.test}</span></li>))}
          <li className="zc-fx-open"><strong>Status: unclassified.</strong><span>No source is identified until measurement and control evidence support one.</span></li></ol>
          {toolId === 'celestial' && <SpaceWeatherContext />}</div>);
      case 'instruments':
        return (<div className="zc-fx-reflect"><div className="zc-fx-tag measured">Recommended instrument</div><p>{report.experiment.instrument}</p>
          <p className="zc-fx-note">Current capture: {(input.sampleRate / 1000).toFixed(1)} kHz, so the measurable ceiling is about {(input.sampleRate / 2000).toFixed(1)} kHz.</p></div>);
      case 'response':
        return (<div><label className="zc-free-label" htmlFor={ids.draft}>Response draft <span className="small-note">{draft.length}/220</span></label>
          <textarea id={ids.draft} className="text-control" maxLength={220} value={draft} onChange={e => { draftTouched.current = true; setDraft(e.target.value); }} data-testid="input-response-draft" />
          <ResponseProductAccess draft={draft} userUid={userUid} hasPaidInterpretation={hasPaidInterpretation} />
          <p className="zc-fx-note">Encoding a message is your own expression. A later sound is not evidence of a reply.</p></div>);
      case 'compare':
        return <p className="zc-fx-note">Use the baseline controls below: hold this capture, record again with matching settings, then compare.</p>;
      case 'export':
        return (<button type="button" className="btn btn-primary" onClick={exportReport} data-testid="button-export-tool"><Download size={13} /> {exported === 'report' ? 'Report downloaded' : 'Download private JSON report'}</button>);
      case 'notebook':
        return <p className="zc-fx-note">Use the notebook below to save a user-assessed record of this reading.</p>;
      case 'synthesis':
        return <p className="zc-fx-synth" data-testid="text-synthesis">{report.synthesis}</p>;
      default: return measuredGrid;
    }
  };

  return (
    <section className="panel zc-free zc-fx" id="free-reading" aria-labelledby="zc-free-title" data-testid="panel-free-reading">
      <header className="zc-free-head">
        <div>
          <div className="zc-free-kicker"><Cpu size={12} aria-hidden="true" /> Free / on this device / 19 tools</div>
          <h2 id="zc-free-title" className="zc-free-title">Discovery workbench</h2>
          <p className="zc-free-sub">Choose an instrument. Measurements, interpretations and your own reports are kept in separate, labelled layers. Nothing is uploaded or saved unless you ask.</p>
        </div>
        <span className={`zc-free-state ${report ? 'on' : ''}`} data-testid="status-free-reading"><span className="zc-free-dot" aria-hidden="true" /> {report ? 'Reading live' : 'Awaiting capture'}</span>
      </header>

      <div className="zc-fx-catalogue">
        <div className="zc-fx-filter">
          <label htmlFor={ids.search} className="zc-fx-search"><Search size={13} aria-hidden="true" />
            <input id={ids.search} type="search" placeholder="Search tools" value={query} onChange={e => setQuery(e.target.value)} data-testid="input-tool-search" /></label>
          <div className="zc-fx-chips" role="group" aria-label="Filter by lens">
            {LENS_FILTERS.map(l => <button key={l} type="button" aria-pressed={lensFilter === l} className="zc-fx-chip" onClick={() => setLensFilter(l)} data-testid={`button-filter-${l}`}>{l}</button>)}
          </div>
        </div>
        <div className="zc-fx-tools" role="radiogroup" aria-label="Discovery tools">
          {visibleTools.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={toolId === t.id} className={`zc-fx-tool lens-${t.lens}`} onClick={() => { setToolId(t.id); setPlanOpen(false); }} data-testid={`button-tool-${t.id}`}>
              <span className="zc-fx-num">{String(FRONTIER_TOOLS.findIndex(x => x.id === t.id) + 1).padStart(2, '0')}</span>
              <strong>{t.title}</strong><small>{t.description}</small>
            </button>))}
          {!visibleTools.length && <p className="empty-inline">No tool matches. Clear the search or filter.</p>}
        </div>
      </div>

      <div className={`zc-free-body${report ? ' zc-free-body-report' : ''}`}>
        <div className="zc-free-controls">
          <label className="zc-free-label" htmlFor={ids.ctx}>Your context <span className="small-note">optional / {context.length}/{MAX_CONTEXT}</span></label>
          <textarea id={ids.ctx} className="text-control zc-free-context" maxLength={MAX_CONTEXT} value={context} onChange={e => setContext(e.target.value.slice(0, MAX_CONTEXT))} placeholder="Where were you, what were you listening for, what does this moment mean to you?" data-testid="input-free-context" />
          <fieldset className="zc-fx-feel"><legend className="zc-free-label">How did it feel? (self-report)</legend>
            {FEELINGS.map(x => <button key={x} type="button" aria-pressed={feeling === x} className="zc-fx-chip" onClick={() => setFeeling(x)} data-testid={`button-feeling-${x}`}>{x}</button>)}
          </fieldset>
          <label className="zc-free-label" htmlFor={ids.hyp}>Your research question <span className="small-note">optional</span></label>
          <input id={ids.hyp} className="text-control zc-fx-input" maxLength={500} value={hypothesis} onChange={e => setHypothesis(e.target.value)} placeholder="Does this hum recur when the fridge is off?" data-testid="input-hypothesis" />
          <p className="zc-free-fine">Context and feeling stay in this tab. They are never written to the notebook, and raw audio is never stored.</p>
        </div>

        <div className="zc-free-output">
          {!report ? (
            <div className="zc-free-empty" data-testid="state-free-empty">
              <div className="zc-free-rings" aria-hidden="true"><i /><i /><i /></div>
              <h3>{reportError ? 'Capture not readable' : 'Nothing measured yet'}</h3>
              <p>{reportError || `${tool.title} is selected. Start a capture or import audio above and the reading appears here.`}</p>
              <a className="btn btn-subtle" href="#capture" data-testid="link-free-capture">Go to capture <ArrowRight size={13} aria-hidden="true" /></a>
            </div>
          ) : (
            <article className="zc-free-reading" key={toolId} data-testid="card-free-reading">
              <div className="zc-fx-toolhead"><span>{tool.output}</span><span className="mono">{tool.method}</span></div>
              <h3 className="zc-free-reading-title" data-testid="text-free-title">{tool.title}</h3>
              <p className="zc-free-summary" data-testid="text-free-summary">{report.reading.summary}</p>
              <ComprehensiveListeningReport input={input!} report={report} context={context} aiResult={aiResult} />
              <div className="zc-fx-view" data-testid={`view-tool-${toolId}`}>{renderToolView()}</div>
              {!['spiritual', 'divine', 'guidance', 'matrix'].includes(toolId) && (
                <div className="zc-free-block meaning"><div className="zc-free-tag">Interpretation / {tool.lens}</div>
                  <p data-testid="text-free-interpretation">{report.reading.interpretation}</p></div>)}

              <div className="zc-fx-actions">
                <button type="button" className="btn btn-primary" onClick={() => setPlanOpen(o => !o)} aria-expanded={planOpen} data-testid="button-investigate"><FlaskConical size={13} /> {planOpen ? 'Hide investigation' : 'Investigate further'}</button>
                <button type="button" className="btn btn-subtle" onClick={exportReport} data-testid="button-free-export"><Download size={13} /> {exported === 'report' ? 'Downloaded' : 'Export report'}</button>
              </div>
              {planOpen && (
                <div className="zc-fx-plan" data-testid="panel-investigation">
                  <h4>{report.experiment.question}</h4>
                  <p><strong>Instrument.</strong> {report.experiment.instrument}</p>
                  <div className="zc-fx-plancols">
                    <div><h5>Steps</h5><ol>{report.experiment.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
                    <div><h5>Controls</h5><ul>{report.experiment.controls.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      <h5>Possible outcomes</h5><ul>{report.experiment.outcomes.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  </div>
                </div>)}
              <details className="zc-free-details"><summary data-testid="button-free-method">Explore the method</summary>
                <p>{report.reading.method}</p><ul>{report.reading.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
            </article>
          )}
        </div>
      </div>

      <div className="zc-fx-lower">
        <section className="zc-fx-card" aria-labelledby="zc-fx-base"><h3 id="zc-fx-base"><GitCompare size={14} /> Cross-session baseline</h3>
          <p className="zc-fx-note">Held in this tab only. Match FFT size, sample rate and source before comparing.</p>
          <div className="zc-fx-actions">
            <button type="button" className="btn btn-subtle" disabled={!input} onClick={takeBaseline} data-testid="button-set-baseline"><Bookmark size={13} /> {baseline ? 'Replace baseline' : 'Hold as baseline'}</button>
            <button type="button" className="btn btn-subtle" disabled={!input || !baseline} onClick={runCompare} data-testid="button-compare">Compare current</button>
            {baseline && <button type="button" className="btn btn-subtle" onClick={() => { setBaseline(null); setComparison(null); }} data-testid="button-clear-baseline"><X size={13} /> Clear</button>}
          </div>
          {baseline && <p className="zc-fx-note" data-testid="text-baseline">Baseline: {fmtHz(baseline.dominantFrequencyHz)}, RMS {fmtNum(baseline.rmsLevel, 4)}, {(baseline.sampleRate / 1000).toFixed(1)} kHz.</p>}
          {compareError && <p className="status-box alert-box" role="alert">{compareError}</p>}
          {comparison && <dl className="zc-fx-grid" data-testid="result-comparison">
            <div><dt>Settings matched</dt><dd>{comparison.comparable ? 'yes' : 'no'}</dd></div>
            <div><dt>Peak shift</dt><dd>{comparison.frequencyDifferenceHz == null ? 'n/a' : `${comparison.frequencyDifferenceHz.toFixed(1)} Hz`}</dd></div>
            <div><dt>Level shift</dt><dd>{comparison.relativeLevelDifference.toFixed(4)}</dd></div>
            <div className="wide"><dt>Conclusion</dt><dd>{comparison.conclusion}</dd></div></dl>}
        </section>

        <section className="zc-fx-card" aria-labelledby="zc-fx-ai"><h3 id="zc-fx-ai"><Sparkles size={14} /> Optional on-device AI</h3>
          <p className="zc-fx-note" data-testid="status-local-ai">{ai === 'checking' ? 'Checking this browser...' : ai === 'available' ? 'A local model is ready in this browser.' : ai === 'downloadable' ? 'This browser can download a local model.' : ai === 'downloading' ? 'The browser is downloading its local model.' : 'Gemini Nano is not currently available here. Check the setup steps below; your complete local report still works. iPhone and Safari currently use the local rules-based fallback.'}</p>
          <LocalAISetup availability={ai} busy={aiRunning} onRecheck={() => void recheckAI()} />
          {ai !== 'unavailable' && ai !== 'checking' && (<>
            <label className="zc-fx-consent" htmlFor={ids.consent}><input id={ids.consent} type="checkbox" checked={consent} onChange={e => {
              setConsent(e.target.checked);
              if (!e.target.checked && aiRunning) cancelAI();
            }} data-testid="checkbox-ai-consent" />
              I agree my browser may download a model, and my context will be processed on this device only. No cloud fallback.</label>
            <div className="zc-fx-actions">
              <button type="button" className="btn btn-subtle" disabled={!consent || !report || aiRunning} onClick={() => void runAI()} data-testid="button-run-ai">Reflect on this snapshot</button>
              {aiRunning && <button type="button" className="btn btn-subtle" onClick={cancelAI} data-testid="button-cancel-ai">Cancel</button>}
            </div></>)}
          {aiRunning && <p className="zc-fx-note" role="status">Working locally{aiProgress != null ? ` (${Math.round(aiProgress * 100)}%)` : ''}...</p>}
          {aiError && <p className="status-box alert-box" role="alert" data-testid="text-ai-error">{aiError}</p>}
          {aiResult && <div className="zc-fx-reflect" data-testid="result-ai"><div className="zc-fx-tag interp">AI reflection / snapshot of {aiResult.snapshot.tool.title}</div>
            <p>{aiResult.insight.reflection}</p><p><strong>Question.</strong> {aiResult.insight.question}</p><p><strong>Next step.</strong> {aiResult.insight.nextStep}</p>
            <p className="small-note">Model: {aiResult.insight.model} (on-device)</p></div>}
        </section>
      </div>

      <section className="zc-fx-card zc-fx-notebook" aria-labelledby="zc-fx-nb"><h3 id="zc-fx-nb"><NotebookPen size={14} /> Research notebook <span className="small-note">{records.length} records / this browser</span></h3>
        <p className="zc-fx-note">Saves measurements, the research question and your assessment. Your context, feeling and raw audio are excluded. Local records are unencrypted and accessible to anyone using this browser profile; export or delete them here when needed.</p>
        {archive.status !== 'ready' && <p className="status-box alert-box" role="alert" data-testid="text-archive-issue">{archive.issue}</p>}
        <div className="zc-fx-nbform">
          <label className="zc-free-label" htmlFor={ids.state}>Discovery state (your assessment)</label>
          <select id={ids.state} className="select-control" value={state} onChange={e => setState(e.target.value as DiscoveryState)} data-testid="select-discovery-state">
            {DISCOVERY_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          {advanced && <p className="zc-fx-flag">USER ASSESSMENT - not a verified platform fact. Document at least 20 characters of evidence.</p>}
          <label className="zc-free-label" htmlFor={ids.ev}>Evidence <span className="small-note">{evidence.length}/500</span></label>
          <textarea id={ids.ev} className="text-control" maxLength={500} value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Repeated three times at 1 m; stopped when the pump was switched off." data-testid="input-evidence" />
          {parentId && <p className="zc-fx-note">Saving as a new revision of {parentId.slice(0, 8)}. <button type="button" className="zc-fx-textbtn" onClick={() => setParentId('')}>Cancel revision</button></p>}
          <button type="button" className="btn btn-primary" disabled={!report || busy || archive.status !== 'ready' || (advanced && evidence.trim().length < 20)} onClick={() => void saveRecord()} data-testid="button-save-record">{busy ? 'Saving...' : parentId ? 'Save revision' : 'Save record'}</button>
          {nbMsg && <p className={`status-box ${nbMsg.kind === 'err' ? 'alert-box' : ''}`} role={nbMsg.kind === 'err' ? 'alert' : 'status'} data-testid="text-notebook-status">{nbMsg.text}</p>}
        </div>
        {records.length > 0 ? (<>
          <ul className="zc-fx-records">{records.map(r => {
            const st = r.results.find(x => x.name === 'user-assessed-discovery-state')?.value;
            const prev = r.results.find(x => x.name === 'previous-revision')?.value;
            return (<li key={r.id} data-testid={`row-record-${r.id}`}>
              <div><span className="mono small-note">{new Date(r.createdAt).toLocaleString()}</span><strong>{r.hypothesis.statement}</strong>
                <span className="zc-fx-note">USER ASSESSMENT: {String(st)}{prev ? ` / revises ${String(prev).slice(0, 8)}` : ''}</span></div>
              <div className="zc-fx-actions">
                <button type="button" className="btn btn-subtle" onClick={() => setParentId(r.id)} data-testid={`button-revise-${r.id}`}>Revise</button>
                {confirmDelete === r.id ? (<>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteRecord(r.id)} data-testid={`button-confirm-delete-${r.id}`}>Confirm delete</button>
                  <button type="button" className="btn btn-subtle" onClick={() => setConfirmDelete(null)}>Keep</button></>)
                  : <button type="button" className="btn btn-subtle" aria-label="Delete record" onClick={() => setConfirmDelete(r.id)} data-testid={`button-delete-${r.id}`}><Trash2 size={13} /></button>}
              </div></li>);
          })}</ul>
          <button type="button" className="btn btn-subtle" onClick={exportNotebook} data-testid="button-export-notebook"><Download size={13} /> {exported === 'notebook' ? 'Downloaded' : 'Export notebook'}</button>
        </>) : <p className="empty-inline">No discovery records yet. Your first saved reading will appear here.</p>}
      </section>

      <footer className="zc-free-foot">
        <p><ShieldCheck size={13} aria-hidden="true" /> Measured evidence, research hypotheses and personal meaning remain distinct. Open questions can be revisited as evidence develops. Free encoding and decoding stay free.</p>
        <div className="zc-fx-paid">
          <p><strong>Go deeper (paid, optional).</strong> Subscribe on Premium for member research; buy credits separately for chargeable AI interpretations. Get a real quote in the interpretation section.</p>
          <nav className="zc-free-links" aria-label="Go deeper">
            <a href="#interpretation" className="zc-free-link" data-testid="link-free-interpretation">Get a quote <ArrowRight size={12} /></a>
            <Link href="/messages" className="zc-free-link" data-testid="link-free-messages">Free encoder <ArrowRight size={12} /></Link>
            <Link href="/premium" className="zc-free-link" data-testid="link-free-premium">Premium <ArrowRight size={12} /></Link>
            <Link href="/wallet" className="zc-free-link" data-testid="link-free-wallet">Credits <ArrowRight size={12} /></Link>
          </nav>
        </div>
      </footer>
    </section>
  );
}

function Meter({ label, value, note }: { label: string; value: number; note: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (<div className="zc-fx-meter"><div className="zc-fx-meterhead"><span>{label}</span><span className="mono">{v.toFixed(2)}</span></div>
    <div className="zc-fx-bar"><i style={{ transform: `scaleX(${v})` }} /></div><small>{note}</small></div>);
}
