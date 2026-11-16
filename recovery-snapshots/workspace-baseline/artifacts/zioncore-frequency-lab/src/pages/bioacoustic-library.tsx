import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Activity, ExternalLink, Leaf, MapPin, ShieldCheck, Square } from 'lucide-react';
import { Link } from 'wouter';
import BioacousticPlaybackPlanner from '@/components/bioacoustic-playback-planner';
import {
  clusterAcousticEvents,
  compareAcousticEventSets,
  validateBioacousticInputBudget,
  type AcousticRecordingComparison,
  type ClusteredAcousticEvents,
} from '@/lib/bioacoustic-analysis';
import { segmentWavFile, type AudioEventSegmentationResult } from '@/lib/audio-file-analysis';
import {
  BIOACOUSTIC_LIBRARY,
  filterBioacousticLibrary,
  type BioacousticLicenseCategory,
} from '@/lib/bioacoustic-library';
import './bioacoustic-library.css';

const licenseLabels: Record<BioacousticLicenseCategory, string> = {
  'recording-specific': 'Check each recording',
  'permission-required': 'Permission required',
  'safety-policy': 'Location-safety guidance',
};

function BioacousticLibraryPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<BioacousticLicenseCategory | 'all'>('all');
  const [firstFile, setFirstFile] = useState<File | null>(null);
  const [secondFile, setSecondFile] = useState<File | null>(null);
  const [results, setResults] = useState<{ first: AudioEventSegmentationResult; second?: AudioEventSegmentationResult } | null>(null);
  const [clusterCount, setClusterCount] = useState(3);
  const [clusterResult, setClusterResult] = useState<ClusteredAcousticEvents | null>(null);
  const [comparison, setComparison] = useState<AcousticRecordingComparison | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const analysisRun = useRef(0);
  const entries = useMemo(
    () => filterBioacousticLibrary(BIOACOUSTIC_LIBRARY, query, category),
    [query, category],
  );

  const clearResults = () => {
    analysisRun.current += 1;
    setResults(null);
    setClusterResult(null);
    setComparison(null);
    setAnalysisError('');
    setAnalyzing(false);
  };
  const changeRecording = (which: 'first' | 'second', event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    clearResults();
    if (which === 'first') setFirstFile(file);
    else setSecondFile(file);
  };
  const removeRecording = (which: 'first' | 'second') => {
    clearResults();
    if (which === 'first') setFirstFile(null);
    else setSecondFile(null);
  };
  const analyzeRecordings = async () => {
    if (!firstFile) return;
    try {
      validateBioacousticInputBudget(firstFile.size, secondFile?.size ?? 0);
    } catch (cause) {
      setAnalysisError(cause instanceof Error ? cause.message : 'The selected WAV files exceed local analysis limits.');
      return;
    }
    const run = ++analysisRun.current;
    setAnalyzing(true);
    setAnalysisError('');
    setResults(null);
    setClusterResult(null);
    setComparison(null);
    try {
      const isCurrent = () => analysisRun.current === run;
      const first = await segmentWavFile(firstFile, isCurrent);
      const second = secondFile ? await segmentWavFile(secondFile, isCurrent) : undefined;
      if (!isCurrent()) return;
      setResults({ first, ...(second ? { second } : {}) });
      setClusterResult(clusterAcousticEvents(first.events, clusterCount));
      if (second) setComparison(compareAcousticEventSets(first.events, second.events));
    } catch (cause) {
      if (analysisRun.current === run) {
        setAnalysisError(cause instanceof Error ? cause.message : 'Local sound analysis failed. No file was uploaded.');
      }
    } finally {
      if (analysisRun.current === run) setAnalyzing(false);
    }
  };
  const cancelAnalysis = () => {
    analysisRun.current += 1;
    setAnalyzing(false);
    setAnalysisError('Analysis cancelled. Files remain in this browser only and were not uploaded.');
  };
  const changeClusterCount = (value: string) => {
    const parsed = Number(value);
    setClusterCount(parsed);
    if (results) setClusterResult(clusterAcousticEvents(results.first.events, parsed));
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Bioacoustic Source Library | ZionCore Frequency Lab';
    return () => {
      analysisRun.current += 1;
      document.title = previousTitle;
    };
  }, []);

  return <main className="page-wrap bio-library-page" id="main-content" tabIndex={-1}>
    <header className="bio-library-hero">
      <div>
        <div className="eyebrow">Research sources / reviewed 12 Nov 2026</div>
        <h1 className="page-title">Bioacoustic source library.</h1>
        <p className="lead">A reviewed directory of recording collections and conservation guidance. It helps researchers check reuse rights, species context, location risk, and identification limits before using a source.</p>
        <div className="bio-library-hero-actions">
          <a className="btn btn-primary" href="#bio-analysis-title" data-testid="link-bioacoustic-tool">Open local event tools</a>
          <a className="bio-library-text-link" href="#playback-study-title" data-testid="link-bioacoustic-playback-plan">Plan a playback study</a>
          <a className="bio-library-text-link" href="#bio-source-list">Browse reviewed sources</a>
        </div>
      </div>
      <div className="bio-library-seal" aria-hidden="true"><Leaf size={24} /><span>FIELD<br />SOURCES</span></div>
    </header>

    <section className="bio-library-notice" aria-label="Library scope">
      <ShieldCheck size={19} />
      <p><strong>Source index only.</strong> No third-party recordings are bundled, downloaded, or played here. Public access to a sound is not a reuse license; check the exact asset’s terms before analysis, redistribution, or commercial use.</p>
    </section>

    <section className="bio-library-controls panel" aria-label="Search sources">
      <label className="bio-library-search">
        <span>Search sources, taxa, or guidance</span>
        <input className="select-control" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try “birds” or “coordinates”" data-testid="input-bioacoustic-search" />
      </label>
      <label className="bio-library-filter">
        <span>Reuse category</span>
        <select className="select-control" value={category} onChange={event => setCategory(event.target.value as BioacousticLicenseCategory | 'all')} data-testid="select-bioacoustic-license">
          <option value="all">All source types</option>
          <option value="recording-specific">Recording-specific terms</option>
          <option value="permission-required">Permission required</option>
          <option value="safety-policy">Location-safety guidance</option>
        </select>
      </label>
      <p className="bio-library-count" aria-live="polite" data-testid="text-bioacoustic-result-count">{entries.length} reviewed {entries.length === 1 ? 'source' : 'sources'}</p>
    </section>

    <section className="bio-library-results" id="bio-source-list" aria-label="Reviewed bioacoustic sources">
      {entries.length === 0
        ? <div className="panel bio-library-empty" role="status">No reviewed sources match those filters. Try another term or show all source types.</div>
        : entries.map(entry => <article className="panel bio-source-card" key={entry.id} data-testid={`card-bio-source-${entry.id}`}>
          <div className="bio-source-heading">
            <div>
              <div className="eyebrow">{entry.publisher} · {entry.kind.replaceAll('-', ' ')}</div>
              <h2>{entry.name}</h2>
            </div>
            <span className={`bio-license-badge ${entry.licenseCategory}`}><ShieldCheck size={13} />{licenseLabels[entry.licenseCategory]}</span>
          </div>
          <div className="bio-source-taxa" aria-label="Taxonomic context">
            {entry.taxa.map(taxon => <span key={taxon}><Leaf size={12} />{taxon}</span>)}
          </div>
          <p className="bio-source-license"><strong>Reuse terms</strong>{entry.licenseSummary}</p>
          <div className="bio-source-details">
            <div><h3>Species context</h3><p>{entry.speciesContext}</p></div>
            <div><h3><MapPin size={13} /> Location handling</h3><p>{entry.locationHandling}</p></div>
            <div><h3>Identification uncertainty</h3><p>{entry.identificationUncertainty}</p></div>
            <div><h3>Attribution</h3><p>{entry.attribution}</p></div>
          </div>
          <footer className="bio-source-footer">
            <span>Reviewed {new Date(`${entry.reviewedOn}T12:00:00Z`).toLocaleDateString()}</span>
            <div>{entry.references.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noopener noreferrer">{reference.label}<ExternalLink size={12} /></a>)}</div>
          </footer>
        </article>)}
    </section>

    <section className="bio-analysis-section" aria-labelledby="bio-analysis-title">
      <div className="bio-analysis-heading">
        <div><div className="eyebrow">Local, bounded processing</div><h2 id="bio-analysis-title">Inspect acoustic event structure.</h2></div>
        <span className="bio-analysis-local"><Activity size={14} />Browser only</span>
      </div>
      <p className="bio-analysis-intro">Find candidate sound spans from short-time RMS energy, group recording A’s events by measured features, and compare those features with an optional second recording. These are exploratory acoustic patterns—not animal-call detections, species labels, or evidence of communication.</p>
      <div className="panel bio-analysis-panel">
        <div className="bio-recording-inputs">
          <div className="bio-file-field">
            <label><span>Recording A · required</span><input className="select-control" type="file" accept=".wav,audio/wav,audio/x-wav" onChange={event => changeRecording('first', event)} data-testid="input-bioacoustic-recording-a" /></label>
            {firstFile && <div className="bio-selected-file"><span>{firstFile.name} · {(firstFile.size / 1024 / 1024).toFixed(2)} MiB</span><button type="button" onClick={() => removeRecording('first')} data-testid="button-remove-bioacoustic-a">Clear</button></div>}
          </div>
          <div className="bio-file-field">
            <label><span>Recording B · optional comparison</span><input className="select-control" type="file" accept=".wav,audio/wav,audio/x-wav" onChange={event => changeRecording('second', event)} data-testid="input-bioacoustic-recording-b" /></label>
            {secondFile && <div className="bio-selected-file"><span>{secondFile.name} · {(secondFile.size / 1024 / 1024).toFixed(2)} MiB</span><button type="button" onClick={() => removeRecording('second')} data-testid="button-remove-bioacoustic-b">Clear</button></div>}
          </div>
          <label>
            <span>Groups for recording A</span>
            <select className="select-control" value={clusterCount} disabled={analyzing} onChange={event => changeClusterCount(event.target.value)} data-testid="select-bioacoustic-clusters">
              {[2, 3, 4, 5, 6, 7, 8].map(count => <option value={count} key={count}>{count} groups</option>)}
            </select>
          </label>
        </div>
        <p className="bio-analysis-limits">PCM or IEEE-float WAV · mono/stereo · 8–96 kHz · 24 MiB combined input and 60 seconds per file · up to 100 event candidates per recording. Selected files are processed in memory and are not saved or uploaded.</p>
        <div className="bio-analysis-actions">
          <button className="btn btn-primary" onClick={() => void analyzeRecordings()} disabled={!firstFile || analyzing} data-testid="button-analyze-bioacoustics">
            <Activity size={15} />{analyzing ? 'Analyzing locally…' : 'Segment and analyze'}
          </button>
          {analyzing && <button className="btn btn-subtle" onClick={cancelAnalysis} data-testid="button-cancel-bioacoustics"><Square size={13} />Cancel</button>}
        </div>
        {analysisError && <p className="bio-analysis-error" role="alert" data-testid="status-bioacoustic-error">{analysisError}</p>}
      </div>

      {results && <>
        <div className="bio-results-heading"><h3>Candidate event spans</h3><span>{results.first.methodId} v{results.first.methodVersion}</span></div>
        <div className="bio-recording-results">
          {[{ label: 'A', result: results.first }, ...(results.second ? [{ label: 'B', result: results.second }] : [])].map(({ label, result }) => {
            const clusterById = label === 'A'
              ? new Map(clusterResult?.events.map(event => [event.id, event.clusterId]) ?? [])
              : new Map<string, number>();
            return <article className="panel bio-recording-result" key={label} data-testid={`panel-bioacoustic-recording-${label.toLowerCase()}`}>
              <div className="bio-recording-result-heading">
                <div><div className="eyebrow">Recording {label}</div><strong>{result.sourceName}</strong></div>
                <span>{result.sourceSampleRateHz.toLocaleString()} Hz · {result.durationSeconds.toFixed(1)} s · {result.sourceChannels === 1 ? 'mono' : 'stereo'}</span>
              </div>
              <p className="bio-threshold-note">Energy gate: RMS ≥ {result.onsetThresholdRms.toFixed(4)} FS · noise-floor estimate {result.noiseFloorRms.toFixed(4)} FS. {result.candidateEventCount} candidate spans found.</p>
              {result.truncated && <p className="bio-truncated-note" role="status">Only the first {result.events.length} spans are shown and used; the event display cap was reached.</p>}
              {result.events.length === 0
                ? <p className="bio-no-events" role="status">No spans met this energy threshold. Quiet or continuous sounds can be missed; this is not evidence that the recording contains no animal vocalizations.</p>
                : <div className="bio-event-table-wrap">
                  <table className="bio-event-table">
                    <thead><tr><th>Span</th><th>Start</th><th>Duration</th><th>Peak</th><th>Centroid</th><th>Mean RMS</th>{label === 'A' && <th>Feature group</th>}</tr></thead>
                    <tbody>{result.events.map(event => <tr key={event.id} data-testid={`row-event-${label.toLowerCase()}-${event.id}`}>
                      <th scope="row">{event.id}</th>
                      <td>{event.startSeconds.toFixed(2)} s</td>
                      <td>{event.durationSeconds.toFixed(2)} s</td>
                      <td>{event.dominantFrequencyHz == null ? '—' : `${event.dominantFrequencyHz.toFixed(0)} Hz`}</td>
                      <td>{event.spectralCentroidHz == null ? '—' : `${event.spectralCentroidHz.toFixed(0)} Hz`}</td>
                      <td>{event.meanRms.toFixed(4)} FS</td>
                      {label === 'A' && <td>{clusterById.get(event.id) ?? '—'}</td>}
                    </tr>)}</tbody>
                  </table>
                </div>}
            </article>;
          })}
        </div>

        {clusterResult && <section className="bio-cluster-results" aria-label="Recording A feature groups" data-testid="panel-bioacoustic-clusters">
          <div className="bio-results-heading"><h3>Feature groups in recording A</h3><span>{clusterResult.methodId} v{clusterResult.methodVersion} · {clusterResult.effectiveClusterCount}/{clusterResult.requestedClusterCount} groups used</span></div>
          <p className="bio-analysis-intro">A deterministic k-means grouping over log-scaled duration, peak frequency, spectral centroid, and mean level. Group numbers are arbitrary and do not represent species or call types.</p>
          <div className="bio-cluster-grid">{clusterResult.clusters.map(cluster => <article className="panel bio-cluster-card" key={cluster.id}>
            <div><span>Group {cluster.id}</span><strong>{cluster.eventIds.length} {cluster.eventIds.length === 1 ? 'span' : 'spans'}</strong></div>
            <p>Mean duration {cluster.meanDurationSeconds.toFixed(2)} s</p>
            <p>Mean peak {cluster.meanDominantFrequencyHz == null ? 'not measured' : `${cluster.meanDominantFrequencyHz.toFixed(0)} Hz`}</p>
            <p>Mean centroid {cluster.meanSpectralCentroidHz == null ? 'not measured' : `${cluster.meanSpectralCentroidHz.toFixed(0)} Hz`}</p>
          </article>)}</div>
          {clusterResult.events.length === 0 && <p className="bio-no-events">No candidate spans are available to group.</p>}
        </section>}

        {comparison && <section className="panel bio-comparison" aria-label="Recording comparison" data-testid="panel-bioacoustic-comparison">
          <div className="bio-results-heading"><h3>Recording A / B feature comparison</h3><span>{comparison.methodId} v{comparison.methodVersion} · distance ≤ {comparison.maximumNormalizedDistance.toFixed(2)}</span></div>
          <div className="bio-comparison-metrics">
            <div><span>Feature-similar pairs</span><strong>{comparison.matchedEventCount}</strong></div>
            <div><span>Matched share</span><strong>{comparison.similarityPercent.toFixed(0)}%</strong></div>
            <div><span>Mean duration delta</span><strong>{comparison.averageDurationDeltaSeconds == null ? '—' : `${comparison.averageDurationDeltaSeconds.toFixed(2)} s`}</strong></div>
            <div><span>Mean peak delta</span><strong>{comparison.averageDominantFrequencyDeltaHz == null ? '—' : `${comparison.averageDominantFrequencyDeltaHz.toFixed(0)} Hz`}</strong></div>
          </div>
          <p>{comparison.limitation}</p>
        </section>}
      </>}
    </section>

    <BioacousticPlaybackPlanner />

    <aside className="bio-library-next">
      <div><div className="eyebrow">Continue with your own recording</div><p>Use the local audio lab to inspect a file you have permission to analyze. ZionCore measures acoustic properties; it does not translate animal language or establish intent.</p></div>
      <Link href="/" className="btn btn-primary" data-testid="link-bioacoustic-local-lab">Open local audio lab</Link>
    </aside>
  </main>;
}

export default BioacousticLibraryPage;
