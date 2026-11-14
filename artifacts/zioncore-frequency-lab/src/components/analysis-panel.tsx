import { useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, BookOpen, BrainCircuit, LoaderCircle, Microscope } from 'lucide-react';

type AnalysisExplanation = {
  scientificInterpretation: string;
  confidence: 'low' | 'moderate' | 'high';
  uncertainty: string;
  possibleSources: string[];
  faithReflection: string | null;
  model: string;
};

type AnalysisPanelProps = {
  hasMeasurement: boolean;
  captureActive: boolean;
  canAnalyze: boolean;
  requiresAccount: boolean;
  loading: boolean;
  error: string;
  explanation: AnalysisExplanation | null;
  onAnalyze(includeFaithReflection: boolean): Promise<void>;
};

export function AnalysisPanel({
  hasMeasurement,
  captureActive,
  canAnalyze,
  requiresAccount,
  loading,
  error,
  explanation,
  onAnalyze,
}: AnalysisPanelProps) {
  const [includeFaithReflection, setIncludeFaithReflection] = useState(false);

  return (
    <section className="panel zc-analysis" aria-labelledby="zc-analysis-title" data-testid="panel-analysis">
      <div className="panel-head">
        <span className="panel-title" id="zc-analysis-title">AI explanation</span>
        <BrainCircuit size={17} aria-hidden="true" />
      </div>
      <div className="section-body">
        <p className="zc-analysis-intro">
          A grounded summary of measured sound. An explanation can suggest possibilities, but cannot identify a source with certainty.
        </p>

        <label className="zc-reflection-toggle" htmlFor="zc-faith-reflection">
          <input
            id="zc-faith-reflection"
            type="checkbox"
            checked={includeFaithReflection}
            onChange={event => setIncludeFaithReflection(event.target.checked)}
            disabled={loading}
            data-testid="toggle-faith-reflection"
          />
          <span>
            <strong>Include a separate faith reflection</strong>
            <small>Optional personal reflection; never part of the scientific interpretation.</small>
          </span>
        </label>

        {error && (
          <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-analysis-error">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary zc-analyze-button"
          type="button"
          disabled={!hasMeasurement || captureActive || loading || !canAnalyze}
          onClick={() => void onAnalyze(includeFaithReflection)}
          data-testid="button-analyze-measurement"
        >
          {loading ? <LoaderCircle className="zc-loading-icon" size={15} /> : <Microscope size={15} />}
          {loading ? 'Preparing explanation…' : captureActive ? 'Stop capture to analyze' : explanation ? 'Refresh explanation' : 'Explain this measurement'}
        </button>
        {requiresAccount ? (
          <p className="permission-note" role="status" data-testid="status-analysis-account-required">
            Cloud AI requests require a signed-in account and available quota. Local measurement remains free. <Link href="/history">Sign in or create an account</Link>.
          </p>
        ) : !canAnalyze ? (
          <p className="permission-note" role="status" data-testid="status-analysis-unavailable">
            Cloud AI is not configured in this environment. You can still use the free local measurement tools.
          </p>
        ) : null}
        {captureActive && (
          <p className="permission-note" role="status" data-testid="status-analysis-stop-capture">
            Stop capture to lock the reading before requesting an interpretation.
          </p>
        )}
        {!hasMeasurement && !captureActive && (
          <p className="permission-note" role="status" data-testid="status-analysis-needs-measurement">
            Take a microphone measurement first. No explanation is generated without a reading.
          </p>
        )}

        {loading && (
          <div className="zc-analysis-loading" aria-live="polite" data-testid="status-analysis-loading">
            <span className="zc-skeleton-line wide" />
            <span className="zc-skeleton-line" />
            <span className="zc-skeleton-line short" />
            <span className="zc-skeleton-line wide" />
          </div>
        )}

        {!loading && explanation && (
          <div className="zc-analysis-output" aria-live="polite" data-testid="output-analysis">
            <section className="zc-output-section zc-output-science" data-testid="output-scientific-interpretation">
              <div className="zc-output-heading">
                <Microscope size={14} aria-hidden="true" />
                <h3>Scientific interpretation</h3>
                <span className={`zc-confidence confidence-${explanation.confidence}`} data-testid="value-analysis-confidence">
                  {explanation.confidence} confidence
                </span>
              </div>
              <p>{explanation.scientificInterpretation}</p>
            </section>

            <section className="zc-output-section" data-testid="output-uncertainty">
              <div className="zc-output-heading"><AlertCircle size={14} aria-hidden="true" /><h3>Uncertainty</h3></div>
              <p>{explanation.uncertainty}</p>
            </section>

            <section className="zc-output-section" data-testid="output-possible-sources">
              <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Possible sound sources</h3></div>
              {explanation.possibleSources.length > 0 ? (
                <ul className="zc-source-list">
                  {explanation.possibleSources.map((source, index) => (
                    <li key={`${source}-${index}`} data-testid={`text-possible-source-${index}`}>{source}</li>
                  ))}
                </ul>
              ) : (
                <p>No possible sources were suggested.</p>
              )}
            </section>

            {explanation.faithReflection && (
              <section className="zc-output-section zc-output-reflection" data-testid="output-faith-reflection">
                <div className="zc-output-heading"><BookOpen size={14} aria-hidden="true" /><h3>Separate faith reflection</h3></div>
                <p>{explanation.faithReflection}</p>
                <small>This is a personal reflection, not a measurement or scientific finding.</small>
              </section>
            )}

            <div className="zc-analysis-meta" data-testid="text-analysis-model">Explanation model · {explanation.model}</div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AnalysisPanel;
