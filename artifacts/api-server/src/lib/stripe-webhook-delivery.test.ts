import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import {
  InvalidStripeSignatureError,
  processStripeWebhookDelivery,
} from './stripe-webhook-delivery';

// Synthetic fixtures: these never authenticate a network request.
const stripe = new Stripe('sk_test_unit_fixture_only');
const secret = 'unit-test-signing-fixture';
const payload = Buffer.from(JSON.stringify({
  id: 'evt_unit_delivery',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { id: 'cs_test_delivery' } },
}));
const verify = (body: Buffer, signature: string) =>
  stripe.webhooks.constructEvent(body, signature, secret);
const signature = () => stripe.webhooks.generateTestHeaderString({
  payload: payload.toString(), secret,
});

test('a signed delivery fulfills without requiring a PostgreSQL mirror', async () => {
  let count = 0;
  await processStripeWebhookDelivery(payload, signature(), {
    verify,
    fulfill: async event => {
      assert.equal(event.id, 'evt_unit_delivery');
      count++;
    },
  });
  assert.equal(count, 1);
});

test('an invalid signature never reaches fulfillment and does not expose the payload', async () => {
  let reachedFulfillment = false;
  const invalid = stripe.webhooks.generateTestHeaderString({
    payload: payload.toString(), secret: 'different-fixture',
  });
  await assert.rejects(processStripeWebhookDelivery(payload, invalid, {
    verify,
    fulfill: async () => { reachedFulfillment = true; },
  }), error => error instanceof InvalidStripeSignatureError
    && !error.message.includes('evt_unit_delivery'));
  assert.equal(reachedFulfillment, false);
});

test('tampering with the signed body is rejected before any fulfillment', async () => {
  await assert.rejects(processStripeWebhookDelivery(
    Buffer.from(`${payload.toString()} `),
    signature(),
    { verify, fulfill: async () => { assert.fail('must not fulfill'); } },
  ), InvalidStripeSignatureError);
});

test('fulfillment failures propagate for Stripe retry and never run the mirror', async () => {
  let mirrorCalled = false;
  await assert.rejects(processStripeWebhookDelivery(payload, signature(), {
    verify,
    fulfill: async () => { throw new Error('Firestore unavailable'); },
    mirror: async () => { mirrorCalled = true; },
  }), /Firestore unavailable/);
  assert.equal(mirrorCalled, false);
});

test('an explicitly enabled mirror runs after fulfillment and errors remain retryable', async () => {
  const order: string[] = [];
  await assert.rejects(processStripeWebhookDelivery(payload, signature(), {
    verify,
    fulfill: async () => { order.push('fulfill'); },
    mirror: async () => { order.push('mirror'); throw new Error('mirror unavailable'); },
  }), /mirror unavailable/);
  assert.deepEqual(order, ['fulfill', 'mirror']);
});

test('verification configuration failures are not mislabeled as bad signatures', async () => {
  await assert.rejects(processStripeWebhookDelivery(payload, signature(), {
    verify: () => { throw new Error('configuration unavailable'); },
    fulfill: async () => { assert.fail('must not fulfill'); },
  }), /configuration unavailable/);
});
