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

export const GEMINI_FLASH_LITE_STANDARD_PRICING = {
  verifiedOn: '2026-11-12',
  inputUsdPerMillionTokens: 0.3,
  outputUsdPerMillionTokens: 2.5,
  freeTierPerMillionTokensUsd: 0,
  freeTierMayBeUsedToImproveProducts: true,
  paidTierMayBeUsedToImproveProducts: false,
} as const;

export const FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD =
  (FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS / 1_000_000)
  * GEMINI_FLASH_LITE_STANDARD_PRICING.outputUsdPerMillionTokens;
export const EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD =
  (EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS / 1_000_000)
  * GEMINI_FLASH_LITE_STANDARD_PRICING.outputUsdPerMillionTokens;

export type ProviderRuntimeState = {
  projectMismatch: boolean;
  aiConfigured: boolean;
  appCheckInitialized: boolean;
  projectSecurityConfirmed: boolean;
};

export type ProviderRuntimeAssessment = {
  configuration: 'project-mismatch' | 'not-configured' | 'initialized';
  appCheck: 'missing' | 'initialized-token-unverified';
  projectSecurityGate: 'confirmed-by-operator' | 'not-confirmed';
  aiRequestsAllowed: boolean;
  liveModelAvailability: 'not-tested';
  projectQuota: 'not-readable-from-client';
  projectBillingTier: 'not-readable-from-client';
};

export const CONNECTED_MODEL_PROVIDER = {
  id: 'firebase-ai-logic-gemini-developer-api',
  label: 'Google Gemini through Firebase AI Logic',
  backend: 'GoogleAIBackend / Gemini Developer API',
  modelId: FREQUENCY_EXPLANATION_MODEL,
  configuredInCode: true,
  modelListedAsSupported: true,
  docsVerifiedOn: '2026-11-12',
  auth: 'Client code requires Firebase sign-in and refreshes an ID token before each explicit request. Firebase also offers project-wide authenticated-users enforcement; the active setting is not read from client code.',
  appCheck: 'Firebase App Check is required for Firebase AI Logic as of 2026-11-02. Initialization does not prove that a token exchange succeeded.',
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
  requestCredentials: 'Firebase Authentication and App Check tokens are used by the Firebase request gateway; they are not included in the model prompt.',
  latency: 'A browser-measured request round trip is attached to each successful result. It includes network and response parsing, not provider-only inference time.',
  quota: 'Firebase documents a default 100 generate-content requests per minute per user for Firebase AI Logic, plus provider/model RPM/RPD/TPM/TPD limits. These limits are project-level and the active project values are not readable from this client. Quota responses are handled; the app also applies a 15-second per-tab cooldown.',
  cost: 'Current public standard-tier prices are $0.30 per million input tokens and $2.50 per million output tokens. The request caps output at 700 tokens, so the output-token portion is at most $0.00175; input cost is additional. The active project tier and actual per-call token usage are not available in client code.',
  dataUse: 'The published price table says the free tier may use submitted content to improve products and the paid tier does not. Google’s terms separately state that UK/EEA/Switzerland users are subject to Paid Services data-use terms even when using unpaid Gemini API quota. Confirm the project’s applicable tier and terms before sending sensitive information.',
  sources: AI_PROVIDER_DOCUMENTATION,
} as const;

export function assessProviderRuntime(state: ProviderRuntimeState): ProviderRuntimeAssessment {
  return {
    configuration: state.projectMismatch
      ? 'project-mismatch'
      : state.aiConfigured
        ? 'initialized'
        : 'not-configured',
    appCheck: state.appCheckInitialized ? 'initialized-token-unverified' : 'missing',
    projectSecurityGate: state.projectSecurityConfirmed ? 'confirmed-by-operator' : 'not-confirmed',
    aiRequestsAllowed: !state.projectMismatch
      && state.aiConfigured
      && state.appCheckInitialized
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
    projectSecurityConfirmed: firebaseAiProjectSecurityConfirmed,
  });
}
