import { z } from 'zod';
import {
  CreateAiInterpretationBody,
  CreateAiInterpretationResponse,
  GetAiInterpretationQuoteResponse,
} from '@workspace/api-zod';
import {
  firebaseAuth,
  getFirebaseIdentityHeaders,
} from '@/lib/firebase';
import type { SavedInterpretation } from '@/lib/observations';

const minimumRequestIntervalMs = 15_000;
const requestTimeoutMs = 180_000;
const recoveryAttempts = 9;
let lastAnalysisRequestAt = 0;
const pendingInMemory = new Map<string, PendingInterpretation>();

export const analysisMeasurementSchema = z.object({
  sampleRate: z.number().int().min(8000).max(192000),
  fftSize: z.union([z.literal(2048), z.literal(4096), z.literal(8192)]),
  frequencyResolutionHz: z.number().positive().finite(),
  dominantFrequencyHz: z.number().positive().finite().nullable(),
  topPeaksHz: z.array(z.number().positive().finite()).max(6),
  rmsLevel: z.number().min(0).max(1),
  durationSeconds: z.number().finite().min(0).max(86400),
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
});

export type AnalysisMeasurement = z.infer<typeof analysisMeasurementSchema>;
export type AIInterpretationQuote = z.infer<typeof GetAiInterpretationQuoteResponse>;
export type Explanation = SavedInterpretation;

type PendingInterpretation = {
  idempotencyKey: string;
  fingerprint: string;
};

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

async function readResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, body: await readResponse(response) };
  } catch {
    throw new AIRequestError(
      'The connection did not confirm this reading. Retry recovery for the same request; do not start another paid reading.',
      503,
      true,
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function errorFromResponse(status: number, body: unknown, fallback: string) {
  const message = body && typeof body === 'object' && 'error' in body &&
    typeof body.error === 'string'
    ? body.error
    : fallback;
  const retryable = body && typeof body === 'object' && 'retryable' in body &&
    typeof body.retryable === 'boolean'
    ? body.retryable
    : status >= 500 || [401, 403, 408, 429].includes(status);
  return new AIRequestError(message, status, retryable);
}

function pendingStorageKey(uid: string) {
  return `zioncore.ai-interpretation.pending.v1.${encodeURIComponent(uid)}`;
}

function readPending(uid: string): PendingInterpretation | null {
  const inMemory = pendingInMemory.get(uid);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(pendingStorageKey(uid));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      value && typeof value === 'object' &&
      'idempotencyKey' in value && typeof value.idempotencyKey === 'string' &&
      'fingerprint' in value && typeof value.fingerprint === 'string'
    ) {
      const pending = {
        idempotencyKey: value.idempotencyKey,
        fingerprint: value.fingerprint,
      };
      pendingInMemory.set(uid, pending);
      return pending;
    }
  } catch {
    // Session storage may be unavailable; the in-memory key remains usable.
  }
  return null;
}

function savePending(uid: string, pending: PendingInterpretation) {
  pendingInMemory.set(uid, pending);
  try {
    sessionStorage.setItem(pendingStorageKey(uid), JSON.stringify(pending));
  } catch {
    // The key remains in memory for this page session.
  }
}

function clearPending(uid: string) {
  pendingInMemory.delete(uid);
  try {
    sessionStorage.removeItem(pendingStorageKey(uid));
  } catch {
    // Nothing further is required when session storage is unavailable.
  }
}

async function fingerprintRequest(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure request recovery is unavailable in this browser. No interpretation was started.');
  }
  const value = JSON.stringify({ measurement, includeFaithReflection });
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function toSavedInterpretation(
  body: unknown,
): Explanation {
  try {
    const result = CreateAiInterpretationResponse.parse(body);
    return {
      scientificInterpretation: result.analysis.executiveSummary,
      confidence: result.analysis.confidence,
      uncertainty: result.analysis.uncertainty,
      possibleSources: result.analysis.candidateExplanations.map(candidate =>
        `${candidate.label} — unverified hypothesis, ${candidate.confidence} confidence`.slice(0, 240),
      ),
      faithReflection: result.analysis.faithReflection,
      model: result.model,
    };
  } catch {
    throw new AIRequestError(
      'The interpretation response could not be validated. Retry recovery for the same request; do not start another paid reading.',
      502,
      true,
    );
  }
}

