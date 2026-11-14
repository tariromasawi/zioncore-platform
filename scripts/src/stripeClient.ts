import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

type StripeConnectionSettings = {
  secret_key?: unknown;
  webhook_secret?: unknown;
};

type StripeConnectionResponse = {
  items?: Array<{ settings?: StripeConnectionSettings }>;
};

async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret?: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const replToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !replToken) {
    throw new Error('Stripe is not connected to this Replit environment.');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: {
        Accept: 'application/json',
        X_REPLIT_TOKEN: replToken,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Stripe connection request failed with status ${response.status}.`);
  }

  const data = await response.json() as StripeConnectionResponse;
  const settings = data.items?.[0]?.settings;
  if (typeof settings?.secret_key !== 'string' || settings.secret_key.length === 0) {
    throw new Error('The connected Stripe account does not provide a secret key.');
  }
  return {
    secretKey: settings.secret_key,
    webhookSecret: typeof settings.webhook_secret === 'string'
      ? settings.webhook_secret
      : undefined,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey, { maxNetworkRetries: 2 });
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for Stripe data synchronization.');
  }
  const { secretKey, webhookSecret } = await getStripeCredentials();
  if (!webhookSecret) {
    throw new Error('A Stripe webhook signing secret is not configured.');
  }
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
  });
}
