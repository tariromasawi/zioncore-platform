import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, Download, FlaskConical, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import type { ExperimentDesignRecord } from '@/lib/ai-experiment-design';
import './experiment-design-panel.css';

type ExperimentDesignPanelProps = {
  sessions: Array<{
    id: string;
    domain: string;
    totalObservationCount: number;
    sendObservationCount: number;
  }>;
  signedIn: boolean;
  aiReady: boolean;
  unavailableMessage: string;
  loading: boolean;
  error: string;
  proposal: ExperimentDesignRecord | null;
  onGenerate(sourceSessionId: string, researchQuestion: string, consentToSend: boolean): void;
  onExport(): void;
};

export function ExperimentDesignPanel({
  sessions,
  signedIn,
  aiReady,
  unavailableMessage,
  loading,
  error,
  proposal,
  onGenerate,
  onExport,
}: ExperimentDesignPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [consentToSend, setConsentToSend] = useState(false);

  useEffect(() => {
    if (selectedSessionId && !sessions.some(session => session.id === selectedSessionId)) {
      setSelectedSessionId('');
      setConsentToSend(false);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find(session => session.id === selectedSessionId);
  const currentProposal = proposal?.sourceSessionId === selectedSessionId
    && proposal.researchQuestion === researchQuestion.trim()
    ? proposal
    : null;
  const canGenerate = signedIn
    && aiReady
    && !!selectedSession
    && consentToSend
    && researchQuestion.trim().length >= 8
    && !loading;

  function handleSessionChange(sessionId: string) {
    setSelectedSessionId(sessionId);
    setConsentToSend(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate || !selectedSession) return;
    onGenerate(selectedSession.id, researchQuestion.trim(), consentToSend);
  }

  return (
    <section className="panel zc-experiment" aria-labelledby="zc-experiment-title" data-testid="panel-experiment-design">
      <div className="panel-head">
        <span className="panel-title" id="zc-experiment-title">Experiment design</span>
        <FlaskConical size={17} aria-hidden="true" />
      </div>
      <div className="section-body">
        <p className="zc-experiment-intro">
          Turn a saved acoustic summary into a bounded plan for a follow-up test. A plan is a proposal to evaluate—not a discovery.
        </p>

        <form onSubmit={handleSubmit} data-testid="form-experiment-design">
          <div className="zc-experiment-inputs">
            <label className="zc-experiment-field" htmlFor="zc-experiment-session">
              <span>Saved research session</span>
              <select
                id="zc-experiment-session"
                value={selectedSessionId}
                onChange={event => handleSessionChange(event.target.value)}
                disabled={!sessions.length || loading}
                data-testid="select-experiment-session"
              >
                <option value="">
                  {sessions.length === 0 ? 'No saved sessions available' : 'Choose a saved session'}
                </option>
                {sessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.domain} · {session.totalObservationCount} observation{session.totalObservationCount === 1 ? '' : 's'}
                    </option>
                  ))}
              </select>
              {selectedSession && (
                <small className="zc-experiment-session-summary" data-testid="text-experiment-session-summary">
                  {selectedSession.totalObservationCount} total observations · up to {selectedSession.sendObservationCount} eligible summaries
                </small>
              )}
            </label>

            <label className="zc-experiment-field" htmlFor="zc-experiment-question">
              <span>Research question</span>
              <textarea
                id="zc-experiment-question"
                value={researchQuestion}
                onChange={event => {
                  setResearchQuestion(event.target.value);
                  setConsentToSend(false);
                }}
                maxLength={300}
                minLength={8}
                rows={3}
                placeholder="What measurable pattern would you like a follow-up test to examine?"
                disabled={loading}
                data-testid="input-experiment-question"
              />
              <small className="zc-experiment-count" data-testid="text-experiment-question-count">
                {researchQuestion.length}/300 · at least 8 characters
              </small>
            </label>
          </div>

          <div className="zc-experiment-privacy" data-testid="text-experiment-data-disclosure">
            <ShieldCheck size={17} aria-hidden="true" />
            <div>
              <strong>What this request sends</strong>
              <p>
                With your explicit consent, the selected domain, up to eight numeric summaries from that session, and the question you type are sent to Google Gemini through Firebase AI Logic. Raw audio, messages/prayers, hypotheses, notes, dates, instrument IDs, account identity, session ID, and saved personal reflections are not sent.
              </p>
            </div>
          </div>

          <label className="zc-experiment-consent" htmlFor="zc-experiment-consent">
            <input
              id="zc-experiment-consent"
              type="checkbox"
              checked={consentToSend}
              onChange={event => setConsentToSend(event.target.checked)}
              disabled={loading || !selectedSession}
              data-testid="checkbox-experiment-consent"
            />
            <span>
              <strong>I consent to send the selected domain, up to eight numeric observations, and my typed question to Google Gemini through Firebase AI Logic.</strong>
              <small>The excluded data listed above will not be sent.</small>
            </span>
          </label>

          {error && (
            <div className="zc-experiment-error" role="alert" data-testid="status-experiment-error">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary zc-experiment-generate"
            type="submit"
            disabled={!canGenerate}
            data-testid="button-generate-experiment"
          >
            {loading ? <LoaderCircle className="zc-experiment-loading-icon" size={15} aria-hidden="true" /> : <FlaskConical size={15} aria-hidden="true" />}
            {loading ? 'Preparing proposal…' : 'Prepare experiment proposal'}
          </button>

          {!signedIn ? (
            <p className="permission-note" role="status" data-testid="status-experiment-sign-in">
              <Link href="/history">Sign in</Link> to request an AI-assisted experiment proposal. Your saved measurements remain unchanged.
            </p>
          ) : !aiReady ? (
            <p className="permission-note" role="status" data-testid="status-experiment-unavailable">
              {unavailableMessage || 'AI experiment design is currently unavailable.'}
            </p>
          ) : sessions.length === 0 ? (
            <p className="permission-note" role="status" data-testid="status-experiment-needs-session">
              Save a research session with measured observations before creating a follow-up plan.
            </p>
          ) : null}
        </form>

        {loading && (
          <div className="zc-experiment-loading" aria-live="polite" data-testid="status-experiment-loading">
            <span className="zc-skeleton-line wide" />
            <span className="zc-skeleton-line" />
            <span className="zc-skeleton-line short" />
          </div>
        )}

        {!loading && currentProposal && (
          <div className="zc-experiment-output" aria-live="polite" data-testid="output-experiment-proposal">
            <div className="zc-experiment-output-head">
              <div>
                <span className="zc-experiment-status" data-testid="status-experiment-proposal-kind">AI proposal · not a discovery</span>
                <h3 data-testid="text-experiment-proposal-title">{currentProposal.proposal.title}</h3>
              </div>
              <button
                className="btn btn-subtle zc-experiment-export"
                type="button"
                onClick={onExport}
                data-testid="button-export-experiment"
              >
                <Download size={14} aria-hidden="true" />
                Export
              </button>
            </div>

            <p className="zc-experiment-question" data-testid="text-experiment-testable-question">{currentProposal.proposal.testableQuestion}</p>

            <div className="zc-experiment-result-section">
              <h4>Falsifiable hypothesis</h4>
              <p data-testid="text-experiment-hypothesis">{currentProposal.proposal.falsifiableHypothesis}</p>
            </div>
            <div className="zc-experiment-result-section">
              <h4>Rationale</h4>
              <p data-testid="text-experiment-rationale">{currentProposal.proposal.rationale}</p>
            </div>
            <div className="zc-experiment-result-grid">
              <div className="zc-experiment-result-section">
                <h4>Protocol steps</h4>
                <ol data-testid="list-experiment-protocol">
                  {currentProposal.proposal.protocolSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
                </ol>
              </div>
              <div className="zc-experiment-result-section">
                <h4>Control conditions</h4>
                <ul data-testid="list-experiment-controls">
                  {currentProposal.proposal.controlConditions.map((condition, index) => <li key={`${index}-${condition}`}>{condition}</li>)}
                </ul>
              </div>
              <div className="zc-experiment-result-section">
                <h4>Measured outcomes</h4>
                <ul data-testid="list-experiment-outcomes">
                  {currentProposal.proposal.measuredOutcomes.map((outcome, index) => <li key={`${index}-${outcome}`}>{outcome}</li>)}
                </ul>
              </div>
              <div className="zc-experiment-result-section">
                <h4>Safeguards</h4>
                <ul data-testid="list-experiment-safeguards">
                  {currentProposal.proposal.safeguards.map((safeguard, index) => <li key={`${index}-${safeguard}`}>{safeguard}</li>)}
                </ul>
              </div>
            </div>
            <div className="zc-experiment-rule">
              <h4>Decision rule</h4>
              <p data-testid="text-experiment-decision-rule">{currentProposal.proposal.decisionRule}</p>
            </div>
            <div className="zc-experiment-limitations">
              <div className="zc-experiment-result-section">
                <h4>Uncertainty &amp; limitations</h4>
                <ul data-testid="list-experiment-limitations">
                  {currentProposal.proposal.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}
                </ul>
              </div>
              <p>This AI-generated plan is bounded by the supplied summaries and question. It does not establish a source, cause, communication, or finding.</p>
            </div>
            <div className="zc-experiment-meta" data-testid="text-experiment-provenance">
              Based on {currentProposal.sourceObservationCount} observation{currentProposal.sourceObservationCount === 1 ? '' : 's'} · Generated {new Date(currentProposal.generatedAt).toLocaleString()} · Client round trip {currentProposal.clientRoundTripMs} ms
            </div>
          </div>
        )}

        {!loading && proposal && !currentProposal && !error && (
          <div className="zc-experiment-empty" role="status" data-testid="status-experiment-stale-proposal">
            <span className="zc-experiment-empty-mark" aria-hidden="true" />
            <p>The selected session or question changed. Generate a new proposal to match the current input.</p>
          </div>
        )}

        {!loading && !currentProposal && !proposal && !error && (
          <div className="zc-experiment-empty" role="status" data-testid="status-experiment-empty">
            <span className="zc-experiment-empty-mark" aria-hidden="true" />
            <p>A proposal will appear here after you choose a saved session, enter a research question, and give consent.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ExperimentDesignPanel;
