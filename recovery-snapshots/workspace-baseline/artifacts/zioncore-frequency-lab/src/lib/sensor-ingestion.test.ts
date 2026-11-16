import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LocalSensorIngestionSession,
  MAX_SENSOR_INGESTION_BATCH_BYTES,
  SENSOR_INGESTION_SCOPE,
  SensorIngestionError,
  type SensorIngestionBudget,
  type SensorIngestionConsent,
} from '@/lib/sensor-ingestion';

const START_MS = Date.parse('2026-11-12T12:00:00.000Z');
const START_ISO = new Date(START_MS).toISOString();
const LATER_ISO = new Date(START_MS + 60 * 60_000).toISOString();

function makeConsent(overrides: Partial<SensorIngestionConsent> = {}): SensorIngestionConsent {
  return {
    explicitlyGranted: true,
    scope: SENSOR_INGESTION_SCOPE,
    purpose: 'Local bounded signal review',
    grantedAt: START_ISO,
    expiresAt: LATER_ISO,
    ...overrides,
  };
}

function makeBudget(overrides: Partial<SensorIngestionBudget> = {}): SensorIngestionBudget {
  return {
    maxBatchRecords: 2,
    maxBatchBytes: 16_384,
    maxSessionRecords: 10,
    maxSessionBytes: 65_536,
    retentionSeconds: 30,
    ...overrides,
  };
}

function makeObservation(index: number) {
  const suffix = String(index).padStart(12, '0');
  return {
    contractVersion: 'zc-sensor-observation/v1',
    observationId: `00000000-0000-4000-8000-${suffix}`,
    instrumentId: 'instrument.browser-microphone-web-audio',
    modality: 'acoustic',
    sourceType: 'live',
    time: {
      observedStartAt: START_ISO,
      observedEndAt: new Date(START_MS + 1000).toISOString(),
      receivedAt: new Date(START_MS + 1010).toISOString(),
      clock: 'host-utc',
      uncertaintyMs: null,
    },
    permission: { status: 'granted', scope: 'microphone', userInitiated: true },
    calibration: {
      status: 'uncalibrated',
      checkedAt: null,
      reference: 'No absolute acoustic calibration was applied.',
    },
    channels: [{ id: 'rms-level', unit: 'full-scale-fraction', values: [0.1], sampleRateHz: null }],
    provenance: {
      adapterId: 'adapter.browser-acoustic-spectrum',
      adapterVersion: '1.0.0',
      acquisitionMethod: 'browser-microphone',
      classification: 'measured',
      softwareVersion: 'zioncore-frequency-lab@0.0.0',
      sourceLabel: 'Browser acoustic summary',
      physicalDeviceIdentity: 'not-collected',
    },
  };
}

test('an ingestion session requires explicit, time-bounded local consent and a declared budget', () => {
  assert.throws(
    () => new LocalSensorIngestionSession({ explicitlyGranted: false }, makeBudget(), () => START_MS),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'CONSENT_REQUIRED',
  );
  assert.throws(
    () => new LocalSensorIngestionSession(makeConsent({ expiresAt: START_ISO }), makeBudget(), () => START_MS),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'CONSENT_REQUIRED',
  );
  assert.throws(
    () => new LocalSensorIngestionSession(makeConsent(), {
      ...makeBudget(),
      maxBatchBytes: MAX_SENSOR_INGESTION_BATCH_BYTES + 1,
    }, () => START_MS),
    /Invalid sensor-ingestion budget/,
  );
});

test('batches expose exact counts, bytes, expiry, and zero external cost without persistence', () => {
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget(), () => START_MS);
  session.add(makeObservation(1));
  session.add(makeObservation(2));
  const beforeDrain = session.getStats();
  const batch = session.drainBatch();

  assert.equal(beforeDrain.queuedRecords, 2);
  assert.ok(beforeDrain.queuedBytes > 0);
  assert.equal(batch?.scope, SENSOR_INGESTION_SCOPE);
  assert.equal(batch?.schemaVersion, 'zc-sensor-batch/v1');
  assert.equal(batch?.recordCount, 2);
  assert.equal(batch?.serializedBytes, beforeDrain.queuedBytes);
  assert.equal(batch?.estimatedExternalCostUsd, 0);
  assert.equal(batch?.expiresAt, new Date(START_MS + 30_000).toISOString());
  assert.equal(session.getStats().queuedRecords, 0);
});

