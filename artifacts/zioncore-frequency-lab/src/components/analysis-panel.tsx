import { lazy, Suspense, useEffect, useState } from 'react';
import { Activity, AlertCircle, AudioLines, BookOpen, BrainCircuit, CreditCard, FlaskConical, ListChecks, LoaderCircle, Microscope } from 'lucide-react';
import type { User } from 'firebase/auth';
import { useGetPublicInterpretationPricing } from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  getAIAudioInterpretationQuote,
  getAIInterpretationQuote,
  type AIInterpretationQuote,
  type AIAudioInterpretationQuote,
  MAX_LISTENING_CONTEXT_CHARS,
  type Explanation,
} from '@/lib/ai-analysis';
import { splitFaithReflection } from '@/lib/faith-reflection';
import {
  MAX_EXTERNAL_AUDIO_BYTES,
  MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
} from '@workspace/frequency-ai-contract';
import BillingOffers from './billing-offers';
import type { SignalCardCapture } from '@/lib/signal-cards';

const SignalCardStudio = lazy(() => import('./signal-card-studio'));
const BioacousticEvidencePanel = lazy(() => import('./bioacoustic-evidence-panel'));

type AnalysisPanelProps = {
  hasMeasurement: boolean;
  canAnalyze: boolean;
  loading: boolean;
  error: string;
  explanation: Explanation | null;
  externalAudioFile: File | null;
  externalAudioDurationSeconds: number;
  cardCapture?: SignalCardCapture | null;
  onAnalyze(
    includeFaithReflection: boolean,
    listeningContext: string,
    quote: AIInterpretationQuote,
    externalAudioFile?: File,
  ): Promise<void>;
  user: User | null;
  firebaseReady: boolean;
  projectMismatch: boolean;
};

const domainTitles: Record<Explanation['domainPerspectives'][number]['domain'], string> = {
  acoustics: 'Acoustics & resonance',
  signal_processing: 'Signal processing',
  mathematics: 'Mathematics & statistics',
  communications: 'Communications patterns',
  environmental_bioacoustics: 'Environment & bioacoustics',
};

const relevanceTitles: Record<Explanation['domainPerspectives'][number]['relevance'], string> = {
  direct: 'Directly represented',
  tentative: 'Tentative reading',
  needs_more_data: 'More data needed',
};

