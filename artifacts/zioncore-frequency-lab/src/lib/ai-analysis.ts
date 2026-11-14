import { z } from 'zod';
import {
  firebaseAiReady,
  firebaseAuth,
  firebaseApp,
  firebaseAppCheck,
  getFirebaseAiSetupMessage,
} from '@/lib/firebase';
import type {
  Observation,
  SavedInterpretation,
  SavedInterpretationProvenance,
} from '@/lib/observations';

export const FREQUENCY_EXPLANATION_MODEL = 'gemini-3.5-flash-lite';
// Increment methodVersion for analysis behavior/config changes and promptVersion when prompt text changes.
export const FREQUENCY_EXPLANATION_METHOD_ID = 'frequency-measurement-explanation';
export const FREQUENCY_EXPLANATION_METHOD_VERSION = '1.1.0';
export const FREQUENCY_EXPLANATION_PROMPT_VERSION = '1.1.0';
export const FREQUENCY_EXPLANATION_PROVIDER = 'firebase-ai-google';
export const FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS = 700;
export const MAX_FIREBASE_AI_PROMPT_CHARACTERS = 8_000;
export const MINIMUM_AI_REQUEST_INTERVAL_MS = 15_000;
let lastAnalysisRequestAt = 0;
let analysisRequestInFlight = false;

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

export const explanationSchema = z.object({
  scientificInterpretation: z.string().min(1).max(1800),
  confidence: z.enum(['low', 'moderate', 'high']),
  uncertainty: z.string().min(1).max(1200),
  possibleSources: z.array(z.string().min(1).max(240)).max(6),
  faithReflection: z.string().max(900).nullable(),
}).strict();

export type Explanation = SavedInterpretation & {
  provenance: SavedInterpretationProvenance;
};
export type AnalysisMeasurement = Pick<
  Observation,
  | 'sampleRate'
  | 'fftSize'
  | 'frequencyResolutionHz'
  | 'dominantFrequencyHz'
  | 'topPeaksHz'
  | 'rmsLevel'
  | 'durationSeconds'
>;

export function buildInterpretationContext(measurement: AnalysisMeasurement) {
  const validated = analysisMeasurementSchema.parse(measurement);
  const resolution = `${validated.frequencyResolutionHz.toFixed(3)} Hz/bin`;
  const evidenceUsed = [
    `Sample rate: ${validated.sampleRate.toLocaleString()} Hz.`,
    `FFT size: ${validated.fftSize.toLocaleString()}; bin resolution: ${resolution}.`,
    validated.dominantFrequencyHz == null
      ? 'No dominant frequency was reported.'
      : `Dominant frequency bin: ${validated.dominantFrequencyHz.toFixed(2)} Hz.`,
    validated.topPeaksHz.length
      ? `Reported peak frequencies: ${validated.topPeaksHz.map(peak => `${peak.toFixed(2)} Hz`).join(', ')}.`
      : 'No additional peak frequencies were reported.',
    `Relative RMS amplitude: ${validated.rmsLevel.toFixed(4)} FS.`,
    `Measurement duration: ${validated.durationSeconds.toFixed(2)} seconds.`,
  ];
  const limitations = [
    'Only structured measurement values were supplied; raw audio, waveform samples, spectrum bins, source labels, and environmental context were not sent.',
    'RMS is relative digital full-scale amplitude, not calibrated sound-pressure level.',
    `Frequency estimates are limited by the ${resolution} FFT-bin spacing.`,
    'A single acoustic measurement cannot identify a sound source or establish intent, communication, or causation.',
    'Microphone and audio-file measurements do not measure radio or other electromagnetic signals.',
  ];
  return { evidenceUsed, limitations };
}

export function boundInterpretationConfidence(confidence: 'low' | 'moderate' | 'high') {
  return confidence === 'high' ? 'moderate' : confidence;
}

export function getAnalysisRequestThrottleError(
  now: number,
  lastRequestAt: number,
  requestInFlight: boolean,
) {
  if (requestInFlight) return 'An AI request is already in progress.';
  if (now - lastRequestAt < MINIMUM_AI_REQUEST_INTERVAL_MS) {
    return 'Please wait a few seconds before requesting another AI request.';
  }
  return null;
}

