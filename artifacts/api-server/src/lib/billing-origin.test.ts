import assert from 'node:assert/strict';
import test from 'node:test';
import { getTrustedBillingOrigin, ZIONCORE_PRODUCTION_ORIGIN } from './billing-origin';

test('production billing returns use only the approved ZionCore domain', () => {
  assert.equal(
    getTrustedBillingOrigin('https://zioncore.replit.app', { nodeEnv: 'production' }),
    ZIONCORE_PRODUCTION_ORIGIN,
  );
});

test('production billing rejects preview, lookalike, and insecure origins', () => {
  const environment = {
    nodeEnv: 'production',
    replitDomains: 'zioncore.replit.app,preview.replit.dev',
  };
  assert.equal(getTrustedBillingOrigin('https://preview.replit.dev', environment), null);
  assert.equal(getTrustedBillingOrigin('https://zioncore.replit.app.attacker.example', environment), null);
  assert.equal(getTrustedBillingOrigin('http://zioncore.replit.app', environment), null);
});

test('development accepts only local origins or explicitly injected Replit hosts', () => {
  const environment = {
    nodeEnv: 'development',
    replitDomains: 'preview.replit.dev',
    replitDevDomain: 'local-preview.replit.dev',
  };
  assert.equal(getTrustedBillingOrigin('http://localhost:5173', environment), 'http://localhost:5173');
  assert.equal(getTrustedBillingOrigin('https://preview.replit.dev', environment), 'https://preview.replit.dev');
  assert.equal(getTrustedBillingOrigin('https://unlisted.example', environment), null);
});
