import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billingOfferAccessibleName, billingPriceLabel } from './billing-accessibility';

const creditPack = {
  name: 'Listening credits', credits: 250, amountMinor: 250,
  currency: 'gbp' as const, interval: null,
};
test('each available and paused purchase control has its offer and price in the name', () => {
  for (const action of ['Buy credits', 'Sign in to buy', 'Purchases paused']) {
    assert.equal(billingOfferAccessibleName(action, creditPack),
      `${action}: Listening credits, 250 credits, £2.50`);
    assert.notEqual(
      billingOfferAccessibleName(action, creditPack),
      billingOfferAccessibleName(action, { ...creditPack, credits: 500, amountMinor: 500 }),
    );
  }
});
test('membership names expose recurrence and exclude a nonexistent credit allocation', () => {
  const membership = { ...creditPack, name: 'ZionCore Premium', credits: null, amountMinor: 100, interval: 'month' as const };
  assert.equal(billingPriceLabel(membership), '£1.00 / month');
  assert.equal(billingOfferAccessibleName('Start Premium', membership), 'Start Premium: ZionCore Premium, £1.00 / month');
});
