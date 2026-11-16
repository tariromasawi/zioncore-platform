import React from 'react';
import {
  Activity,
  AlertTriangle,
  AudioLines,
  Check,
  CircleHelp,
  Cloud,
  Gauge,
  Play,
  ShieldCheck,
} from 'lucide-react';
import type {
  ProtocolBenchmarkReport,
  ProtocolBenchmarkResult,
  RecoverySummary,
} from '@/lib/protocol-benchmark';

type ProtocolBenchmarkPanelProps = {
  report: ProtocolBenchmarkReport | null;
  running: boolean;
  error: string;
  onRun: () => void;
};

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatMs(value: number): string {
  return `${value.toFixed(3)} ms`;
}

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(3)} s`;
}

function formatRate(value: number | null): string {
  return value === null ? 'Not reported' : `${value.toFixed(2)} bit/s`;
}

function RecoveryFacts({ summary, label, testId }: {
  summary: RecoverySummary;
  label: string;
  testId: string;
}) {
  return (
    <div className="protocol-bench__recovery" data-testid={testId}>
      <div className="protocol-bench__recovery-title">
        <h4>{label}</h4>
        <strong>{summary.recovered} / {summary.trials} recovered</strong>
      </div>
      <dl className="protocol-bench__fact-grid protocol-bench__fact-grid--compact">
        <div><dt>Trials</dt><dd>{summary.trials}</dd></div>
        <div><dt>Recovered</dt><dd>{summary.recovered}</dd></div>
        <div><dt>Errors</dt><dd>{summary.errors}</dd></div>
        <div><dt>Error rate</dt><dd>{formatPercent(summary.errorRate)}</dd></div>
        <div><dt>False accepts</dt><dd>{summary.falseAccepts}</dd></div>
      </dl>
    </div>
  );
}

function ProtocolResult({ result, index }: {
  result: ProtocolBenchmarkResult;
  index: number;
}) {
  const key = result.protocolId || String(index);

  return (
    <article
      className="protocol-bench__protocol"
      data-testid={`card-protocol-benchmark-${key}`}
    >
      <header className="protocol-bench__protocol-head">
        <div>
          <span className="protocol-bench__eyebrow">Protocol {String(index + 1).padStart(2, '0')} · {result.maturity}</span>
          <h3>{result.protocolName}</h3>
          <code>{result.protocolId}</code>
        </div>
        <span className="protocol-bench__local-pill"><Check size={12} aria-hidden="true" />Local run</span>
      </header>

      <section className="protocol-bench__section" aria-label={`${result.protocolName} payload and signal`}>
        <div className="protocol-bench__section-label"><AudioLines size={14} aria-hidden="true" />Payload & signal</div>
        <dl className="protocol-bench__fact-grid">
          <div><dt>Payload</dt><dd>{result.payloadBytes} bytes</dd></div>
          <div><dt>Payload goodput</dt><dd>{formatRate(result.payloadGoodputBitsPerSecond)}</dd></div>
          <div><dt>Nominal rate</dt><dd>{formatRate(result.nominalSymbolRateBitsPerSecond)}</dd></div>
          <div><dt>Encoded duration</dt><dd>{formatDuration(result.encodedDurationSeconds)}</dd></div>
          <div><dt>Sample rate</dt><dd>{result.sampleRateHz.toLocaleString()} Hz</dd></div>
        </dl>
      </section>

      <section className="protocol-bench__section" aria-label={`${result.protocolName} recovery results`}>
        <div className="protocol-bench__section-label"><Activity size={14} aria-hidden="true" />Packet recovery</div>
        <RecoveryFacts
          summary={result.clean}
          label="Clean recovery"
          testId={`summary-clean-recovery-${key}`}
        />
        {result.symbolRoundTrip && (
          <RecoveryFacts
            summary={result.symbolRoundTrip}
            label="Symbol-array round trip"
            testId={`summary-symbol-round-trip-${key}`}
          />
        )}
        {result.noise.status === 'measured' ? (
          <div className="protocol-bench__noise" data-testid={`sweep-noise-${key}`}>
            <div className="protocol-bench__subhead">
              <h4>Deterministic noise sweep</h4>
              <span>{result.noise.levels.length} SNR levels</span>
            </div>
            <div className="protocol-bench__table-wrap">
              <table>
                <caption className="protocol-bench__sr-only">{result.protocolName} noise sweep trial, recovery, error, and SNR results</caption>
                <thead>
                  <tr>
                    <th scope="col">Target SNR</th>
                    <th scope="col">Measured SNR</th>
                    <th scope="col">Trials</th>
                    <th scope="col">Recovered</th>
                    <th scope="col">Errors</th>
                    <th scope="col">Error rate</th>
                    <th scope="col">False accepts</th>
                  </tr>
                </thead>
                <tbody>
                  {result.noise.levels.map((level, levelIndex) => (
                    <tr key={`${key}-${level.targetSnrDb}-${levelIndex}`} data-testid={`row-noise-level-${key}-${levelIndex}`}>
                      <th scope="row">{level.targetSnrDb} dB</th>
                      <td>{level.measuredSnrDb.toFixed(2)} dB</td>
                      <td>{level.trials}</td>
                      <td>{level.recovered}</td>
                      <td>{level.errors}</td>
                      <td>{formatPercent(level.errorRate)}</td>
                      <td>{level.falseAccepts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="protocol-bench__not-applicable" data-testid={`noise-not-applicable-${key}`}>
            <span className="protocol-bench__eyebrow">Noise sweep · not applicable</span>
            <p>{result.noise.reason}</p>
          </div>
        )}
      </section>

      <section className="protocol-bench__section" aria-label={`${result.protocolName} compute and boundaries`}>
        <div className="protocol-bench__section-label"><Gauge size={14} aria-hidden="true" />Local compute & boundaries</div>
        <dl className="protocol-bench__fact-grid">
          <div><dt>Local encode</dt><dd>{formatMs(result.compute.encodeMs)}</dd></div>
          <div><dt>Clean decode mean</dt><dd>{formatMs(result.compute.cleanDecodeMeanMs)}</dd></div>
          <div><dt>All-trial decode total</dt><dd>{formatMs(result.compute.allTrialDecodeMs)}</dd></div>
        </dl>
        <div className="protocol-bench__boundary-pair">
          <div className="protocol-bench__boundary" data-testid={`compatibility-${key}`}>
            <span className="protocol-bench__eyebrow">Device compatibility</span>
            <strong>Not measured</strong>
            <p>{result.deviceCompatibility.reason}</p>
          </div>
          <div className="protocol-bench__boundary protocol-bench__boundary--cloud" data-testid={`cloud-usage-${key}`}>
            <span className="protocol-bench__eyebrow"><Cloud size={12} aria-hidden="true" />Cloud usage</span>
            <strong>{result.cloud.requests} requests · ${result.cloud.estimatedCostUsd.toFixed(2)} estimated</strong>
            <p>{result.cloud.note}</p>
          </div>
        </div>
      </section>

      <section className="protocol-bench__limits" aria-label={`${result.protocolName} interpretation limits`} data-testid={`limits-protocol-${key}`}>
        <h4>Protocol interpretation limits</h4>
        <ul>
          {result.interpretationLimits.map((limit, limitIndex) => (
            <li key={`${key}-limit-${limitIndex}`}>{limit}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

export default function ProtocolBenchmarkPanel({
  report,
  running,
  error,
  onRun,
}: ProtocolBenchmarkPanelProps) {
  return (
    <section
      className="protocol-bench"
      aria-labelledby="protocol-bench-heading"
      data-testid="panel-protocol-benchmark"
    >
      <header className="protocol-bench__header">
        <div className="protocol-bench__heading">
          <span className="protocol-bench__kicker"><Activity size={14} aria-hidden="true" />Local protocol / benchmark</span>
          <h2 id="protocol-bench-heading">Measure the packet path. Keep the claim small.</h2>
          <p>
            Inspect protocol recovery and local processing cost with fixed synthetic packets.
            Results describe this deterministic software run—not field reliability.
          </p>
        </div>
        <button
          className="protocol-bench__run"
          type="button"
          onClick={onRun}
          disabled={running}
          aria-describedby="protocol-bench-run-note"
          data-testid="button-run-protocol-benchmark"
        >
          <Play size={14} aria-hidden="true" />
          {running ? 'Running local benchmark…' : 'Run local benchmark'}
        </button>
      </header>

      {error && (
        <div className="protocol-bench__error" role="alert" data-testid="status-protocol-benchmark-error">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!report && (
        <div className="protocol-bench__pre-run" id="protocol-bench-run-note" data-testid="explanation-protocol-benchmark">
          <div className="protocol-bench__pre-run-mark"><CircleHelp size={19} aria-hidden="true" /></div>
          <div>
            <strong>What this local run does—and does not—measure</strong>
            <p>
              The benchmark synthesizes fixed test packets and deterministic, unclipped uniform
              Float32 noise. It is not a calibrated or statistically sufficient field test and
              does not check device compatibility. Nothing is sent to a service or audio device.
            </p>
          </div>
        </div>
      )}

      {running && (
        <div className="protocol-bench__running" role="status" aria-live="polite" data-testid="status-protocol-benchmark-running">
          <span className="protocol-bench__running-mark" aria-hidden="true" />
          <span>Running fixed local protocol checks…</span>
        </div>
      )}

      {!report ? (
        <div className="protocol-bench__empty" role={error ? undefined : 'status'} data-testid="status-protocol-benchmark-empty">
          <div className="protocol-bench__empty-mark"><ShieldCheck size={18} aria-hidden="true" /></div>
          <div>
            <strong>No benchmark report in this view.</strong>
            <p>Run the local suite to inspect clean recovery, noise sweeps where applicable, and measured processing time.</p>
          </div>
        </div>
      ) : (
        <div className="protocol-bench__report" data-testid="report-protocol-benchmark">
          <div className="protocol-bench__scope" data-testid="summary-protocol-benchmark">
            <ShieldCheck size={16} aria-hidden="true" />
            <span><strong>Local synthetic diagnostics</strong> · suite {report.suiteVersion} · {report.trialCountPerCondition} trials per condition</span>
            <time dateTime={report.createdAt} data-testid="text-protocol-benchmark-created">{report.createdAt}</time>
          </div>
          <p className="protocol-bench__generator" data-testid="text-protocol-benchmark-noise-generator">
            <span className="protocol-bench__eyebrow">Noise generator</span>
            <span>{report.noiseGenerator}</span>
          </p>
          <div className="protocol-bench__protocol-list" data-testid="list-protocol-benchmark-results">
            {report.results.map((result, index) => (
              <ProtocolResult key={`${result.protocolId}-${index}`} result={result} index={index} />
            ))}
          </div>
          <section className="protocol-bench__overall-limits" aria-labelledby="protocol-bench-limits-heading" data-testid="panel-protocol-benchmark-limitations">
            <div className="protocol-bench__overall-title">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <span className="protocol-bench__eyebrow">Read before interpreting</span>
                <h3 id="protocol-bench-limits-heading">What this report cannot establish</h3>
              </div>
            </div>
            <ul>
              {report.overallLimits.map((limit, index) => (
                <li key={`overall-limit-${index}`} data-testid={`limitation-protocol-benchmark-${index}`}>{limit}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
