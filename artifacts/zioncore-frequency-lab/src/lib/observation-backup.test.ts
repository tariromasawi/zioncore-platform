import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_OBSERVATION_BACKUP_BYTES, observationBackupErrorMessage,
  parseObservationBackup, prepareObservationRestore, restoreObservationBackup,
} from './observation-backup';
import {
  appendObservation, OBSERVATION_STORAGE_KEY, readLocalRecoveryCopy,
  readObservationArchive, type Observation,
} from './observations';

const record = (id: string, notes = 'fixture'): Observation => ({
  id, notes, createdAt: '2026-11-07T12:00:00.000Z',
  sampleRate: 48000, fftSize: 4096, frequencyResolutionHz: 11.71875,
  dominantFrequencyHz: 440, topPeaksHz: [440], rmsLevel: 0.1,
  durationSeconds: 4, mode: 'audio-file',
});
class Store {
  value: string;
  writes = 0;
  full = false;
  constructor(items: Observation[] = []) { this.value = JSON.stringify(items); }
  getItem(key: string) { assert.equal(key, OBSERVATION_STORAGE_KEY); return this.value; }
  setItem(key: string, value: string) {
    assert.equal(key, OBSERVATION_STORAGE_KEY);
    if (this.full) throw Object.assign(new Error('private-debug-marker'), { name: 'QuotaExceededError' });
    this.value = value;
    this.writes++;
  }
}
const preview = (items: unknown[], storage: Store) =>
  prepareObservationRestore(parseObservationBackup(JSON.stringify(items)), readObservationArchive(storage));

test('a backup is validated and identical file duplicates are counted rather than imported twice', () => {
  const parsed = parseObservationBackup(JSON.stringify([record('a'), record('a'), { id: 'invalid' }]));
  assert.equal(parsed.observations.length, 1);
  assert.equal(parsed.invalidCount, 1);
  assert.equal(parsed.fileDuplicateCount, 1);
});

test('malformed, unrelated, oversized and excessive-record files fail without revealing raw content', () => {
  for (const text of ['{private-debug-marker', '{}', ' '.repeat(MAX_OBSERVATION_BACKUP_BYTES + 1), JSON.stringify(Array(10001).fill({}))]) {
    assert.throws(() => parseObservationBackup(text), cause => {
      assert.doesNotMatch(observationBackupErrorMessage(cause), /private-debug-marker/);
      return true;
    });
  }
});

test('different records sharing an identity inside one backup are rejected rather than arbitrarily selected', () => {
  assert.throws(() => parseObservationBackup(JSON.stringify([record('same', 'one'), record('same', 'two')])), /same identity/);
});

test('preview distinguishes new, identical and conflicting records without modifying storage', () => {
  const storage = new Store([record('identical'), record('conflict', 'original')]);
  const plan = preview([record('identical'), record('conflict', 'changed'), record('new')], storage);
  assert.equal(plan.existingDuplicateCount, 1);
  assert.equal(plan.existingConflictCount, 1);
  assert.deepEqual(plan.recordsToAdd.map(item => item.id), ['new']);
  assert.equal(storage.writes, 0);
});

test('partial recovery requires acknowledgement and preserves every existing record', async () => {
  const storage = new Store([record('existing', 'original')]);
  const original = storage.value;
  const plan = preview([record('new'), record('existing', 'different'), { id: 'invalid' }], storage);
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), /Confirm/);
  assert.equal(storage.value, original);
  const items = await restoreObservationBackup(plan, true, { storage });
  assert.equal(items.find(item => item.id === 'existing')?.notes, 'original');
  assert.equal(items.filter(item => item.id === 'new').length, 1);
  assert.equal(items.length, 2);
});

test('changes after preview refuse the restore and preserve the intervening save', async () => {
  const storage = new Store([record('original')]);
  const plan = preview([record('imported')], storage);
  await appendObservation(record('intervening'), { storage });
  const changed = storage.value;
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), /changed after the preview/);
  assert.equal(storage.value, changed);
});