async function recoverInterpretation(idempotencyKey: string): Promise<Explanation> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Sign in before recovering this interpretation.');
  for (let attempt = 0; attempt < recoveryAttempts; attempt += 1) {
    const headers = await getFirebaseIdentityHeaders(user);
    const { response, body } = await requestJson('/api/ai/interpretation/recover', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey }),
    });
    if (response.status === 202) {
      const retryAfterMs = body && typeof body === 'object' && 'retryAfterMs' in body &&
        typeof body.retryAfterMs === 'number'
        ? Math.max(500, Math.min(body.retryAfterMs, 3000))
        : 1500;
      if (attempt < recoveryAttempts - 1) {
        await new Promise(resolve => globalThis.setTimeout(resolve, retryAfterMs));
        continue;
      }
      throw new AIRequestError(
        'ZionCore is still completing this reading. Retry recovery shortly; do not start another interpretation.',
        202,
        true,
      );
    }
    if (!response.ok) {
      throw errorFromResponse(response.status, body, 'ZionCore could not recover this interpretation.');
    }
    return toSavedInterpretation(body);
  }
  throw new AIRequestError('ZionCore could not confirm recovery status. Retry recovery shortly.', 503, true);
}

export async function getAIInterpretationQuote(
  includeFaithReflection = false,
): Promise<AIInterpretationQuote> {
  const headers = await getFirebaseIdentityHeaders();
  const query = new URLSearchParams({ faith: includeFaithReflection ? '1' : '0' });
  const { response, body } = await requestJson(
    `/api/ai/interpretation/quote?${query}`,
    { method: 'GET', headers },
  );
  if (!response.ok) {
    throw errorFromResponse(response.status, body, 'The interpretation price could not be loaded.');
  }
  return GetAiInterpretationQuoteResponse.parse(body);
}

export function getAnalysisErrorMessage(error: unknown) {
  if (error instanceof AIRequestError) return error.message;
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code).toLowerCase()
    : '';
  const message = error instanceof Error ? error.message : '';
  if (/app check|attestation/i.test(message)) {
    return 'App Check could not verify this browser. No AI request was sent; local measurements remain available.';
  }
  if (/sign in/i.test(message)) return message;
  if (code.includes('resource-exhausted') || /429|quota/i.test(message)) {
    return 'The AI service has reached its current quota. No new interpretation was returned.';
  }
  if (error instanceof z.ZodError) {
    return 'The interpretation response did not match the expected format. Its billing status was not changed.';
  }
  return message || 'ZionCore could not return a valid interpretation. Your local measurement remains unchanged.';
}

export async function analyzeMeasurement(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
  expectedQuote: AIInterpretationQuote,
): Promise<Explanation> {
  const validatedMeasurement = analysisMeasurementSchema.parse(measurement);
  const user = firebaseAuth?.currentUser;
  if (!user) {
    throw new Error('Sign in before requesting a cloud AI interpretation. Local measurements remain available.');
  }

  const fingerprint = await fingerprintRequest(validatedMeasurement, includeFaithReflection);
  const pending = readPending(user.uid);
  if (pending) {
    if (pending.fingerprint !== fingerprint) {
      throw new AIRequestError(
        'A previous interpretation is still unresolved. Recover that same reading before starting another.',
        202,
        true,
      );
    }
    try {
      const recovered = await recoverInterpretation(pending.idempotencyKey);
      clearPending(user.uid);
      return recovered;
    } catch (error) {
      if (error instanceof AIRequestError && !error.retryable) clearPending(user.uid);
      throw error;
    }
  }

  if (!expectedQuote.canAfford) {
    throw new Error('This account does not have enough credits for the quoted interpretation.');
  }
  if (expectedQuote.expiresAt.getTime() <= Date.now()) {
    throw new Error('This price quote expired. Request a fresh quote; no interpretation was started.');
  }
  if (Date.now() - lastAnalysisRequestAt < minimumRequestIntervalMs) {
    throw new Error('Please wait a few seconds before requesting another ZionCore reading.');
  }

  const headers = await getFirebaseIdentityHeaders(user);
  const requestBody = CreateAiInterpretationBody.parse({
    measurement: {
      captureSource: 'microphone',
      ...validatedMeasurement,
    },
    includeFaithReflection,
    listeningContext: '',
  });
  const idempotencyKey = `ai-${crypto.randomUUID()}`;
  savePending(user.uid, { idempotencyKey, fingerprint });
  lastAnalysisRequestAt = Date.now();

  try {
    const { response, body } = await requestJson('/api/ai/interpretation', {
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
      const recovered = await recoverInterpretation(idempotencyKey);
      clearPending(user.uid);
      return recovered;
    }
    if (!response.ok) {
      const error = errorFromResponse(response.status, body, 'ZionCore could not complete this interpretation.');
      if (!error.retryable) clearPending(user.uid);
      throw error;
    }
    const result = toSavedInterpretation(body);
    clearPending(user.uid);
    return result;
  } catch (error) {
    if (error instanceof AIRequestError && !error.retryable) clearPending(user.uid);
    throw error;
  }
}
