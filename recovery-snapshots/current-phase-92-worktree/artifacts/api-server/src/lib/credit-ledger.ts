import { createHash } from 'node:crypto';
import {
  getFirestore,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from './firebase-admin';

export type CreditBucket = 'purchased' | 'promotional';
export type CreditTransactionType =
  | 'purchase'
  | 'promotional_grant'
  | 'reservation'
  | 'settlement'
  | 'release';

export type WalletSnapshot = {
  purchasedCredits: number;
  promotionalCredits: number;
  reservedCredits: number;
  availableCredits: number;
  updatedAt: string | null;
};

export type WalletTransaction = {
  id: string;
  type: CreditTransactionType;
  purchasedDelta: number;
  promotionalDelta: number;
  reservedDelta: number;
  creditDelta: number;
  relatedOperationId: string | null;
  createdAt: string;
};

export type CreditMutationResult = {
  wallet: WalletSnapshot;
  duplicate: boolean;
};

type WalletDocument = {
  purchasedCredits: number;
  promotionalCredits: number;
  reservedCredits: number;
  updatedAt: Date | null;
};

type ReservationDocument = {
  operationId: string;
  status: 'reserved' | 'settled' | 'released';
  amount: number;
  reservedPurchasedCredits: number;
  reservedPromotionalCredits: number;
  finalChargeCredits: number | null;
  requestFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreditLedgerErrorCode =
  | 'INVALID_INPUT'
  | 'INSUFFICIENT_CREDITS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_CLOSED'
  | 'SETTLEMENT_EXCEEDS_RESERVED'
  | 'WALLET_DATA_INVALID';

export class CreditLedgerError extends Error {
  constructor(readonly code: CreditLedgerErrorCode, message: string) {
    super(message);
    this.name = 'CreditLedgerError';
  }
}

const maximumCreditsPerOperation = 1_000_000;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function validateUid(uid: string): string {
  if (!uid || uid.length > 128 || uid.includes('/')) {
    throw new CreditLedgerError('INVALID_INPUT', 'Invalid account identifier.');
  }
  return uid;
}

function validateId(value: string, label: string): string {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new CreditLedgerError('INVALID_INPUT', `Invalid ${label}.`);
  }
  return value;
}

function validateCredits(amount: number): number {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > maximumCreditsPerOperation
  ) {
    throw new CreditLedgerError(
      'INVALID_INPUT',
      `Credit amount must be a whole number from 1 to ${maximumCreditsPerOperation}.`,
    );
  }
  return amount;
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && Number.isFinite(date.getTime())
        ? date.toISOString()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function walletDocumentFromSnapshot(
  data: FirebaseFirestore.DocumentData | undefined,
): WalletDocument {
  if (!data) {
    return {
      purchasedCredits: 0,
      promotionalCredits: 0,
      reservedCredits: 0,
      updatedAt: null,
    };
  }
  const values = [
    data.purchasedCredits,
    data.promotionalCredits,
    data.reservedCredits,
  ];
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new CreditLedgerError(
      'WALLET_DATA_INVALID',
      'The server wallet record is invalid and requires reconciliation.',
    );
  }
  const updatedAt = data.updatedAt instanceof Date
    ? data.updatedAt
    : data.updatedAt && typeof data.updatedAt.toDate === 'function'
      ? data.updatedAt.toDate()
      : null;
  return {
    purchasedCredits: data.purchasedCredits,
    promotionalCredits: data.promotionalCredits,
    reservedCredits: data.reservedCredits,
    updatedAt: updatedAt instanceof Date && Number.isFinite(updatedAt.getTime())
      ? updatedAt
      : null,
  };
}

function toWalletSnapshot(wallet: WalletDocument): WalletSnapshot {
  return {
    purchasedCredits: wallet.purchasedCredits,
    promotionalCredits: wallet.promotionalCredits,
    reservedCredits: wallet.reservedCredits,
    availableCredits: wallet.purchasedCredits + wallet.promotionalCredits,
    updatedAt: wallet.updatedAt?.toISOString() ?? null,
  };
}