export function AnalysisPanel({
  hasMeasurement,
  canAnalyze,
  loading,
  error,
  explanation,
  externalAudioFile,
  externalAudioDurationSeconds,
  cardCapture,
  onAnalyze,
  user,
  firebaseReady,
  projectMismatch,
}: AnalysisPanelProps) {
  const [includeFaithReflection, setIncludeFaithReflection] = useState(false);
  const [listeningContext, setListeningContext] = useState('');
  const [quote, setQuote] = useState<AIInterpretationQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteRefreshSequence, setQuoteRefreshSequence] = useState(0);
  const [sendAudioForReview, setSendAudioForReview] = useState(false);
  const [audioQuote, setAudioQuote] = useState<AIAudioInterpretationQuote | null>(null);
  const [audioQuoteLoading, setAudioQuoteLoading] = useState(false);
  const [audioQuoteError, setAudioQuoteError] = useState('');
  const publicPricing = useGetPublicInterpretationPricing({
    query: { staleTime: 60_000, retry: 1 },
  });
  const baseCredits = includeFaithReflection
    ? publicPricing.data?.spiritualCredits
    : publicPricing.data?.standardCredits;

  useEffect(() => {
    let active = true;
    const updateQuote = async () => {
      if (!user || !firebaseReady || projectMismatch) {
        setQuote(null);
        setQuoteLoading(false);
        setQuoteError('');
        return;
      }
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const nextQuote = await getAIInterpretationQuote(includeFaithReflection);
        if (active) setQuote(nextQuote);
      } catch (error) {
        if (active) {
          setQuote(null);
          setQuoteError(error instanceof Error
            ? error.message
            : 'The interpretation price is unavailable. No credits have been used.');
        }
      } finally {
        if (active) setQuoteLoading(false);
      }
    };
    void updateQuote();
    window.addEventListener('focus', updateQuote);
    return () => {
      active = false;
      window.removeEventListener('focus', updateQuote);
    };
  }, [user?.uid, firebaseReady, projectMismatch, quoteRefreshSequence, explanation, includeFaithReflection]);

  const audioFileEligible = Boolean(
    externalAudioFile &&
    externalAudioFile.size <= MAX_EXTERNAL_AUDIO_BYTES &&
    (externalAudioFile.type === 'audio/wav' || externalAudioFile.name.toLowerCase().endsWith('.wav')) &&
    externalAudioDurationSeconds >= 3 &&
    externalAudioDurationSeconds <= MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
  );

  useEffect(() => {
    setSendAudioForReview(false);
    setAudioQuote(null);
    setAudioQuoteError('');
  }, [externalAudioFile]);

  useEffect(() => {
    if (!sendAudioForReview || !audioFileEligible || !user || !firebaseReady || projectMismatch) {
      setAudioQuote(null);
      setAudioQuoteLoading(false);
      setAudioQuoteError('');
      return;
    }
    let active = true;
    setAudioQuoteLoading(true);
    setAudioQuoteError('');
    void getAIAudioInterpretationQuote({
      durationSeconds: externalAudioDurationSeconds,
      fileBytes: externalAudioFile!.size,
      includeFaithReflection,
    }).then(result => {
      if (active) setAudioQuote(result);
    }).catch(cause => {
      if (active) {
        setAudioQuote(null);
        setAudioQuoteError(cause instanceof Error
          ? cause.message
          : 'The advanced audio price is unavailable. No audio has been sent.');
      }
    }).finally(() => {
      if (active) setAudioQuoteLoading(false);
    });
    return () => { active = false; };
  }, [
    sendAudioForReview,
    audioFileEligible,
    externalAudioDurationSeconds,
    externalAudioFile?.size,
    includeFaithReflection,
    user?.uid,
    firebaseReady,
    projectMismatch,
    quoteRefreshSequence,
  ]);

  useEffect(() => {
    if (error) setQuoteRefreshSequence(value => value + 1);
  }, [error]);

  const activeQuote = sendAudioForReview ? audioQuote : quote;
  const faithReading = explanation?.faithReflection
    ? splitFaithReflection(explanation.faithReflection)
    : null;

  return (
    <section className="panel zc-analysis" aria-labelledby="zc-analysis-title" data-testid="panel-analysis">
      <div className="panel-head">
        <span className="panel-title" id="zc-analysis-title">ZionCore frequency reading</span>
        <BrainCircuit size={17} aria-hidden="true" />
      </div>
      <div className="section-body">
        <p className="zc-analysis-intro">
          ZionCore starts with measured frequency features—peaks, harmonics, drift, and pattern relationships—then explores them through five domain lenses. The optional personalised reading uses your context and the most fitting spiritual perspective; it never treats a scripture quote as evidence for the signal.
        </p>
        <p className="zc-callout">
          <span>Free local readings are available without an account in the <a href="#free-reading">Discovery tools</a>.
          This section is for optional credit-funded provider analysis.</span>
        </p>

        <div className="zc-context-field">
          <label htmlFor="zc-listening-context">What would you like ZionCore to consider? <span>Optional</span></label>
          <textarea
            id="zc-listening-context"
            value={listeningContext}
            onChange={event => setListeningContext(event.target.value)}
            maxLength={MAX_LISTENING_CONTEXT_CHARS}
            rows={4}
            placeholder="Share the frequencies or patterns that caught your attention, your faith or cultural lens, and what you want ZionCore to explore."
            disabled={loading}
            aria-describedby="zc-context-privacy zc-context-count"
            data-testid="input-listening-context"
          />
          <div className="zc-context-meta" id="zc-context-count">
            <span>{listeningContext.length}/{MAX_LISTENING_CONTEXT_CHARS}</span>
          </div>
          <p id="zc-context-privacy">
            A standard interpretation sends derived measurements, this note, and a compact ZionCore brief to Gemini; the same text data may go once to OpenAI if Gemini cannot return a valid report. Raw audio stays on this device unless you separately select the paid audio review below.
          </p>
        </div>

        <div className="zc-audio-sharing">
          <label className="zc-reflection-toggle" htmlFor="zc-send-audio-review">
            <input
              id="zc-send-audio-review"
              type="checkbox"
              checked={sendAudioForReview}
              onChange={event => setSendAudioForReview(event.target.checked)}
              disabled={loading || !audioFileEligible || !user || !firebaseReady || projectMismatch}
              data-testid="toggle-external-audio-review"
            />
            <span>
              <strong>Premium direct audio review · send this WAV to Gemini</strong>
              <small>
                {audioFileEligible
                  ? "Optional, one request at a time. The WAV uploads to ZionCore’s authenticated route and is sent to Gemini in short segments only after the full quoted credit amount is reserved. ZionCore does not store the recording; Google’s processing terms apply. Gemini notes and your chosen context may then go to OpenAI as text-only fallback."
                  : `Import a 3-second to 10-minute PCM WAV up to ${Math.round(MAX_EXTERNAL_AUDIO_BYTES / (1024 * 1024))} MB to enable this option. Other formats remain available for local analysis and standard interpretation.`}
              </small>
            </span>
          </label>
          {sendAudioForReview && (
            <div className="zc-callout" role="status" data-testid="panel-audio-quote">
              {audioQuoteLoading && !audioQuote ? (
                <span><LoaderCircle size={14} className="zc-loading-icon" /> Checking the advanced audio price… No audio has been sent.</span>
              ) : audioQuote ? (
                <div>
                  <strong>{audioQuote.credits} credits total</strong>
                  <span>Service value: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(audioQuote.amountMinor / 100)} · valid until {new Date(audioQuote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
                  <span>Includes the standard {audioQuote.baseCredits}-credit reading plus {audioQuote.addOnCredits} credits for direct Gemini audio review.</span>
                   <span>Available balance: {audioQuote.availableCredits} credits. ZionCore reserves all {audioQuote.credits} quoted credits before sending the WAV to Gemini; credits are charged only after a valid report.</span>
                  {!audioQuote.canAfford && <span>Add credits before requesting this review.</span>}
                </div>
              ) : audioQuoteError ? (
                <span>{audioQuoteError} Standard local-feature interpretation remains available.</span>
              ) : (
                <span>The advanced audio quote is unavailable. No audio has been sent.</span>
              )}
            </div>
          )}
        </div>

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
            <strong>Include a personalised spiritual reading</strong>
            <small>Get at least three substantial paragraphs based on measured features and your context, with relevant faith traditions considered respectfully.</small>
          </span>
        </label>

        <div className="zc-callout" role="status" data-testid="panel-interpretation-quote">
          {!user ? (
            <div>
              {baseCredits != null
                ? <strong>{baseCredits} credits per completed {includeFaithReflection ? 'spiritual' : 'standard'} AI interpretation.</strong>
                : publicPricing.isLoading
                  ? <span>Loading approved interpretation prices…</span>
                  : <span>Approved paid pricing could not be loaded. Free local readings remain available. <button type="button" className="btn btn-subtle" onClick={() => void publicPricing.refetch()}>Retry prices</button></span>}
              <span>Sign in to check your wallet and receive an account-bound quote before any paid processing.</span>
            </div>
          ) : sendAudioForReview ? (
            audioQuote ? (
              <div>
                <strong>{audioQuote.credits} credits for this audio review</strong>
                <span>Available balance: {audioQuote.availableCredits} credits.</span>
                  {audioQuote.canAfford
                   ? <span>All {audioQuote.credits} quoted credits are reserved before provider processing, charged only after a valid report, and released if generation fails.</span>
                  : <span>Add credits before generating. <Link href="/wallet">Compare credit packs</Link>.</span>}
              </div>
            ) : audioQuoteLoading ? (
              <span><LoaderCircle size={14} className="zc-loading-icon" /> Checking the audio price…</span>
            ) : (
              <span>{audioQuoteError || 'The advanced audio quote is unavailable. No audio has been sent.'}</span>
            )
          ) : quoteLoading && !quote ? (
            <span><LoaderCircle size={14} className="zc-loading-icon" /> Checking the current price and balance…</span>
          ) : quote ? (
            <div>
              <strong>{quote.credits} ZC credits per completed interpretation</strong>
              <span>Service value: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(quote.amountMinor / 100)} · valid until {new Date(quote.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span>
              <span>Available balance: {quote.availableCredits} credits.</span>
              {quoteLoading && <span>Refreshing price and balance…</span>}
              {!quote.canAfford && (
                <span>
                  Add credits before generating. Choose a credit pack below, or <Link href="/wallet" data-testid="link-analysis-wallet">compare membership and all offers</Link>.
                </span>
              )}
              {quote.canAfford && (
                <>
                  <span>All {quote.credits} quoted credits are reserved before AI generation, charged only after a valid report, and released if generation fails.</span>
                  <span>To recover a dropped response, completed readings are kept privately for up to 24 hours.</span>
                </>
              )}
            </div>
          ) : quoteError ? (
            <div>
              <span>{quoteError}</span>
              {firebaseReady && !projectMismatch && (
                <button className="btn btn-subtle" type="button" onClick={() => setQuoteRefreshSequence(value => value + 1)}>
                  Check again
                </button>
              )}
            </div>
          ) : (
            <span>The current price and wallet balance are unavailable. No paid reading can start until ZionCore can verify your account and quote.</span>
          )}
          {!user && <Link href="/history">Sign in or create an account</Link>}
        </div>

        {user && activeQuote && !activeQuote.canAfford && (
          <section className="zc-quick-credit-purchase" aria-labelledby="zc-quick-credit-title" data-testid="panel-inline-credit-purchase">
            <div className="zc-quick-credit-heading">
              <CreditCard size={15} aria-hidden="true" />
              <h3 id="zc-quick-credit-title">Continue this reading</h3>
            </div>
            <p>Choose a credit pack here. Stripe Checkout opens in a new tab, so this capture and your chosen context stay open. The current quote is {activeQuote.credits} credits; failed readings release their reserved credits.</p>
            <BillingOffers
              user={user}
              firebaseReady={firebaseReady}
              projectMismatch={projectMismatch}
              includePremium={false}
              interpretationCredits={activeQuote.credits}
            />
          </section>
        )}

        {error && (
          <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-analysis-error">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          className="btn btn-primary zc-analyze-button"
          type="button"
          disabled={
            !canAnalyze ||
            loading ||
            quoteLoading ||
            audioQuoteLoading ||
            !user ||
            !activeQuote?.canAfford ||
            (sendAudioForReview && (!audioFileEligible || !audioQuote))
          }
          onClick={async () => {
            if (sendAudioForReview && audioQuote && externalAudioFile) {
              await onAnalyze(includeFaithReflection, listeningContext, audioQuote, externalAudioFile);
              setQuoteRefreshSequence(value => value + 1);
            } else if (quote) {
              await onAnalyze(includeFaithReflection, listeningContext, quote);
              setQuoteRefreshSequence(value => value + 1);
            }
          }}
          data-testid="button-analyze-measurement"
        >
          {loading ? <LoaderCircle className="zc-loading-icon" size={15} /> : <Microscope size={15} />}
          {loading
            ? 'Reading frequency patterns…'
            : activeQuote
              ? `${sendAudioForReview ? 'Run premium audio review' : explanation ? 'Refresh interpretation' : 'Run full interpretation'} · ${activeQuote.credits} credits`
              : !user
                ? 'Sign in for a deeper AI reading'
                : quoteLoading || audioQuoteLoading
                  ? 'Checking your interpretation price…'
                  : 'A verified quote is required'}
        </button>
        {!hasMeasurement && (
          <p className="permission-note" role="status" data-testid="status-analysis-needs-measurement">
            Capture a microphone reading or import a recording first. No interpretation is generated without measured frequencies.
          </p>
        )}
        {hasMeasurement && !canAnalyze && (
          <p className="permission-note" role="status" data-testid="status-analysis-needs-window">
            Continue the capture for at least three seconds to build a temporal profile before analysis.
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
            <section className="zc-output-section zc-output-executive" data-testid="output-executive-summary">
              <div className="zc-output-heading"><BrainCircuit size={14} aria-hidden="true" /><h3>Executive reading</h3></div>
              <p>{explanation.executiveSummary}</p>
            </section>

            <section className="zc-signal-hero" data-testid="output-pattern-signature">
              <div className="zc-signal-hero-top">
                <span className="zc-signal-kicker">Signal family</span>
                <span className="zc-signal-family">{explanation.signalFamily}</span>
                <span className={`zc-confidence confidence-${explanation.confidence}`} data-testid="value-analysis-confidence">
                  {explanation.confidence} confidence
                </span>
              </div>
              <p>{explanation.patternSignature}</p>
              <small>{explanation.confidenceScope}</small>
            </section>

            <section className="zc-output-section zc-output-integrated" data-testid="output-integrated-reading">
              <div className="zc-output-heading"><AudioLines size={14} aria-hidden="true" /><h3>Integrated interpretation</h3></div>
              <p>{explanation.integratedReading}</p>
            </section>

            <section className="zc-output-section zc-output-science" data-testid="output-scientific-interpretation">
              <div className="zc-output-heading">
                <Microscope size={14} aria-hidden="true" />
                <h3>Pattern analysis</h3>
              </div>
              <p>{explanation.harmonicAnalysis}</p>
            </section>

            <div className="zc-analysis-grid">
              <section className="zc-analysis-card" data-testid="output-temporal-analysis">
                <div className="zc-output-heading"><Activity size={14} aria-hidden="true" /><h3>Temporal dynamics</h3></div>
                <p>{explanation.temporalAnalysis}</p>
              </section>
              <section className="zc-analysis-card" data-testid="output-modulation-analysis">
                <div className="zc-output-heading"><AudioLines size={14} aria-hidden="true" /><h3>Modulation reading</h3></div>
                <p>{explanation.modulationAnalysis}</p>
              </section>
            </div>

            <section className="zc-output-section" data-testid="output-domain-perspectives">
              <div className="zc-output-heading"><Microscope size={14} aria-hidden="true" /><h3>Five domain perspectives</h3></div>
              <div className="zc-domain-list">
                {explanation.domainPerspectives.map(perspective => (
                  <article className="zc-domain-card" key={perspective.domain}>
                    <div className="zc-domain-card-head">
                      <strong>{domainTitles[perspective.domain]}</strong>
                      <span>{relevanceTitles[perspective.relevance]}</span>
                    </div>
                    <p>{perspective.analysis}</p>
                    <small>{perspective.evidenceBoundary}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="zc-output-section" data-testid="output-key-takeaways">
              <div className="zc-output-heading"><ListChecks size={14} aria-hidden="true" /><h3>Key takeaways</h3></div>
              <ol className="zc-report-list">
                {explanation.keyTakeaways.map((takeaway, index) => <li key={`${index}-${takeaway}`}>{takeaway}</li>)}
              </ol>
            </section>

            <section className="zc-output-section" data-testid="output-candidate-explanations">
              <div className="zc-output-heading"><span className="zc-heading-mark" aria-hidden="true" /><h3>Candidate interpretations</h3></div>
              {explanation.candidateExplanations.length > 0 ? (
                <div className="zc-candidate-list">
                  {explanation.candidateExplanations.map((candidate, index) => (
                    <article className="zc-candidate" key={`${candidate.label}-${index}`} data-testid={`candidate-${index}`}>
                      <div className="zc-candidate-top">
                        <strong>{candidate.label}</strong>
                        <span className={`zc-confidence confidence-${candidate.confidence}`}>{candidate.confidence}</span>
                      </div>
                      <p>{candidate.rationale}</p>
                      <small><strong>Supporting evidence:</strong> {candidate.evidenceFor}</small>
                      <small><strong>Evidence against or missing:</strong> {candidate.evidenceAgainst}</small>
                      <small><strong>What would distinguish it:</strong> {candidate.whatWouldDiscriminate}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No candidate interpretations were supported by this capture.</p>
              )}
            </section>

            <Suspense fallback={<section className="zc-output-section" aria-label="Bioacoustic evidence scope" />}>
              <BioacousticEvidencePanel />
            </Suspense>

            <section className="zc-output-section" data-testid="output-data-quality">
              <div className="zc-output-heading"><Activity size={14} aria-hidden="true" /><h3>Data quality &amp; interpretation range</h3></div>
              <p>{explanation.dataQuality}</p>
            </section>

            <section className="zc-output-section" data-testid="output-follow-up-experiments">
              <div className="zc-output-heading"><FlaskConical size={14} aria-hidden="true" /><h3>Experiments to deepen the reading</h3></div>
              <div className="zc-domain-list">
                {explanation.followUpExperiments.map((experiment, index) => (
                  <article className="zc-domain-card" key={`${index}-${experiment.title}`}>
                    <strong>{experiment.title}</strong>
                    <p>{experiment.method}</p>
                    <small><strong>Record:</strong> {experiment.whatToRecord}</small>
                  </article>
                ))}
              </div>
            </section>

            <section className="zc-output-section" data-testid="output-uncertainty">
              <div className="zc-output-heading"><AlertCircle size={14} aria-hidden="true" /><h3>Uncertainty</h3></div>
              <p>{explanation.uncertainty}</p>
            </section>

            <section className="zc-output-section" data-testid="output-reflection-questions">
              <div className="zc-output-heading"><BookOpen size={14} aria-hidden="true" /><h3>Questions for your own reflection</h3></div>
              <ul className="zc-report-list">
                {explanation.reflectionQuestions.map((question, index) => <li key={`${index}-${question}`}>{question}</li>)}
              </ul>
            </section>

            {faithReading && (
              <section className="zc-output-section zc-output-reflection" data-testid="output-faith-reflection">
                <div className="zc-output-heading"><BookOpen size={14} aria-hidden="true" /><h3>Personalised spiritual reading</h3></div>
                {faithReading.paragraphs.map((paragraph, index) => <p key={`faith-paragraph-${index}`}>{paragraph}</p>)}
                {faithReading.sacredTextEcho && (
                  <aside className="zc-sacred-text-echo" data-testid="output-sacred-text-echo">
                    <small>Optional sacred-text echo · separate from the measured analysis</small>
                    <blockquote>{faithReading.sacredTextEcho}</blockquote>
                  </aside>
                )}
                <small>A personal interpretation of possible meaning, not a verified identification of a divine source.</small>
              </section>
            )}

            {explanation.audioReview && (
              <section className="zc-output-section zc-audio-review-result" data-testid="output-audio-review">
                <div className="zc-output-heading"><AudioLines size={14} aria-hidden="true" /><h3>Direct audio review</h3></div>
                <p>Gemini reviewed {explanation.audioReview.segmentCount} short WAV segment{explanation.audioReview.segmentCount === 1 ? '' : 's'} using {explanation.audioReview.model}. These are exploratory model observations; the main report compares them with local measurements. Animal and environmental reference links are not loaded or benchmarked, so class precision and recall are unknown. Any source, species, behavior, or intent suggestion remains unverified.</p>
                <p className="zc-audio-review-summary">{explanation.audioReview.summary}</p>
              </section>
            )}

            <div className="zc-analysis-meta" data-testid="text-analysis-model">Provider · {explanation.provider} · {explanation.model}{explanation.fallbackUsed ? ' (fallback used)' : ''}</div>
            <section className="zc-output-section zc-experiment-next" data-testid="section-experiment-next">
              <div className="zc-output-heading"><AudioLines size={14} aria-hidden="true" /><h3>Continue this investigation</h3></div>
              <p>Save a Signal Card above if you want to keep this reading, then open the acoustic message workspace in a separate tab. Encode and play a response there; return to this lab to record a follow-up signal.</p>
              <div className="zc-experiment-next-actions">
                <a href="#signal-cards" className="btn btn-subtle" data-testid="link-analysis-save-card">Review Signal Card options</a>
                <Link href="/messages" target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="link-analysis-acoustic-response">Compose an acoustic response</Link>
              </div>
            </section>
            <section className="zc-output-section zc-analysis-purchase" data-testid="panel-analysis-purchase">
              <div className="zc-output-heading"><CreditCard size={14} aria-hidden="true" /><h3>Choose your next chapter</h3></div>
              <p>Add a credit pack for another reading. Premium is a separate monthly membership; interpretation credits are purchased separately.</p>
              <BillingOffers
                user={user}
                firebaseReady={firebaseReady}
                projectMismatch={projectMismatch}
                interpretationCredits={quote?.credits ?? null}
              />
            </section>
          </div>
        )}
        <div id="signal-cards">
          <Suspense fallback={<p className="empty-inline" role="status">Preparing saved signal cards…</p>}>
            <SignalCardStudio
              key={user?.uid ?? 'signed-out'}
              userId={user?.uid ?? null}
              explanation={loading ? null : explanation}
              capture={cardCapture ?? null}
            />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

export default AnalysisPanel;
