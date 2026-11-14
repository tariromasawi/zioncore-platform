export type AiJobProviderUsage = {
  provider: 'gemini' | 'openai';
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostMicroUsd: number | null;
};

export type AiJobFinancialAudit = {
  quoteId: string;
  service: 'interpretation' | 'audio-review';
  creditsCharged: number;
  grossServiceValueMinor: number;
  currency: 'gbp';
  providerUsage: AiJobProviderUsage[];
  estimatedProviderCostMicroUsd: number | null;
  infrastructureCostMicroUsd: null;
  recordedAtMs: number;
};

export function createAiJobFinancialAudit(input: {
  quoteId: string;
  service: AiJobFinancialAudit['service'];
  creditsCharged: number;
  providerUsage: AiJobProviderUsage[];
  recordedAtMs?: number;
}): AiJobFinancialAudit {
  const estimates = input.providerUsage.map(entry => entry.estimatedCostMicroUsd);
  const estimatedProviderCostMicroUsd = estimates.length > 0 && estimates.every(
    (value): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
  )
    ? estimates.reduce((total, value) => total + value, 0)
    : null;
  return {
    quoteId: input.quoteId,
    service: input.service,
    creditsCharged: input.creditsCharged,
    grossServiceValueMinor: input.creditsCharged,
    currency: 'gbp',
    providerUsage: input.providerUsage,
    estimatedProviderCostMicroUsd,
    infrastructureCostMicroUsd: null,
    recordedAtMs: input.recordedAtMs ?? Date.now(),
  };
}
