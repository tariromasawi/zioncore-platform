import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const SERVICE_QUOTE_TTL_MS = 15 * 60 * 1000;
const QUOTE_AUDIENCE = 'zioncore-service-quote-v1';
const MAX_QUOTE_TOKEN_LENGTH = 4096;

export type QuotedService = 'interpretation' | 'audio-review';

export type ServiceQuoteExpectation = {
  uid: string;
  service: QuotedService;
  credits: number;
  pricingVersion: string;
  scope: string;
};

export type SignedServiceQuote = ServiceQuoteExpectation & {
  quoteId: string;
  currency: 'gbp';
  amountMinor: number;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type IssuedServiceQuote = {
  quoteId: string;
  quoteToken: string;
  expiresAt: string;
  currency: 'gbp';
  amountMinor: number;
};

export type ServiceQuoteVerification =
  | { ok: true; quote: SignedServiceQuote }
  | { ok: false; reason: 'unconfigured' | 'invalid' | 'expired' | 'mismatch' };

function quoteSecret(env: NodeJS.ProcessEnv): Buffer | null {
  const value = env.SESSION_SECRET?.trim();
  return value && Buffer.byteLength(value, 'utf8') >= 32
    ? Buffer.from(value, 'utf8')
    : null;
}

function isQuoteService(value: unknown): value is QuotedService {
  return value === 'interpretation' || value === 'audio-review';
}

function isQuotePayload(value: unknown): value is SignedServiceQuote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Partial<SignedServiceQuote> & { audience?: unknown };
  return quote.audience === QUOTE_AUDIENCE
    && typeof quote.quoteId === 'string'
    && /^[0-9a-f-]{36}$/i.test(quote.quoteId)
    && typeof quote.uid === 'string'
    && quote.uid.length > 0
    && quote.uid.length <= 128
    && !quote.uid.includes('/')
    && isQuoteService(quote.service)
    && Number.isSafeInteger(quote.credits)
    && Number(quote.credits) > 0
    && Number(quote.credits) <= 1_000_000
    && typeof quote.pricingVersion === 'string'
    && /^[A-Za-z0-9._-]{1,64}$/.test(quote.pricingVersion)
    && typeof quote.scope === 'string'
    && /^[a-z0-9:._-]{1,120}$/.test(quote.scope)
    && quote.currency === 'gbp'
    && Number.isSafeInteger(quote.amountMinor)
    && quote.amountMinor === quote.credits
    && Number.isSafeInteger(quote.issuedAtMs)
    && Number.isSafeInteger(quote.expiresAtMs)
    && Number(quote.expiresAtMs) > Number(quote.issuedAtMs)
    && Number(quote.expiresAtMs) - Number(quote.issuedAtMs) <= SERVICE_QUOTE_TTL_MS;
}

function signature(secret: Buffer, payload: string): Buffer {
  return createHmac('sha256', secret)
    .update(`${QUOTE_AUDIENCE}\0${payload}`)
    .digest();
}

export function issueServiceQuote(
  input: ServiceQuoteExpectation,
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now(),
): IssuedServiceQuote | null {
  const secret = quoteSecret(env);
  if (!secret
    || !input.uid
    || input.uid.length > 128
    || input.uid.includes('/')
    || !isQuoteService(input.service)
    || !Number.isSafeInteger(input.credits)
    || input.credits < 1
    || input.credits > 1_000_000
    || !/^[A-Za-z0-9._-]{1,64}$/.test(input.pricingVersion)
    || !/^[a-z0-9:._-]{1,120}$/.test(input.scope)
    || !Number.isSafeInteger(nowMs)
  ) return null;

  const quote: SignedServiceQuote & { audience: string } = {
    audience: QUOTE_AUDIENCE,
    ...input,
    quoteId: randomUUID(),
    currency: 'gbp',
    amountMinor: input.credits,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + SERVICE_QUOTE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(quote), 'utf8').toString('base64url');
  const token = `${encoded}.${signature(secret, encoded).toString('base64url')}`;
  return {
    quoteId: quote.quoteId,
    quoteToken: token,
    expiresAt: new Date(quote.expiresAtMs).toISOString(),
    currency: quote.currency,
    amountMinor: quote.amountMinor,
  };
}

export function verifyServiceQuote(
  token: string,
  expected: ServiceQuoteExpectation,
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now(),
): ServiceQuoteVerification {
  const secret = quoteSecret(env);
  if (!secret) return { ok: false, reason: 'unconfigured' };
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_QUOTE_TOKEN_LENGTH) {
    return { ok: false, reason: 'invalid' };
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'invalid' };
  let suppliedSignature: Buffer;
  let decoded: Buffer;
  try {
    decoded = Buffer.from(parts[0], 'base64url');
    suppliedSignature = Buffer.from(parts[1], 'base64url');
    if (
      decoded.toString('base64url') !== parts[0]
      || suppliedSignature.toString('base64url') !== parts[1]
    ) return { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  const expectedSignature = signature(secret, parts[0]);
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) return { ok: false, reason: 'invalid' };

  let payload: unknown;
  try {
    payload = JSON.parse(decoded.toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isQuotePayload(payload)) return { ok: false, reason: 'invalid' };
  if (payload.expiresAtMs <= nowMs) return { ok: false, reason: 'expired' };
  if (
    payload.issuedAtMs > nowMs + 60_000
    || payload.uid !== expected.uid
    || payload.service !== expected.service
    || payload.credits !== expected.credits
    || payload.pricingVersion !== expected.pricingVersion
    || payload.scope !== expected.scope
  ) return { ok: false, reason: 'mismatch' };

  return { ok: true, quote: payload };
}
