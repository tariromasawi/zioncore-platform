import {
  firebaseAiClientConfigured,
  firebaseAiProjectSecurityConfirmed,
  firebaseAppCheck,
  firebaseProjectMismatch,
} from '@/lib/firebase';
import { FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS, FREQUENCY_EXPLANATION_MODEL } from '@/lib/ai-analysis';
import { EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS } from '@/lib/ai-experiment-design';

export const AI_PROVIDER_DOCUMENTATION = {
  supportedModels: 'https://firebase.google.com/docs/ai-logic/models',
  firebasePricing: 'https://firebase.google.com/docs/ai-logic/pricing',
  firebaseQuotas: 'https://firebase.google.com/docs/ai-logic/quotas',
  authenticatedUsersMode: 'https://firebase.google.com/docs/ai-logic/auth-mode?api=dev',
  geminiPricing: 'https://ai.google.dev/gemini-api/docs/pricing',
  geminiTerms: 'https://ai.google.dev/gemini-api/terms',
} as const;

export const GEMINI_3_8_FLASH_STANDARD_PRICING = {
  verifiedOn: '2026-11-14',
  inputUsdPerMillionTokens: 0.75,
  outputUsdPerMillionTokens: 3.75,
  freeTierPerMillionTokensUsd: 0,
  freeTierMayBeUsedToImproveProducts: true,
  paidTierMayBeUsedToImproveProducts: false,
} as const;

export const FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD =
  (FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS / 1_000_000)
  * GEMINI_3_8_FLASH_STANDARD_PRICING.outputUsdPerMillionTokens;
export const EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD =
  (EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS / 1_000_000)
  * GEMINI_3_8_FLASH_STANDARD_PRICING.outputUsdPerMillionTokens;

export type ProviderRuntimeState = {
  projectMismatch: boolean;
  aiConfigured: boolean;
  appCheckInitialized: boolean;
  appCheckTokenExchangeVerified: boolean;
  projectSecurityConfirmed: boolean;
  costGuardedBackendAvailable: boolean;
};

export type ProviderRuntimeAssessment = {
  configuration: 'project-mismatch' | 'not-configured' | 'initialized';
  appCheck: 'missing' | 'initialized-token-unverified' | 'token-verified';
  projectSecurityGate: 'confirmed-by-operator' | 'not-confirmed';
  requestPath: 'cost-quoted-backend-ready' | 'disabled-no-cost-quoted-route';
  aiRequestsAllowed: boolean;
  liveModelAvailability: 'not-tested';
  projectQuota: 'not-readable-from-client';
  projectBillingTier: 'not-readable-from-client';
};

export const CONNECTED_MODEL_PROVIDER = {
  id: 'firebase-ai-logic-gemini-developer-api',
  label: 'Gemini 3.8 Flash (Firebase AI Logic candidate; request path paused)',
  backend: 'GoogleAIBackend / Gemini Developer API; no cost-quoted research-design route is connected',
  modelId: FREQUENCY_EXPLANATION_MODEL,
  configuredInCode: true,
  modelListedAsSupported: true,
  docsVerifiedOn: '2026-11-14',
  auth: 'This candidate client route is disabled. Existing paid interpretation uses the authenticated, quoted application API; project-wide Firebase AI enforcement is not read from client code.',
  appCheck: 'Firebase App Check is required for Firebase AI Logic as of 2026-11-02. SDK initialization does not prove that a token exchange succeeded.',
  dataSent: [
    'Sample rate and FFT size',
    'Frequency resolution and dominant frequency',
    'Up to six spectral peak frequencies',
    'Relative RMS level and measurement duration',
  ],
  dataNotSent: [
    'Raw audio or microphone recordings',
    'Spectrum bins',
    'User notes or family/devotional records',
    'Account email or display name in the model prompt',
  ],
  experimentDesignDataSent: [
    'The user-entered research question (up to 300 characters)',
    'The selected registered research domain and its public description',
    'Up to eight validated numeric observation summaries',
  ],
  experimentDesignDataNotSent: [
    'Raw audio or recordings',
    'Message or prayer text',
    'Observation notes, dates, session ID, account identity, or personal reflections',
  ],
  experimentDesignOutputTokenLimit: EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS,
  requestCredentials: 'No candidate-provider request is currently sent. Future requests must use verified identity, App Check, explicit consent, and the existing cost-controlled service boundary.',
  latency: 'A browser-measured request round trip is attached to each successful result. It includes network and response parsing, not provider-only inference time.',
  quota: 'Firebase documents a default 100 generate-content requests per minute per user for Firebase AI Logic, plus provider/model RPM/RPD/TPM/TPD limits. These limits are project-level and the active project values are not readable from this client. Quota responses are handled; the app also applies a 15-second per-tab cooldown.',
  cost: 'For the Gemini 3.8 Flash standard tier, Google lists $0.75 per million input tokens and $3.75 per million output tokens through December 31, 2026; the listed prices change on January 1, 2027. A 700-token output is at most $0.002625; input cost is additional. The active project tier and actual per-call token usage are not available in client code.',
  dataUse: 'Google’s published pricing table says the free tier may use submitted content to improve products and the paid tier does not. The applicable project tier is not verifiable from browser code; avoid sending sensitive information.',
  sources: AI_PROVIDER_DOCUMENTATION,
} as const;

export function assessProviderRuntime(state: ProviderRuntimeState): ProviderRuntimeAssessment {
  return {
    configuration: state.projectMismatch
      ? 'project-mismatch'
      : state.aiConfigured
        ? 'initialized'
        : 'not-configured',
    appCheck: !state.appCheckInitialized
      ? 'missing'
      : state.appCheckTokenExchangeVerified
        ? 'token-verified'
        : 'initialized-token-unverified',
    projectSecurityGate: state.projectSecurityConfirmed ? 'confirmed-by-operator' : 'not-confirmed',
    requestPath: state.costGuardedBackendAvailable
      ? 'cost-quoted-backend-ready'
      : 'disabled-no-cost-quoted-route',
    aiRequestsAllowed: state.costGuardedBackendAvailable
      && !state.projectMismatch
      && state.aiConfigured
      && state.appCheckInitialized
      && state.appCheckTokenExchangeVerified
      && state.projectSecurityConfirmed,
    liveModelAvailability: 'not-tested',
    projectQuota: 'not-readable-from-client',
    projectBillingTier: 'not-readable-from-client',
  };
}

export function getCurrentProviderRuntimeAssessment() {
  return assessProviderRuntime({
    projectMismatch: firebaseProjectMismatch,
    aiConfigured: firebaseAiClientConfigured,
    appCheckInitialized: Boolean(firebaseAppCheck),
    appCheckTokenExchangeVerified: false,
    projectSecurityConfirmed: firebaseAiProjectSecurityConfirmed,
    costGuardedBackendAvailable: false,
  });
}
