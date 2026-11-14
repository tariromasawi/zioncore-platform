import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateTaskPriceQuote,
  TaskPricingError,
  type TaskCostBreakdown,
  type TaskPricingPolicy,
} from './task-pricing';

const costs: TaskCostBreakdown = {
  modelInferenceMicroGbp: 70_000,
  audioProcessingMicroGbp: 15_000,
  externalApiMicroGbp: 0,
  computeMicroGbp: 10_000,
  storageMicroGbp: 5_000,
  overheadMicroGbp: 0,
};

const policy: TaskPricingPolicy = {
  version: 'cost-review-v1',
  targetGrossMarginBasisPoints: 5_000,
  creditsPerPound: 1_000,
  roundingIncrement: 10,
  minimumCredits: 10,
  maximumCredits: 100_000,
};

test('calculates a deterministic quote from measured cost and target margin', () => {
  const quote = calculateTaskPriceQuote(costs, policy);

  assert.deepEqual(quote, {
    pricingVersion: 'cost-review-v1',
    totalCostMicroGbp: 100_000,
    targetPriceMicroGbp: 200_000,
    credits: 200,
  });
});

test('rounds up to the configured credit increment and never below the minimum', () => {
  const lowCost: TaskCostBreakdown = {
    ...costs,
    modelInferenceMicroGbp: 1,
    audioProcessingMicroGbp: 0,
    computeMicroGbp: 0,
    storageMicroGbp: 0,
  };

  const quote = calculateTaskPriceQuote(lowCost, {
    ...policy,
    targetGrossMarginBasisPoints: 0,
    creditsPerPound: 1,
    roundingIncrement: 25,
    minimumCredits: 50,
  });

  assert.equal(quote.credits, 50);
});

test('rejects zero costs rather than inventing a paid quote', () => {
  const zeroCosts = Object.fromEntries(
    Object.keys(costs).map(key => [key, 0]),
  ) as TaskCostBreakdown;

  assert.throws(
    () => calculateTaskPriceQuote(zeroCosts, policy),
    error => error instanceof TaskPricingError && error.code === 'COST_NOT_MEASURED',
  );
});

test('rejects client-added or missing cost components', () => {
  assert.throws(
    () => calculateTaskPriceQuote({ ...costs, arbitraryClientCost: 1 } as TaskCostBreakdown, policy),
    error => error instanceof TaskPricingError && error.code === 'INVALID_COST_BREAKDOWN',
  );

  const { overheadMicroGbp: _overhead, ...incompleteCosts } = costs;
  assert.throws(
    () => calculateTaskPriceQuote(incompleteCosts as TaskCostBreakdown, policy),
    error => error instanceof TaskPricingError && error.code === 'INVALID_COST_BREAKDOWN',
  );
});

test('rejects negative, fractional, and unsafe cost amounts', () => {
  for (const invalid of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => calculateTaskPriceQuote(
        { ...costs, modelInferenceMicroGbp: invalid },
        policy,
      ),
      error => error instanceof TaskPricingError && error.code === 'INVALID_COST_BREAKDOWN',
    );
  }
});

test('rejects a cost total that overflows the supported integer range', () => {
  assert.throws(
    () => calculateTaskPriceQuote(
      {
        ...costs,
        modelInferenceMicroGbp: Number.MAX_SAFE_INTEGER,
        audioProcessingMicroGbp: 1,
      },
      policy,
    ),
    error => error instanceof TaskPricingError && error.code === 'INVALID_COST_BREAKDOWN',
  );
});

test('fails closed when a quote exceeds its configured credit cap', () => {
  assert.throws(
    () => calculateTaskPriceQuote(costs, { ...policy, maximumCredits: 100 }),
    error => error instanceof TaskPricingError && error.code === 'PRICE_EXCEEDS_LIMIT',
  );
});

test('rejects unsafe margin, conversion, and version values', () => {
  const invalidPolicies: TaskPricingPolicy[] = [
    { ...policy, targetGrossMarginBasisPoints: 10_000 },
    { ...policy, creditsPerPound: 0 },
    { ...policy, version: 'version with spaces' },
    { ...policy, minimumCredits: 15 },
  ];

  for (const invalidPolicy of invalidPolicies) {
    assert.throws(
      () => calculateTaskPriceQuote(costs, invalidPolicy),
      error => error instanceof TaskPricingError && error.code === 'INVALID_PRICING_POLICY',
    );
  }
});
