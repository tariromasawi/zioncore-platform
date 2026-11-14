import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeMeasurement,
  analysisMeasurementSchema,
  buildAnalysisPrompt,
  buildInterpretationContext,
  boundInterpretationConfidence,
  createAnalysisProvenance,
  FREQUENCY_EXPLANATION_MODEL,
  FREQUENCY_EXPLANATION_METHOD_ID,
  FREQUENCY_EXPLANATION_METHOD_VERSION,
  getAnalysisRequestThrottleError,
  FREQUENCY_EXPLANATION_PROMPT_VERSION,
  getAnalysisErrorMessage,
  MINIMUM_AI_REQUEST_INTERVAL_MS,
  verifyAiRequestCredentials,
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
  assert.match(prompt, /possibleSources as hypotheses, not detections/);
  assert.match(prompt, /low or moderate confidence/);
  assert.doesNotMatch(prompt, /LOCAL_NOTE_MUST_NOT_BE_SENT|LOCAL_AUDIO_MUST_NOT_BE_SENT|bins/);
  assert.match(prompt, /faithReflection to null/);
});

test('requests reflection separately and identifies the documented model', () => {
  assert.match(buildAnalysisPrompt(measurement, true), /personal reflection/);
  assert.equal(FREQUENCY_EXPLANATION_MODEL, 'gemini-3.5-flash-lite');
  assert.match(buildAnalysisPrompt(measurement, false), new RegExp(`${FREQUENCY_EXPLANATION_METHOD_ID} v${FREQUENCY_EXPLANATION_METHOD_VERSION}`));
  assert.match(buildAnalysisPrompt(measurement, false), new RegExp(`prompt v${FREQUENCY_EXPLANATION_PROMPT_VERSION}`));
});

test('interpretation evidence is derived from validated measurements and includes explicit limits', () => {
  const context = buildInterpretationContext(measurement);
  assert.match(context.evidenceUsed[0], /48,000 Hz/);
  assert.match(context.evidenceUsed[1], /4,096.*11\.719 Hz\/bin/);
  assert.match(context.evidenceUsed[2], /440\.63 Hz/);
  assert.match(context.evidenceUsed[4], /0\.1200 FS/);
  assert.ok(context.limitations.some(item => /not calibrated sound-pressure level/.test(item)));
  assert.ok(context.limitations.some(item => /cannot identify a sound source/.test(item)));
  assert.ok(context.limitations.some(item => /do not measure radio/.test(item)));

  const silent = buildInterpretationContext({ ...measurement, dominantFrequencyHz: null, topPeaksHz: [] });
  assert.match(silent.evidenceUsed[2], /No dominant frequency/);
  assert.match(silent.evidenceUsed[3], /No additional peak/);
});

test('new interpretation confidence never exceeds moderate', () => {
  assert.equal(boundInterpretationConfidence('low'), 'low');
  assert.equal(boundInterpretationConfidence('moderate'), 'moderate');
  assert.equal(boundInterpretationConfidence('high'), 'moderate');
});

test('analysis provenance binds method, prompt, model, generation time, and exact observation', () => {
  const provenance = createAnalysisProvenance('capture-42', '2026-11-12T12:00:00.000Z');
  assert.equal(provenance.source, 'ai-generated');
  assert.equal(provenance.observationId, 'capture-42');
  assert.equal(provenance.methodId, FREQUENCY_EXPLANATION_METHOD_ID);
  assert.equal(provenance.methodVersion, FREQUENCY_EXPLANATION_METHOD_VERSION);
  assert.equal(provenance.promptVersion, FREQUENCY_EXPLANATION_PROMPT_VERSION);
  assert.equal(provenance.modelId, FREQUENCY_EXPLANATION_MODEL);
  assert.throws(() => createAnalysisProvenance('../other-record'), /valid observation ID/);
  assert.throws(() => createAnalysisProvenance('capture-42', 'not-a-timestamp'), /valid timestamp/);
});

test('quota, missing or rejected App Check, and permission failures are distinguished', () => {
  assert.match(getAnalysisErrorMessage({ code: 'functions/resource-exhausted' }), /quota/i);
  assert.match(getAnalysisErrorMessage({ code: 'app-check/token-unavailable' }), /App Check.*attestation/i);
  assert.match(getAnalysisErrorMessage(new Error('App attestation failed.')), /reCAPTCHA key.*hostname/i);
  assert.match(
    getAnalysisErrorMessage({ code: 'functions/permission-denied', message: 'Missing account permission.' }),
    /account access.*Firebase permissions/i,
  );
});

test('request throttle prevents concurrent and too-frequent cloud calls', () => {
  assert.equal(getAnalysisRequestThrottleError(20_000, 0, false), null);
  assert.match(getAnalysisRequestThrottleError(20_000, 10_001, false) ?? '', /wait a few seconds/i);
  assert.match(getAnalysisRequestThrottleError(20_000, 0, true) ?? '', /already in progress/i);
  assert.equal(getAnalysisRequestThrottleError(MINIMUM_AI_REQUEST_INTERVAL_MS, 0, false), null);
});

test('cloud request preflight requires both Firebase identity and App Check tokens', async () => {
  await assert.doesNotReject(verifyAiRequestCredentials(
    async () => 'firebase-id-token',
    async () => ({ token: 'app-check-token' }),
  ));
  await assert.rejects(
    verifyAiRequestCredentials(async () => '', async () => ({ token: 'app-check-token' })),
    /Authentication could not provide a current sign-in token/,
  );
  await assert.rejects(
    verifyAiRequestCredentials(async () => 'firebase-id-token', async () => ({ token: '' })),
    /App Check could not provide a valid attestation token/,
  );
});

test('cloud AI analysis refuses to send a request without a signed-in user', async () => {
  await assert.rejects(
    analyzeMeasurement(measurement, false, 'observation-1'),
    /Sign in before sending a cloud AI request/,
  );
});
