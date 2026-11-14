const microPoundsPerPound = 1_000_000n;
const basisPoints = 10_000n;
const maximumCreditsPerQuote = 1_000_000;

export type TaskCostBreakdown = {
  modelInferenceMicroGbp: number;
  audioProcessingMicroGbp: number;
  externalApiMicroGbp: number;
  computeMicroGbp: number;
  storageMicroGbp: number;
  overheadMicroGbp: number;
};

export type TaskPricingPolicy = {
  version: string;
  targetGrossMarginBasisPoints: number;
  creditsPerPound: number;
  roundingIncrement: number;
  minimumCredits: number;
  maximumCredits: number;
};

export type TaskPriceQuote = {
  pricingVersion: string;
  totalCostMicroGbp: number;
  targetPriceMicroGbp: number;
  credits: number;
};

export type TaskPricingErrorCode =
  | 'INVALID_COST_BREAKDOWN'
  | 'COST_NOT_MEASURED'
  | 'INVALID_PRICING_POLICY'
  | 'PRICE_EXCEEDS_LIMIT';

export class TaskPricingError extends Error {
  constructor(readonly code: TaskPricingErrorCode, message: string) {
    super(message);
    this.name = 'TaskPricingError';
  }
}

const costFields = [
  'modelInferenceMicroGbp',
  'audioProcessingMicroGbp',
  'externalApiMicroGbp',
  'computeMicroGbp',
  'storageMicroGbp',
  'overheadMicroGbp',
] as const satisfies readonly (keyof TaskCostBreakdown)[];

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function validateCosts(costs: TaskCostBreakdown): number {
  if (!costs || typeof costs !== 'object' || Array.isArray(costs)) {
    throw new TaskPricingError('INVALID_COST_BREAKDOWN', 'A measured cost breakdown is required.');
  }

  const keys = Object.keys(costs).sort();
  const expectedKeys = [...costFields].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TaskPricingError('INVALID_COST_BREAKDOWN', 'The cost breakdown has an invalid shape.');
  }

  let total = 0n;
  for (const field of costFields) {
    const amount = costs[field];
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new TaskPricingError(
        'INVALID_COST_BREAKDOWN',
        'Cost components must be non-negative safe integers in micro-GBP.',
      );
    }
    total += BigInt(amount);
  }

  if (total <= 0n) {
    throw new TaskPricingError(
      'COST_NOT_MEASURED',
      'A paid quote requires a positive, measured processing cost.',
    );
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TaskPricingError('INVALID_COST_BREAKDOWN', 'The total cost is outside the supported range.');
  }
  return Number(total);
}

function validatePolicy(policy: TaskPricingPolicy): void {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new TaskPricingError('INVALID_PRICING_POLICY', 'A server pricing policy is required.');
  }

  const policyKeys = Object.keys(policy).sort();
  const expectedPolicyKeys = [
    'version',
    'targetGrossMarginBasisPoints',
    'creditsPerPound',
    'roundingIncrement',
    'minimumCredits',
    'maximumCredits',
  ].sort();
  if (
    policyKeys.length !== expectedPolicyKeys.length ||
    policyKeys.some((key, index) => key !== expectedPolicyKeys[index])
  ) {
    throw new TaskPricingError('INVALID_PRICING_POLICY', 'The pricing policy has an invalid shape.');
  }

  const validVersion = typeof policy.version === 'string' &&
    /^[A-Za-z0-9._-]{1,64}$/.test(policy.version);
  const validMargin = Number.isSafeInteger(policy.targetGrossMarginBasisPoints) &&
    policy.targetGrossMarginBasisPoints >= 0 &&
    policy.targetGrossMarginBasisPoints <= 9_500;
  const validConversion = Number.isSafeInteger(policy.creditsPerPound) &&
    policy.creditsPerPound > 0 &&
    policy.creditsPerPound <= maximumCreditsPerQuote;
  const validIncrement = Number.isSafeInteger(policy.roundingIncrement) &&
    policy.roundingIncrement > 0 &&
    policy.roundingIncrement <= maximumCreditsPerQuote;
  const validMinimum = Number.isSafeInteger(policy.minimumCredits) &&
    policy.minimumCredits > 0 &&
    policy.minimumCredits <= maximumCreditsPerQuote &&
    policy.minimumCredits % policy.roundingIncrement === 0;
  const validMaximum = Number.isSafeInteger(policy.maximumCredits) &&
    policy.maximumCredits >= policy.minimumCredits &&
    policy.maximumCredits <= maximumCreditsPerQuote;

  if (
    !validVersion ||
    !validMargin ||
    !validConversion ||
    !validIncrement ||
    !validMinimum ||
    !validMaximum
  ) {
    throw new TaskPricingError(
      'INVALID_PRICING_POLICY',
      'The pricing policy is invalid or exceeds the supported limits.',
    );
  }
}

/**
 * Calculates a deterministic server-side credit quote from measured costs.
 * This module has no configured prices and is not connected to checkout.
 */
export function calculateTaskPriceQuote(
  costs: TaskCostBreakdown,
  policy: TaskPricingPolicy,
): TaskPriceQuote {
  const totalCostMicroGbp = validateCosts(costs);
  validatePolicy(policy);

  const cost = BigInt(totalCostMicroGbp);
  const margin = BigInt(policy.targetGrossMarginBasisPoints);
  const targetPriceMicroGbp = ceilDivide(
    cost * basisPoints,
    basisPoints - margin,
  );
  const creditsBeforeRounding = ceilDivide(
    targetPriceMicroGbp * BigInt(policy.creditsPerPound),
    microPoundsPerPound,
  );
  const increment = BigInt(policy.roundingIncrement);
  const roundedCredits = ceilDivide(creditsBeforeRounding, increment) * increment;
  const credits = roundedCredits < BigInt(policy.minimumCredits)
    ? policy.minimumCredits
    : Number(roundedCredits);
  const targetPrice = Number(targetPriceMicroGbp);

  if (!Number.isSafeInteger(targetPrice) || credits > policy.maximumCredits) {
    throw new TaskPricingError(
      'PRICE_EXCEEDS_LIMIT',
      'The measured task cost exceeds the configured quote limit.',
    );
  }

  return {
    pricingVersion: policy.version,
    totalCostMicroGbp,
    targetPriceMicroGbp: targetPrice,
    credits,
  };
}
