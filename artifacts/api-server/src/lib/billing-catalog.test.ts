import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCheckoutMode,
  isCheckoutEnabled,
  isOfferPurchasable,
} from './billing-catalog';

const keys = [
  'NODE_ENV',
  'ZIONCORE_CHECKOUT_MODE',
  'ZIONCORE_LIVE_CHECKOUT_APPROVED',
  'ZIONCORE_AUTOMATIC_TAX_ENABLED',
  'ZIONCORE_PAID_USAGE_ENABLED',
  'ZIONCORE_PREMIUM_FEATURES_ENABLED',
  'STRIPE_LIVE_SECRET_KEY',
  'STRIPE_LIVE_WEBHOOK_SECRET',
] as const;

function withBillingEnvironment(values: Partial<Record<typeof keys[number], string>>, run: () => void) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('checkout is disabled unless an explicit test or live mode is selected', () => {
  withBillingEnvironment({}, () => {
    assert.equal(getCheckoutMode(), 'disabled');
    assert.equal(isCheckoutEnabled(), false);
    assert.equal(isOfferPurchasable('credits-250'), false);
    assert.equal(isOfferPurchasable('credits-50'), false);
  });
});

test('test mode is never selected by the production runtime', () => {
  withBillingEnvironment({ NODE_ENV: 'development', ZIONCORE_CHECKOUT_MODE: 'test' }, () => {
    assert.equal(isCheckoutEnabled(), true);
    assert.equal(isOfferPurchasable('credits-250'), true);
    assert.equal(isOfferPurchasable('credits-50'), false);
    assert.equal(isOfferPurchasable('premium-monthly'), true);
  });
  withBillingEnvironment({ NODE_ENV: 'production', ZIONCORE_CHECKOUT_MODE: 'test' }, () => {
    assert.equal(getCheckoutMode(), 'disabled');
    assert.equal(isCheckoutEnabled(), false);
  });
});

test('live checkout requires approval, tax, and correctly typed live credentials', () => {
  withBillingEnvironment({
    NODE_ENV: 'development',
    ZIONCORE_CHECKOUT_MODE: 'live',
    ZIONCORE_LIVE_CHECKOUT_APPROVED: 'true',
    ZIONCORE_AUTOMATIC_TAX_ENABLED: 'true',
  }, () => {
    assert.equal(isCheckoutEnabled(), false);
    assert.equal(isOfferPurchasable('credits-250'), false);
    assert.equal(isOfferPurchasable('credits-50'), false);
    assert.equal(isOfferPurchasable('premium-monthly'), false);
  });

  withBillingEnvironment({
    NODE_ENV: 'development',
    ZIONCORE_CHECKOUT_MODE: 'live',
    ZIONCORE_LIVE_CHECKOUT_APPROVED: 'true',
    ZIONCORE_AUTOMATIC_TAX_ENABLED: 'true',
    STRIPE_LIVE_SECRET_KEY: 'sk_live_placeholder',
    STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_placeholder',
  }, () => {
    assert.equal(isCheckoutEnabled(), true);
    assert.equal(isOfferPurchasable('credits-250'), false);
    assert.equal(isOfferPurchasable('credits-50'), false);
    assert.equal(isOfferPurchasable('premium-monthly'), false);
  });

  withBillingEnvironment({
    NODE_ENV: 'development',
    ZIONCORE_CHECKOUT_MODE: 'live',
    ZIONCORE_LIVE_CHECKOUT_APPROVED: 'true',
    ZIONCORE_AUTOMATIC_TAX_ENABLED: 'true',
    ZIONCORE_PAID_USAGE_ENABLED: 'true',
    ZIONCORE_PREMIUM_FEATURES_ENABLED: 'true',
    STRIPE_LIVE_SECRET_KEY: 'sk_live_placeholder',
    STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_placeholder',
  }, () => {
    assert.equal(isOfferPurchasable('credits-250'), true);
    assert.equal(isOfferPurchasable('credits-500'), true);
    assert.equal(isOfferPurchasable('credits-1050'), true);
    assert.equal(isOfferPurchasable('credits-2750'), true);
    assert.equal(isOfferPurchasable('credits-5750'), true);
    assert.equal(isOfferPurchasable('credits-50'), false);
    assert.equal(isOfferPurchasable('premium-monthly'), true);
    assert.equal(isOfferPurchasable('unlisted-offer'), false);
  });
});
