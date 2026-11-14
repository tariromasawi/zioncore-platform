import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express, { type RequestHandler } from 'express';
import type { WalletSnapshot, WalletTransaction } from '../lib/credit-ledger';
import { createWalletRouter } from './wallet';

type WalletLedgerReader = {
  readWallet(uid: string): Promise<WalletSnapshot>;
  listTransactions(uid: string, limit?: number): Promise<WalletTransaction[]>;
};

const sampleWallet: WalletSnapshot = {
  purchasedCredits: 8,
  promotionalCredits: 2,
  reservedCredits: 0,
  availableCredits: 10,
  updatedAt: null,
};

const sampleTransaction: WalletTransaction = {
  id: 'purchase-1',
  type: 'purchase',
  purchasedDelta: 8,
  promotionalDelta: 0,
  reservedDelta: 0,
  creditDelta: 8,
  relatedOperationId: null,
  createdAt: '2026-11-08T12:00:00.000Z',
};

async function withWalletServer(
  verifiedUid: string | null,
  ledger: WalletLedgerReader,
  run: (baseUrl: string) => Promise<void>,
) {
  const identityMiddleware: RequestHandler = (_req, res, next) => {
    if (verifiedUid) res.locals.firebaseUid = verifiedUid;
    next();
  };
  const app = express().use(createWalletRouter(identityMiddleware, () => ledger));
  const server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

test('wallet and history use the verified UID and ignore caller-supplied UIDs', async () => {
  const walletReads: string[] = [];
  const transactionReads: string[] = [];
  const ledger: WalletLedgerReader = {
    async readWallet(uid) {
      walletReads.push(uid);
      return sampleWallet;
    },
    async listTransactions(uid) {
      transactionReads.push(uid);
      return [sampleTransaction];
    },
  };

  await withWalletServer('verified-customer', ledger, async baseUrl => {
    const walletResponse = await fetch(`${baseUrl}/wallet?uid=other-customer`);
    assert.equal(walletResponse.status, 200);
    assert.equal(walletResponse.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await walletResponse.json(), sampleWallet);

    const historyResponse = await fetch(
      `${baseUrl}/wallet/transactions?uid=other-customer`,
    );
    assert.equal(historyResponse.status, 200);
    assert.equal(historyResponse.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await historyResponse.json(), {
      transactions: [sampleTransaction],
    });
  });

  assert.deepEqual(walletReads, ['verified-customer']);
  assert.deepEqual(transactionReads, ['verified-customer']);
});

test('wallet and history deny requests without a verified UID', async () => {
  let ledgerCalls = 0;
  const ledger: WalletLedgerReader = {
    async readWallet() {
      ledgerCalls += 1;
      return sampleWallet;
    },
    async listTransactions() {
      ledgerCalls += 1;
      return [sampleTransaction];
    },
  };

  await withWalletServer(null, ledger, async baseUrl => {
    const walletResponse = await fetch(`${baseUrl}/wallet?uid=attacker`);
    assert.equal(walletResponse.status, 401);

    const historyResponse = await fetch(
      `${baseUrl}/wallet/transactions?uid=attacker`,
    );
    assert.equal(historyResponse.status, 401);
  });

  assert.equal(ledgerCalls, 0);
});
