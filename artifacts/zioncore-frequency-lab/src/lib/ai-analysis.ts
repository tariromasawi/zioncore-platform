import { z } from 'zod';
import {
  CreateAiAudioInterpretationBody,
  CreateAiInterpretationBody,
  CreateAiInterpretationResponse,
  GetAiAudioInterpretationQuoteResponse,
} from '@workspace/api-zod';
import {
  AUDIO_CONSENT_VERSION,
  MAX_EXTERNAL_AUDIO_BYTES,
  MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
  spectralMatrixAnalysisSchema,
} from '@workspace/frequency-ai-contract';
import { MAX_ANALYSIS_OUTPUT_TOKENS as SHARED_MAX_ANALYSIS_OUTPUT_TOKENS } from '../../../../lib/frequency-ai-contract/src/constants';
import {
  firebaseAuth,
  getFirebaseIdentityHeaders,
} from '@/lib/firebase';
import { splitFaithReflection } from '@/lib/faith-reflection';
import type { Observation } from '@/lib/observations';
import type { SignalFeatures } from '@/lib/signal-analysis';
import type { SpectralMatrixAnalysis } from '@/lib/spectral-matrix';
import { fetchJsonWithDeadline } from './request-json';

export const FREQUENCY_EXPLANATION_MODEL = 'gemini-3.8-flash';
export const MAX_ANALYSIS_OUTPUT_TOKENS = SHARED_MAX_ANALYSIS_OUTPUT_TOKENS;
export const MAX_LISTENING_CONTEXT_CHARS = 700;
export const MAX_FAITH_READING_CHARS = 6000;
const minimumRequestIntervalMs = 15_000;
let lastAnalysisRequestAt = 0;

export class AIRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AIRequestError';
  }
}

export const signalFeaturesSchema = z.object({
  spectralCentroidHz: z.number().positive().finite().nullable(),
  spectralFlatness: z.number().min(0).max(1),
  spectralEntropy: z.number().min(0).max(1),
  peakToMedianContrastDb: z.number().min(0).max(120).finite().nullable(),
  rolloff85Hz: z.number().positive().finite().nullable(),
  harmonicity: z.number().min(0).max(1),
  zeroCrossingRate: z.number().min(0).max(1),
  dominantFrequencyStabilityHz: z.number().min(0).finite().nullable(),
  dominantFrequencyDriftHz: z.number().finite().nullable(),
  amplitudeVariationCoefficient: z.number().min(0).finite().nullable(),
  temporalWindowSeconds: z.number().min(0).max(6),
}).strict();

export const analysisMeasurementSchema = z.object({
  captureSource: z.enum(['microphone', 'audio-file']),
  sampleRate: z.number().int().min(8000).max(192000),
  fftSize: z.union([z.literal(2048), z.literal(4096), z.literal(8192)]),
  frequencyResolutionHz: z.number().positive().finite(),
  dominantFrequencyHz: z.number().positive().finite().nullable(),
  topPeaksHz: z.array(z.number().positive().finite()).max(6),
  rmsLevel: z.number().min(0).max(1),
  durationSeconds: z.number().finite().min(0).max(86400),
  signalFeatures: signalFeaturesSchema,
  spectralMatrixAnalysis: spectralMatrixAnalysisSchema,
}).strict().superRefine((measurement, context) => {
  const nyquist = measurement.sampleRate / 2;
  if (Math.abs(measurement.frequencyResolutionHz - measurement.sampleRate / measurement.fftSize) > 0.000001) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['frequencyResolutionHz'], message: 'Invalid FFT resolution.' });
  }
  if (measurement.dominantFrequencyHz != null && measurement.dominantFrequencyHz > nyquist) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dominantFrequencyHz'], message: 'Frequency exceeds Nyquist.' });
  }
  if (measurement.topPeaksHz.some(peak => peak > nyquist)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['topPeaksHz'], message: 'A peak exceeds Nyquist.' });
  }
  if (
    measurement.signalFeatures.spectralCentroidHz != null &&
    measurement.signalFeatures.spectralCentroidHz > nyquist
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['signalFeatures', 'spectralCentroidHz'], message: 'Spectral centroid exceeds Nyquist.' });
  }
  if (
    measurement.signalFeatures.rolloff85Hz != null &&
    measurement.signalFeatures.rolloff85Hz > nyquist
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['signalFeatures', 'rolloff85Hz'], message: 'Spectral rolloff exceeds Nyquist.' });
  }
});

