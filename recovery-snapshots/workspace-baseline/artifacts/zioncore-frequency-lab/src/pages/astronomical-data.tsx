import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Download, ExternalLink, RefreshCw, Square } from 'lucide-react';
import {
  astronomicalDatasetToCsv,
  fetchNoaaPlanetaryKp,
  NOAA_PUBLIC_DATA_TERMS,
  NOAA_SWPC_KP_ENDPOINT,
  NOAA_SWPC_KP_PRODUCT,
  type AstronomicalDataset,
} from '@/lib/astronomical-data';
import { downloadFile } from '@/lib/observations';
import './astronomical-data.css';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The public dataset could not be imported.';
}

export default function AstronomicalDataPage() {
  const [dataset, setDataset] = useState<AstronomicalDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  const orderedObservations = useMemo(
    () => dataset ? [...dataset.observations].reverse() : [],
    [dataset],
  );
  const statistics = useMemo(() => {
    if (!dataset?.observations.length) return null;
    const values = dataset.observations.map(point => point.value);
    return {
      latest: dataset.observations.at(-1)!,
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  }, [dataset]);

  const importDataset = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const imported = await fetchNoaaPlanetaryKp({ signal: controller.signal });
      if (!controller.signal.aborted) setDataset(imported);
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const cancelImport = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Astronomical Data | ZionCore Frequency Lab';
    return () => {
      requestRef.current?.abort();
      document.title = previousTitle;
    };
  }, []);

  return <main className="page-wrap astronomy-page" id="main-content" tabIndex={-1}>
    <header className="astronomy-hero">
      <div className="eyebrow">Cosmic observatory / public-data adapter</div>
      <h1 className="page-title">Astronomical data, with provenance.</h1>
      <p className="lead">Import NOAA’s estimated Planetary K-index feed as a timestamped, attributed dataset. This first adapter is a processed geomagnetic index—not raw radio astronomy, a calibrated instrument stream, or a signal from an intelligent source.</p>
    </header>

    <section className="astronomy-source panel" aria-labelledby="astronomy-source-title">
      <div className="astronomy-source-top">
        <div>
          <div className="eyebrow">Adapter {dataset?.adapter.id ?? 'astronomy.noaa-swpc-planetary-kp-1m'} · v{dataset?.adapter.version ?? '1.0.0'}</div>
          <h2 id="astronomy-source-title">NOAA SWPC estimated Planetary K-index</h2>
          <p>One-minute estimates, timestamped in UTC. The endpoint is fetched only when you select Import or refresh.</p>
        </div>
        <span className="astronomy-source-badge"><Activity size={13} />Public NOAA feed</span>
      </div>
      <div className="astronomy-reference-links">
        <a href={NOAA_SWPC_KP_ENDPOINT} target="_blank" rel="noopener noreferrer" data-testid="link-noaa-kp-endpoint">Raw JSON feed <ExternalLink size={12} /></a>
      </div>
      <div className="astronomy-actions">
        {loading
          ? <button className="btn btn-subtle" type="button" onClick={cancelImport} data-testid="button-cancel-astronomy-import"><Square size={13} />Cancel import</button>
          : <button className="btn btn-primary" type="button" onClick={() => void importDataset()} data-testid="button-import-noaa-kp"><RefreshCw size={14} />{dataset ? 'Refresh dataset' : 'Import dataset'}</button>}
        {dataset && <button
          className="btn btn-subtle"
          type="button"
          onClick={() => downloadFile('noaa-swpc-planetary-kp.json', JSON.stringify(dataset, null, 2), 'application/json')}
          data-testid="button-export-noaa-kp-json"
        ><Download size={14} />Export JSON</button>}
        {dataset && <button
          className="btn btn-subtle"
          type="button"
          onClick={() => downloadFile('noaa-swpc-planetary-kp.csv', astronomicalDatasetToCsv(dataset), 'text/csv')}
          data-testid="button-export-noaa-kp-csv"
        ><Download size={14} />Export CSV</button>}
      </div>
      {loading && <p role="status" className="astronomy-status" data-testid="status-astronomy-loading">Fetching the public feed directly from NOAA SWPC…</p>}
      {error && <p role="alert" className="astronomy-error" data-testid="status-astronomy-error">{error} Your last successfully imported dataset, if any, is still available on this page.</p>}
    </section>

    <section className="astronomy-provenance panel" aria-labelledby="astronomy-provenance-title">
      <h2 id="astronomy-provenance-title">Source, units, and calibration</h2>
      <dl>
        <div><dt>Source</dt><dd>NOAA Space Weather Prediction Center, Estimated Planetary K-index.</dd></div>
        <div><dt>Value unit</dt><dd>Dimensionless Kp index; estimated values are 0–9.</dd></div>
        <div><dt>Calibration</dt><dd>Not provided by this feed. Kp is a provider-derived index, not a raw magnetometer reading; this adapter does not infer instrument calibration.</dd></div>
        <div><dt>Rights / credit</dt><dd>NOAA states government-server information is public domain unless specifically annotated otherwise. This adapter retains NOAA attribution and links to the product and general terms; check product-specific notices and do not imply NOAA endorsement.</dd></div>
      </dl>
      <div className="astronomy-reference-links">
        <a href={NOAA_SWPC_KP_PRODUCT} target="_blank" rel="noopener noreferrer" data-testid="link-noaa-kp-product">NOAA K-index product page <ExternalLink size={12} /></a>
        <a href={NOAA_PUBLIC_DATA_TERMS} target="_blank" rel="noopener noreferrer" data-testid="link-noaa-data-terms">NOAA data use / disclaimer <ExternalLink size={12} /></a>
      </div>
    </section>

    {!dataset && !loading && <div className="astronomy-empty panel" role="status">No data loaded. Import is manual, read-only, and does not write to ZionCore history or Firebase.</div>}

    {dataset && statistics && <>
      <section className="astronomy-summary" aria-label="Imported dataset summary">
        <div className="panel"><span>Rows imported</span><strong data-testid="text-astronomy-row-count">{dataset.observations.length}</strong></div>
        <div className="panel"><span>Latest estimated Kp</span><strong data-testid="text-astronomy-latest-kp">{statistics.latest.value.toFixed(2)}</strong><small>{statistics.latest.reportedKpLabel}</small></div>
        <div className="panel"><span>Observed range</span><strong>{statistics.minimum.toFixed(2)}–{statistics.maximum.toFixed(2)}</strong><small>Kp index</small></div>
        <div className="panel"><span>Retrieved</span><strong>{new Date(dataset.source.retrievedAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</strong><small>UTC · {new Date(dataset.source.retrievedAtUtc).toLocaleDateString()}</small></div>
      </section>

      <section className="astronomy-observations panel" aria-labelledby="astronomy-observations-title">
        <div className="astronomy-table-heading">
          <div><div className="eyebrow">Newest first · source timestamps preserved</div><h2 id="astronomy-observations-title">Imported observations</h2></div>
          <span>{dataset.source.attribution}</span>
        </div>
        <div className="astronomy-table-wrap">
          <table data-testid="table-astronomy-observations">
            <thead><tr><th>Timestamp (UTC)</th><th>Estimated Kp</th><th>Reported Kp index</th><th>Label</th><th>Unit</th></tr></thead>
            <tbody>{orderedObservations.slice(0, 40).map(point => <tr key={point.id} data-testid={`row-astronomy-observation-${point.timestampUtc}`}>
              <td>{point.timestampUtc}</td>
              <td>{point.value.toFixed(2)}</td>
              <td>{point.reportedKpIndex}</td>
              <td>{point.reportedKpLabel}</td>
              <td>{point.unit}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="astronomy-table-note">Showing the newest 40 of {dataset.observations.length} imported rows. Exports include every imported row and full source/calibration-status metadata.</p>
      </section>
    </>}

    <aside className="astronomy-local-note">
      <strong>Local session only.</strong>
      <span>The import remains in this tab’s memory until you leave or refresh. No account history, database write, automatic polling, AI interpretation, or external upload is involved.</span>
    </aside>
  </main>;
}
