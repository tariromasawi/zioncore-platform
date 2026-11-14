import Stripe from 'stripe';

export class InvalidStripeSignatureError extends Error {
  constructor() {
    super('Invalid Stripe webhook signature.');
    this.name = 'InvalidStripeSignatureError';
  }
}

export type StripeWebhookDeliveryDependencies = {
  verify: (payload: Buffer, signature: string) => Promise<Stripe.Event> | Stripe.Event;
  fulfill: (event: Stripe.Event) => Promise<void>;
  mirror?: (payload: Buffer, signature: string) => Promise<void>;
};

// The optional PostgreSQL mirror is not the source of wallet entitlements.
// Never acknowledge a delivery before its Firestore fulfillment has succeeded.
export async function processStripeWebhookDelivery(
  payload: Buffer,
  signature: string,
  dependencies: StripeWebhookDeliveryDependencies,
): Promise<void> {
  if (!Buffer.isBuffer(payload)) {
    throw new TypeError('Stripe webhook payload must be a raw Buffer.');
  }
  let event: Stripe.Event;
  try {
    event = await dependencies.verify(payload, signature);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      // Do not propagate SDK errors containing the supplied signature or payload.
      throw new InvalidStripeSignatureError();
    }
    throw error;
  }
  await dependencies.fulfill(event);
  if (dependencies.mirror) await dependencies.mirror(payload, signature);
}