const domainPerspectiveSchema = z.object({
  domain: z.enum([
    'acoustics',
    'signal_processing',
    'mathematics',
    'communications',
    'environmental_bioacoustics',
  ]),
  relevance: z.enum(['direct', 'tentative', 'needs_more_data']),
  analysis: z.string().min(1).max(1800),
  evidenceBoundary: z.string().min(1).max(900),
}).strict();

export const analysisContextSchema = z.string().trim().max(MAX_LISTENING_CONTEXT_CHARS);

const faithReflectionSchema = z.string().max(MAX_FAITH_READING_CHARS).nullable().superRefine((reflection, context) => {
  if (reflection === null) return;
  if (splitFaithReflection(reflection).paragraphs.length < 3) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A requested spiritual reflection must contain at least three substantive paragraphs.',
    });
  }
});

export const explanationSchema = z.object({
  signalFamily: z.enum(['tonal', 'harmonic', 'broadband', 'mixed', 'insufficient']),
  executiveSummary: z.string().min(1).max(1800),
  integratedReading: z.string().min(1).max(3200),
  patternSignature: z.string().min(1).max(1200),
  harmonicAnalysis: z.string().min(1).max(1800),
  temporalAnalysis: z.string().min(1).max(1800),
  modulationAnalysis: z.string().min(1).max(1800),
  domainPerspectives: z.array(domainPerspectiveSchema).length(5),
  keyTakeaways: z.array(z.string().min(1).max(700)).min(3).max(6),
  confidence: z.enum(['low', 'moderate', 'high']),
  confidenceScope: z.string().min(1).max(700),
  uncertainty: z.string().min(1).max(1800),
  dataQuality: z.string().min(1).max(1600),
  candidateExplanations: z.array(z.object({
    label: z.string().min(1).max(160),
    rationale: z.string().min(1).max(1100),
    evidenceFor: z.string().min(1).max(1000),
    evidenceAgainst: z.string().min(1).max(1000),
    confidence: z.enum(['low', 'moderate', 'high']),
    whatWouldDiscriminate: z.string().min(1).max(1000),
  }).strict()).max(5),
  followUpExperiments: z.array(z.object({
    title: z.string().min(1).max(140),
    method: z.string().min(1).max(1100),
    whatToRecord: z.string().min(1).max(700),
  }).strict()).min(2).max(5),
  reflectionQuestions: z.array(z.string().min(1).max(500)).min(2).max(4),
  faithReflection: faithReflectionSchema,
}).strict();

export type Explanation = z.infer<typeof explanationSchema> & {
  model: string;
  provider: 'gemini' | 'openai';
  fallbackUsed: boolean;
  audioReview?: {
    provider: 'gemini';
    model: string;
    segmentCount: number;
    summary: string;
  };
};

const aiInterpretationQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  quoteToken: z.string().min(32).max(4096),
  expiresAt: z.coerce.date(),
  currency: z.literal('gbp'),
  amountMinor: z.number().int().min(1).max(1_000_000),
  credits: z.number().int().min(1).max(1_000_000),
  availableCredits: z.number().int().min(0),
  canAfford: z.boolean(),
  pricingVersion: z.string().min(1).max(64),
}).strict();

export type AIInterpretationQuote = z.infer<typeof aiInterpretationQuoteSchema>;
export const aiAudioInterpretationQuoteSchema = GetAiAudioInterpretationQuoteResponse;
export type AIAudioInterpretationQuote = z.infer<typeof aiAudioInterpretationQuoteSchema>;

export type AnalysisMeasurement = Pick<
  Observation,
  | 'sampleRate'
  | 'fftSize'
  | 'frequencyResolutionHz'
  | 'dominantFrequencyHz'
  | 'topPeaksHz'
  | 'rmsLevel'
  | 'durationSeconds'
