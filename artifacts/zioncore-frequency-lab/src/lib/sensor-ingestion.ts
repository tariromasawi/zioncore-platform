import { z } from 'zod';
import {
  sensorObservationSchema,
  type NormalizedSensorObservation,
} from '@/lib/sensor-adapter-contract';

export const SENSOR_INGESTION_SCOPE = 'local-memory-only' as const;
export const SENSOR_INGESTION_BATCH_SCHEMA = 'zc-sensor-batch/v1' as const;
export const MAX_SENSOR_INGESTION_BATCH_RECORDS = 32;
export const MAX_SENSOR_INGESTION_BATCH_BYTES = 1_048_576;
export const MAX_SENSOR_INGESTION_SESSION_RECORDS = 500;
export const MAX_SENSOR_INGESTION_SESSION_BYTES = 5_242_880;
export const MAX_SENSOR_INGESTION_RETENTION_SECONDS = 3_600;

const timestampSchema = z.string().datetime({ offset: true });

export const sensorIngestionConsentSchema = z.object({
  explicitlyGranted: z.literal(true),
  scope: z.literal(SENSOR_INGESTION_SCOPE),
  purpose: z.string().trim().min(1).max(160),
  grantedAt: timestampSchema,
  expiresAt: timestampSchema,
}).strict().superRefine((consent, context) => {
  if (Date.parse(consent.expiresAt) <= Date.parse(consent.grantedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'Ingestion consent must expire after it is granted.',
    });
  }
});

export const sensorIngestionBudgetSchema = z.object({
  maxBatchRecords: z.number().int().min(1).max(MAX_SENSOR_INGESTION_BATCH_RECORDS),
  maxBatchBytes: z.number().int().min(1024).max(MAX_SENSOR_INGESTION_BATCH_BYTES),
  maxSessionRecords: z.number().int().min(1).max(MAX_SENSOR_INGESTION_SESSION_RECORDS),
  maxSessionBytes: z.number().int().min(1024).max(MAX_SENSOR_INGESTION_SESSION_BYTES),
  retentionSeconds: z.number().int().min(1).max(MAX_SENSOR_INGESTION_RETENTION_SECONDS),
}).strict().superRefine((budget, context) => {
  if (budget.maxBatchRecords > budget.maxSessionRecords) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxBatchRecords'],
      message: 'A batch cannot exceed the total session record budget.',
    });
  }
  if (budget.maxBatchBytes > budget.maxSessionBytes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxBatchBytes'],
      message: 'A batch cannot exceed the total session byte budget.',
    });
  }
});

export type SensorIngestionConsent = z.infer<typeof sensorIngestionConsentSchema>;
export type SensorIngestionBudget = z.infer<typeof sensorIngestionBudgetSchema>;

export type SensorIngestionBatch = {
  schemaVersion: typeof SENSOR_INGESTION_BATCH_SCHEMA;
  scope: typeof SENSOR_INGESTION_SCOPE;
  createdAt: string;
  expiresAt: string;
  recordCount: number;
  serializedBytes: number;
  estimatedExternalCostUsd: 0;
  records: NormalizedSensorObservation[];
};

export type SensorIngestionErrorCode =
  | 'CONSENT_REQUIRED'
  | 'CONSENT_EXPIRED'
  | 'SESSION_BUDGET_EXCEEDED'
  | 'BATCH_FULL'
  | 'INVALID_OBSERVATION'
  | 'REVOKED';

export class SensorIngestionError extends Error {
  constructor(readonly code: SensorIngestionErrorCode, message: string) {
    super(message);
    this.name = 'SensorIngestionError';
  }
}

type QueuedObservation = {
  observation: NormalizedSensorObservation;
  serializedBytes: number;
  expiresAtMs: number;
};

export class LocalSensorIngestionSession {
  private readonly consent: SensorIngestionConsent;
  private readonly budget: SensorIngestionBudget;
  private readonly now: () => number;
  private queued: QueuedObservation[] = [];
  private queuedBytes = 0;
  private sessionRecords = 0;
  private sessionBytes = 0;
  private revoked = false;

  constructor(
    consentInput: unknown,
    budgetInput: unknown,
    now: () => number = () => Date.now(),
  ) {
    const consentResult = sensorIngestionConsentSchema.safeParse(consentInput);
    if (!consentResult.success) {
      throw new SensorIngestionError('CONSENT_REQUIRED', 'Explicit local-ingestion consent is required.');
    }
    const budgetResult = sensorIngestionBudgetSchema.safeParse(budgetInput);
    if (!budgetResult.success) {
      throw new Error(`Invalid sensor-ingestion budget: ${budgetResult.error.issues[0]?.message ?? 'unknown budget error'}`);
    }
    this.consent = consentResult.data;
    this.budget = budgetResult.data;
    this.now = now;
    this.assertActive();
  }

