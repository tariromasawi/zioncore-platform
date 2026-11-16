import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeMeasurement,
  analysisMeasurementSchema,
  buildAnalysisPrompt,
  FREQUENCY_EXPLANATION_MODEL,
  getAnalysisErrorMessage,
  type AnalysisMeasurement,
} from '@/lib/ai-analysis';
import { ZIONCORE_GENESIS_AI_CONTEXT } from '@/lib/genesis-context';

const measurement: AnalysisMeasurement = {
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
};

test('validates structured measurements before analysis', () => {
  assert.equal(analysisMeasurementSchema.safeParse(measurement).success, true);
  assert.equal(analysisMeasurementSchema.safeParse({
    ...measurement,
    dominantFrequencyHz: 24001,
  }).success, false);
});

test('analysis prompt contains only structured values, not audio or notes', () => {
  const withLocalOnlyData = {
    ...measurement,
    notes: 'LOCAL_NOTE_MUST_NOT_BE_SENT',
    bins: [1, 2, 3],
    audio: 'LOCAL_AUDIO_MUST_NOT_BE_SENT',
  } as AnalysisMeasurement;
  const prompt = buildAnalysisPrompt(withLocalOnlyData, false);
  assert.match(prompt, /sampleRate/);
  assert.match(prompt, /dominantFrequencyHz/);
  assert.doesNotMatch(prompt, /LOCAL_NOTE_MUST_NOT_BE_SENT|LOCAL_AUDIO_MUST_NOT_BE_SENT|bins/);
  assert.match(prompt, /faithReflection to null/);
  assert.match(prompt, /MWARI NDI MWARI/);
  assert.match(prompt, /founder-provided Genesis declaration/i);
  assert.doesNotMatch(prompt, /THE FIRST DECLARATION|Tarry Kupakwashe|Karumekangu/);
});

test('requests reflection separately and identifies the documented model', () => {
  assert.match(buildAnalysisPrompt(measurement, true), /personal reflection/);
  assert.equal(FREQUENCY_EXPLANATION_MODEL, 'gemini-3.5-flash-lite');
});

test('the runtime Genesis context is bounded and protects the full archive', () => {
  assert.ok(ZIONCORE_GENESIS_AI_CONTEXT.length < 1200);
  assert.match(ZIONCORE_GENESIS_AI_CONTEXT, /measured observations.*hypotheses.*spiritual reflection/i);
  assert.match(ZIONCORE_GENESIS_AI_CONTEXT, /does not override privacy, consent, safety/i);
});

test('quota and App Check failures have specific user-facing guidance', () => {
  assert.match(getAnalysisErrorMessage({ code: 'functions/resource-exhausted' }), /quota/i);
  assert.match(getAnalysisErrorMessage({ code: 'functions/permission-denied' }), /App Check/i);
});

test('cloud AI analysis refuses to send a request without a signed-in user', async () => {
  await assert.rejects(
    analyzeMeasurement(measurement, false),
    /Sign in before sending a cloud AI request/,
  );
});