> & {
  captureSource: 'microphone' | 'audio-file';
  signalFeatures: SignalFeatures;
  spectralMatrixAnalysis: SpectralMatrixAnalysis;
};

export function getAnalysisErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code).toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (code.includes('resource-exhausted') || message.includes('429') || message.includes('quota')) {
    return 'ZionCore has reached its current interpretation quota. Your measurement remains local; try again later.';
  }
  if (code.includes('permission-denied') || message.includes('app check')) {
    return 'Firebase rejected this ZionCore interpretation request. Check that your account is signed in and permitted.';
  }
  if (code.includes('failed-precondition') || message.includes('billing')) {
    return 'The interpretation provider configuration could not complete this ZionCore reading. No interpretation was returned.';
  }
  if (code.includes('unavailable') || code.includes('network') || message.includes('network')) {
    return 'ZionCore could not reach the interpretation service. Check your connection and try again.';
  }
  return 'ZionCore could not return a valid reading. Your measurement was not changed.';
}

async function getSecureIdentityHeaders() {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Sign in to request a frequency interpretation.');
  return getFirebaseIdentityHeaders(user);
}

export async function getAIInterpretationQuote(
  includeFaithReflection = false,
): Promise<AIInterpretationQuote> {
  const headers = await getSecureIdentityHeaders();
  const query = new URLSearchParams({ faith: includeFaithReflection ? '1' : '0' });
  const { response, body: responseBody } = await fetchJsonWithDeadline(`/api/ai/interpretation/quote?${query}`, {
    method: 'GET',
    headers,
  }, 15_000);
  if (!response.ok) {
    const errorMessage = responseBody && typeof responseBody === 'object' &&
      'error' in responseBody && typeof responseBody.error === 'string'
      ? responseBody.error
      : 'The interpretation price could not be loaded.';
    throw new Error(errorMessage);
  }
  return aiInterpretationQuoteSchema.parse(responseBody);
}

export async function getAIAudioInterpretationQuote(input: {
  durationSeconds: number;
  fileBytes: number;
  includeFaithReflection: boolean;
}): Promise<AIAudioInterpretationQuote> {
  const headers = await getSecureIdentityHeaders();
  const query = new URLSearchParams({
    durationSeconds: String(input.durationSeconds),
    fileBytes: String(input.fileBytes),
    faith: input.includeFaithReflection ? '1' : '0',
  });
  const { response, body: responseBody } = await fetchJsonWithDeadline(
    `/api/ai/interpretation/audio-quote?${query}`,
    { method: 'GET', headers },
    15_000,
  );
  if (!response.ok) {
    const message = responseBody && typeof responseBody === 'object' &&
      'error' in responseBody && typeof responseBody.error === 'string'
      ? responseBody.error
      : 'The advanced audio price could not be loaded.';
    throw new Error(message);
  }
  return aiAudioInterpretationQuoteSchema.parse(responseBody);
}

async function requestInterpretationJson(url: string, init: RequestInit, timeoutMs = 180_000) {
  try {
    return await fetchJsonWithDeadline(url, init, timeoutMs);
  } catch {
    // A lost response does not establish whether the server settled the job.
    // Keep its original recovery key; never imply a refund or create a new job.
    throw new AIRequestError(
      'The connection did not confirm this reading. It may still be completing. Use recovery for the same reading rather than starting a new paid request.',
      503,
      true,
    );
  }
}

export function parseInterpretationResponse(body: unknown): Explanation {
  try {
    const result = CreateAiInterpretationResponse.parse(body);
    return {
      ...explanationSchema.parse(result.analysis),
      model: result.model,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      ...(result.audioReview ? { audioReview: result.audioReview } : {}),
    };
  } catch {
    throw new AIRequestError(
      'The reading response could not be validated. Keep this reading’s recovery request; its payment status has not been changed.',
      502,
      true,
    );
  }
}

