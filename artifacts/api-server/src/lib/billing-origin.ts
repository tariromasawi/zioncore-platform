export const ZIONCORE_PRODUCTION_ORIGIN = 'https://zioncore.replit.app';

export type BillingOriginEnvironment = {
  nodeEnv?: string;
  replitDomains?: string;
  replitDevDomain?: string;
};

export function getTrustedBillingOrigin(
  rawOrigin: string | undefined,
  environment: BillingOriginEnvironment,
): string | null {
  if (!rawOrigin) return null;

  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return null;
  }

  if (environment.nodeEnv === 'production') {
    return origin.origin === ZIONCORE_PRODUCTION_ORIGIN
      ? ZIONCORE_PRODUCTION_ORIGIN
      : null;
  }

  const isLocalOrigin =
    origin.hostname === 'localhost' || origin.hostname === '127.0.0.1';
  if (origin.protocol !== 'https:' && !isLocalOrigin) return null;
  if (isLocalOrigin) return origin.origin;

  const trustedHosts = new Set(
    [environment.replitDomains, environment.replitDevDomain]
      .filter((value): value is string => Boolean(value))
      .flatMap(value => value.split(','))
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  );

  return trustedHosts.has(origin.host.toLowerCase()) ? origin.origin : null;
}
