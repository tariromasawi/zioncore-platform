import type { ResonanceEngineSnapshot } from '@/lib/resonance-engine';
import './engine-monitor.css';

type EngineMonitorProps = { snapshot: ResonanceEngineSnapshot };

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberOrDash(value: number | null | undefined, digits = 1): string {
  return finite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

function formatFrequency(value: number | null | undefined): string {
  if (!finite(value)) return 'Unresolved';
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} kHz`
    : `${value.toFixed(value < 100 ? 2 : 1)} Hz`;
}

function formatElapsed(value: number): string {
  const safe = finite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

function TrendPlot({ trend }: { trend: ResonanceEngineSnapshot['trend'] }) {
  const samples = Array.isArray(trend)
    ? trend.filter(sample => sample && finite(sample.timeSeconds) && finite(sample.rmsLevel))
    : [];
  const frequencyValues = samples
    .map(sample => sample.dominantFrequencyHz)
    .filter(finite);
  const hasFrequency = frequencyValues.length > 0;

  if (!samples.length) {
    return (
      <div className="em-trend-empty" data-testid="status-trend-empty">
        <span className="em-empty-mark" aria-hidden="true" />
        <p>No measured trend points yet.</p>
        <span>Frequency and level traces appear as session samples arrive.</span>
      </div>
    );
  }

  const width = 720;
  const height = 184;
  const insetX = 14;
  const insetY = 16;
  const firstTime = samples[0].timeSeconds;
  const lastTime = samples[samples.length - 1].timeSeconds;
  const timeSpan = Math.max(0.001, lastTime - firstTime);
  const minFrequency = hasFrequency ? Math.min(...frequencyValues) : 0;
  const frequencySpan = hasFrequency
    ? Math.max(1, Math.max(...frequencyValues) - minFrequency)
    : 1;
  const maxRms = Math.max(0.000001, ...samples.map(sample => sample.rmsLevel));
  const xAt = (index: number) => samples.length === 1
    ? width / 2
    : insetX + ((samples[index].timeSeconds - firstTime) / timeSpan) * (width - insetX * 2);
  const yFrequency = (value: number) =>
    height - insetY - ((value - minFrequency) / frequencySpan) * (height - insetY * 2);
  const yRms = (value: number) => height - insetY - (value / maxRms) * (height - insetY * 2);
  const makePath = (valueAt: (value: number) => number, pick: (index: number) => number | null) => {
    let open = false;
    return samples.map((_, index) => {
      const value = pick(index);
      if (!finite(value)) {
        open = false;
        return '';
      }
      const command = `${open ? 'L' : 'M'} ${xAt(index).toFixed(2)} ${valueAt(value).toFixed(2)}`;
      open = true;
      return command;
    }).filter(Boolean).join(' ');
  };

  return (
    <div className="em-chart-frame">
      <svg
        className="em-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Measured session trend with ${samples.length} samples${hasFrequency ? ', showing dominant frequency and relative RMS level' : ', showing relative RMS level only'}`}
        data-testid="visual-engine-trend"
      >
        {[0.25, 0.5, 0.75].map(position => (
          <line
            key={position}
            x1="0"
            x2={width}
            y1={height * position}
            y2={height * position}
            className="em-chart-grid"
          />
        ))}
        <path d={makePath(yRms, index => samples[index].rmsLevel)} className="em-rms-line" />
        {hasFrequency && (
          <path
            d={makePath(yFrequency, index => samples[index].dominantFrequencyHz)}
            className="em-frequency-line"
          />
        )}
        {samples.map((sample, index) => (
          <circle
            key={`${sample.timeSeconds}-${index}`}
            cx={xAt(index)}
            cy={yRms(sample.rmsLevel)}
            r="2.4"
            className="em-rms-point"
          />
        ))}
      </svg>
      <div className="em-chart-legend" aria-label="Trend series">
        {hasFrequency && <span><i className="em-legend-frequency" /> Dominant frequency</span>}
        <span><i className="em-legend-rms" /> RMS level</span>
        <span className="em-chart-scale-note">Each trace is scaled to its own visible range.</span>
        <span className="em-chart-count">{samples.length} measured {samples.length === 1 ? 'sample' : 'samples'}</span>
      </div>
    </div>
  );
}