export function isInterpretationResponseRetryable(status: number, body: unknown): boolean {
  if (body && typeof body === 'object' && 'retryable' in body && typeof body.retryable === 'boolean') {
    return body.retryable;
  }
  // An intermediary failure is not authoritative proof that a paid job failed.
  return status >= 500 || status === 401 || status === 403 || status === 408 || status === 429;
}

export async function recoverAIInterpretation(
  idempotencyKey: string,
): Promise<Explanation> {
  const headers = await getSecureIdentityHeaders();
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const { response, body: responseBody } = await requestInterpretationJson('/api/ai/interpretation/recover', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idempotencyKey }),
    });
    if (response.status === 202) {
      const retryAfterMs = responseBody && typeof responseBody === 'object'
        && 'retryAfterMs' in responseBody
        && typeof responseBody.retryAfterMs === 'number'
        ? Math.max(500, Math.min(responseBody.retryAfterMs, 3000))
        : 1500;
      if (attempt < 8) {
        await new Promise(resolve => window.setTimeout(resolve, retryAfterMs));
        continue;
      }
      throw new AIRequestError(
        'ZionCore is still completing this reading. Retry recovery shortly; do not start another interpretation.',
        202,
        true,
      );
    }
    if (!response.ok) {
      const errorMessage = responseBody && typeof responseBody === 'object' &&
        'error' in responseBody && typeof responseBody.error === 'string'
        ? responseBody.error
        : 'ZionCore could not recover this interpretation.';
      const retryable = isInterpretationResponseRetryable(response.status, responseBody);
      throw new AIRequestError(errorMessage, response.status, retryable);
    }
    return parseInterpretationResponse(responseBody);
  }
  throw new AIRequestError('ZionCore could not confirm recovery status. Retry recovery shortly.', 503, true);
}

export async function analyzeMeasurement(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
  expectedQuote: AIInterpretationQuote,
  listeningContext = '',
  idempotencyKey = `ai-${crypto.randomUUID()}`,
): Promise<Explanation> {
  const validatedMeasurement = analysisMeasurementSchema.parse(measurement);
  const validatedContext = analysisContextSchema.parse(listeningContext);
  const now = Date.now();
  if (now - lastAnalysisRequestAt < minimumRequestIntervalMs) {
    throw new Error('Please wait a few seconds before requesting another ZionCore reading.');
  }
  lastAnalysisRequestAt = now;
  try {
    const headers = await getSecureIdentityHeaders();

    const requestBody = CreateAiInterpretationBody.parse({
      measurement: validatedMeasurement,
      includeFaithReflection,
      listeningContext: validatedContext,
    });
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const { response, body: responseBody } = await requestInterpretationJson('/api/ai/interpretation', {
        method: 'POST',
        headers: {
          ...headers,
          'Idempotency-Key': idempotencyKey,
          'X-ZionCore-Quoted-Credits': String(expectedQuote.credits),
          'X-ZionCore-Pricing-Version': expectedQuote.pricingVersion,
          'X-ZionCore-Quote-Token': expectedQuote.quoteToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (response.status === 202) {
        const retryAfterMs = responseBody && typeof responseBody === 'object'
          && 'retryAfterMs' in responseBody
          && typeof responseBody.retryAfterMs === 'number'
          ? Math.max(500, Math.min(responseBody.retryAfterMs, 3000))
          : 1500;
        if (attempt < 8) {
          await new Promise(resolve => window.setTimeout(resolve, retryAfterMs));
          continue;
        }
        throw new AIRequestError(
          'ZionCore is still completing this reading. Retry the same request shortly; it will not be charged twice.',
          202,
          true,
        );
      }
      if (!response.ok) {
        const errorMessage = responseBody && typeof responseBody === 'object' &&
          'error' in responseBody && typeof responseBody.error === 'string'
          ? responseBody.error
          : 'ZionCore could not complete this interpretation.';
        const retryable = isInterpretationResponseRetryable(response.status, responseBody);
        throw new AIRequestError(errorMessage, response.status, retryable);
      }
      return parseInterpretationResponse(responseBody);
    }
    throw new AIRequestError('ZionCore could not confirm the reading status. Retry the same request.', 503, true);
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    if (error instanceof Error && error.message.startsWith('Firebase is not configured')) throw error;
    if (error instanceof Error && error.message.includes('App Check')) throw error;
    if (error instanceof z.ZodError) {
      throw new Error('ZionCore received an incomplete or invalid interpretation.');
    }
    if (error instanceof Error && error.message.startsWith('Sign in')) throw error;
    if (error instanceof Error && error.message.startsWith('Please wait')) throw error;
    if (error instanceof Error && error.message.includes('Secure sign-in')) throw error;
    throw new Error(getAnalysisErrorMessage(error));
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const batchSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += batchSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + batchSize));
  }
  return window.btoa(binary);
}

