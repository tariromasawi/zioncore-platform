import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, AudioLines, GitBranch, Info, Layers3, ShieldAlert } from 'lucide-react';
import type { InterpretationComparisonReport } from '@/lib/interpretation-comparison';

type InterpretationComparisonOption = {
  observationId: string;
  label: string;
  modelId: string;
  confidence: 'low' | 'moderate' | 'high';
  possibleSources: string[];
};

type InterpretationComparisonPanelProps = {
  options: InterpretationComparisonOption[];
  report: InterpretationComparisonReport | null;
  error: string;
  onBuild: (observationIds: string[]) => void;
  onExport: () => void;
};

function sameIdSet(left: string[], right: string[]) {
  return left.length === right.length && left.every(id => right.includes(id));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatHz(value: number | null) {
  return value == null ? 'Not measured' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} Hz`;
}

function formatMeasurement(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : 'Unavailable';
}

function confidenceLabel(value: 'low' | 'moderate' | 'high') {
  return value === 'low' ? 'Low confidence' : value === 'moderate' ? 'Moderate confidence' : 'High confidence';
}

export default function InterpretationComparisonPanel({
  options,
  report,
  error,
  onBuild,
  onExport,
}: InterpretationComparisonPanelProps) {
  const availableIds = useMemo(() => new Set(options.map(option => option.observationId)), [options]);
  const initialIds = report?.candidates.map(candidate => candidate.observationId).filter(id => availableIds.has(id)) ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialIds.slice(0, 6));
  const [builtForIds, setBuiltForIds] = useState<string[] | null>(() => report && initialIds.length === report.candidates.length ? initialIds : null);
  const optionsKey = options.map(option => option.observationId).join('\u001f');
  const previousOptionsKey = useRef(optionsKey);

  useEffect(() => {
    if (previousOptionsKey.current === optionsKey) return;
    previousOptionsKey.current = optionsKey;
    setSelectedIds(current => current.filter(id => availableIds.has(id)).slice(0, 6));
    setBuiltForIds(null);
  }, [optionsKey]);

  const canBuild = selectedIds.length >= 2 && selectedIds.length <= 6;
  const reportIds = report?.candidates.map(candidate => candidate.observationId) ?? [];
  const reportIsCurrent = Boolean(
    report &&
    builtForIds &&
    sameIdSet(selectedIds, builtForIds) &&
    sameIdSet(selectedIds, reportIds),
  );

  const toggleOption = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(value => value !== id)
      : selectedIds.length < 6 ? [...selectedIds, id] : selectedIds;
    if (!sameIdSet(selectedIds, next)) {
      setSelectedIds(next);
      setBuiltForIds(null);
    }
  };

  const buildComparison = () => {
    if (!canBuild) return;
    const snapshot = [...selectedIds];
    setBuiltForIds(snapshot);
    onBuild(snapshot);
  };

  return (
    <section className="zc-compare" aria-labelledby="zc-compare-title" data-testid="panel-interpretation-comparison">
      <header className="zc-compare__header">
        <div className="zc-compare__title-block">
          <span className="zc-compare__eyebrow"><AudioLines size={14} aria-hidden="true" /> Interpretation review / account records</span>
          <h2 id="zc-compare-title">Compare saved interpretations</h2>
          <p>Review provenance-linked AI proposals beside their measured values. This is a local comparison of saved records, not a new analysis.</p>
        </div>
        <div className="zc-compare__header-mark" aria-hidden="true"><Layers3 size={22} strokeWidth={1.4} /><span>02—06</span></div>
      </header>

      <div className="zc-compare__evidence-note" role="note" data-testid="note-comparison-evidence-boundary">
        <ShieldAlert size={17} aria-hidden="true" />
        <p><strong>Agreement is not evidence.</strong> Repeated wording or agreement between models is not empirical evidence, independent confirmation, or verification of a source.</p>
      </div>

      <div className="zc-compare__selector">
        <div className="zc-compare__selector-heading">
          <div>
            <h3 id="zc-compare-records-title">Choose saved records</h3>
            <p>Select between 2 and 6 records with saved AI interpretations and provenance.</p>
          </div>
          <span className="zc-compare__count" aria-live="polite" data-testid="text-comparison-selection-count">
            {selectedIds.length} <span>/ 6 selected</span>
          </span>
        </div>

        {options.length === 0 ? (
          <div className="zc-compare__empty" data-testid="empty-comparison-options">
            <span className="zc-compare__empty-mark"><AudioLines size={18} aria-hidden="true" /></span>
            <div>
              <strong>No comparable interpretations yet</strong>
              <p>Saved observations with a provenance-linked AI interpretation will appear here. Measurements without a saved interpretation are not included.</p>
            </div>
          </div>
        ) : (
          <fieldset className="zc-compare__choices" aria-labelledby="zc-compare-records-title">
            <legend className="zc-sr-only">Saved interpretations to compare</legend>
            {options.map(option => {
              const checked = selectedIds.includes(option.observationId);
              const atLimit = selectedIds.length >= 6 && !checked;
              return (
                <label
                  className={`zc-compare__choice${checked ? ' is-selected' : ''}${atLimit ? ' is-limit' : ''}`}
                  key={option.observationId}
                  data-testid={`option-comparison-record-${option.observationId}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={atLimit}
                    onChange={() => toggleOption(option.observationId)}
                    aria-label={`Select ${option.label}, ${confidenceLabel(option.confidence)}, model ${option.modelId}`}
                    data-testid={`checkbox-comparison-record-${option.observationId}`}
                  />
                  <span className="zc-compare__checkmark" aria-hidden="true" />
                  <span className="zc-compare__choice-copy">
                    <strong>{option.label}</strong>
                    <span className="zc-compare__choice-meta"><span>{option.modelId}</span><span>{confidenceLabel(option.confidence)}</span></span>
                    {option.possibleSources.length > 0 && (
                      <span className="zc-compare__choice-sources">Proposed sources: {option.possibleSources.join(' · ')}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="zc-compare__actions">
          <p className="zc-compare__selection-hint" data-testid="text-comparison-selection-guidance">
            {selectedIds.length < 2
              ? `Select ${2 - selectedIds.length} more ${2 - selectedIds.length === 1 ? 'record' : 'records'} to compare.`
              : selectedIds.length > 6
                ? 'Choose no more than 6 records.'
                : 'The comparison is computed from the selected saved records.'}
          </p>
          <button
            type="button"
            className="zc-compare__build"
            onClick={buildComparison}
            disabled={!canBuild}
            data-testid="button-build-interpretation-comparison"
          >
            <GitBranch size={15} aria-hidden="true" /> Build comparison
          </button>
        </div>
      </div>

      {error && (
        <div className="zc-compare__error" role="alert" data-testid="status-comparison-error">
          <Info size={16} aria-hidden="true" /><span>{error}</span>
        </div>
      )}

      {report && !reportIsCurrent && (
        <p className="zc-compare__stale" role="status" data-testid="status-comparison-stale">
          The selection changed. The previous report is hidden; build a new comparison for these records.
        </p>
      )}

      {reportIsCurrent && report && (
        <div className="zc-compare__report" data-testid="report-interpretation-comparison">
          <div className="zc-compare__report-heading">
            <div>
              <span className="zc-compare__eyebrow">Report / {report.schemaVersion}</span>
              <h3>Side-by-side record review</h3>
              <p>Generated {formatDate(report.generatedAt)} <span aria-hidden="true">·</span> Method <code>{report.method}</code></p>
            </div>
            <button type="button" className="zc-compare__export" onClick={onExport} data-testid="button-export-interpretation-comparison">
              <ArrowDownToLine size={15} aria-hidden="true" /> Export report
            </button>
          </div>

          <section className="zc-compare__report-section" aria-labelledby="zc-compare-pipelines-title">
            <div className="zc-compare__section-heading">
              <span className="zc-compare__section-index">01</span>
              <div><h4 id="zc-compare-pipelines-title">Pipeline provenance groups</h4><p>Records grouped by recorded provider, model, method, and prompt versions.</p></div>
            </div>
            <div className="zc-compare__pipeline-list" data-testid="list-comparison-provenance-groups">
              {report.pipelineGroups.map((group, index) => (
                <article className="zc-compare__pipeline" key={`${group.provider}-${group.modelId}-${group.methodId}-${index}`} data-testid={`group-comparison-provenance-${index}`}>
                  <div className="zc-compare__pipeline-top"><strong>{group.provider}</strong><span>{group.observationIds.length} {group.observationIds.length === 1 ? 'record' : 'records'}</span></div>
                  <dl>
                    <div><dt>Model</dt><dd>{group.modelId}</dd></div>
                    <div><dt>Method</dt><dd>{group.methodId} / {group.methodVersion}</dd></div>
                    <div><dt>Prompt</dt><dd>{group.promptVersion}</dd></div>
                  </dl>
                  <p>Record IDs: {group.observationIds.join(', ')}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="zc-compare__report-section" aria-labelledby="zc-compare-wording-title">
            <div className="zc-compare__section-heading">
              <span className="zc-compare__section-index">02</span>
              <div><h4 id="zc-compare-wording-title">Repeated exact source wording</h4><p>Text recurrences are displayed as text only—not as corroboration.</p></div>
            </div>
            {report.repeatedSourceWording.length ? (
              <ul className="zc-compare__wording-list" data-testid="list-comparison-repeated-wording">
                {report.repeatedSourceWording.map((item, index) => (
                  <li key={`${item.wording}-${index}`} data-testid={`item-comparison-repeated-wording-${index}`}>
                    <blockquote>“{item.wording}”</blockquote>
                    <span>Appears in {item.observationIds.length} records</span>
                    <small>{item.observationIds.join(', ')}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="zc-compare__no-repeats" data-testid="empty-comparison-repeated-wording">No exact repeated source wording was found in these records.</div>
            )}
          </section>

          <section className="zc-compare__report-section" aria-labelledby="zc-compare-candidates-title">
            <div className="zc-compare__section-heading">
              <span className="zc-compare__section-index">03</span>
              <div><h4 id="zc-compare-candidates-title">Interpretations and measurements</h4><p>Each AI proposal remains attached to its own saved observation.</p></div>
            </div>
            <div className="zc-compare__candidate-list" data-testid="list-comparison-candidates">
              {report.candidates.map((candidate, index) => (
                <article className="zc-compare__candidate" key={candidate.observationId} data-testid={`candidate-comparison-${candidate.observationId}`}>
                  <div className="zc-compare__candidate-head">
                    <div><span className="zc-compare__candidate-number">RECORD {String(index + 1).padStart(2, '0')}</span><h5>{candidate.observationId}</h5><span className="zc-compare__record-date">{formatDate(candidate.recordedAt)}</span></div>
                    <span className={`zc-compare__confidence confidence-${candidate.interpretation.confidence}`}>{confidenceLabel(candidate.interpretation.confidence)}</span>
                  </div>

                  <div className="zc-compare__candidate-body">
                    <section className="zc-compare__proposal" aria-label={`AI interpretation for ${candidate.observationId}`}>
                      <span className="zc-compare__field-label">AI hypothesis · saved wording</span>
                      <p data-testid={`text-comparison-interpretation-${candidate.observationId}`}>{candidate.interpretation.scientificInterpretation}</p>
                    </section>

                    <div className="zc-compare__candidate-columns">
                      <section className="zc-compare__measurement" aria-label={`Numeric measurements for ${candidate.observationId}`}>
                        <span className="zc-compare__field-label">Measured values</span>
                        <dl className="zc-compare__measure-grid" data-testid={`measurements-comparison-${candidate.observationId}`}>
                          <div><dt>Dominant frequency</dt><dd>{formatHz(candidate.measurement.dominantFrequencyHz)}</dd></div>
                          <div><dt>Top peaks</dt><dd>{candidate.measurement.topPeaksHz.length ? candidate.measurement.topPeaksHz.map(value => formatHz(value)).join(', ') : 'None recorded'}</dd></div>
                          <div><dt>Sample rate</dt><dd>{formatMeasurement(candidate.measurement.sampleRateHz / 1000, 3)} kHz</dd></div>
                          <div><dt>FFT size</dt><dd>{candidate.measurement.fftSize.toLocaleString()} points</dd></div>
                          <div><dt>Resolution</dt><dd>{formatMeasurement(candidate.measurement.frequencyResolutionHz)} Hz / bin</dd></div>
                          <div><dt>RMS level</dt><dd>{formatMeasurement(candidate.measurement.rmsLevel, 4)} FS</dd></div>
                          <div><dt>Duration</dt><dd>{formatMeasurement(candidate.measurement.durationSeconds, 2)} sec</dd></div>
                        </dl>
                      </section>

                      <section className="zc-compare__uncertainty" aria-label={`Uncertainty and sources for ${candidate.observationId}`}>
                        <span className="zc-compare__field-label">Uncertainty and possible sources</span>
                        <p>{candidate.interpretation.uncertainty || 'No uncertainty statement was saved.'}</p>
                        {candidate.interpretation.possibleSources.length ? (
                          <ul>{candidate.interpretation.possibleSources.map((source, sourceIndex) => <li key={`${source}-${sourceIndex}`}>{source}</li>)}</ul>
                        ) : <span className="zc-compare__muted">No possible sources were recorded.</span>}
                        {candidate.interpretation.evidenceUsed.length > 0 && (
                          <div className="zc-compare__evidence-used"><strong>Evidence cited in interpretation</strong><ul>{candidate.interpretation.evidenceUsed.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></div>
                        )}
                        {candidate.interpretation.limitations.length > 0 && (
                          <div className="zc-compare__limits"><strong>Saved limitations</strong><ul>{candidate.interpretation.limitations.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></div>
                        )}
                      </section>
                    </div>

                    <details className="zc-compare__provenance-details">
                      <summary>Source, model, and method provenance</summary>
                      <dl>
                        <div><dt>Source</dt><dd>{candidate.provenance.source}</dd></div>
                        <div><dt>Provider</dt><dd>{candidate.provenance.provider}</dd></div>
                        <div><dt>Model ID</dt><dd>{candidate.provenance.modelId}</dd></div>
                        <div><dt>Method</dt><dd>{candidate.provenance.methodId} / {candidate.provenance.methodVersion}</dd></div>
                        <div><dt>Prompt version</dt><dd>{candidate.provenance.promptVersion}</dd></div>
                        <div><dt>Interpretation generated</dt><dd>{formatDate(candidate.provenance.generatedAt)}</dd></div>
                        <div><dt>Provenance observation ID</dt><dd>{candidate.provenance.observationId}</dd></div>
                        {candidate.provenance.clientRoundTripMs != null && <div><dt>Client round trip</dt><dd>{formatMeasurement(candidate.provenance.clientRoundTripMs, 0)} ms</dd></div>}
                      </dl>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="zc-compare__report-section zc-compare__boundaries" aria-labelledby="zc-compare-boundaries-title">
            <div className="zc-compare__section-heading">
              <span className="zc-compare__section-index">04</span>
              <div><h4 id="zc-compare-boundaries-title">What this report cannot establish</h4><p>Keep observations, hypotheses, and personal conclusions distinct.</p></div>
            </div>
            <ul data-testid="list-comparison-boundaries">
              {report.boundaries.map((boundary, index) => <li key={`${boundary}-${index}`} data-testid={`boundary-comparison-${index}`}>{boundary}</li>)}
            </ul>
            <p className="zc-compare__personal-note"><strong>Your conclusion remains yours.</strong> This panel does not merge model proposals into a finding or interpret agreement as verification.</p>
          </section>
        </div>
      )}
    </section>
  );
}
