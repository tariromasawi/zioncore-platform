import assert from 'node:assert/strict';
import test from 'node:test';
import { getAudioInterpretationPrice } from './ai-audio-pricing';

const base = {
  ZIONCORE_AI_INTERPRETATION_CREDITS: '100',
  ZIONCORE_AI_SPIRITUAL_INTERPRETATION_CREDITS: '200',
  ZIONCORE_AI_PRICING_APPROVED: 'true',
  ZIONCORE_AI_PRICING_VERSION: 'catalog-v2',
  ZIONCORE_AI_AUDIO_PRICING_APPROVED: 'true',
  ZIONCORE_AI_AUDIO_PRICING_VERSION: 'gemini-v2',
};

const shortFile = { durationSeconds: 20, fileBytes: 4 * 1024 * 1024, includeFaithReflection: false };

test('premium audio price fails closed until separately approved audio pricing is configured', () => {
  assert.equal(getAudioInterpretationPrice(shortFile, {
    ...base,
    ZIONCORE_AI_AUDIO_PRICING_APPROVED: 'false',
  }), null);
});

test('audio quote scales with duration and size and binds the spiritual reading tier', () => {
  assert.deepEqual(getAudioInterpretationPrice(shortFile, base), {
    credits: 101,
    baseCredits: 100,
    addOnCredits: 1,
    pricingVersion: 'audio-gemini-v2-catalog-v2',
    durationBandSeconds: 30,
    fileSizeBandBytes: 4 * 1024 * 1024,
  });

  const longSpiritual = getAudioInterpretationPrice({
    durationSeconds: 600,
    fileBytes: 20 * 1024 * 1024,
    includeFaithReflection: true,
  }, base);
  assert.deepEqual(longSpiritual, {
    credits: 325,
    baseCredits: 200,
    addOnCredits: 125,
    pricingVersion: 'audio-gemini-v2-catalog-v2',
    durationBandSeconds: 600,
    fileSizeBandBytes: 20 * 1024 * 1024,
  });
});

test('audio quote scope binds duration, size and spiritual service selection', async () => {
  const { buildAudioQuoteScope } = await import('./ai-audio-pricing');
  assert.equal(buildAudioQuoteScope(shortFile), 'audio-review:pcm-wav:30s:4mb:frequency:v2');
  assert.equal(buildAudioQuoteScope({ ...shortFile, includeFaithReflection: true }), 'audio-review:pcm-wav:30s:4mb:spiritual:v2');
  assert.notEqual(
    buildAudioQuoteScope({ ...shortFile, durationSeconds: 61 }),
    buildAudioQuoteScope(shortFile),
  );
});

test('rejects audio requests exceeding duration or file-size bounds', () => {
  assert.equal(getAudioInterpretationPrice({ ...shortFile, durationSeconds: 601 }, base), null);
  assert.equal(getAudioInterpretationPrice({ ...shortFile, fileBytes: 33 * 1024 * 1024 }, base), null);
  assert.equal(getAudioInterpretationPrice({ ...shortFile, durationSeconds: 2 }, base), null);
});
