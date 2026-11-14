import React from 'react';
import { Activity, AlertTriangle, Check, CircleHelp, Play, ShieldCheck, X } from 'lucide-react';
import type { ResearchAgentEvaluationReport } from '@/lib/research-agent-evaluation';

type ResearchAgentEvaluationPanelProps = {
  report: ResearchAgentEvaluationReport | null;
  error: string;
  onRun(): void;
};

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCost(cost: number | null): string {
  return cost === null ? 'Not reported' : `$${cost.toFixed(2)} USD`;
}

export default function ResearchAgentEvaluationPanel({
  report,
  error,
  onRun,
}: ResearchAgentEvaluationPanelProps) {
  return (
    <section
      className="research-eval"
      aria-labelledby="research-eval-heading"
      data-testid="panel-research-agent-evaluation"
    >
      <header className="research-eval__header">
        <div className="research-eval__heading">
          <span className="research-eval__kicker"><Activity size={14} aria-hidden="true" /> Local agent / evaluation</span>
          <h2 id="research-eval-heading">A fixed test set, not a field claim.</h2>
          <p>
            Repeatable, code-authored checks for the deterministic browser-local acoustic
            statistics agent. Passing fixtures describe this implementation—not real-world
            accuracy.
          </p>
        </div>
        <button
          className="research-eval__run"
          type="button"
          onClick={onRun}
          data-testid="button-run-agent-evaluation"
        >
          <Play size={14} aria-hidden="true" />
          Run local evaluation
        </button>
      </header>

      {error && (
        <div className="research-eval__error" role="alert" data-testid="status-agent-evaluation-error">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!report ? (
        <div className="research-eval__empty" role={error ? undefined : 'status'} data-testid="status-agent-evaluation-empty">
          <div className="research-eval__empty-mark"><CircleHelp size={19} aria-hidden="true" /></div>
          <div>
            <strong>No evaluation report in this view.</strong>
            <p>Run the local fixture suite to inspect its labeled results and boundaries.</p>
          </div>
        </div>
      ) : (
        <div className="research-eval__report" data-testid="report-agent-evaluation">
          <div className="research-eval__scope">
            <ShieldCheck size={16} aria-hidden="true" />
            <span><strong>Scope:</strong> deterministic browser-local agent only</span>
            <span className="research-eval__timestamp">
              Generated <time dateTime={report.generatedAt}>{report.generatedAt}</time>
            </span>
          </div>

          <div className="research-eval__metrics" aria-label="Evaluation summary">
            <article className="research-eval__metric" data-testid="metric-labeled-reliability">
              <span className="research-eval__metric-label">Labeled-case reliability</span>
              <strong>{formatRate(report.reliability.rate)}</strong>
              <small>{report.reliability.passedChecks} of {report.reliability.totalChecks} fixture checks passed</small>
            </article>
            <article className="research-eval__metric" data-testid="metric-routing-refusal-quality">
              <span className="research-eval__metric-label">Routing / schema refusals</span>
              <strong>{formatRate(report.refusalQuality.rate)}</strong>
              <small>{report.refusalQuality.passedChecks} of {report.refusalQuality.totalChecks} refusal checks passed</small>
            </article>
            <article className="research-eval__metric research-eval__metric--regression" data-testid="metric-current-regression">
              <span className="research-eval__metric-label">Current fixture regression</span>
              <strong>{formatRate(report.regression.rate)}</strong>
              <small>{report.regression.failedCases} failed of {report.regression.totalCases} labeled cases in this run</small>
              <span className="research-eval__metric-note">No historical release comparison</span>
            </article>
          </div>

          <div className="research-eval__detail-grid">
            <section className="research-eval__subsection" aria-labelledby="research-eval-cases">
              <div className="research-eval__subhead">
                <div>
                  <span className="research-eval__eyebrow">Fixture outcomes</span>
                  <h3 id="research-eval-cases">Labeled arithmetic cases</h3>
                </div>
                <span className="research-eval__count">{report.labeledCases.length} cases</span>
              </div>
              <div className="research-eval__case-list" data-testid="list-agent-evaluation-cases">
                {report.labeledCases.map(testCase => (
                  <article className="research-eval__case" key={testCase.id} data-testid={`case-agent-evaluation-${testCase.id}`}>
                    <div className="research-eval__case-heading">
                      <div>
                        <h4>{testCase.label}</h4>
                        <code>{testCase.id}</code>
                      </div>
                      <span className={`research-eval__result ${testCase.passedChecks === testCase.totalChecks ? 'is-pass' : 'is-fail'}`}>
                        {testCase.passedChecks === testCase.totalChecks
                          ? <Check size={13} aria-hidden="true" />
                          : <X size={13} aria-hidden="true" />}
                        {testCase.passedChecks}/{testCase.totalChecks} checks
                      </span>
                    </div>
                    {testCase.agentId && <p className="research-eval__agent-id">Agent <code>{testCase.agentId}</code></p>}
                    <ul className="research-eval__check-list">
                      {testCase.checks.map((check, index) => (
                        <li
                          className={`research-eval__check ${check.passed ? 'is-pass' : 'is-fail'}`}
                          key={`${testCase.id}-${index}`}
                          data-testid={`check-agent-evaluation-${testCase.id}-${index}`}
                        >
                          <span className="research-eval__check-icon" aria-label={check.passed ? 'Passed' : 'Failed'}>
                            {check.passed ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                          </span>
                          <span className="research-eval__check-copy">
                            <strong>{check.label}</strong>
                            <span><b>Expected</b> {check.expected}</span>
                            <span><b>Actual</b> {check.actual}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>

            <aside className="research-eval__side">
              <section className="research-eval__subsection" aria-labelledby="research-eval-refusals">
                <div className="research-eval__subhead">
                  <div>
                    <span className="research-eval__eyebrow">Boundary checks</span>
                    <h3 id="research-eval-refusals">Routing & schema</h3>
                  </div>
                  <span className="research-eval__count">{report.refusalChecks.length} checks</span>
                </div>
                <ul className="research-eval__refusal-list" data-testid="list-agent-refusal-checks">
                  {report.refusalChecks.map(check => (
                    <li className="research-eval__refusal" key={check.id} data-testid={`check-agent-refusal-${check.id}`}>
                      <span className={`research-eval__result ${check.passed ? 'is-pass' : 'is-fail'}`}>
                        {check.passed ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
                        {check.passed ? 'Passed' : 'Failed'}
                      </span>
                      <strong>{check.label}</strong>
                      <span><b>Expected</b> {check.expected} <b>Observed</b> {check.actual}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="research-eval__calibration" aria-labelledby="research-eval-calibration" data-testid="panel-agent-calibration">
                <span className="research-eval__eyebrow">Calibration</span>
                <h3 id="research-eval-calibration">Not applicable</h3>
                <p>{report.calibration.reason}</p>
                <span className="research-eval__not-applicable">{report.calibration.status}</span>
              </section>

              <section className="research-eval__cost" aria-labelledby="research-eval-cost" data-testid="panel-agent-cost">
                <span className="research-eval__eyebrow">Declared cost</span>
                <h3 id="research-eval-cost">{formatCost(report.cost.declaredEstimateUsd)}</h3>
                <p>{report.cost.note}</p>
                <strong className="research-eval__meter-warning">Provider spend is not metered.</strong>
              </section>
            </aside>
          </div>

          <section className="research-eval__limitations" aria-labelledby="research-eval-limitations" data-testid="panel-agent-evaluation-limitations">
            <div className="research-eval__limitations-title">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <span className="research-eval__eyebrow">Read before interpreting</span>
                <h3 id="research-eval-limitations">What this report cannot establish</h3>
              </div>
            </div>
            <ul>
              {report.boundaries.map((boundary, index) => (
                <li key={`${index}-${boundary}`} data-testid={`limitation-agent-evaluation-${index}`}>{boundary}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
