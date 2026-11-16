import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { createAiInterpretationRouter } from './ai-interpretation';

test('public approved pricing needs no identity, wallet, provider or payment operation', async () => {
  let privilegedCalls = 0;
  const app = express();
  app.use('/api', createAiInterpretationRouter({
    environment: {
      ZIONCORE_AI_PRICING_APPROVED: 'true',
      ZIONCORE_AI_INTERPRETATION_CREDITS: '100',
      ZIONCORE_AI_SPIRITUAL_INTERPRETATION_CREDITS: '200',
      ZIONCORE_AI_PRICING_VERSION: 'service-catalog-v2',
    },
    identityMiddleware: (_req, res) => { privilegedCalls++; res.sendStatus(401); },
    ledgerProvider: () => { privilegedCalls++; throw new Error('Wallet must not be touched.'); },
    providerFactory: () => { privilegedCalls++; throw new Error('Provider must not be touched.'); },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/api/ai/interpretation/pricing`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { standardCredits: 100, spiritualCredits: 200, freeLocal: true });
    assert.equal(privilegedCalls, 0);
    assert.equal((await fetch(`${base}/api/ai/interpretation/quote`)).status, 401);
    assert.equal(privilegedCalls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
