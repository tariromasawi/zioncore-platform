export type ReservationRecoveryLedger = {
  getReservationStatus(uid: string, operationId: string): Promise<string | null>;
  releaseReservation(
    uid: string,
    input: { operationId: string; idempotencyKey: string },
  ): Promise<unknown>;
};

export type ReservationRecoveryResult = {
  reservationHeld: boolean;
  reservationStateUnknown: boolean;
  reservationReleaseFailed: boolean;
};

/**
 * Resolves the ambiguous case where a reserve transaction may have committed
 * even though its response was lost. Never release credits owned by a newer
 * lease or by a job whose report has already been generated.
 */
export async function reconcileFailedReservation(input: {
  ledger: ReservationRecoveryLedger;
  uid: string;
  operationId: string;
  releaseIdempotencyKey: string;
  reservationAttempted: boolean;
  reservationHeld: boolean;
  generationSucceeded: boolean;
  lostLease: boolean;
}): Promise<ReservationRecoveryResult> {
  let reservationHeld = input.reservationHeld;
  let reservationStateUnknown = false;
  let reservationReleaseFailed = false;

  if (
    input.reservationAttempted &&
    !reservationHeld &&
    !input.generationSucceeded &&
    !input.lostLease
  ) {
    try {
      reservationHeld =
        (await input.ledger.getReservationStatus(input.uid, input.operationId)) === 'reserved';
    } catch {
      reservationStateUnknown = true;
    }
  }

  if (
    reservationHeld &&
    !input.generationSucceeded &&
    !input.lostLease &&
    !reservationStateUnknown
  ) {
    try {
      await input.ledger.releaseReservation(input.uid, {
        operationId: input.operationId,
        idempotencyKey: input.releaseIdempotencyKey,
      });
      reservationHeld = false;
    } catch {
      reservationReleaseFailed = true;
    }
  }

  return { reservationHeld, reservationStateUnknown, reservationReleaseFailed };
}