function mapTransaction(
  snapshot: QueryDocumentSnapshot,
): WalletTransaction {
  const data = snapshot.data();
  const type = data.type as CreditTransactionType;
  const validTypes: CreditTransactionType[] = [
    'purchase',
    'promotional_grant',
    'reservation',
    'settlement',
    'release',
  ];
  const integers = [
    data.purchasedDelta,
    data.promotionalDelta,
    data.reservedDelta,
    data.creditDelta,
  ];
  const createdAt = dateToIso(data.createdAt);
  if (
    !validTypes.includes(type) ||
    integers.some(value => !Number.isSafeInteger(value)) ||
    createdAt == null
  ) {
    throw new CreditLedgerError(
      'WALLET_DATA_INVALID',
      'A wallet ledger record is invalid and requires reconciliation.',
    );
  }
  return {
    id: snapshot.id,
    type,
    purchasedDelta: data.purchasedDelta,
    promotionalDelta: data.promotionalDelta,
    reservedDelta: data.reservedDelta,
    creditDelta: data.creditDelta,
    relatedOperationId: typeof data.relatedOperationId === 'string'
      ? data.relatedOperationId
      : null,
    createdAt,
  };
}

function readReservation(data: FirebaseFirestore.DocumentData): ReservationDocument {
  const createdAt = data.createdAt instanceof Date
    ? data.createdAt
    : data.createdAt?.toDate?.();
  const updatedAt = data.updatedAt instanceof Date
    ? data.updatedAt
    : data.updatedAt?.toDate?.();
  if (
    typeof data.operationId !== 'string' ||
    !['reserved', 'settled', 'released'].includes(data.status) ||
    !Number.isSafeInteger(data.amount) ||
    data.amount < 1 ||
    !Number.isSafeInteger(data.reservedPurchasedCredits) ||
    data.reservedPurchasedCredits < 0 ||
    !Number.isSafeInteger(data.reservedPromotionalCredits) ||
    data.reservedPromotionalCredits < 0 ||
    data.reservedPurchasedCredits + data.reservedPromotionalCredits !== data.amount ||
    (data.finalChargeCredits !== null &&
      (!Number.isSafeInteger(data.finalChargeCredits) ||
        data.finalChargeCredits < 0 ||
        data.finalChargeCredits > data.amount)) ||
    typeof data.requestFingerprint !== 'string' ||
    !(createdAt instanceof Date) ||
    !(updatedAt instanceof Date)
  ) {
    throw new CreditLedgerError(
      'WALLET_DATA_INVALID',
      'A credit reservation record is invalid and requires reconciliation.',
    );
  }
  return {
    operationId: data.operationId,
    status: data.status,
    amount: data.amount,
    reservedPurchasedCredits: data.reservedPurchasedCredits,
    reservedPromotionalCredits: data.reservedPromotionalCredits,
    finalChargeCredits: data.finalChargeCredits,
    requestFingerprint: data.requestFingerprint,
    createdAt,
    updatedAt,
  };
}

export type CreditLedgerNamespace = 'production' | 'test';

