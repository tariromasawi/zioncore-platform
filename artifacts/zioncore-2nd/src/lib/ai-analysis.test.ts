import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateAiInterpretationBody } from '@workspace/api-zod';
import {
  analyzeMeasurement,
  analysisMeasurementSchema,
  getAnalysisErrorMessage,
  type AnalysisMeasurement,
} from '@/lib/ai-analysis';

const measurement: AnalysisMeasurement = {
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
};

test('validates structured base measurements before requesting an interpretation', () => {
  assert.equal(analysisMeasurementSchema.safeParse(measurement).success, true);
  assert.equal(analysisMeasurementSchema.safeParse({
    ...measurement,
    dominantFrequencyHz: 24001,
  }).success, false);
});

test('the generated API contract accepts base readings without fabricating derived features', () => {
  const body = CreateAiInterpretationBody.parse({
    measurement: {
      captureSource: 'microphone',
      ...measurement,
    },
    includeFaithReflection: false,
    listeningContext: '',
  });
  assert.equal(body.measurement.signalFeatures, undefined);
  assert.equal(body.measurement.spectralMatrixAnalysis, undefined);
});

test('App Check and quota failures produce actionable, non-misleading guidance', () => {
  assert.match(
    getAnalysisErrorMessage(new Error('Firebase App Check could not obtain a valid token.')),
    /No AI request was sent/i,
  );
  assert.match(
    getAnalysisErrorMessage({ code: 'functions/resource-exhausted' }),
    /quota/i,
  );
});

test('cloud interpretation refuses to send a request without a signed-in user', async () => {
  await assert.rejects(
    analyzeMeasurement(measurement, false, {
      quoteId: '00000000-0000-4000-8000-000000000000',
      quoteToken: 'a'.repeat(32),
      expiresAt: new Date(Date.now() + 60_000),
      currency: 'gbp',
      amountMinor: 1,
      credits: 1,
      availableCredits: 1,
      canAfford: true,
      pricingVersion: 'test',
    }),
    /Sign in before requesting a cloud AI interpretation/,
  );
});
