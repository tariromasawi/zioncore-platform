import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  reconcileFailedReservation,
  type ReservationRecoveryLedger,
} from './paid-reservation-recovery';

function fakeLedger(
  status: string | null,
  options: { statusError?: Error; releaseError?: Error } = {},
) {
  const calls: string[] = [];
  const ledger: ReservationRecoveryLedger = {
    async getReservationStatus() {
      calls.push('status');
      if (options.statusError) throw options.statusError;
      return status;
    },
    async releaseReservation(_uid, input) {
      calls.push(`release:${input.idempotencyKey}`);
      if (options.releaseError) throw options.releaseError;
    },
  };
  return { ledger, calls };
}

const baseInput = {
  uid: 'user-123',
  operationId: 'ai-request-123',
  releaseIdempotencyKey: 'ai-release:request-123',
  reservationAttempted: true,
  reservationHeld: false,
  generationSucceeded: false,
  lostLease: false,
};

test('releases a reservation when reserve may have committed before a lost reply', async () => {
  const { ledger, calls } = fakeLedger('reserved');
  const result = await reconcileFailedReservation({ ...baseInput, ledger });
  assert.deepEqual(result, {
    reservationHeld: false,
    reservationStateUnknown: false,
    reservationReleaseFailed: false,
  });
  assert.deepEqual(calls, ['status', 'release:ai-release:request-123']);
});

test('does not release when the failed reserve created no reservation', async () => {
  const { ledger, calls } = fakeLedger(null);
  const result = await reconcileFailedReservation({ ...baseInput, ledger });
  assert.equal(result.reservationHeld, false);
  assert.deepEqual(calls, ['status']);
});

test('keeps the job recoverable when reservation status cannot be verified', async () => {
  const { ledger, calls } = fakeLedger(null, { statusError: new Error('unavailable') });
  const result = await reconcileFailedReservation({ ...baseInput, ledger });
  assert.deepEqual(result, {
    reservationHeld: false,
    reservationStateUnknown: true,
    reservationReleaseFailed: false,
  });
  assert.deepEqual(calls, ['status']);
});

test('reports a failed release without claiming the credits were returned', async () => {
  const { ledger, calls } = fakeLedger('reserved', { releaseError: new Error('unavailable') });
  const result = await reconcileFailedReservation({ ...baseInput, ledger });
  assert.deepEqual(result, {
    reservationHeld: true,
    reservationStateUnknown: false,
    reservationReleaseFailed: true,
  });
  assert.deepEqual(calls, ['status', 'release:ai-release:request-123']);
});

test('does not inspect or release reservations owned by a settled result or newer lease', async () => {
  const { ledger, calls } = fakeLedger('reserved');
  const settled = await reconcileFailedReservation({
    ...baseInput,
    ledger,
    reservationHeld: true,
    generationSucceeded: true,
  });
  const stale = await reconcileFailedReservation({
    ...baseInput,
    ledger,
    lostLease: true,
  });
  assert.equal(settled.reservationHeld, true);
  assert.equal(stale.reservationHeld, false);
  assert.deepEqual(calls, []);
});
