import { createHash, randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { AiJobFinancialAudit } from './ai-job-financial-audit';

const retentionMs = 24 * 60 * 60 * 1000;
export const AI_INTERPRETATION_LEASE_MS = 5 * 60 * 1000;
const leaseMs = AI_INTERPRETATION_LEASE_MS;

export type AiInterpretationJobClaim =
  | { kind: 'claimed'; leaseToken: string; reclaimed: boolean }
  | { kind: 'busy'; retryAfterMs: number }
  | { kind: 'generated'; response: unknown; chargeCredits: number }
  | { kind: 'settled'; response: unknown; chargeCredits: number }
  | { kind: 'failed' }
  | { kind: 'expired' };

export type AiInterpretationJobRecovery =
  | { kind: 'busy'; retryAfterMs: number }
  | { kind: 'stale'; leaseToken: string }
  | { kind: 'generated'; response: unknown; chargeCredits: number }
  | { kind: 'settled'; response: unknown; chargeCredits: number }
  | { kind: 'failed' }
  | { kind: 'expired' }
  | { kind: 'missing' };

export type AiInterpretationQuoteAudit = {
  quoteId: string;
  service: 'interpretation' | 'audio-review';
  credits: number;
  pricingVersion: string;
  scope: string;
  currency: 'gbp';
  amountMinor: number;
  issuedAtMs: number;
  expiresAtMs: number;
};

export class AiInterpretationJobError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'IDEMPOTENCY_CONFLICT' | 'LEASE_LOST' | 'JOB_DATA_INVALID', message: string) {
    super(message);
    this.name = 'AiInterpretationJobError';
  }
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function validDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function fingerprintAiInterpretationRequest(value: unknown): string {
  return hash(JSON.stringify(value));
}

