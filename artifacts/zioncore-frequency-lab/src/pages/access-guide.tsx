import React from 'react';
import { Link } from 'wouter';
import ResearchAgentEvaluationPanel from '@/components/research-agent-evaluation-panel';
import ProtocolBenchmarkPanel from '@/components/protocol-benchmark-panel';
import ProtocolPrototypeSandbox from '@/components/protocol-prototype-sandbox';
import {
  ArrowRight, AudioLines, Check, Cloud, Database, Download, FileQuestion,
  LockKeyhole, MapPin, Mic, Radio, ShieldCheck, Waves,
} from 'lucide-react';
import {
  AI_PROVIDER_DOCUMENTATION,
  CONNECTED_MODEL_PROVIDER,
  EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD,
  FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD,
  GEMINI_3_8_FLASH_STANDARD_PRICING,
  getCurrentProviderRuntimeAssessment,
} from '@/lib/ai-provider-inventory';
import { FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS } from '@/lib/ai-analysis';
import {
  runResearchAgentEvaluation,
  type ResearchAgentEvaluationReport,
} from '@/lib/research-agent-evaluation';
import { researchAgentRouter } from '@/lib/research-grid';
import { runProtocolBenchmarkSuite, type ProtocolBenchmarkReport } from '@/lib/protocol-benchmark';
import './access-guide.css';

const researchAgentScopeLabels: Record<string, string> = {
  'acoustic.frequency-and-amplitude-metrics': 'dominant-frequency and relative RMS measurements',
  'aggregate.session-count': 'aggregate count of sessions with observations',
};

const researchAgentToolLabels: Record<string, string> = {
  'tool.local.acoustic-statistics': 'deterministic local acoustic statistics',
  'tool.approved.firebase-ai-json': 'Firebase AI JSON request (not enabled for this role)',
};

const researchAgentActionLabels: Record<string, string> = {
  'read-measurement-summary': 'read scoped measurement summaries',
  'calculate-descriptive-statistics': 'calculate descriptive statistics',
  'request-approved-model': 'request an approved model',
  'return-structured-output': 'return validated structured output',
};

const localCapabilities = [
  {
    icon: Mic,
    title: 'Live microphone measurements',
    text: 'Spectrum, peak, RMS, and FFT measurements are available free, in your browser, without an account. Capture begins only when you start it and grant browser microphone permission. Raw audio is processed locally; it is not recorded or uploaded.',
    testId: 'access-local-microphone',
  },
  {
    icon: AudioLines,
    title: 'WAV file analysis',
    text: 'Supported WAV files are measured locally (up to 24 MB and 10 minutes). Bioacoustic event segmentation has a stricter 60-second limit. Source audio is not uploaded by these local tools.',
    testId: 'access-local-wav-analysis',
  },
  {
    icon: Waves,
    title: 'Signal synthesis and playback',
    text: 'Bounded waveform generation, filtering, modulation, and WAV export run in browser DSP. Playback is optional, begins only after your action, and uses the current device output rather than a cloud service.',
    testId: 'access-local-dsp',
  },
  {
    icon: Database,
    title: 'Observation and research archives',
    text: 'Saved observations, session summaries, and your research notes stay in this browser’s storage. Browser storage is not encrypted. When signed in, the device archive is still local to this browser and is not cloud-synced.',
    testId: 'access-local-archives',
  },
  {
    icon: MapPin,
    title: 'Location and ecology privacy',
    text: 'This version does not request browser geolocation, and normalized sensor records reject coordinate fields. Sensitive ecology locations are omitted from shared research; any future location-sharing flow must be explicit and coarse-grained.',
    testId: 'access-location-privacy',
  },
  {
    icon: AudioLines,
    title: 'Compose and inspect a test packet',
    text: 'Supported local DTMF encoding, hexadecimal symbol decoding, and PCM/IEEE-float WAV packet recovery (8–96 kHz) run in the browser with checksum verification. WAV import does not activate the microphone. Playback is optional and requires your explicit consent; it plays through this device’s local speaker and is not external transmission.',
    testId: 'access-local-packet',
  },
  {
    icon: Download,
    title: 'Compare and export locally',
    text: 'Compare selected local research summaries and export observation data as JSON or CSV. These tools do not upload your notes or audio.',
    testId: 'access-local-export',
  },
];

