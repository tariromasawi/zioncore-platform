import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, RefreshCw, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { compareObservations, discoveryLenses, type DiscoveryLens } from '@/lib/discovery-engine';
import { readObservationArchive, type Observation } from '@/lib/observations';
import {
  appendResearchExperiment,
  createObservationComparisonExperiment,
  readResearchExperimentArchive,
  ResearchExperimentStorageError,
} from '@/lib/research-experiments';

type ResearchExperiment = ReturnType<typeof createObservationComparisonExperiment>;

const lensLabels: Record<DiscoveryLens, string> = {
  human: 'Human communication',
  animal: 'Animal intelligence',
  environment: 'Environmental patterns',
  spiritual: 'Spiritual exploration',
  celestial: 'Celestial inquiry',
  unknown: 'Unknown signal',
};

function formatFrequency(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'No dominant peak';
  return value >= 1_000 ? `${(value / 1_000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Unknown capture time';
}

function downloadJson(data: unknown, prefix = 'zioncore-signal-comparison') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function DiscoveryStudio() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [archiveIssue, setArchiveIssue] = useState('');
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [lens, setLens] = useState<DiscoveryLens>('unknown');
  const [refreshCount, setRefreshCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [hypothesis, setHypothesis] = useState('');
  const [researchExperiments, setResearchExperiments] = useState<ResearchExperiment[]>([]);
  const [researchArchiveIssue, setResearchArchiveIssue] = useState('');
  const [researchArchiveStatus, setResearchArchiveStatus] = useState<'ready' | 'damaged' | 'unavailable'>('ready');
  const [researchSaving, setResearchSaving] = useState(false);
  const [researchSaveError, setResearchSaveError] = useState('');
  const [researchSaveStatus, setResearchSaveStatus] = useState('');

  useEffect(() => {
    const archive = readObservationArchive();
    setObservations(archive.items);
    setArchiveIssue(archive.status === 'damaged' ? archive.issue : '');
    setFirstId(current => current && archive.items.some(item => item.id === current)
      ? current : archive.items[0]?.id ?? '');
    setSecondId(current => current && archive.items.some(item => item.id === current)
      ? current : archive.items.find(item => item.id !== (archive.items[0]?.id ?? ''))?.id ?? '');
    const researchArchive = readResearchExperimentArchive();
    setResearchExperiments(researchArchive.items);
    setResearchArchiveStatus(researchArchive.status);
    setResearchArchiveIssue(researchArchive.status === 'ready' ? '' : researchArchive.issue);
    setReady(true);
  }, [refreshCount]);

  const first = observations.find(item => item.id === firstId);
  const second = observations.find(item => item.id === secondId);
  const comparison = useMemo(
    () => first && second ? compareObservations(first, second, lens) : null,
    [first, second, lens],
  );

  const refresh = () => {
    setReady(false);
    setRefreshCount(value => value + 1);
  };

  const saveResearchRecord = async () => {
    if (!first || !second || !comparison?.success || hypothesis.trim().length < 3) return;
    setResearchSaving(true);
    setResearchSaveError('');
    setResearchSaveStatus('');
    try {
      const record = createObservationComparisonExperiment({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        hypothesis,
        first,
        second,
        comparison: comparison.data,
      });
      const next = await appendResearchExperiment(record);
      setResearchExperiments(next);
      setResearchArchiveStatus('ready');
      setResearchArchiveIssue('');
      setResearchSaveStatus('Saved privately in this browser. The record contains your hypothesis and measurement metadata, not audio or observation notes.');
    } catch (cause) {
      setResearchSaveError(
        cause instanceof ResearchExperimentStorageError
          ? cause.message
          : 'The research record could not be saved. Your existing records were left unchanged.',
      );
    } finally {
      setResearchSaving(false);
    }
  };

  return <section className="zds-shell" aria-labelledby="zds-title" data-testid="section-discovery-studio">
    <div className="zds-heading">
      <div>
        <span className="zg-kicker"><Sparkles size={13} /> Local pattern research / v1</span>
        <h2 id="zds-title">Compare what you measured.</h2>
        <p>Choose two saved captures and a research lens. ZionCore compares their recorded peaks and settings on this device, then suggests a repeatable next experiment.</p>
      </div>
      <button className="btn btn-subtle" type="button" onClick={refresh} data-testid="button-refresh-discovery">
        <RefreshCw size={14} /> Refresh captures
      </button>
    </div>

    {archiveIssue && <div className="zds-notice" role="status" data-testid="status-discovery-archive">
      Some saved history is unreadable. This tool uses only the readable measurements and does not change your archive.
    </div>}
    {researchArchiveIssue && <div className="zds-record-message is-error" role="status" data-testid="status-research-archive">
      {researchArchiveIssue}
    </div>}

    {!ready ? <div className="zds-empty" role="status">Checking local captures…</div>
      : observations.length < 2 ? <div className="zds-empty" data-testid="empty-discovery-captures">
        <strong>Two saved captures open the comparison studio.</strong>
        <p>Make a capture in the live lab, save it, then repeat under a condition you want to compare.</p>
        <Link href="/" className="btn btn-primary"><ArrowRight size={14} /> Open the live lab</Link>
      </div> : <>
        <div className="zds-controls">
          <label><span>Baseline capture</span>
            <select value={firstId} onChange={event => setFirstId(event.target.value)} data-testid="select-discovery-baseline">
              {observations.map(item => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {formatFrequency(item.dominantFrequencyHz)}</option>)}
            </select>
          </label>
          <label><span>Compare with</span>
            <select value={secondId} onChange={event => setSecondId(event.target.value)} data-testid="select-discovery-followup">
              {observations.map(item => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {formatFrequency(item.dominantFrequencyHz)}</option>)}
            </select>
          </label>
          <label><span>Exploration lens</span>
            <select value={lens} onChange={event => setLens(event.target.value as DiscoveryLens)} data-testid="select-discovery-lens">
              {discoveryLenses.map(item => <option key={item} value={item}>{lensLabels[item]}</option>)}
            </select>
          </label>
        </div>

        {!first || !second ? <div className="zds-empty" role="status">Choose two saved captures to begin.</div>
          : !comparison ? null
            : !comparison.success ? <div className="zds-notice" role="alert">{comparison.error}</div>
              : <div className="zds-result" data-testid="result-discovery-comparison">
                <div className="zds-result-top">
                  <div><span className="zds-result-label">Comparison finding</span><strong>{comparison.data.finding === 'repeatable-pattern' ? 'A repeatable peak pattern' : comparison.data.finding === 'insufficient-data' ? 'More signal data needed' : 'A changed or ambiguous pattern'}</strong></div>
                  <button className="btn btn-subtle" type="button" onClick={() => downloadJson({
                    product: 'ZionCore',
                    comparison: comparison.data,
                    privacy: 'Local export of measurement metadata only; no audio, private notes, or provider-generated content is included.',
                  })} data-testid="button-export-discovery">
                    <Download size={14} /> Export comparison
                  </button>
                </div>
                <p className="zds-summary">{comparison.data.summary}</p>
                <div className="zds-metrics">
                  <div><span>Baseline peak</span><strong>{formatFrequency(comparison.data.first.dominantFrequencyHz)}</strong></div>
                  <div><span>Later peak</span><strong>{formatFrequency(comparison.data.second.dominantFrequencyHz)}</strong></div>
                  <div><span>Peak shift</span><strong>{comparison.data.dominantShiftHz == null ? '—' : `${comparison.data.dominantShiftHz > 0 ? '+' : ''}${comparison.data.dominantShiftHz.toFixed(1)} Hz`}</strong></div>
                  <div><span>Nearby peaks</span><strong>{comparison.data.matchedPeaksHz.length} · within {comparison.data.peakMatchToleranceHz.toFixed(2)} Hz</strong></div>
                </div>
                <div className="zds-settings">
                  <span>{(comparison.data.first.sampleRate / 1_000).toFixed(1)} kHz / FFT {comparison.data.first.fftSize.toLocaleString()} / {comparison.data.first.mode}</span>
                  <span>{comparison.data.setupComparable ? 'Same recorded settings' : `Different: ${comparison.data.setupDifferences.join(', ')}`}</span>
                </div>
                <div className="zds-next">
                  <strong>Next experiment · {lensLabels[lens]}</strong>
                  <ol>{comparison.data.nextExperiments.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol>
                </div>
                <div className="zds-record-form">
                  <label htmlFor="zds-hypothesis">Your research hypothesis</label>
                  <textarea
                    id="zds-hypothesis"
                    value={hypothesis}
                    onChange={event => {
                      setHypothesis(event.target.value);
                      setResearchSaveError('');
                      setResearchSaveStatus('');
                    }}
                    maxLength={500}
                    placeholder="What pattern do you want to investigate? Keep this as a question or hypothesis."
                    data-testid="input-research-hypothesis"
                  />
                  <p>Saving is optional and local to this browser profile. ZionCore stores your hypothesis and derived measurements only; it does not upload audio, notes, or this record, and it does not train a model.</p>
                  <button
                    className="btn btn-subtle"
                    type="button"
                    onClick={() => void saveResearchRecord()}
                    disabled={researchSaving || researchArchiveStatus !== 'ready' || hypothesis.trim().length < 3}
                    data-testid="button-save-research-record"
                  >
                    {researchSaving ? 'Saving locally…' : 'Save private research record'}
                  </button>
                  {researchSaveError && <div className="zds-record-message is-error" role="alert" data-testid="status-research-save-error">{researchSaveError}</div>}
                  {researchSaveStatus && <div className="zds-record-message" role="status" data-testid="status-research-save">{researchSaveStatus}</div>}
                </div>
              </div>}
      </>}

    {researchExperiments.length > 0 && <section className="zds-record-list" aria-labelledby="zds-records-title" data-testid="section-saved-research-records">
      <div className="zds-record-list-heading">
        <div><strong id="zds-records-title">Your local research records</strong><span>{researchExperiments.length} / 100 saved in this browser profile</span></div>
        <button
          className="btn btn-subtle"
          type="button"
          onClick={() => downloadJson({
            product: 'ZionCore',
            records: researchExperiments,
            privacy: 'User-requested local export. Records contain hypotheses and derived measurement metadata, not raw audio or saved observation notes.',
          }, 'zioncore-research-archive')}
          data-testid="button-export-research-archive"
        >
          <Download size={14} /> Export records
        </button>
      </div>
      <ul>
        {researchExperiments.slice(0, 5).map(experiment => (
          <li key={experiment.id}>
            <div><strong>{experiment.hypothesis.statement}</strong><span>{experiment.domainId} · {formatDate(experiment.createdAt)} · unverified hypothesis</span></div>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => downloadJson({
                product: 'ZionCore',
                record: experiment,
                privacy: 'User-requested local export. This record contains derived measurement metadata, not raw audio or saved observation notes.',
              }, 'zioncore-research-record')}
              aria-label={`Export research record: ${experiment.hypothesis.statement}`}
            >
              <Download size={13} /> Export
            </button>
          </li>
        ))}
        {researchExperiments.length > 5 && <li className="zds-record-list-more">Showing the five latest records. Export the archive to download all {researchExperiments.length}.</li>}
      </ul>
    </section>}

    <p className="zds-privacy">Runs in this browser using saved measurement metadata. It does not upload audio, notes, or comparisons, call an AI provider, alter history, or change account credits. A pattern comparison describes the selected recordings; it does not identify a source.</p>
  </section>;
}
