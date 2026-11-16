import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { CreditLedgerError, createCreditLedger } from './credit-ledger';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';

assertLocalFirestoreEmulator(process.env.FIRESTORE_EMULATOR_HOST);
const app = initializeApp(
  { projectId: 'demo-zioncore-frequency-lab' },
  `credit-ledger-tests-${process.pid}`,
);
const ledger = createCreditLedger(getFirestore(app));
const testLedger = createCreditLedger(getFirestore(app), 'test');
const uid = () => `test-${randomUUID()}`;

after(async () => {
  await deleteApp(app);
});

test('grants are idempotent and preserve purchased and promotional buckets', async () => {
  const accountId = uid();
  const purchasedInput = {
    amount: 40,
    bucket: 'purchased' as const,
    idempotencyKey: 'purchase-event-0001',
  };
  const firstGrant = await ledger.grantCredits(accountId, purchasedInput);
  const repeatedGrant = await ledger.grantCredits(accountId, purchasedInput);
  const promotionalGrant = await ledger.grantCredits(accountId, {
    amount: 15,
    bucket: 'promotional',
    idempotencyKey: 'promo-event-00001',
  });

  assert.equal(firstGrant.duplicate, false);
  assert.equal(repeatedGrant.duplicate, true);
  assert.deepEqual(promotionalGrant.wallet, {
    purchasedCredits: 40,
    promotionalCredits: 15,
    reservedCredits: 0,
    availableCredits: 55,
    updatedAt: promotionalGrant.wallet.updatedAt,
  });

  await assert.rejects(
    ledger.grantCredits(accountId, {
      ...purchasedInput,
      amount: 41,
    }),
    error => error instanceof CreditLedgerError && error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('test-mode credits are isolated from the production wallet and ledger', async () => {
  const accountId = uid();
  await testLedger.grantCredits(accountId, {
    amount: 25,
    bucket: 'purchased',
    idempotencyKey: 'stripe-test-event-0001',
  });

  assert.equal((await testLedger.readWallet(accountId)).availableCredits, 25);
  assert.equal((await ledger.readWallet(accountId)).availableCredits, 0);
  assert.equal((await testLedger.listTransactions(accountId)).length, 1);
  assert.equal((await ledger.listTransactions(accountId)).length, 0);
});

test('a missing wallet summary is zero only when no credit history exists', async () => {
  const emptyAccount = uid();
  assert.equal((await ledger.readWallet(emptyAccount)).availableCredits, 0);
  const initializedWallet = await getFirestore(app)
    .doc(`users/${emptyAccount}/wallet/current`)
    .get();
  assert.equal(initializedWallet.exists, true);
  assert.deepEqual(
    {
      purchasedCredits: initializedWallet.data()?.purchasedCredits,
      promotionalCredits: initializedWallet.data()?.promotionalCredits,
      reservedCredits: initializedWallet.data()?.reservedCredits,
    },
    { purchasedCredits: 0, promotionalCredits: 0, reservedCredits: 0 },
  );

  const accountWithTransaction = uid();
  await getFirestore(app)
    .doc(`users/${accountWithTransaction}/credit_transactions/orphan-event`)
    .set({ createdAt: new Date() });
  await assert.rejects(
    ledger.readWallet(accountWithTransaction),
    error => error instanceof CreditLedgerError && error.code === 'WALLET_DATA_INVALID',
  );

  const accountWithReservation = uid();
  await getFirestore(app)
    .doc(`users/${accountWithReservation}/credit_reservations/orphan-reservation`)
    .set({ createdAt: new Date() });
  await assert.rejects(
    ledger.readWallet(accountWithReservation),
    error => error instanceof CreditLedgerError && error.code === 'WALLET_DATA_INVALID',
  );
  for (const account of [accountWithTransaction, accountWithReservation]) {
    await assert.rejects(
      ledger.grantCredits(account, {
        amount: 50, bucket: 'purchased', idempotencyKey: 'new-purchase-after-corruption',
      }),
      error => error instanceof CreditLedgerError && error.code === 'WALLET_DATA_INVALID',
    );
    assert.equal((await getFirestore(app).doc(`users/${account}/wallet/current`).get()).exists, false);
  }
});

test('reservations consume promotional credits first and settlement releases unused holds', async () => {
  const accountId = uid();
  await ledger.grantCredits(accountId, {
    amount: 80,
    bucket: 'purchased',
    idempotencyKey: 'purchase-event-0002',
  });
  await ledger.grantCredits(accountId, {
    amount: 20,
    bucket: 'promotional',
    idempotencyKey: 'promo-event-00002',
  });

  const reservation = await ledger.reserveCredits(accountId, {
    operationId: 'analysis-job-0001',
    amount: 50,
    idempotencyKey: 'reserve-event-0001',
  });
  assert.deepEqual(
    {
      purchased: reservation.wallet.purchasedCredits,
      promotional: reservation.wallet.promotionalCredits,
      reserved: reservation.wallet.reservedCredits,
      available: reservation.wallet.availableCredits,
    },
    { purchased: 50, promotional: 0, reserved: 50, available: 50 },
  );

  const settled = await ledger.settleReservation(accountId, {
    operationId: 'analysis-job-0001',
    finalChargeCredits: 35,
    idempotencyKey: 'settle-event-0001',
  });
  const repeatedSettlement = await ledger.settleReservation(accountId, {
    operationId: 'analysis-job-0001',
    finalChargeCredits: 35,
    idempotencyKey: 'settle-event-0001',
  });
  assert.equal(settled.wallet.purchasedCredits, 65);
  assert.equal(settled.wallet.promotionalCredits, 0);
  assert.equal(settled.wallet.reservedCredits, 0);
  assert.equal(repeatedSettlement.duplicate, true);

  const history = await ledger.listTransactions(accountId, 10);
  assert.equal(history.length, 4);
  assert.equal(history.find(entry => entry.type === 'settlement')?.creditDelta, -35);
});

test('releasing a reservation restores the original bucket allocation', async () => {
  const accountId = uid();
  await ledger.grantCredits(accountId, {
    amount: 60,
    bucket: 'purchased',
    idempotencyKey: 'purchase-event-0003',
  });
  await ledger.grantCredits(accountId, {
    amount: 30,
    bucket: 'promotional',
    idempotencyKey: 'promo-event-00003',
  });
  await ledger.reserveCredits(accountId, {
    operationId: 'analysis-job-0002',
    amount: 40,
    idempotencyKey: 'reserve-event-0002',
  });

  const released = await ledger.releaseReservation(accountId, {
    operationId: 'analysis-job-0002',
    idempotencyKey: 'release-event-0001',
  });
  assert.equal(released.wallet.purchasedCredits, 60);
  assert.equal(released.wallet.promotionalCredits, 30);
  assert.equal(released.wallet.reservedCredits, 0);
  assert.equal(released.wallet.availableCredits, 90);
});

test('concurrent reservations cannot overspend the wallet', async () => {
  const accountId = uid();
  await ledger.grantCredits(accountId, {
    amount: 60,
    bucket: 'purchased',
    idempotencyKey: 'purchase-event-0004',
  });

  const results = await Promise.allSettled([
    ledger.reserveCredits(accountId, {
      operationId: 'analysis-job-0003',
      amount: 40,
      idempotencyKey: 'reserve-event-0003',
    }),
    ledger.reserveCredits(accountId, {
      operationId: 'analysis-job-0004',
      amount: 40,
      idempotencyKey: 'reserve-event-0004',
    }),
  ]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected?.status, 'rejected');
  if (rejected?.status === 'rejected') {
    assert.ok(
      rejected.reason instanceof CreditLedgerError &&
        rejected.reason.code === 'INSUFFICIENT_CREDITS',
    );
  }
  const wallet = await ledger.readWallet(accountId);
  assert.equal(wallet.availableCredits, 20);
  assert.equal(wallet.reservedCredits, 40);
});

test('settlements cannot exceed a reservation and failed reservations do not alter balances', async () => {
  const accountId = uid();
  await ledger.grantCredits(accountId, {
    amount: 10,
    bucket: 'purchased',
    idempotencyKey: 'purchase-event-0005',
  });

  await assert.rejects(
    ledger.reserveCredits(accountId, {
      operationId: 'analysis-job-0005',
      amount: 11,
      idempotencyKey: 'reserve-event-0005',
    }),
    error => error instanceof CreditLedgerError && error.code === 'INSUFFICIENT_CREDITS',
  );
  assert.equal((await ledger.readWallet(accountId)).availableCredits, 10);

  await ledger.reserveCredits(accountId, {
    operationId: 'analysis-job-0006',
    amount: 8,
    idempotencyKey: 'reserve-event-0006',
  });
  await assert.rejects(
    ledger.settleReservation(accountId, {
      operationId: 'analysis-job-0006',
      finalChargeCredits: 9,
      idempotencyKey: 'settle-event-0006',
    }),
    error => error instanceof CreditLedgerError &&
      error.code === 'SETTLEMENT_EXCEEDS_RESERVED',
  );
  assert.equal((await ledger.readWallet(accountId)).reservedCredits, 8);
});
