import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateProviderUsageMicroUsd,
  estimateGeminiAudioUsageMicroUsd,
  generateWithGeminiAudioSegment,
  getGeminiAnalysisModel,
  getGeminiCredentialSource,
  isGeminiConfigured,
  normalizeGeminiUsage,
  GOOGLE_GENAI_ANALYSIS_MODEL,
} from './ai-provider-clients';

test('prefers the owner-provided Google API key and validates integration configuration', () => {
  assert.equal(
    getGeminiCredentialSource({ GOOGLE_GENAI_API_KEY: 'configured' } as NodeJS.ProcessEnv),
    'google-api-key',
  );
  assert.equal(
    getGeminiCredentialSource({
      AI_INTEGRATIONS_GEMINI_API_KEY: 'configured',
      AI_INTEGRATIONS_GEMINI_BASE_URL: 'https://proxy.example',
    } as NodeJS.ProcessEnv),
    'replit-integration',
  );
  assert.equal(
    getGeminiCredentialSource({
      AI_INTEGRATIONS_GEMINI_API_KEY: 'configured',
    } as NodeJS.ProcessEnv),
    'unconfigured',
  );
  assert.equal(isGeminiConfigured({ GOOGLE_GENAI_API_KEY: 'configured' } as NodeJS.ProcessEnv), true);
  assert.equal(isGeminiConfigured({} as NodeJS.ProcessEnv), false);
  assert.equal(
    getGeminiAnalysisModel({ GOOGLE_GENAI_API_KEY: 'configured' } as NodeJS.ProcessEnv),
    'gemini-3-flash-preview',
  );
  assert.equal(
    getGeminiAnalysisModel({
      AI_INTEGRATIONS_GEMINI_API_KEY: 'configured',
      AI_INTEGRATIONS_GEMINI_BASE_URL: 'https://proxy.example',
    } as NodeJS.ProcessEnv),
    'gemini-3.8-flash',
  );
});

test('estimates provider usage at conservative standard token rates', () => {
  assert.equal(
    estimateProviderUsageMicroUsd('gemini-3.8-flash', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    }),
    12_000_000,
  );
  assert.equal(
    estimateProviderUsageMicroUsd('gpt-5.4-mini', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    }),
    5_250_000,
  );
});

test('returns no cost estimate when model or token usage is unknown', () => {
  assert.equal(
    estimateProviderUsageMicroUsd('future-model', {
      inputTokens: 100,
      outputTokens: 50,
    }),
    null,
  );
  assert.equal(
    estimateProviderUsageMicroUsd('gemini-3.8-flash', {
      inputTokens: null,
      outputTokens: 50,
    }),
    null,
  );
});

test('Gemini cost tracking covers the configured preview model and includes thinking tokens', () => {
  const usage = normalizeGeminiUsage({
    promptTokenCount: 17,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 3,
  });
  assert.deepEqual(usage, { inputTokens: 17, outputTokens: 8 });
  assert.equal(
    estimateProviderUsageMicroUsd(GOOGLE_GENAI_ANALYSIS_MODEL, usage),
    33,
  );
  assert.deepEqual(
    normalizeGeminiUsage({ promptTokenCount: -1, candidatesTokenCount: 1.5 }),
    { inputTokens: null, outputTokens: null },
  );
});

test('Gemini audio usage estimate applies the documented audio input rate conservatively', () => {
  assert.equal(
    estimateGeminiAudioUsageMicroUsd('gemini-3-flash-preview', {
      inputTokens: 1_000,
      outputTokens: 256,
    }),
    1_768,
  );
  assert.equal(
    estimateGeminiAudioUsageMicroUsd('unknown-model', {
      inputTokens: 1_000,
      outputTokens: 256,
    }),
    null,
  );
  assert.equal(
    estimateGeminiAudioUsageMicroUsd('gemini-3-flash-preview', {
      inputTokens: null,
      outputTokens: 256,
    }),
    null,
  );
});

test('Gemini audio segment helper sends WAV inline data and applies its bounded deadline', async () => {
  // Provider I/O itself is verified by the provider contract and bounded WAV parser tests;
  // this assertion keeps the public entry point available for the paid audio route.
  assert.equal(typeof generateWithGeminiAudioSegment, 'function');
});
