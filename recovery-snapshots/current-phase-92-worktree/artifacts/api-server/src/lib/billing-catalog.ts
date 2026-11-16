import type Stripe from 'stripe';
import type { BillingOffer, BillingCatalogResponse } from '@workspace/api-zod';
import { getUncachableStripeClient } from './stripe-client';

export type CheckoutMode = 'disabled' | 'test' | 'live';

export type BillingCatalogEntry = BillingOffer & {
  priceId: string;
  livemode: boolean;
};

const currentCreditPacks = {
  'credits-250': 250,
  'credits-500': 500,
  'credits-1050': 1050,
  'credits-2750': 2750,
  'credits-5750': 5750,
} as const;

const legacyCreditPacks = {
  'credits-50': 50,
  'credits-200': 200,
  'credits-1000': 1000,
} as const;

export type CreditPackKey = keyof typeof currentCreditPacks | keyof typeof legacyCreditPacks;

const supportedOfferKeys = new Set<string>([
  ...Object.keys(currentCreditPacks),
  'premium-monthly',
]);
const catalogCreditAmounts = new Set<number>([
  ...Object.values(currentCreditPacks),
  ...Object.values(legacyCreditPacks),
]);

export function getCreditPackGrantAmount(key: string): number | undefined {
  if (Object.hasOwn(currentCreditPacks, key)) {
    return currentCreditPacks[key as keyof typeof currentCreditPacks];
  }
  if (Object.hasOwn(legacyCreditPacks, key)) {
    return legacyCreditPacks[key as keyof typeof legacyCreditPacks];
  }
  return undefined;
}

export function isLegacyCreditPackKey(value: string): value is keyof typeof legacyCreditPacks {
  return Object.hasOwn(legacyCreditPacks, value);
}

export function getCheckoutMode(): CheckoutMode {
  const configured = process.env.ZIONCORE_CHECKOUT_MODE;
  if (process.env.NODE_ENV === 'production') {
    return configured === 'live' ? 'live' : 'disabled';
  }
  return configured === 'test' || configured === 'live'
    ? configured
    : 'disabled';
}

function hasLiveStripeCredentials(): boolean {
  const secretKey = process.env.STRIPE_LIVE_SECRET_KEY?.trim() ?? '';
  const webhookSecret = process.env.STRIPE_LIVE_WEBHOOK_SECRET?.trim() ?? '';
  const liveApiKey = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_');
  return liveApiKey && webhookSecret.startsWith('whsec_');
}

export function isCheckoutEnabled(): boolean {
  const mode = getCheckoutMode();
  if (mode === 'test') return process.env.NODE_ENV !== 'production';
  return mode === 'live'
    && process.env.ZIONCORE_LIVE_CHECKOUT_APPROVED === 'true'
    && process.env.ZIONCORE_AUTOMATIC_TAX_ENABLED === 'true'
    && hasLiveStripeCredentials();
}

export function isOfferPurchasable(key: string): boolean {
  const mode = getCheckoutMode();
  if (!supportedOfferKeys.has(key)) return false;
  if (mode === 'disabled') return false;
  if (mode === 'test') return true;
  if (!isCheckoutEnabled()) return false;
  if (key === 'premium-monthly') {
    return process.env.ZIONCORE_PREMIUM_FEATURES_ENABLED === 'true';
  }
  return supportedOfferKeys.has(key)
    && process.env.ZIONCORE_PAID_USAGE_ENABLED === 'true';
}

function expectedLivemode(mode = getCheckoutMode()): boolean | null {
  if (mode === 'live') return true;
  if (mode === 'test') return false;
  return null;
}

function toOffer(price: Stripe.Price, product: Stripe.Product): BillingCatalogEntry | null {
  if (!product.active || product.metadata.app !== 'zioncore') return null;
  if (price.currency !== 'gbp' || !price.active || price.unit_amount == null) return null;

  const credits = Number(product.metadata.credits);
  if (
    Number.isSafeInteger(credits)
    && catalogCreditAmounts.has(credits)
    && !price.recurring
    && product.metadata.pack === `credits-${credits}`
  ) {
    return {
      key: `credits-${credits}` as BillingOffer['key'],
      kind: 'credit_pack',
      name: product.name,
      credits,
      currency: 'gbp',
      amountMinor: price.unit_amount,
      purchasable: isOfferPurchasable(`credits-${credits}`),
      interval: null,
      priceId: price.id,
      livemode: price.livemode,
    };
  }

  if (
    product.metadata.plan === 'pro'
    && product.metadata.currency_label === 'gbp'
    && price.recurring?.interval === 'month'
  ) {
    return {
      key: 'premium-monthly',
      kind: 'premium_subscription',
      name: product.name,
      credits: null,
      currency: 'gbp',
      amountMinor: price.unit_amount,
      purchasable: isOfferPurchasable('premium-monthly'),
      interval: 'month',
      priceId: price.id,
      livemode: price.livemode,
    };
  }

  return null;
}

export async function readBillingCatalog(): Promise<{
  response: BillingCatalogResponse;
  entries: BillingCatalogEntry[];
}> {
  const stripe = await getUncachableStripeClient();
  const prices = await stripe.prices.list({
    active: true,
    currency: 'gbp',
    limit: 100,
    expand: ['data.product'],
  });
  const expected = expectedLivemode();
  const entries: BillingCatalogEntry[] = [];

  for (const price of prices.data) {
    if (expected != null && price.livemode !== expected) continue;
    if (typeof price.product === 'string' || 'deleted' in price.product) continue;
    const offer = toOffer(price, price.product);
    if (offer) entries.push(offer);
  }

  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  }
  if ([...counts.values()].some(count => count > 1)) {
    throw new Error('The active ZionCore Stripe catalog has duplicate offer prices.');
  }

  entries.sort((a, b) => {
    const order = [
      'credits-250',
      'credits-500',
      'credits-1050',
      'credits-2750',
      'credits-5750',
      'credits-50',
      'credits-200',
      'credits-1000',
      'premium-monthly',
    ];
    return order.indexOf(a.key) - order.indexOf(b.key);
  });

  const customerOffers = entries.filter(entry => supportedOfferKeys.has(entry.key));
  return {
    response: {
      checkoutEnabled: isCheckoutEnabled(),
      portalEnabled: getCheckoutMode() !== 'disabled',
      offers: customerOffers.map(({ priceId: _priceId, livemode: _livemode, ...offer }) => offer),
    },
    entries,
  };
}

export function findBillingOffer(
  entries: BillingCatalogEntry[],
  key: string,
): BillingCatalogEntry | undefined {
  if (!supportedOfferKeys.has(key)) return undefined;
  return entries.find(entry => entry.key === key);
}

export function isCreditPackKey(value: string): value is CreditPackKey {
  return getCreditPackGrantAmount(value) !== undefined;
}
