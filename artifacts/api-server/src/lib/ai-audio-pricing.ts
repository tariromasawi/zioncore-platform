import { getAIInterpretationPrice } from './ai-interpretation-pricing';

export const AUDIO_QUOTE_DURATION_UNIT_SECONDS = 30;
export const AUDIO_QUOTE_SIZE_UNIT_BYTES = 1024 * 1024;

export type AudioQuoteScopeInput = {
  durationSeconds: number;
  fileBytes: number;
  includeFaithReflection: boolean;
};

export type AudioInterpretationPrice = {
  credits: number;
  baseCredits: number;
  addOnCredits: number;
  pricingVersion: string;
  durationBandSeconds: number;
  fileSizeBandBytes: number;
};

export function getAudioInterpretationPrice(
  input: AudioQuoteScopeInput,
  env: NodeJS.ProcessEnv = process.env,
): AudioInterpretationPrice | null {
  const base = getAIInterpretationPrice(env, input.includeFaithReflection);
  const pricingVersion = env.ZIONCORE_AI_AUDIO_PRICING_VERSION?.trim();
  const durationRate = boundedRate(env.ZIONCORE_AI_AUDIO_CREDITS_PER_30S, 5);
  const sizeRate = boundedRate(env.ZIONCORE_AI_AUDIO_CREDITS_PER_MB, 2);
  if (
    !base ||
    env.ZIONCORE_AI_AUDIO_PRICING_APPROVED?.trim().toLowerCase() !== 'true' ||
    !pricingVersion ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(pricingVersion) ||
    !Number.isSafeInteger(durationRate) ||
    !Number.isSafeInteger(sizeRate) ||
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds < 3 ||
    input.durationSeconds > 600 ||
    !Number.isSafeInteger(input.fileBytes) ||
    input.fileBytes < 1 ||
    input.fileBytes > 32 * 1024 * 1024
  ) return null;

  const durationBandSeconds = Math.ceil(input.durationSeconds / AUDIO_QUOTE_DURATION_UNIT_SECONDS)
    * AUDIO_QUOTE_DURATION_UNIT_SECONDS;
  const fileSizeBandBytes = Math.ceil(input.fileBytes / AUDIO_QUOTE_SIZE_UNIT_BYTES)
    * AUDIO_QUOTE_SIZE_UNIT_BYTES;
  const durationUnitsBeyondBase = Math.max(
    0,
    durationBandSeconds / AUDIO_QUOTE_DURATION_UNIT_SECONDS - 1,
  );
  const sizeUnitsBeyondBase = Math.max(
    0,
    fileSizeBandBytes / AUDIO_QUOTE_SIZE_UNIT_BYTES - 5,
  );
  const addOnCredits = Math.max(
    1,
    durationUnitsBeyondBase * durationRate + sizeUnitsBeyondBase * sizeRate,
  );
  const credits = base.credits + addOnCredits;
  if (!Number.isSafeInteger(credits) || credits <= base.credits || credits > 1_000_000) {
    return null;
  }
  return {
    credits,
    baseCredits: base.credits,
    addOnCredits,
    pricingVersion: `audio-${pricingVersion}-${base.pricingVersion}`,
    durationBandSeconds,
    fileSizeBandBytes,
  };
}

function boundedRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  if (!/^(?:0|[1-9]\d{0,3})$/.test(raw.trim())) return Number.NaN;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 1000 ? value : Number.NaN;
}

export function buildAudioQuoteScope(input: AudioQuoteScopeInput): string {
  const durationBandSeconds = Math.ceil(input.durationSeconds / AUDIO_QUOTE_DURATION_UNIT_SECONDS)
    * AUDIO_QUOTE_DURATION_UNIT_SECONDS;
  const fileSizeBandMb = Math.ceil(input.fileBytes / AUDIO_QUOTE_SIZE_UNIT_BYTES);
  return `audio-review:pcm-wav:${durationBandSeconds}s:${fileSizeBandMb}mb:${input.includeFaithReflection ? 'spiritual' : 'frequency'}:v2`;
}
