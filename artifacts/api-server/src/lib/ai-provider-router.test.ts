import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AIProvidersUnavailableError,
  runWithGeminiOpenAIFallback,
  shouldFailOver,
  type ProviderCalls,
} from './ai-provider-router';

const validText = '{"value":"validated"}';
const validate = (text: string) => {
  const parsed = JSON.parse(text) as { value?: unknown };
  if (typeof parsed.value !== 'string') throw new Error('Invalid output shape.');
  return { value: parsed.value };
};

test('uses Gemini alone when its response validates', async () => {
  let openAICalls = 0;
  const result = await runWithGeminiOpenAIFallback({
    gemini: async () => ({ text: validText, model: 'gemini-test' }),
    openai: async () => {
      openAICalls += 1;
      return { text: validText, model: 'openai-test' };
    },
  }, validate);

  assert.equal(result.provider, 'gemini');
  assert.equal(result.fallbackUsed, false);
  assert.equal(openAICalls, 0);
  assert.deepEqual(result.attempts.map(attempt => attempt.provider), ['gemini']);
});

test('uses OpenAI once after a retryable Gemini failure', async () => {
  let openAICalls = 0;
  const providers: ProviderCalls = {
    gemini: async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); },
    openai: async () => {
      openAICalls += 1;
      return { text: validText, model: 'openai-test' };
    },
  };

  const result = await runWithGeminiOpenAIFallback(providers, validate);
  assert.equal(result.provider, 'openai');
  assert.equal(result.fallbackUsed, true);
  assert.equal(openAICalls, 1);
});

test('uses OpenAI once when Gemini returns invalid JSON', async () => {
  const result = await runWithGeminiOpenAIFallback({
    gemini: async () => ({
      text: 'not JSON',
      model: 'gemini-test',
      usage: { inputTokens: 11, outputTokens: 4 },
    }),
    openai: async () => ({
      text: validText,
      model: 'openai-test',
      usage: { inputTokens: 12, outputTokens: 5 },
    }),
  }, validate);

  assert.equal(result.provider, 'openai');
  assert.equal(result.analysis.value, 'validated');
  assert.deepEqual(
    result.attempts.map(attempt => ({
      provider: attempt.provider,
      inputTokens: attempt.usage?.inputTokens,
      outputTokens: attempt.usage?.outputTokens,
    })),
    [
      { provider: 'gemini', inputTokens: 11, outputTokens: 4 },
      { provider: 'openai', inputTokens: 12, outputTokens: 5 },
    ],
  );
});

test('does not fail over for invalid requests, but does for provider service errors', () => {
  assert.equal(shouldFailOver(Object.assign(new Error('Bad request'), { status: 400 })), false);
  assert.equal(shouldFailOver(Object.assign(new Error('Rate limited'), { status: 429 })), true);
  assert.equal(shouldFailOver(Object.assign(new Error('Server error'), { status: 503 })), true);
});

test('does not loop if the fallback provider also returns invalid output', async () => {
  let openAICalls = 0;
  await assert.rejects(
    runWithGeminiOpenAIFallback({
      gemini: async () => ({ text: 'bad', model: 'gemini-test' }),
      openai: async () => {
        openAICalls += 1;
        return { text: 'also bad', model: 'openai-test' };
      },
    }, validate),
    error => error instanceof AIProvidersUnavailableError && error.attempts.length === 2,
  );
  assert.equal(openAICalls, 1);
});