export default function EngineMonitor({ snapshot }: EngineMonitorProps) {
  const phase = snapshot.phase || 'standby';
  const phaseLabel = snapshot.phaseLabel?.trim() || 'Awaiting session';
  const statusMessage = snapshot.statusMessage?.trim() || 'No session status is available yet.';
  const stages = Array.isArray(snapshot.stages) ? snapshot.stages : [];
  const frameCount = finite(snapshot.matrixFrameCount) ? Math.max(0, snapshot.matrixFrameCount) : 0;
  const varianceShare = finite(snapshot.matrixVarianceShare)
    ? `${(snapshot.matrixVarianceShare * 100).toFixed(1)}%`
    : '—';
  const peakPositionPercent = finite(snapshot.dominantFrequencyHz)
    && finite(snapshot.sampleRateHz)
    && snapshot.sampleRateHz > 0
    ? Math.min(100, Math.max(0, (snapshot.dominantFrequencyHz / (snapshot.sampleRateHz / 2)) * 100))
    : null;

  return (
    <section id="engine-monitor" className={`engine-monitor engine-monitor--${phase}`} aria-labelledby="engine-monitor-title" data-testid="engine-monitor">
      <header className="em-header">
        <div className="em-heading">
          <span className="em-kicker"><span className="em-crosshair" aria-hidden="true" /> Session observatory</span>
          <h2 id="engine-monitor-title">Signal, as it arrives.</h2>
          <p>Local measurements, with interpretation kept in its place.</p>
        </div>
        <div className="em-phase" data-testid="status-engine-phase" role="status" aria-live="polite">
          <span className="em-phase-indicator" aria-hidden="true" />
          <span>
            <small>SESSION STATE</small>
            <strong>{phaseLabel}</strong>
          </span>
        </div>
      </header>

      <div className="em-status-band" data-testid="status-engine-message">
        <span className="em-status-index" aria-hidden="true">01</span>
        <p>{statusMessage}</p>
        <div className="em-source">
          <small>SOURCE</small>
          <span data-testid="value-engine-source">{snapshot.sourceLabel?.trim() || 'Not selected'}</span>
        </div>
      </div>

      <div className="em-measurement-layout">
        <section className="em-frequency-panel" aria-label="Measured dominant frequency">
          <div className="em-panel-label"><span>01 / MEASURED</span><span>DOMINANT FREQUENCY</span></div>
          <div className="em-frequency-value" data-testid="value-dominant-frequency">
            {formatFrequency(snapshot.dominantFrequencyHz)}
          </div>
          <div className="em-frequency-foot">
            <span>Peak in current analysis window</span>
            <span className="em-time" data-testid="value-session-elapsed">{formatElapsed(snapshot.elapsedSeconds)} elapsed</span>
          </div>
          <div
            className="em-frequency-rule"
            role="img"
            aria-label={peakPositionPercent == null
              ? 'Dominant frequency position is unresolved'
              : `Dominant frequency is at ${peakPositionPercent.toFixed(1)} percent of the measured Nyquist range`}
            data-testid="visual-peak-position"
          >
            <span style={{ width: `${peakPositionPercent ?? 0}%` }} />
          </div>
          <div className="em-frequency-range" aria-hidden="true">
            <span>0 Hz</span>
            <span>Nyquist {finite(snapshot.sampleRateHz) ? formatFrequency(snapshot.sampleRateHz / 2) : '—'}</span>
          </div>
        </section>

        <div className="em-readouts" aria-label="Acquisition parameters">
          <div className="em-readout">
            <span>Sample rate</span>
            <strong data-testid="value-sample-rate">{numberOrDash(snapshot.sampleRateHz, 0)}<small>{finite(snapshot.sampleRateHz) ? ' Hz' : ''}</small></strong>
          </div>
          <div className="em-readout">
            <span>FFT window</span>
            <strong data-testid="value-fft-size">{numberOrDash(snapshot.fftSize, 0)}<small>{finite(snapshot.fftSize) ? ' pts' : ''}</small></strong>
          </div>
          <div className="em-readout">
            <span>Frequency resolution</span>
            <strong data-testid="value-frequency-resolution">{numberOrDash(snapshot.frequencyResolutionHz, 2)}<small>{finite(snapshot.frequencyResolutionHz) ? ' Hz' : ''}</small></strong>
          </div>
          <div className="em-readout">
            <span>Matrix frames</span>
            <strong data-testid="value-matrix-frames">{frameCount.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <section className="em-trend-section" aria-labelledby="em-trend-title">
        <div className="em-section-heading">
          <div>
            <span className="em-section-index">02 / TEMPORAL RECORD</span>
            <h3 id="em-trend-title">Session trace</h3>
          </div>
          <span className="em-measured-tag">MEASURED DATA</span>
        </div>
        <TrendPlot trend={snapshot.trend} />
      </section>

      <div className="em-reading-grid">
        <article className="em-reading-card">
          <span className="em-card-index">03 / SPECTRAL TEXTURE</span>
          <h3 data-testid="value-texture-label">{snapshot.textureLabel?.trim() || 'Texture not resolved'}</h3>
          <p data-testid="value-texture-detail">{snapshot.textureDetail?.trim() || 'No spectral texture detail is available.'}</p>
          <span className="em-reading-kind">Signal characterization</span>
        </article>
        <article className="em-reading-card">
          <span className="em-card-index">04 / TEMPORAL PROFILE</span>
          <h3 data-testid="value-temporal-label">{snapshot.temporalLabel?.trim() || 'Profile not resolved'}</h3>
          <p data-testid="value-temporal-detail">{snapshot.temporalDetail?.trim() || 'No temporal profile detail is available.'}</p>
          <span className="em-reading-kind">Session pattern</span>
        </article>
        <article className="em-reading-card em-reading-card--matrix">
          <span className="em-card-index">05 / MATRIX SUMMARY</span>
          <div className="em-matrix-line">
            <h3 data-testid="value-matrix-label">{snapshot.matrixLabel?.trim() || 'Matrix waiting'}</h3>
            <strong data-testid="value-matrix-variance">{varianceShare}</strong>
          </div>
          <p data-testid="value-matrix-detail">{snapshot.matrixDetail?.trim() || 'No matrix detail is available.'}</p>
          <span className="em-reading-kind">Variance share, when available</span>
        </article>
      </div>

      <section className="em-stages" aria-labelledby="em-stages-title">
        <div className="em-section-heading em-stage-heading">
          <div>
            <span className="em-section-index">06 / PROCESS PATH</span>
            <h3 id="em-stages-title">What the instrument is doing</h3>
          </div>
          <span className="em-stage-count">{stages.length.toString().padStart(2, '0')} stages</span>
        </div>
        {stages.length ? (
          <ol className="em-stage-list">
            {stages.map((stage, index) => (
              <li className={`em-stage em-stage--${stage.state || 'waiting'}`} key={`${stage.key}-${index}`} data-testid={`status-engine-stage-${stage.key}`}>
                <span className="em-stage-marker" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="em-stage-copy">
                  <div className="em-stage-title-row">
                    <strong>{stage.label?.trim() || 'Unnamed stage'}</strong>
                    <span className="em-stage-state">{stage.state?.replaceAll('_', ' ') || 'waiting'}</span>
                  </div>
                  <p>{stage.detail?.trim() || 'No stage detail is available.'}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="em-stage-empty" data-testid="status-stages-empty">Process stages are not available for this snapshot.</p>
        )}
      </section>
      <footer className="em-footnote">
        <span>Measured values describe the sampled signal. Labels summarize signal patterns; personal meaning remains yours to discern.</span>
        <span className="em-engine-version" data-testid="text-engine-version">Profile {snapshot.engineVersion || 'unavailable'}</span>
      </footer>
    </section>
  );
}
