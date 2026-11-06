import { z } from 'zod';
import {
  firebaseAiReady,
  firebaseApp,
  getFirebaseSetupMessage,
} from '@/lib/firebase';
import type { Observation } from '@/lib/observations';

export const FREQUENCY_EXPLANATION_MODEL = 'gemini-3.5-flash-lite';
const minimumRequestIntervalMs = 15_000;
let lastAnalysisRequestAt = 0;

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

export type Explanation = z.infer<typeof explanationSchema> & { model: string };
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
    'You are a careful scientific assistant interpreting a real microphone measurement.',
    'Use only the supplied structured values. Do not invent data, identify a source with certainty, diagnose health, infer messages, or claim that a microphone detects radio, supernatural, divine, or extraterrestrial signals.',
    'A dominant FFT bin is not calibrated sound pressure; RMS here is relative digital amplitude. Explain likely ordinary acoustic explanations and the limits of a single short measurement.',
    'Return exactly one JSON object with keys: scientificInterpretation (string), confidence (low|moderate|high), uncertainty (string), possibleSources (array of strings), faithReflection (string or null).',
    'Measured values must remain distinct from interpretation and uncertainty.',
    includeFaithReflection
      ? 'Provide a brief optional faith reflection in faithReflection. Label it as personal reflection, not a scientific conclusion or evidence. Do not claim the measurement proves spiritual meaning.'
      : 'Set faithReflection to null. Do not include spiritual or religious interpretation.',
    `Structured measurement: ${JSON.stringify(validated)}`,
  ].join('\n');
}

export function getAnalysisErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code).toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (code.includes('resource-exhausted') || message.includes('429') || message.includes('quota')) {
    return 'The AI service is at its current quota. Your measurement remains local; try again later.';
  }
  if (code.includes('permission-denied') || message.includes('app check')) {
    return 'Firebase rejected this AI request. Confirm App Check is registered and enforced for this app.';
  }
  if (code.includes('failed-precondition') || message.includes('billing')) {
    return 'The selected Firebase AI model is unavailable in this project configuration. No alternate paid service was used.';
  }
  if (code.includes('unavailable') || code.includes('network') || message.includes('network')) {
    return 'The AI service could not be reached. Check your connection and try again.';
  }
  return 'The AI service could not return a valid explanation. Your measurement was not changed.';
}

export async function analyzeMeasurement(
  measurement: AnalysisMeasurement,
  includeFaithReflection: boolean,
): Promise<Explanation> {
  const prompt = buildAnalysisPrompt(measurement, includeFaithReflection);
  if (!firebaseAiReady || !firebaseApp) {
    throw new Error(getFirebaseSetupMessage() || 'Firebase AI Logic is not ready.');
  }
  const now = Date.now();
  if (now - lastAnalysisRequestAt < minimumRequestIntervalMs) {
    throw new Error('Please wait a few seconds before requesting another AI explanation.');
  }
  lastAnalysisRequestAt = now;
  try {
    const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
    const model = getGenerativeModel(
      getAI(firebaseApp, { backend: new GoogleAIBackend() }),
      {
        model: FREQUENCY_EXPLANATION_MODEL,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
          responseMimeType: 'application/json',
        },
      },
    );
    const result = await model.generateContent(prompt);
    const parsed = explanationSchema.parse(JSON.parse(result.response.text()));
    return {
      ...parsed,
      faithReflection: includeFaithReflection ? parsed.faithReflection : null,
      model: FREQUENCY_EXPLANATION_MODEL,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Firebase is not configured')) throw error;
    if (error instanceof Error && error.message.includes('App Check')) throw error;
    throw new Error(getAnalysisErrorMessage(error));
  }
}