export async function analyzeAudioMeasurement(
  measurement: AnalysisMeasurement,
  audioFile: File,
  includeFaithReflection: boolean,
  expectedQuote: AIInterpretationQuote,
  listeningContext = '',
  idempotencyKey = `audio-ai-${crypto.randomUUID()}`,
): Promise<Explanation> {
  const validatedMeasurement = analysisMeasurementSchema.parse(measurement);
  const validatedContext = analysisContextSchema.parse(listeningContext);
  if (validatedMeasurement.captureSource !== 'audio-file') {
    throw new Error('Advanced audio review is available for an imported recording.');
  }
  if (
    audioFile.size > MAX_EXTERNAL_AUDIO_BYTES ||
    !(audioFile.type === 'audio/wav' || audioFile.name.toLowerCase().endsWith('.wav')) ||
    validatedMeasurement.durationSeconds < 3 ||
    validatedMeasurement.durationSeconds > MAX_EXTERNAL_AUDIO_DURATION_SECONDS
  ) {
    throw new Error('Choose a PCM WAV recording of 3 seconds to 10 minutes and no larger than 24 MB for advanced audio review.');
  }
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
    throw new Error('A valid audio interpretation request identifier is required.');
  }

  const bytes = await audioFile.arrayBuffer();
  const body = CreateAiAudioInterpretationBody.parse({
    audioBase64: toBase64(bytes),
    audioMimeType: 'audio/wav',
    externalAudioConsent: true,
    consentVersion: AUDIO_CONSENT_VERSION,
    measurement: validatedMeasurement,
    includeFaithReflection,
    listeningContext: validatedContext,
  });
  const headers = await getSecureIdentityHeaders();
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const { response, body: responseBody } = await requestInterpretationJson('/api/ai/interpretation/audio', {
      method: 'POST',
      headers: {
        ...headers,
        'Idempotency-Key': idempotencyKey,
        'X-ZionCore-Quoted-Credits': String(expectedQuote.credits),
        'X-ZionCore-Pricing-Version': expectedQuote.pricingVersion,
        'X-ZionCore-Quote-Token': expectedQuote.quoteToken,
        'Content-Type': 'application/vnd.zioncore.audio-analysis+json',
      },
      body: JSON.stringify(body),
    }, 600_000);
    if (response.status === 202) {
      const retryAfterMs = responseBody && typeof responseBody === 'object'
        && 'retryAfterMs' in responseBody
        && typeof responseBody.retryAfterMs === 'number'
        ? Math.max(500, Math.min(responseBody.retryAfterMs, 3000))
        : 1500;
      if (attempt < 8) {
        await new Promise(resolve => window.setTimeout(resolve, retryAfterMs));
        continue;
      }
      throw new AIRequestError('ZionCore is still completing this audio review. Retry the same request shortly.', 202, true);
    }
    if (!response.ok) {
      const errorMessage = responseBody && typeof responseBody === 'object' &&
        'error' in responseBody && typeof responseBody.error === 'string'
        ? responseBody.error
        : 'ZionCore could not complete the advanced audio review.';
      const retryable = isInterpretationResponseRetryable(response.status, responseBody);
      throw new AIRequestError(errorMessage, response.status, retryable);
    }
    return parseInterpretationResponse(responseBody);
  }
  throw new AIRequestError('ZionCore could not confirm the audio review status. Retry the same request.', 503, true);
}
