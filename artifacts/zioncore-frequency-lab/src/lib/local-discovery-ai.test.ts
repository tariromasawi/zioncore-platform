import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLocalAIAvailability, generateLocalDiscoveryInsight, parseLocalDiscoverySuggestion, type BrowserLanguageModel } from './local-discovery-ai';
import { buildFrontierReport } from './frontier-discovery';

const reading = buildFrontierReport({
  dominantFrequencyHz: null, rmsLevel: 0, durationSeconds: 3, sampleRate: 48000, silent: true,
  features: { spectralCentroidHz: null, spectralFlatness: 0, spectralEntropy: 0, peakToMedianContrastDb: null, rolloff85Hz: null, harmonicity: 0, zeroCrossingRate: 0, dominantFrequencyStabilityHz: null, dominantFrequencyDriftHz: null, amplitudeVariationCoefficient: null, temporalWindowSeconds: 3 },
}, { toolId: 'spiritual', context: '', feeling: 'neutral', hypothesis: '' });
const suggestion = JSON.stringify({ reflection: 'As a personal reflection, consider patience and kindness.', question: 'Would a second recorder show the same pattern?', nextStep: 'Repeat with a matched quiet baseline and compare.' });

test('unsupported browser keeps the free engine and reports local AI unavailable', async () => {
  assert.equal(await getLocalAIAvailability(undefined), 'unavailable');
  await assert.rejects(generateLocalDiscoveryInsight(reading, { signal: new AbortController().signal }, undefined), /unavailable/);
});
test('local AI result validation rejects invented measurements and source confirmations', () => {
  assert.ok(parseLocalDiscoverySuggestion(suggestion).question.includes('recorder'));
  assert.throws(() => parseLocalDiscoverySuggestion(suggestion.replace('patience and kindness', 'confirmed divine presence')));
  assert.throws(() => parseLocalDiscoverySuggestion(suggestion.replace('patience and kindness', 'a peak at 600 Hz')));
});
test('available adapter returns model attribution and closes its session', async () => {
  let destroyed = false;
  let structuredOutputRequested = false;
  const api: BrowserLanguageModel = {
    availability: async () => 'available',
    create: async () => ({ prompt: async (_input, options) => {
      structuredOutputRequested = options?.responseConstraint?.type === 'object';
      return suggestion;
    }, destroy: () => { destroyed = true; } }),
  };
  assert.equal(await getLocalAIAvailability(api), 'available');
  const result = await generateLocalDiscoveryInsight(reading, { signal: new AbortController().signal }, api);
  assert.match(result.model, /Gemini Nano/);
  assert.equal(destroyed, true);
  assert.equal(structuredOutputRequested, true);
});
test('cancellation aborts pending local work without keeping an active session', async () => {
  const abort = new AbortController();
  const api: BrowserLanguageModel = {
    availability: async () => 'available',
    create: async ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })),
  };
  const request = generateLocalDiscoveryInsight(reading, { signal: abort.signal }, api);
  abort.abort();
  await assert.rejects(request);
});