  getStats() {
    this.expire();
    return {
      scope: SENSOR_INGESTION_SCOPE,
      queuedRecords: this.queued.length,
      queuedBytes: this.queuedBytes,
      acceptedRecords: this.sessionRecords,
      acceptedBytes: this.sessionBytes,
      remainingRecords: Math.max(0, this.budget.maxSessionRecords - this.sessionRecords),
      remainingBytes: Math.max(0, this.budget.maxSessionBytes - this.sessionBytes),
      revoked: this.revoked,
      estimatedExternalCostUsd: 0 as const,
    };
  }

  add(untrustedObservation: unknown) {
    this.assertActive();
    this.expire();
    const result = sensorObservationSchema.safeParse(untrustedObservation);
    if (!result.success) {
      throw new SensorIngestionError('INVALID_OBSERVATION', 'Sensor data did not match the normalized observation contract.');
    }
    const observation = result.data;
    const serializedBytes = new TextEncoder().encode(JSON.stringify(observation)).byteLength;
    if (serializedBytes > this.budget.maxBatchBytes) {
      throw new SensorIngestionError('BATCH_FULL', 'This observation exceeds the configured maximum batch size.');
    }
    if (this.sessionRecords + 1 > this.budget.maxSessionRecords
      || this.sessionBytes + serializedBytes > this.budget.maxSessionBytes) {
      throw new SensorIngestionError('SESSION_BUDGET_EXCEEDED', 'The explicit ingestion session budget has been reached.');
    }
    if (this.queued.length + 1 > this.budget.maxBatchRecords
      || this.queuedBytes + serializedBytes > this.budget.maxBatchBytes) {
      throw new SensorIngestionError('BATCH_FULL', 'Drain the current batch before adding more sensor data.');
    }

    this.queued.push({
      observation,
      serializedBytes,
      expiresAtMs: this.now() + this.budget.retentionSeconds * 1000,
    });
    this.queuedBytes += serializedBytes;
    this.sessionRecords += 1;
    this.sessionBytes += serializedBytes;
    return this.getStats();
  }

  drainBatch(): SensorIngestionBatch | null {
    this.assertActive();
    this.expire();
    if (this.queued.length === 0) return null;
    const records = this.queued;
    const serializedBytes = this.queuedBytes;
    const expiresAtMs = Math.min(
      Date.parse(this.consent.expiresAt),
      ...records.map(item => item.expiresAtMs),
    );
    this.queued = [];
    this.queuedBytes = 0;
    return {
      schemaVersion: SENSOR_INGESTION_BATCH_SCHEMA,
      scope: SENSOR_INGESTION_SCOPE,
      createdAt: new Date(this.now()).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      recordCount: records.length,
      serializedBytes,
      estimatedExternalCostUsd: 0,
      records: records.map(item => item.observation),
    };
  }

  expire() {
    const now = this.now();
    if (this.revoked) return 0;
    if (now >= Date.parse(this.consent.expiresAt)) {
      const removed = this.queued.length;
      this.clearQueue();
      this.revoked = true;
      return removed;
    }
    const retained: QueuedObservation[] = [];
    let removed = 0;
    for (const item of this.queued) {
      if (item.expiresAtMs <= now) {
        this.queuedBytes -= item.serializedBytes;
        removed += 1;
      } else {
        retained.push(item);
      }
    }
    this.queued = retained;
    return removed;
  }

  revoke() {
    this.revoked = true;
    this.clearQueue();
  }

  async *stream(
    source: AsyncIterable<unknown>,
  ): AsyncGenerator<SensorIngestionBatch, void, void> {
    try {
      for await (const value of source) {
        try {
          this.add(value);
        } catch (cause) {
          if (!(cause instanceof SensorIngestionError) || cause.code !== 'BATCH_FULL') throw cause;
          const batch = this.drainBatch();
          if (!batch) throw cause;
          yield batch;
          this.add(value);
        }
        if (this.queued.length >= this.budget.maxBatchRecords
          || this.queuedBytes >= this.budget.maxBatchBytes) {
          const batch = this.drainBatch();
          if (batch) yield batch;
        }
      }
      const finalBatch = this.drainBatch();
      if (finalBatch) yield finalBatch;
    } finally {
      this.clearQueue();
    }
  }

  private assertActive() {
    if (this.revoked) {
      throw new SensorIngestionError('REVOKED', 'Local ingestion consent has been revoked or expired.');
    }
    if (this.now() >= Date.parse(this.consent.expiresAt)) {
      this.revoke();
      throw new SensorIngestionError('CONSENT_EXPIRED', 'Local ingestion consent has expired.');
    }
    if (this.now() < Date.parse(this.consent.grantedAt)) {
      throw new SensorIngestionError('CONSENT_REQUIRED', 'Local ingestion consent is not yet active.');
    }
  }

  private clearQueue() {
    this.queued = [];
    this.queuedBytes = 0;
  }
}

