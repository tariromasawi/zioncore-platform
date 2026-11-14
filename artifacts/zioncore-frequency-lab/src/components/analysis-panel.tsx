import { useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, BookOpen, BrainCircuit, LoaderCircle, Microscope } from 'lucide-react';
import type { SavedInterpretationProvenance } from '@/lib/observations';
import {
  CONNECTED_MODEL_PROVIDER,
  FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD,
  GEMINI_FLASH_LITE_STANDARD_PRICING,
} from '@/lib/ai-provider-inventory';

type AnalysisExplanation = {
  scientificInterpretation: string;
  confidence: 'low' | 'moderate' | 'high';
  uncertainty: string;
  possibleSources: string[];
  evidenceUsed?: string[];
  limitations?: string[];
  faithReflection: string | null;
  model: string;
  provenance: SavedInterpretationProvenance;
};

type AnalysisPanelProps = {
  hasMeasurement: boolean;
  captureActive: boolean;
  canAnalyze: boolean;
  requiresAccount: boolean;
  unavailableMessage: string;
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
  unavailableMessage,
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
          AI-generated hypotheses from measured values—not verified source identification or received communication.
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

        <p className="permission-note" data-testid="text-ai-provider-disclosure">
          {CONNECTED_MODEL_PROVIDER.modelId} runs through Firebase AI Logic. The prompt contains measured values and analysis instructions after your explicit request; Firebase auth and App Check tokens are sent separately to the Firebase gateway. Project billing tier and quota are not visible here. Published paid-tier rates are ${GEMINI_FLASH_LITE_STANDARD_PRICING.inputUsdPerMillionTokens.toFixed(2)}/million input and ${GEMINI_FLASH_LITE_STANDARD_PRICING.outputUsdPerMillionTokens.toFixed(2)}/million output tokens; this request’s output cap makes its output-token component at most ${FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD.toFixed(5)}, plus input. Free-tier and paid-tier data-use terms differ. <Link href="/access">Review provider details</Link>.
        </p>

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
            {unavailableMessage || 'Cloud AI is paused until its Firebase security settings are confirmed.'} You can still use the free local measurement tools.
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
                <h3>AI interpretation</h3>
                <span className={`zc-confidence confidence-${explanation.confidence}`} data-testid="value-analysis-confidence">
                  {explanation.confidence} interpretation confidence
                </span>
              </div>
              <p>{explanation.scientificInterpretation}</p>
              <small>Confidence is capped at moderate because no raw audio, environmental context, or ground-truth source label is supplied.</small>
            </section>

            <section className="zc-output-section" data-testid="output-evidence-used">
              <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Measured evidence used</h3></div>
              {explanation.evidenceUsed?.length ? (
                <ul className="zc-source-list">
                  {explanation.evidenceUsed.map((evidence, index) => (
                    <li key={`${evidence}-${index}`}>{evidence}</li>
                  ))}
                </ul>
              ) : <p>Evidence details are not available for this older interpretation.</p>}
            </section>

            <section className="zc-output-section" data-testid="output-uncertainty">
              <div className="zc-output-heading"><AlertCircle size={14} aria-hidden="true" /><h3>Uncertainty</h3></div>
              <p>{explanation.uncertainty}</p>
            </section>

            <section className="zc-output-section" data-testid="output-limitations">
              <div className="zc-output-heading"><AlertCircle size={14} aria-hidden="true" /><h3>Technical limitations</h3></div>
              {explanation.limitations?.length ? (
                <ul className="zc-source-list">
                  {explanation.limitations.map((limitation, index) => (
                    <li key={`${limitation}-${index}`}>{limitation}</li>
                  ))}
                </ul>
              ) : <p>Limitations were not recorded for this older interpretation.</p>}
            </section>

            <section className="zc-output-section" data-testid="output-possible-sources">
              <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Possible acoustic explanations</h3></div>
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

            <div className="zc-analysis-meta" data-testid="text-analysis-model">
              Model · {explanation.provenance.modelId} · Method · {explanation.provenance.methodId} v{explanation.provenance.methodVersion} · Prompt v{explanation.provenance.promptVersion} · Observation {explanation.provenance.observationId} · Generated {new Date(explanation.provenance.generatedAt).toLocaleString()} · Client round trip {explanation.provenance.clientRoundTripMs == null ? 'not recorded' : `${explanation.provenance.clientRoundTripMs} ms`}. This timing includes network and response parsing, not provider-only inference. Client-recorded provenance; not cryptographically signed.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default AnalysisPanel;
