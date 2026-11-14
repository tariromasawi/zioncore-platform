export const MAX_INTERPRETATION_CREDITS = 1_000_000;

export type AIInterpretationPrice = {
  credits: number;
  pricingVersion: string;
  service: 'frequency-analysis' | 'spiritual-interpretation';
};

/**
 * Interpretation billing stays unavailable until measured-cost review and
 * explicit owner approval are recorded in server configuration. There is
 * intentionally no default or illustrative price.
 */
export function getAIInterpretationPrice(
  env: NodeJS.ProcessEnv = process.env,
  includeFaithReflection = false,
): AIInterpretationPrice | null {
  const rawCredits = (
    includeFaithReflection
      ? env.ZIONCORE_AI_SPIRITUAL_INTERPRETATION_CREDITS
      : env.ZIONCORE_AI_INTERPRETATION_CREDITS
  )?.trim();
  const pricingVersion = env.ZIONCORE_AI_PRICING_VERSION?.trim();
  if (
    env.ZIONCORE_AI_PRICING_APPROVED?.trim().toLowerCase() !== 'true' ||
    !rawCredits ||
    !/^[1-9]\d{0,6}$/.test(rawCredits) ||
    !pricingVersion
  ) return null;

  const credits = Number(rawCredits);
  if (!Number.isSafeInteger(credits) || credits > MAX_INTERPRETATION_CREDITS) {
    return null;
  }

  if (!/^[A-Za-z0-9._-]{1,64}$/.test(pricingVersion)) return null;

  return {
    credits,
    pricingVersion,
    service: includeFaithReflection ? 'spiritual-interpretation' : 'frequency-analysis',
  };
}