export function createAiInterpretationJobStore(db: Firestore) {
  const collection = (uid: string) => {
    if (!uid || uid.length > 128 || uid.includes('/')) {
      throw new AiInterpretationJobError('INVALID_INPUT', 'Invalid account identifier.');
    }
    return db.collection(`users/${uid}/ai_interpretation_jobs`);
  };

  const jobRef = (uid: string, idempotencyKey: string) => {
    if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
      throw new AiInterpretationJobError('INVALID_INPUT', 'Invalid interpretation request identifier.');
    }
    return collection(uid).doc(hash(`${uid}:${idempotencyKey}`));
  };

  async function claim(
    uid: string,
    idempotencyKey: string,
    requestFingerprint: string,
    chargeCredits: number,
    quoteAudit?: AiInterpretationQuoteAudit,
  ): Promise<AiInterpretationJobClaim> {
    if (!Number.isSafeInteger(chargeCredits) || chargeCredits < 1 || chargeCredits > 1_000_000) {
      throw new AiInterpretationJobError('INVALID_INPUT', 'Invalid interpretation price.');
    }
    const ref = jobRef(uid, idempotencyKey);
    const token = randomUUID();
    const now = new Date();
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        transaction.create(ref, {
          status: 'processing',
          requestFingerprint,
          chargeCredits,
          ...(quoteAudit ? { quoteAudit } : {}),
          leaseToken: token,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          createdAt: now,
          updatedAt: now,
          expiresAt: null,
          response: null,
        });
        return { kind: 'claimed', leaseToken: token, reclaimed: false };
      }

      const data = snapshot.data()!;
      if (data.requestFingerprint !== requestFingerprint) {
        throw new AiInterpretationJobError(
          'IDEMPOTENCY_CONFLICT',
          'This request identifier was already used for different interpretation inputs.',
        );
      }

      const status = data.status;
      if (status === 'settled') {
        const expiresAt = validDate(data.expiresAt);
        if (!data.response || !expiresAt) {
          throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation record is incomplete.');
        }
        if (!Number.isSafeInteger(data.chargeCredits) || data.chargeCredits < 1) {
          throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation price is invalid.');
        }
        return expiresAt.getTime() <= now.getTime()
          ? { kind: 'expired' }
          : { kind: 'settled', response: data.response, chargeCredits: data.chargeCredits };
      }
      if (status === 'generated') {
        if (!data.response) {
          throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation result is missing.');
        }
        if (!Number.isSafeInteger(data.chargeCredits) || data.chargeCredits < 1) {
          throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation price is invalid.');
        }
        return { kind: 'generated', response: data.response, chargeCredits: data.chargeCredits };
      }
      if (status === 'failed') {
        return { kind: 'failed' };
      }
      if (status !== 'processing') {
        throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation status is invalid.');
      }

      const leaseExpiresAt = validDate(data.leaseExpiresAt);
      if (leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime()) {
        return {
          kind: 'busy',
          retryAfterMs: Math.max(500, leaseExpiresAt.getTime() - now.getTime()),
        };
      }

      transaction.update(ref, {
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        updatedAt: now,
      });
      return { kind: 'claimed', leaseToken: token, reclaimed: true };
    });
  }

  async function recover(uid: string, idempotencyKey: string): Promise<AiInterpretationJobRecovery> {
    const ref = jobRef(uid, idempotencyKey);
    const token = randomUUID();
    const now = new Date();
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { kind: 'missing' };
      const data = snapshot.data()!;
      const status = data.status;
      if (status === 'failed') return { kind: 'failed' };
      if (status === 'generated' || status === 'settled') {
        if (
          !data.response
          || !Number.isSafeInteger(data.chargeCredits)
          || data.chargeCredits < 1
        ) {
          throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation record is invalid.');
        }
        if (status === 'settled') {
          const expiresAt = validDate(data.expiresAt);
          if (!expiresAt || expiresAt.getTime() <= now.getTime()) return { kind: 'expired' };
        }
        return { kind: status, response: data.response, chargeCredits: data.chargeCredits };
      }
      if (status !== 'processing') {
        throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The saved interpretation status is invalid.');
      }
      const leaseExpiresAt = validDate(data.leaseExpiresAt);
      if (leaseExpiresAt && leaseExpiresAt.getTime() > now.getTime()) {
        return {
          kind: 'busy',
          retryAfterMs: Math.max(500, leaseExpiresAt.getTime() - now.getTime()),
        };
      }
      transaction.update(ref, {
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        updatedAt: now,
      });
      return { kind: 'stale', leaseToken: token };
    });
  }

  async function markGenerated(
    uid: string,
    idempotencyKey: string,
    leaseToken: string,
    response: unknown,
    financialAudit?: AiJobFinancialAudit,
  ): Promise<void> {
    const ref = jobRef(uid, idempotencyKey);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || data?.status !== 'processing' || data.leaseToken !== leaseToken) {
        throw new AiInterpretationJobError('LEASE_LOST', 'The interpretation request is no longer current.');
      }
      transaction.update(ref, {
        status: 'generated',
        response,
        ...(financialAudit ? { financialAudit } : {}),
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      });
    });
  }

  async function markSettled(uid: string, idempotencyKey: string): Promise<void> {
    const ref = jobRef(uid, idempotencyKey);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || !data?.response || !['generated', 'settled'].includes(data.status)) {
        throw new AiInterpretationJobError('JOB_DATA_INVALID', 'The generated interpretation cannot be finalized.');
      }
      const now = new Date();
      transaction.update(ref, {
        status: 'settled',
        updatedAt: now,
        expiresAt: new Date(now.getTime() + retentionMs),
      });
    });
  }

  async function markFailed(
    uid: string,
    idempotencyKey: string,
    leaseToken: string,
  ): Promise<void> {
    const ref = jobRef(uid, idempotencyKey);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || data?.status !== 'processing' || data.leaseToken !== leaseToken) {
        return;
      }
      const now = new Date();
      transaction.update(ref, {
        status: 'failed',
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + retentionMs),
      });
    });
  }

  async function releaseLease(
    uid: string,
    idempotencyKey: string,
    leaseToken: string,
  ): Promise<void> {
    const ref = jobRef(uid, idempotencyKey);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (snapshot.exists && data?.status === 'processing' && data.leaseToken === leaseToken) {
        transaction.update(ref, { leaseExpiresAt: new Date(0), updatedAt: new Date() });
      }
    });
  }

  async function renewLease(
    uid: string,
    idempotencyKey: string,
    leaseToken: string,
  ): Promise<boolean> {
    const ref = jobRef(uid, idempotencyKey);
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || data?.status !== 'processing' || data.leaseToken !== leaseToken) {
        return false;
      }
      const now = new Date();
      transaction.update(ref, {
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        updatedAt: now,
      });
      return true;
    });
  }

  return { claim, recover, markGenerated, markSettled, markFailed, releaseLease, renewLease };
}

export async function deleteExpiredAiInterpretationJobs(
  db: Firestore,
  now = new Date(),
): Promise<number> {
  const expired = await db.collectionGroup('ai_interpretation_jobs')
    .where('expiresAt', '<=', now)
    .limit(250)
    .get();
  const deletable = expired.docs.filter(snapshot => {
    const status = snapshot.data().status;
    return status === 'settled' || status === 'failed';
  });
  if (deletable.length === 0) return 0;
  const batch = db.batch();
  for (const snapshot of deletable) batch.delete(snapshot.ref);
  await batch.commit();
  return deletable.length;
}