export default function AccessGuidePage() {
  const [evaluationReport, setEvaluationReport] = React.useState<ResearchAgentEvaluationReport | null>(null);
  const [evaluationError, setEvaluationError] = React.useState('');
  const [protocolBenchmarkReport, setProtocolBenchmarkReport] = React.useState<ProtocolBenchmarkReport | null>(null);
  const [protocolBenchmarkRunning, setProtocolBenchmarkRunning] = React.useState(false);
  const [protocolBenchmarkError, setProtocolBenchmarkError] = React.useState('');
  const providerRuntime = getCurrentProviderRuntimeAssessment();
  const configurationLabel = {
    'project-mismatch': 'Blocked: Firebase project mismatch',
    'not-configured': 'Not configured in this build',
    initialized: providerRuntime.aiRequestsAllowed
      ? 'Backend route available; live model not tested'
      : 'Paused: no verified cost-quoted research route',
  }[providerRuntime.configuration];
  const runEvaluation = () => {
    try {
      setEvaluationReport(runResearchAgentEvaluation());
      setEvaluationError('');
    } catch {
      setEvaluationReport(null);
      setEvaluationError('The local evaluation could not finish. No external request was made.');
    }
  };
  const runProtocolBenchmark = () => {
    if (protocolBenchmarkRunning) return;
    setProtocolBenchmarkRunning(true);
    setProtocolBenchmarkError('');
    window.setTimeout(() => {
      try {
        setProtocolBenchmarkReport(runProtocolBenchmarkSuite());
      } catch {
        setProtocolBenchmarkReport(null);
        setProtocolBenchmarkError('The local protocol benchmark could not finish. No service or audio device was used.');
      } finally {
        setProtocolBenchmarkRunning(false);
      }
    }, 0);
  };

  return <main id="main-content" className="page-wrap access-page" tabIndex={-1} data-testid="page-access-guide">
    <div className="access-hero">
      <div className="access-hero-copy">
        <div className="eyebrow">Use & privacy / 01</div>
        <h1 className="page-title">Know what stays here.</h1>
        <p className="lead">A careful browser laboratory: measure, analyze, synthesize, encode, and compare signals locally. This guide separates on-device tools from the few optional services that need an account.</p>
      </div>
      <div className="access-seal" aria-hidden="true"><Waves size={24} /><span>LOCAL<br />FIRST</span></div>
    </div>

    <div className="access-summary" data-testid="access-summary">
      <span className="access-summary-mark"><ShieldCheck size={17} /></span>
      <p><strong>Start without an account.</strong> Measurement, WAV analysis, signal synthesis, supported encoding, and comparison stay in your browser. The microphone is not active until you choose to start and approve browser permission.</p>
    </div>

    <section className="access-section" aria-labelledby="access-local-heading">
      <div className="access-section-head">
        <div className="access-section-index">01</div>
        <div><div className="eyebrow">Free and local</div><h2 id="access-local-heading">Your browser does the work.</h2></div>
        <span className="access-tag access-tag-local"><LockKeyhole size={12} />No account</span>
      </div>
      <div className="access-local-list" data-testid="access-local-features">
        {localCapabilities.map(({ icon: Icon, title, text, testId }, index) => <article className="access-local-item" key={testId} data-testid={testId}>
          <div className="access-item-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="access-item-icon"><Icon size={17} /></div>
          <div className="access-item-copy"><h3>{title}</h3><p>{text}</p></div>
          <Check className="access-item-check" size={16} aria-hidden="true" />
        </article>)}
      </div>
    </section>

    <section className="access-section access-cloud-section" aria-labelledby="access-cloud-heading" data-testid="access-cloud-features">
      <div className="access-section-head">
        <div className="access-section-index">02</div>
        <div><div className="eyebrow">Optional cloud services</div><h2 id="access-cloud-heading">A clear boundary.</h2></div>
        <span className="access-tag access-tag-cloud"><Cloud size={12} />Account required</span>
      </div>
      <div className="access-cloud-grid">
        <article className="access-cloud-card" data-testid="access-ai-explanation">
          <div className="access-card-top"><AudioLines size={17} /><span>{providerRuntime.projectSecurityGate === 'confirmed-by-operator' ? 'Security gates confirmed' : 'Paused pending project security'}</span></div>
          <h3>AI explanation</h3>
          <p>Paid measurement interpretation uses the authenticated, quoted application API. It requires sign-in and App Check. A separate Firebase AI Logic client path remains paused until its token exchange, project settings, privacy terms, and cost controls are verified. Measurement summaries exclude raw audio and notes; optional audio review is a separate, explicitly consented service.</p>
          <div className="access-card-foot">Explicit request · Firebase Authentication + App Check</div>
        </article>
        <article className="access-cloud-card access-cloud-paused" data-testid="access-cloud-history">
          <div className="access-card-top"><Cloud size={17} /><span className="access-paused-label">Paused</span></div>
          <h3>Account cloud history</h3>
          <p>Cloud history requires sign-in plus separately enabled Firestore access and App Check. It is currently paused pending production rules and token verification. Do not treat it as an active archive.</p>
          <div className="access-card-foot">Device archive remains local and separate</div>
        </article>
      </div>
    </section>

    <section className="access-section access-provider-inventory" aria-labelledby="access-provider-heading" data-testid="ai-provider-inventory">
      <div className="access-section-head">
        <div className="access-section-index">03</div>
        <div><div className="eyebrow">Model provider inventory</div><h2 id="access-provider-heading">Provider status and cost controls.</h2></div>
        <span className="access-tag access-tag-cloud">No automatic routing</span>
      </div>

      <article className="provider-inventory-card">
        <div className="provider-inventory-title">
          <div>
            <div className="eyebrow">Candidate provider; client requests disabled</div>
            <h3>{CONNECTED_MODEL_PROVIDER.label}</h3>
            <p>{CONNECTED_MODEL_PROVIDER.backend} · <code>{CONNECTED_MODEL_PROVIDER.modelId}</code></p>
          </div>
          <span className={`provider-status provider-status-${providerRuntime.configuration}`} role="status" data-testid="status-ai-provider-configuration">
            {configurationLabel}
          </span>
        </div>

        <dl className="provider-inventory-facts">
          <div>
            <dt>Model support and live availability</dt>
            <dd>{CONNECTED_MODEL_PROVIDER.modelListedAsSupported ? 'The model is listed in Firebase’s supported-model catalogue.' : 'Model support has not been verified.'} This project’s live response, quota, billing tier, and App Check token exchange have not been tested from this page.</dd>
          </div>
          <div>
            <dt>App Check</dt>
            <dd>{providerRuntime.appCheck === 'initialized-token-unverified'
              ? 'The App Check SDK is initialized; a valid token exchange is not confirmed. Firebase AI Logic requires App Check enforcement.'
              : 'App Check is not initialized in this build.'}</dd>
          </div>
          <div>
            <dt>Sign-in and request protection</dt>
            <dd>
              This candidate Firebase AI Logic request path is disabled. Existing paid interpretation stays on the authenticated application API with its price quote, payment protections, and recovery workflow. Do not enable a browser-to-provider path without verified App Check token exchange, reviewed Firebase project settings, privacy terms, project quotas, and a cost-controlled backend design.
            </dd>
          </div>
          <div>
            <dt>What leaves the browser</dt>
            <dd>For measurement explanations, the prompt contains {CONNECTED_MODEL_PROVIDER.dataSent.join('; ')}. For experiment design, it contains {CONNECTED_MODEL_PROVIDER.experimentDesignDataSent.join('; ')} only after explicit consent. The design prompt excludes {CONNECTED_MODEL_PROVIDER.experimentDesignDataNotSent.join('; ')}. {CONNECTED_MODEL_PROVIDER.requestCredentials}</dd>
          </div>
          <div>
            <dt>Latency record</dt>
            <dd>{CONNECTED_MODEL_PROVIDER.latency} No cross-customer latency aggregate is collected.</dd>
          </div>
          <div>
            <dt>Quota</dt>
              <dd>{CONNECTED_MODEL_PROVIDER.quota} The existing paid interpretation API applies its own request and recovery controls. This candidate direct provider path is disabled; client controls are not a replacement for project quotas.</dd>
          </div>
          <div>
            <dt>Public model price reference</dt>
            <dd>
              Checked {GEMINI_3_8_FLASH_STANDARD_PRICING.verifiedOn}: for Gemini 3.8 Flash, the free tier has no token charge and may use submitted content to improve products; the paid standard tier is ${GEMINI_3_8_FLASH_STANDARD_PRICING.inputUsdPerMillionTokens.toFixed(2)} per million input tokens and ${GEMINI_3_8_FLASH_STANDARD_PRICING.outputUsdPerMillionTokens.toFixed(2)} per million output tokens through December 31, 2026.
              The output-token component is at most ${FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD.toFixed(5)} for a {FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS}-token measurement explanation, or ${EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD.toFixed(5)} for a {CONNECTED_MODEL_PROVIDER.experimentDesignOutputTokenLimit}-token experiment proposal; input is extra. Actual project tier and per-request token usage are not visible here.
              These are provider list prices, not ZionCore customer prices; the candidate path is disabled.
            </dd>
          </div>
        </dl>

        <div className="provider-data-use-note" data-testid="text-ai-provider-data-use">
          <strong>Data-use note:</strong> Google’s published pricing table says the free tier may use submitted content to improve products and the paid tier does not. The project’s active tier and applicable terms are not verifiable from browser code. The candidate route is disabled; do not send sensitive information.
        </div>

        <div className="provider-doc-links" aria-label="Provider documentation">
          <a href={AI_PROVIDER_DOCUMENTATION.supportedModels} target="_blank" rel="noreferrer">Supported models</a>
          <a href={AI_PROVIDER_DOCUMENTATION.firebasePricing} target="_blank" rel="noreferrer">Firebase pricing</a>
          <a href={AI_PROVIDER_DOCUMENTATION.firebaseQuotas} target="_blank" rel="noreferrer">Quota rules</a>
          <a href={AI_PROVIDER_DOCUMENTATION.authenticatedUsersMode} target="_blank" rel="noreferrer">Authenticated-user enforcement</a>
          <a href={AI_PROVIDER_DOCUMENTATION.geminiPricing} target="_blank" rel="noreferrer">Gemini API prices</a>
          <a href={AI_PROVIDER_DOCUMENTATION.geminiTerms} target="_blank" rel="noreferrer">Gemini API terms</a>
        </div>
        <div className="research-agent-policy" data-testid="panel-research-agent-permissions">
          <div className="eyebrow">Read-only research agents</div>
          {researchAgentRouter.list().map(agent => (
            <article className="research-agent-policy-item" key={agent.id} data-testid={`agent-policy-${agent.id}`}>
              <h4>{agent.role.label}</h4>
              <p>{agent.role.description}</p>
              <dl>
                <div><dt>Data scope</dt><dd>{agent.role.dataScopes.map(scope => researchAgentScopeLabels[scope] ?? scope).join('; ')}</dd></div>
                <div><dt>Tools and actions</dt><dd>{agent.role.tools.map(tool => researchAgentToolLabels[tool] ?? tool).join('; ')}. {agent.role.permittedActions.map(action => researchAgentActionLabels[action] ?? action).join('; ')}.</dd></div>
                <div><dt>Budget and input bound</dt><dd>${agent.role.maxCostUsd.toFixed(2)} maximum estimated cost per request; up to {agent.role.maxObservations} observations.</dd></div>
                <div><dt>Denied capabilities</dt><dd>Personal text, identity, record writes, arbitrary network, capture, playback, transmission, billing, and administration.</dd></div>
              </dl>
            </article>
          ))}
          <p className="provider-inventory-footnote">Only deterministic browser processing is enabled in this registry. It receives an immutable projection without source IDs, timestamps, instrument IDs, notes, or messages. Cloud AI is a separate, explicitly requested path and remains blocked until Firebase project safeguards are confirmed.</p>
        </div>
        <ResearchAgentEvaluationPanel
          report={evaluationReport}
          error={evaluationError}
          onRun={runEvaluation}
        />
      </article>
    </section>

    <ProtocolBenchmarkPanel
      report={protocolBenchmarkReport}
      running={protocolBenchmarkRunning}
      error={protocolBenchmarkError}
      onRun={runProtocolBenchmark}
    />

    <ProtocolPrototypeSandbox />

    <section className="access-outside" aria-labelledby="access-outside-heading" data-testid="access-not-included">
      <div className="access-outside-icon"><FileQuestion size={18} /></div>
      <div className="access-outside-copy">
        <div className="eyebrow">Scope of this artifact</div>
        <h2 id="access-outside-heading">What this lab does not include.</h2>
        <p>Stripe, credits, premium gates, compressed-audio formats beyond bounded WAV import, RF reception, and external transmission are not part of this Frequency Lab artifact. Payment and credit features are not implemented in this lab only. This statement is about this lab, not the main ZionCore site.</p>
        <div className="access-outside-list" data-testid="access-excluded-list">
          <span><span aria-hidden="true">—</span> Stripe, credits, or premium gates</span>
          <span><span aria-hidden="true">—</span> Non-WAV audio import or RF reception</span>
          <span><span aria-hidden="true">—</span> External transmission</span>
        </div>
      </div>
      <Radio className="access-outside-watermark" size={78} aria-hidden="true" />
    </section>

    <div className="access-next" data-testid="access-navigation">
      <span>Continue with a local tool</span>
      <div>
        <Link href="/" className="access-next-link" data-testid="link-access-live-lab"><Mic size={14} />Live lab<ArrowRight size={14} /></Link>
        <Link href="/exploration" className="access-next-link" data-testid="link-access-exploration"><AudioLines size={14} />Exploration<ArrowRight size={14} /></Link>
      </div>
    </div>
    <p className="footnote access-footnote" data-testid="access-storage-note">Local browser storage is not encrypted. Use a device profile you trust and avoid saving sensitive personal details.</p>
  </main>;
}