export function createCreditLedger(
  db: Firestore,
  namespace: CreditLedgerNamespace = 'production',
) {
  const walletRef = (uid: string) => namespace === 'test'
    ? db.doc(`users/${validateUid(uid)}/test_billing/wallet`)
    : db.doc(`users/${validateUid(uid)}/wallet/current`);
  const transactions = (uid: string) => namespace === 'test'
    ? db.collection(`users/${validateUid(uid)}/test_billing/wallet/transactions`)
    : db.collection(`users/${validateUid(uid)}/credit_transactions`);
  const reservations = (uid: string) => namespace === 'test'
    ? db.collection(`users/${validateUid(uid)}/test_billing/wallet/reservations`)
    : db.collection(`users/${validateUid(uid)}/credit_reservations`);

  async function readWallet(uid: string): Promise<WalletSnapshot> {
    validateUid(uid);
    const wallet = walletRef(uid);
    const snapshot = await wallet.get();
    if (snapshot.exists) {
      return toWalletSnapshot(walletDocumentFromSnapshot(snapshot.data()));
    }

    await db.runTransaction(async transaction => {
      const currentWallet = await transaction.get(wallet);
      if (currentWallet.exists) {
        walletDocumentFromSnapshot(currentWallet.data());
        return;
      }

      const [transactionHistory, reservationHistory] = await Promise.all([
        transaction.get(transactions(uid).limit(1)),
        transaction.get(reservations(uid).limit(1)),
      ]);
      if (!transactionHistory.empty || !reservationHistory.empty) {
        throw new CreditLedgerError(
          'WALLET_DATA_INVALID',
          'The wallet summary is missing while credit history exists; reconciliation is required.',
        );
      }

      transaction.create(wallet, {
        purchasedCredits: 0,
        promotionalCredits: 0,
        reservedCredits: 0,
        updatedAt: new Date(),
      });
    });

    const initialized = await wallet.get();
    if (!initialized.exists) {
      throw new CreditLedgerError(
        'WALLET_DATA_INVALID',
        'The zero-credit wallet could not be initialized.',
      );
    }
    return toWalletSnapshot(walletDocumentFromSnapshot(initialized.data()));
  }

  async function getReservationStatus(
    uid: string,
    operationId: string,
  ): Promise<ReservationDocument['status'] | null> {
    validateUid(uid);
    validateId(operationId, 'operation identifier');
    const snapshot = await reservations(uid).doc(hash(`${uid}:${operationId}`)).get();
    return snapshot.exists ? readReservation(snapshot.data()!).status : null;
  }

  async function listTransactions(
    uid: string,
    limit = 25,
  ): Promise<WalletTransaction[]> {
    validateUid(uid);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new CreditLedgerError('INVALID_INPUT', 'Limit must be from 1 to 100.');
    }
    const snapshot = await transactions(uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(mapTransaction);
  }

  async function grantCredits(
    uid: string,
    input: {
      amount: number;
      bucket: CreditBucket;
      idempotencyKey: string;
      relatedOperationId?: string | null;
      deduplicateByRelatedOperation?: boolean;
    },
  ): Promise<CreditMutationResult> {
    validateUid(uid);
    validateCredits(input.amount);
    validateId(input.idempotencyKey, 'idempotency key');
    if (input.bucket !== 'purchased' && input.bucket !== 'promotional') {
      throw new CreditLedgerError('INVALID_INPUT', 'Invalid credit bucket.');
    }
    const relatedOperationId = input.relatedOperationId ?? null;
    if (input.deduplicateByRelatedOperation) {
      if (input.bucket !== 'purchased' || !relatedOperationId) {
        throw new CreditLedgerError('INVALID_INPUT', 'Purchase deduplication requires a purchase reference.');
      }
      validateId(relatedOperationId, 'purchase reference');
    }
    const fingerprint = hash(JSON.stringify({
      action: 'grant',
      amount: input.amount,
      bucket: input.bucket,
      relatedOperationId,
    }));
    const eventId = hash(`${uid}:${input.idempotencyKey}`);
    const wallet = walletRef(uid);
    const event = transactions(uid).doc(eventId);

    return db.runTransaction(async transaction => {
      const [walletSnapshot, eventSnapshot] = await Promise.all([
        transaction.get(wallet),
        transaction.get(event),
      ]);
      // Compatibility with old Stripe receipts keyed by event ID: a different
      // event for an already-credited Checkout must never create another grant.
      const relatedReceipts = input.deduplicateByRelatedOperation && !eventSnapshot.exists
        ? await transaction.get(
          transactions(uid).where('relatedOperationId', '==', relatedOperationId).limit(2),
        )
        : null;
      const previousPurchase = relatedReceipts?.docs.find(doc => doc.data().type === 'purchase');
      if (eventSnapshot.exists || previousPurchase) {
        const existing = eventSnapshot.exists ? eventSnapshot.data() : previousPurchase?.data();
        if (existing?.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError(
            'IDEMPOTENCY_CONFLICT',
            'This idempotency key was already used for a different wallet operation.',
          );
        }
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError(
            'WALLET_DATA_INVALID',
            'A ledger record exists without its wallet summary.',
          );
        }
        return {
          wallet: walletSnapshotFromData(walletSnapshot.data()),
          duplicate: true,
        };
      }

      if (!walletSnapshot.exists) {
        const [transactionHistory, reservationHistory] = await Promise.all([
          transaction.get(transactions(uid).limit(1)),
          transaction.get(reservations(uid).limit(1)),
        ]);
        if (!transactionHistory.empty || !reservationHistory.empty) {
          throw new CreditLedgerError(
            'WALLET_DATA_INVALID',
            'The wallet summary is missing while credit history exists; reconciliation is required.',
          );
        }
      }
      const current = walletDocumentFromSnapshot(
        walletSnapshot.exists ? walletSnapshot.data() : undefined,
      );
      const purchasedDelta = input.bucket === 'purchased' ? input.amount : 0;
      const promotionalDelta = input.bucket === 'promotional' ? input.amount : 0;
      const updated: WalletDocument = {
        purchasedCredits: current.purchasedCredits + purchasedDelta,
        promotionalCredits: current.promotionalCredits + promotionalDelta,
        reservedCredits: current.reservedCredits,
        updatedAt: new Date(),
      };
      transaction.set(wallet, updated);
      transaction.create(event, {
        type: input.bucket === 'purchased' ? 'purchase' : 'promotional_grant',
        purchasedDelta,
        promotionalDelta,
        reservedDelta: 0,
        creditDelta: input.amount,
        relatedOperationId,
        requestFingerprint: fingerprint,
        createdAt: new Date(),
      });
      return { wallet: toWalletSnapshot(updated), duplicate: false };
    });
  }

  async function reserveCredits(
    uid: string,
    input: {
      operationId: string;
      amount: number;
      idempotencyKey: string;
    },
  ): Promise<CreditMutationResult> {
    validateUid(uid);
    validateId(input.operationId, 'operation identifier');
    validateId(input.idempotencyKey, 'idempotency key');
    validateCredits(input.amount);
    const fingerprint = hash(JSON.stringify({
      action: 'reserve',
      operationId: input.operationId,
      amount: input.amount,
    }));
    const wallet = walletRef(uid);
    const event = transactions(uid).doc(hash(`${uid}:${input.idempotencyKey}`));
    const reservation = reservations(uid).doc(hash(`${uid}:${input.operationId}`));

    return db.runTransaction(async transaction => {
      const [walletSnapshot, eventSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(wallet),
        transaction.get(event),
        transaction.get(reservation),
      ]);
      if (eventSnapshot.exists) {
        const existingEvent = eventSnapshot.data();
        if (existingEvent?.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError(
            'IDEMPOTENCY_CONFLICT',
            'This idempotency key was already used for a different wallet operation.',
          );
        }
        if (!walletSnapshot.exists || !reservationSnapshot.exists) {
          throw new CreditLedgerError(
            'WALLET_DATA_INVALID',
            'A reservation ledger record is missing its wallet or reservation state.',
          );
        }
        const saved = readReservation(reservationSnapshot.data()!);
        if (saved.operationId !== input.operationId || saved.amount !== input.amount) {
          throw new CreditLedgerError(
            'IDEMPOTENCY_CONFLICT',
            'This operation identifier was already used for a different reservation.',
          );
        }
        return {
          wallet: walletSnapshotFromData(walletSnapshot.data()),
          duplicate: true,
        };
      }
      if (reservationSnapshot.exists) {
        const saved = readReservation(reservationSnapshot.data()!);
        if (saved.operationId !== input.operationId || saved.amount !== input.amount) {
          throw new CreditLedgerError(
            'IDEMPOTENCY_CONFLICT',
            'This operation identifier was already used for a different reservation.',
          );
        }
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError(
            'WALLET_DATA_INVALID',
            'A reservation exists without its wallet summary.',
          );
        }
        return {
          wallet: walletSnapshotFromData(walletSnapshot.data()),
          duplicate: true,
        };
      }

      const current = walletDocumentFromSnapshot(
        walletSnapshot.exists ? walletSnapshot.data() : undefined,
      );
      const available = current.purchasedCredits + current.promotionalCredits;
      if (available < input.amount) {
        throw new CreditLedgerError(
          'INSUFFICIENT_CREDITS',
          'The wallet does not have enough available credits.',
        );
      }

      // Promotional credits are reserved first; purchased credits remain separate.
      const reservedPromotionalCredits = Math.min(
        current.promotionalCredits,
        input.amount,
      );
      const reservedPurchasedCredits = input.amount - reservedPromotionalCredits;
      const now = new Date();
      const updated: WalletDocument = {
        purchasedCredits: current.purchasedCredits - reservedPurchasedCredits,
        promotionalCredits: current.promotionalCredits - reservedPromotionalCredits,
        reservedCredits: current.reservedCredits + input.amount,
        updatedAt: now,
      };
      transaction.set(wallet, updated);
      transaction.create(event, {
        type: 'reservation',
        purchasedDelta: -reservedPurchasedCredits,
        promotionalDelta: -reservedPromotionalCredits,
        reservedDelta: input.amount,
        creditDelta: 0,
        relatedOperationId: input.operationId,
        requestFingerprint: fingerprint,
        createdAt: now,
      });
      transaction.create(reservation, {
        operationId: input.operationId,
        status: 'reserved',
        amount: input.amount,
        reservedPurchasedCredits,
        reservedPromotionalCredits,
        finalChargeCredits: null,
        requestFingerprint: fingerprint,
        createdAt: now,
        updatedAt: now,
      } satisfies ReservationDocument);
      return { wallet: toWalletSnapshot(updated), duplicate: false };
    });
  }

  async function settleReservation(
    uid: string,
    input: {
      operationId: string;
      finalChargeCredits: number;
      idempotencyKey: string;
    },
  ): Promise<CreditMutationResult> {
    validateUid(uid);
    validateId(input.operationId, 'operation identifier');
    validateId(input.idempotencyKey, 'idempotency key');
    if (!Number.isSafeInteger(input.finalChargeCredits) || input.finalChargeCredits < 0) {
      throw new CreditLedgerError('INVALID_INPUT', 'Final charge must be a non-negative whole number.');
    }
    const fingerprint = hash(JSON.stringify({
      action: 'settle',
      operationId: input.operationId,
      finalChargeCredits: input.finalChargeCredits,
    }));
    const wallet = walletRef(uid);
    const event = transactions(uid).doc(hash(`${uid}:${input.idempotencyKey}`));
    const reservation = reservations(uid).doc(hash(`${uid}:${input.operationId}`));

    return db.runTransaction(async transaction => {
      const [walletSnapshot, eventSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(wallet),
        transaction.get(event),
        transaction.get(reservation),
      ]);
      if (eventSnapshot.exists) {
        if (eventSnapshot.data()?.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT', 'Idempotency key conflict.');
        }
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
        }
        return {
          wallet: walletSnapshotFromData(walletSnapshot.data()),
          duplicate: true,
        };
      }
      if (!reservationSnapshot.exists) {
        throw new CreditLedgerError('RESERVATION_NOT_FOUND', 'The credit reservation was not found.');
      }
      const saved = readReservation(reservationSnapshot.data()!);
      if (saved.status === 'settled') {
        if (saved.finalChargeCredits !== input.finalChargeCredits) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT', 'The reservation was settled at a different amount.');
        }
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
        }
        return { wallet: walletSnapshotFromData(walletSnapshot.data()), duplicate: true };
      }
      if (saved.status !== 'reserved') {
        throw new CreditLedgerError('RESERVATION_CLOSED', 'The credit reservation is already closed.');
      }
      if (input.finalChargeCredits > saved.amount) {
        throw new CreditLedgerError(
          'SETTLEMENT_EXCEEDS_RESERVED',
          'Final charge cannot exceed the approved reservation.',
        );
      }
      if (!walletSnapshot.exists) {
        throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
      }
      const current = walletDocumentFromSnapshot(walletSnapshot.data());
      if (current.reservedCredits < saved.amount) {
        throw new CreditLedgerError('WALLET_DATA_INVALID', 'Reserved wallet balance is inconsistent.');
      }

      const promotionalUsed = Math.min(
        input.finalChargeCredits,
        saved.reservedPromotionalCredits,
      );
      const purchasedUsed = input.finalChargeCredits - promotionalUsed;
      const releasedPromotional = saved.reservedPromotionalCredits - promotionalUsed;
      const releasedPurchased = saved.reservedPurchasedCredits - purchasedUsed;
      if (purchasedUsed > saved.reservedPurchasedCredits) {
        throw new CreditLedgerError('WALLET_DATA_INVALID', 'Reserved credit allocation is inconsistent.');
      }

      const now = new Date();
      const updated: WalletDocument = {
        purchasedCredits: current.purchasedCredits + releasedPurchased,
        promotionalCredits: current.promotionalCredits + releasedPromotional,
        reservedCredits: current.reservedCredits - saved.amount,
        updatedAt: now,
      };
      transaction.set(wallet, updated);
      transaction.create(event, {
        type: 'settlement',
        purchasedDelta: releasedPurchased,
        promotionalDelta: releasedPromotional,
        reservedDelta: -saved.amount,
        creditDelta: -input.finalChargeCredits,
        relatedOperationId: input.operationId,
        requestFingerprint: fingerprint,
        createdAt: now,
      });
      transaction.update(reservation, {
        status: 'settled',
        finalChargeCredits: input.finalChargeCredits,
        updatedAt: now,
      });
      return { wallet: toWalletSnapshot(updated), duplicate: false };
    });
  }

  async function releaseReservation(
    uid: string,
    input: {
      operationId: string;
      idempotencyKey: string;
    },
  ): Promise<CreditMutationResult> {
    validateUid(uid);
    validateId(input.operationId, 'operation identifier');
    validateId(input.idempotencyKey, 'idempotency key');
    const fingerprint = hash(JSON.stringify({
      action: 'release',
      operationId: input.operationId,
    }));
    const wallet = walletRef(uid);
    const event = transactions(uid).doc(hash(`${uid}:${input.idempotencyKey}`));
    const reservation = reservations(uid).doc(hash(`${uid}:${input.operationId}`));

    return db.runTransaction(async transaction => {
      const [walletSnapshot, eventSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(wallet),
        transaction.get(event),
        transaction.get(reservation),
      ]);
      if (eventSnapshot.exists) {
        if (eventSnapshot.data()?.requestFingerprint !== fingerprint) {
          throw new CreditLedgerError('IDEMPOTENCY_CONFLICT', 'Idempotency key conflict.');
        }
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
        }
        return {
          wallet: walletSnapshotFromData(walletSnapshot.data()),
          duplicate: true,
        };
      }
      if (!reservationSnapshot.exists) {
        throw new CreditLedgerError('RESERVATION_NOT_FOUND', 'The credit reservation was not found.');
      }
      const saved = readReservation(reservationSnapshot.data()!);
      if (saved.status === 'released') {
        if (!walletSnapshot.exists) {
          throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
        }
        return { wallet: walletSnapshotFromData(walletSnapshot.data()), duplicate: true };
      }
      if (saved.status !== 'reserved') {
        throw new CreditLedgerError('RESERVATION_CLOSED', 'The credit reservation is already closed.');
      }
      if (!walletSnapshot.exists) {
        throw new CreditLedgerError('WALLET_DATA_INVALID', 'The wallet summary is missing.');
      }
      const current = walletDocumentFromSnapshot(walletSnapshot.data());
      if (current.reservedCredits < saved.amount) {
        throw new CreditLedgerError('WALLET_DATA_INVALID', 'Reserved wallet balance is inconsistent.');
      }
      const now = new Date();
      const updated: WalletDocument = {
        purchasedCredits: current.purchasedCredits + saved.reservedPurchasedCredits,
        promotionalCredits: current.promotionalCredits + saved.reservedPromotionalCredits,
        reservedCredits: current.reservedCredits - saved.amount,
        updatedAt: now,
      };
      transaction.set(wallet, updated);
      transaction.create(event, {
        type: 'release',
        purchasedDelta: saved.reservedPurchasedCredits,
        promotionalDelta: saved.reservedPromotionalCredits,
        reservedDelta: -saved.amount,
        creditDelta: 0,
        relatedOperationId: input.operationId,
        requestFingerprint: fingerprint,
        createdAt: now,
      });
      transaction.update(reservation, {
        status: 'released',
        updatedAt: now,
      });
      return { wallet: toWalletSnapshot(updated), duplicate: false };
    });
  }

  return {
    readWallet,
    getReservationStatus,
    listTransactions,
    grantCredits,
    reserveCredits,
    settleReservation,
    releaseReservation,
  };
}

function walletSnapshotFromData(data: FirebaseFirestore.DocumentData | undefined): WalletSnapshot {
  return toWalletSnapshot(walletDocumentFromSnapshot(data));
}

export function getCreditLedger(namespace: CreditLedgerNamespace = 'production') {
  return createCreditLedger(getFirestore(getFirebaseAdminApp()), namespace);
}