export async function verifyAiRequestCredentials(
  getIdentityToken: () => Promise<string>,
  getAppCheckToken: () => Promise<{ token: string }>,
) {
  const [identityToken, appCheckResult] = await Promise.all([
    getIdentityToken(),
    getAppCheckToken(),
  ]);
  if (!identityToken.trim()) {
    throw new Error('Firebase Authentication could not provide a current sign-in token.');
  }
  if (!appCheckResult.token.trim()) {
    throw new Error('App Check could not provide a valid attestation token.');
  }
}

export function createAnalysisProvenance(
  observationId: string,
  generatedAt = new Date().toISOString(),
): SavedInterpretationProvenance {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(observationId)) {
    throw new Error('A valid observation ID is required to attach interpretation provenance.');
  }
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('Interpretation generation time must be a valid timestamp.');
  }
  return {
    source: 'ai-generated',
    observationId,
    methodId: FREQUENCY_EXPLANATION_METHOD_ID,
    methodVersion: FREQUENCY_EXPLANATION_METHOD_VERSION,
    promptVersion: FREQUENCY_EXPLANATION_PROMPT_VERSION,
    provider: FREQUENCY_EXPLANATION_PROVIDER,
    modelId: FREQUENCY_EXPLANATION_MODEL,
    generatedAt,
  };
}

export function buildAnalysisPrompt(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
) {
  const validated = analysisMeasurementSchema.parse({
    sampleRate: measurement.sampleRate,
    fftSize: measurement.fftSize,
    frequencyResolutionHz: measurement.frequencyResolutionHz,
    dominantFrequencyHz: measurement.dominantFrequencyHz,
    topPeaksHz: measurement.topPeaksHz,
    rmsLevel: measurement.rmsLevel,
    durationSeconds: measurement.durationSeconds,
  });
  return [
    `Method ${FREQUENCY_EXPLANATION_METHOD_ID} v${FREQUENCY_EXPLANATION_METHOD_VERSION}; prompt v${FREQUENCY_EXPLANATION_PROMPT_VERSION}.`,
    'You are a careful scientific assistant interpreting a structured acoustic measurement.',
    'Use only the supplied values. Treat possibleSources as hypotheses, not detections. Do not invent data, identify a source with certainty, diagnose health, infer messages, or claim that audio detects radio, supernatural, divine, or extraterrestrial signals.',
    'A dominant FFT bin is not calibrated sound pressure; RMS here is relative digital amplitude. Explain likely ordinary acoustic explanations and the limits of a single short measurement.',
    'Use only low or moderate confidence, describing support for a narrow pattern summary, never confidence in source identity. Explain uncertainty explicitly.',
    'Return exactly one JSON object with keys: scientificInterpretation (string), confidence (low|moderate|high), uncertainty (string), possibleSources (array of strings), faithReflection (string or null). The application will attach deterministic evidence and technical limitations from the measured values.',
    'Measured values must remain distinct from interpretation and uncertainty.',
    includeFaithReflection
      ? 'Provide a brief optional faith reflection in faithReflection. Label it as personal reflection, not a scientific conclusion or evidence. Do not claim the measurement proves spiritual meaning.'
      : 'Set faithReflection to null. Do not include spiritual or religious interpretation.',
    `Structured measurement: ${JSON.stringify(validated)}`,
  ].join('\n');
}