test('storage quota failure preserves the prior archive and produces a safe message', async () => {
  const storage = new Store([record('original')]);
  const original = storage.value;
  const plan = preview([record('imported')], storage);
  storage.full = true;
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), cause => {
    assert.match(observationBackupErrorMessage(cause), /storage is full/);
    assert.doesNotMatch(observationBackupErrorMessage(cause), /private-debug-marker/);
    return true;
  });
  assert.equal(storage.value, original);
});

test('a damaged destination requires the exact recovery copy and explicit replacement confirmation', async () => {
  const storage = new Store([record('original')]);
  const raw = JSON.stringify([record('readable'), { id: 'damaged', notes: 'keep-this-byte-for-byte' }]);
  storage.value = raw;
  const plan = preview([record('imported')], storage);
  assert.equal(plan.destinationDamaged, true);
  assert.equal(plan.destinationReadableCount, 1);
  assert.equal(plan.destinationUnreadableCount, 1);
  assert.equal(plan.snapshot, raw);
  assert.equal(readLocalRecoveryCopy(storage), raw);
  assert.equal(storage.writes, 0);
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), /download.*explicitly confirm/i);
  assert.equal(storage.value, raw);
  const items = await restoreObservationBackup(plan, false, { storage }, true);
  assert.deepEqual(items.map(item => item.id), ['imported', 'readable']);
  assert.equal(storage.writes, 1);
  assert.equal(raw, JSON.stringify([record('readable'), { id: 'damaged', notes: 'keep-this-byte-for-byte' }]));
  assert.equal(readObservationArchive(storage).status, 'ready');
});

test('a damaged archive can be repaired from its readable records even when the backup adds no new identity', async () => {
  const storage = new Store([record('placeholder')]);
  const raw = JSON.stringify([record('same'), record('same')]);
  storage.value = raw;
  const plan = preview([record('same')], storage);
  assert.equal(plan.recordsToAdd.length, 0);
  assert.equal(plan.destinationDamaged, true);
  assert.equal(plan.destinationReadableCount, 1);
  assert.equal(plan.destinationUnreadableCount, 1);
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), /explicitly confirm/i);
  const items = await restoreObservationBackup(plan, false, { storage }, true);
  assert.deepEqual(items.map(item => item.id), ['same']);
  assert.equal(storage.writes, 1);
  assert.equal(readObservationArchive(storage).status, 'ready');
  assert.equal(raw, JSON.stringify([record('same'), record('same')]));
});

test('quota failure during damaged-archive repair preserves the original bytes', async () => {
  const storage = new Store();
  const raw = '{"corrupted":"original-byte-sequence"';
  storage.value = raw;
  const plan = preview([record('recovered')], storage);
  storage.full = true;
  await assert.rejects(restoreObservationBackup(plan, false, { storage }, true), cause => {
    assert.match(observationBackupErrorMessage(cause), /storage is full/);
    return true;
  });
  assert.equal(storage.value, raw);
  assert.equal(readLocalRecoveryCopy(storage), raw);
  assert.equal(storage.writes, 0);
});

test('an empty damaged archive cannot be overwritten without any validated recovery record', async () => {
  const storage = new Store();
  const raw = '{unreadable archive';
  storage.value = raw;
  const plan = preview([{ id: 'missing-measurements' }], storage);
  assert.equal(plan.recordsToAdd.length, 0);
  await assert.rejects(restoreObservationBackup(plan, true, { storage }, true), /No validated observations/);
  assert.equal(storage.value, raw);
  assert.equal(storage.writes, 0);
});

test('repeated imports become no-op previews, not duplicate records or archive rewrites', async () => {
  const storage = new Store();
  await restoreObservationBackup(preview([record('imported')], storage), false, { storage });
  const repeated = preview([record('imported')], storage);
  assert.equal(repeated.recordsToAdd.length, 0);
  assert.equal(repeated.existingDuplicateCount, 1);
  await assert.rejects(restoreObservationBackup(repeated, false, { storage }), /No safe new/);
  assert.equal(storage.writes, 1);
});

test('commit validates records again rather than trusting mutable preview data', async () => {
  const storage = new Store([record('original')]);
  const plan = preview([record('imported')], storage);
  plan.recordsToAdd[0]!.rmsLevel = 8;
  await assert.rejects(restoreObservationBackup(plan, false, { storage }), /validated/);
  assert.equal(storage.writes, 0);
});
