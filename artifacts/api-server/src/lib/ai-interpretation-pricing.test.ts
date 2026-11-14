import assert from 'node:assert/strict';
import test from 'node:test';
import { getAIInterpretationPrice } from './ai-interpretation-pricing';

test('interpretation pricing fails closed when no owner-approved price is configured', () => {
  assert.equal(getAIInterpretationPrice({}), null);
  assert.equal(getAIInterpretationPrice({
    ZIONCORE_AI_INTERPRETATION_CREDITS: '35',
    ZIONCORE_AI_PRICING_VERSION: 'launch-v1',
  }), null);
  assert.equal(getAIInterpretationPrice({
    ZIONCORE_AI_INTERPRETATION_CREDITS: '',
    ZIONCORE_AI_PRICING_APPROVED: 'true',
    ZIONCORE_AI_PRICING_VERSION: 'launch-v1',
  }), null);
});

test('interpretation pricing accepts a bounded whole-credit price and version', () => {
  assert.deepEqual(
    getAIInterpretationPrice({
      ZIONCORE_AI_INTERPRETATION_CREDITS: '35',
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_PRICING_VERSION: 'launch-v1',
    }),
    { credits: 35, pricingVersion: 'launch-v1', service: 'frequency-analysis' },
  );
});

test('spiritual interpretation has its separately configured approved price', () => {
  assert.deepEqual(
    getAIInterpretationPrice({
      ZIONCORE_AI_INTERPRETATION_CREDITS: '100',
      ZIONCORE_AI_SPIRITUAL_INTERPRETATION_CREDITS: '200',
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_PRICING_VERSION: 'catalog-v2',
    }, true),
    { credits: 200, pricingVersion: 'catalog-v2', service: 'spiritual-interpretation' },
  );
});

test('interpretation pricing rejects decimals, unsafe values, and invalid versions', () => {
  for (const value of ['0', '1.5', '-5', '1000001']) {
    assert.equal(getAIInterpretationPrice({
      ZIONCORE_AI_INTERPRETATION_CREDITS: value,
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_PRICING_VERSION: 'v1',
    }), null);
  }
  assert.deepEqual(
    getAIInterpretationPrice({
      ZIONCORE_AI_INTERPRETATION_CREDITS: ' 5 ',
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_PRICING_VERSION: 'fixed-credit-v1',
    }),
    { credits: 5, pricingVersion: 'fixed-credit-v1', service: 'frequency-analysis' },
  );
  assert.equal(
    getAIInterpretationPrice({
      ZIONCORE_AI_INTERPRETATION_CREDITS: '35',
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_PRICING_VERSION: 'version with spaces',
    }),
    null,
  );
});