test('batch and total-session budgets reject overflow without losing queued records', () => {
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget({
    maxBatchRecords: 1,
    maxSessionRecords: 2,
  }), () => START_MS);
  session.add(makeObservation(1));
  assert.throws(
    () => session.add(makeObservation(2)),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'BATCH_FULL',
  );
  assert.equal(session.getStats().queuedRecords, 1);
  assert.equal(session.drainBatch()?.recordCount, 1);
  session.add(makeObservation(2));
  session.drainBatch();
  assert.throws(
    () => session.add(makeObservation(3)),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'SESSION_BUDGET_EXCEEDED',
  );
});

test('async stream yields bounded batches and applies backpressure between batches', async () => {
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget({
    maxBatchRecords: 2,
  }), () => START_MS);
  async function* source() {
    yield makeObservation(1);
    yield makeObservation(2);
    yield makeObservation(3);
  }

  const batches = [];
  for await (const batch of session.stream(source())) batches.push(batch);
  assert.deepEqual(batches.map(batch => batch.recordCount), [2, 1]);
  assert.equal(batches.reduce((sum, batch) => sum + batch.serializedBytes, 0),
    batches.reduce((sum, batch) => sum + batch.records.reduce((records, record) => records + new TextEncoder().encode(JSON.stringify(record)).length, 0), 0));
  assert.equal(session.getStats().acceptedRecords, 3);
  assert.equal(session.getStats().queuedRecords, 0);
});

test('retention expiry and consent revocation clear pending in-memory data', () => {
  let now = START_MS;
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget({
    retentionSeconds: 1,
  }), () => now);
  session.add(makeObservation(1));
  now += 1001;
  const expired = session.getStats();
  assert.equal(expired.queuedRecords, 0);
  assert.equal(expired.acceptedRecords, 1);
  assert.equal(session.expire(), 0);

  session.add(makeObservation(2));
  session.revoke();
  assert.equal(session.getStats().queuedBytes, 0);
  assert.throws(
    () => session.add(makeObservation(3)),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'REVOKED',
  );
});

test('expired consent clears queued data and blocks subsequent stream input', () => {
  let now = START_MS;
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget(), () => now);
  session.add(makeObservation(1));
  now = Date.parse(LATER_ISO) + 1;
  assert.equal(session.expire(), 1);
  assert.equal(session.getStats().revoked, true);
  assert.throws(
    () => session.add(makeObservation(2)),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'REVOKED',
  );
});

test('byte budgets are enforced even when record count is still available', () => {
  const session = new LocalSensorIngestionSession(makeConsent(), makeBudget({
    maxBatchBytes: 1024,
    maxSessionBytes: 2048,
  }), () => START_MS);
  const largeObservation = {
    ...makeObservation(1),
    channels: [{ id: 'samples', unit: 'count', values: new Array(300).fill(1), sampleRateHz: null }],
  };
  assert.throws(
    () => session.add(largeObservation),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'BATCH_FULL',
  );
  assert.equal(session.getStats().acceptedRecords, 0);
  assert.equal(session.getStats().queuedRecords, 0);

  const normalObservation = makeObservation(4);
  const oneRecordBytes = new TextEncoder().encode(JSON.stringify(normalObservation)).byteLength;
  const byteLimitedSession = new LocalSensorIngestionSession(makeConsent(), makeBudget({
    maxBatchRecords: 2,
    maxBatchBytes: Math.max(1024, oneRecordBytes + 1),
    maxSessionRecords: 10,
    maxSessionBytes: Math.max(1024, oneRecordBytes + 1),
  }), () => START_MS);
  byteLimitedSession.add(normalObservation);
  assert.throws(
    () => byteLimitedSession.add(makeObservation(5)),
    (error: unknown) => error instanceof SensorIngestionError && error.code === 'SESSION_BUDGET_EXCEEDED',
  );
});