export function getAnalysisErrorMessage(
  error: unknown,
  purpose: 'explanation' | 'experiment-design' = 'explanation',
) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code).toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const appCheckFailure = code.includes('app-check')
    || code.includes('appcheck')
    || message.includes('app check')
    || message.includes('appcheck')
    || message.includes('attestation');
  const localDataNotice = purpose === 'experiment-design'
    ? 'Selected measurements remain local.'
    : 'Your measurement remains unchanged.';
  if (code.includes('resource-exhausted') || message.includes('429') || message.includes('quota')) {
    return `The AI service is at its current quota. ${localDataNotice} Try again later.`;
  }
  if (appCheckFailure) {
    return `App Check could not provide a valid attestation. Check this environment’s Firebase app ID, reCAPTCHA key, and hostname. ${localDataNotice}`;
  }
  if (code.includes('permission-denied')) {
    return `Firebase denied this AI request. Check your account access and Firebase permissions. ${localDataNotice}`;
  }
  if (code.includes('failed-precondition') || message.includes('billing')) {
    return 'The selected Firebase AI model is unavailable in this project configuration. No alternate paid service was used.';
  }
  if (code.includes('unavailable') || code.includes('network') || message.includes('network')) {
    return 'The AI service could not be reached. Check your connection and try again.';
  }
  return purpose === 'experiment-design'
    ? 'The AI service could not return a valid experiment proposal. No discovery was recorded.'
    : 'The AI service could not return a valid explanation. Your measurement was not changed.';
}

export async function generateFirebaseAiJson(
  prompt: string,
  maxOutputTokens: number,
  purpose: 'explanation' | 'experiment-design' = 'explanation',
) {
  const user = firebaseAuth?.currentUser;
  const app = firebaseApp;
  const appCheck = firebaseAppCheck;
  if (!user) {
    throw new Error('Sign in before sending a cloud AI request. Local research remains available.');
  }
  if (!firebaseAiReady || !app || !appCheck) {
    throw new Error(getFirebaseAiSetupMessage() || 'Firebase AI Logic is not ready.');
  }
  if (!prompt.trim() || prompt.length > MAX_FIREBASE_AI_PROMPT_CHARACTERS) {
    throw new Error(`The AI request must contain 1–${MAX_FIREBASE_AI_PROMPT_CHARACTERS} characters.`);
  }
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS) {
    throw new Error(`AI output must be limited to ${FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS} tokens or fewer.`);
  }
  const throttleError = getAnalysisRequestThrottleError(
    Date.now(),
    lastAnalysisRequestAt,
    analysisRequestInFlight,
  );
  if (throttleError) throw new Error(throttleError);

  analysisRequestInFlight = true;
  try {
    const { getToken } = await import('firebase/app-check');
    await verifyAiRequestCredentials(
      () => user.getIdToken(),
      () => getToken(appCheck),
    );
    lastAnalysisRequestAt = Date.now();

    const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
    const model = getGenerativeModel(
      getAI(app, { backend: new GoogleAIBackend() }),
      {
        model: FREQUENCY_EXPLANATION_MODEL,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      },
    );
    const requestStartedAt = Date.now();
    const result = await model.generateContent(prompt);
    return {
      text: result.response.text(),
      clientRoundTripMs: Math.max(0, Date.now() - requestStartedAt),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Firebase is not configured')) throw error;
    if (error instanceof Error && error.message.includes('App Check')) throw error;
    throw new Error(getAnalysisErrorMessage(error, purpose));
  } finally {
    analysisRequestInFlight = false;
  }
}

export async function analyzeMeasurement(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
  observationId: string,
): Promise<Explanation> {
  const provenance = createAnalysisProvenance(observationId);
  const interpretationContext = buildInterpretationContext(measurement);
  const prompt = buildAnalysisPrompt(measurement, includeFaithReflection);
  const response = await generateFirebaseAiJson(
    prompt,
    FREQUENCY_EXPLANATION_MAX_OUTPUT_TOKENS,
  );
  let parsed: z.infer<typeof explanationSchema>;
  try {
    parsed = explanationSchema.parse(JSON.parse(response.text));
  } catch (error) {
    throw new Error(getAnalysisErrorMessage(error));
  }
  return {
    ...parsed,
    confidence: boundInterpretationConfidence(parsed.confidence),
    ...interpretationContext,
    faithReflection: includeFaithReflection ? parsed.faithReflection : null,
    model: FREQUENCY_EXPLANATION_MODEL,
    provenance: {
      ...provenance,
      generatedAt: new Date().toISOString(),
      clientRoundTripMs: response.clientRoundTripMs,
    },
  };
}
