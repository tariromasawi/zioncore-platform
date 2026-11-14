import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  AiInterpretationJobError,
  createAiInterpretationJobStore,
  deleteExpiredAiInterpretationJobs,
  fingerprintAiInterpretationRequest,
} from './ai-interpretation-jobs';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';

assertLocalFirestoreEmulator(process.env.FIRESTORE_EMULATOR_HOST);
const app = initializeApp(
  { projectId: 'demo-zioncore-frequency-lab' },
  `ai-job-tests-${process.pid}`,
);
const db = getFirestore(app);
const store = createAiInterpretationJobStore(db);
const uid = () => `job-test-${randomUUID()}`;

after(async () => {
  await deleteApp(app);
});

test('completed results replay without creating another generation claim', async () => {
  const accountId = uid();
  const key = 'ai-request-replay-0001';
  const fingerprint = fingerprintAiInterpretationRequest({ sample: 'same request' });
  const response = {
    analysis: { summary: 'saved reading' },
    provider: 'gemini',
    model: 'test-model',
    fallbackUsed: false,
  };

  const first = await store.claim(accountId, key, fingerprint, 35);
  assert.equal(first.kind, 'claimed');
  if (first.kind !== 'claimed') return;

  const concurrent = await store.claim(accountId, key, fingerprint, 35);
  assert.equal(concurrent.kind, 'busy');

  await store.markGenerated(accountId, key, first.leaseToken, response);
  const generated = await store.claim(accountId, key, fingerprint, 35);
  assert.deepEqual(generated, { kind: 'generated', response, chargeCredits: 35 });

  await store.markSettled(accountId, key);
  const settled = await store.claim(accountId, key, fingerprint, 35);
  assert.deepEqual(settled, { kind: 'settled', response, chargeCredits: 35 });
  assert.deepEqual(await store.recover(accountId, key), {
    kind: 'settled',
    response,
    chargeCredits: 35,
  });
});

test('request identifiers cannot be replayed with different inputs', async () => {
  const accountId = uid();
  const key = 'ai-request-conflict-001';
  await store.claim(accountId, key, fingerprintAiInterpretationRequest({ input: 1 }), 35);

  await assert.rejects(
    store.claim(accountId, key, fingerprintAiInterpretationRequest({ input: 2 }), 35),
    error => error instanceof AiInterpretationJobError && error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('settled interpretation retry data expires after 24 hours and stores no raw audio field', async () => {
  const accountId = uid();
  const key = 'ai-request-retention-001';
  const claim = await store.claim(accountId, key, fingerprintAiInterpretationRequest({
    audioSha256: 'a'.repeat(64),
    request: { measurement: 'derived-only' },
  }), 35);
  assert.equal(claim.kind, 'claimed');
  if (claim.kind !== 'claimed') return;

  await store.markGenerated(accountId, key, claim.leaseToken, {
    analysis: { summary: 'derived interpretation only' },
  });
  await store.markSettled(accountId, key);

  const id = createHash('sha256').update(`${accountId}:${key}`).digest('hex');
  const snapshot = await db.doc(`users/${accountId}/ai_interpretation_jobs/${id}`).get();
  const data = snapshot.data();
  assert.ok(data);
  const expiry = data.expiresAt.toDate();
  const updatedAt = data.updatedAt.toDate();
  assert.equal(expiry.getTime() - updatedAt.getTime(), 24 * 60 * 60 * 1000);
  assert.equal('audioBase64' in data, false);
  assert.equal('rawAudio' in data, false);
});

test('a stale processing lease can be closed without exposing an unverified result', async () => {
  const accountId = uid();
  const key = 'ai-request-stale-001';
  const fingerprint = fingerprintAiInterpretationRequest({ input: 'stale' });
  const claim = await store.claim(accountId, key, fingerprint, 35);
  assert.equal(claim.kind, 'claimed');
  if (claim.kind !== 'claimed') return;

  const id = createHash('sha256').update(`${accountId}:${key}`).digest('hex');
  await db.doc(`users/${accountId}/ai_interpretation_jobs/${id}`)
    .update({ leaseExpiresAt: new Date(0) });
  const stale = await store.recover(accountId, key);
  assert.equal(stale.kind, 'stale');
  if (stale.kind !== 'stale') return;

  await store.markFailed(accountId, key, stale.leaseToken);
  assert.deepEqual(await store.recover(accountId, key), { kind: 'failed' });
});

test('expired settled results are unavailable and removed by cleanup', async () => {
  const accountId = uid();
  const key = 'ai-request-expiry-001';
  const fingerprint = fingerprintAiInterpretationRequest({ input: 'expire me' });
  const claim = await store.claim(accountId, key, fingerprint, 35);
  assert.equal(claim.kind, 'claimed');
  if (claim.kind !== 'claimed') return;

  await store.markGenerated(accountId, key, claim.leaseToken, {
    analysis: { summary: 'temporary' },
  });
  await store.markSettled(accountId, key);
  const id = createHash('sha256').update(`${accountId}:${key}`).digest('hex');
  await db.doc(`users/${accountId}/ai_interpretation_jobs/${id}`)
    .update({ expiresAt: new Date(0) });

  assert.equal((await store.claim(accountId, key, fingerprint, 35)).kind, 'expired');
  assert.equal(await deleteExpiredAiInterpretationJobs(db), 1);
  assert.equal((await store.claim(accountId, key, fingerprint, 35)).kind, 'claimed');
});
