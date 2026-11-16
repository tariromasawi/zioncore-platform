import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendObservation, localObservationErrorMessage, OBSERVATION_STORAGE_KEY,
  readLocalRecoveryCopy, readObservationArchive, writeObservations, type Observation,
} from './observations';

class MemoryArchive {
  value: string | null = null;
  writes = 0;
  failRead = false;
  failWrite = false;
  getItem(key: string) {
    assert.equal(key, OBSERVATION_STORAGE_KEY);
    if (this.failRead) throw new Error('private-debug-marker');
    return this.value;
  }
  setItem(key: string, value: string) {
    assert.equal(key, OBSERVATION_STORAGE_KEY);
    if (this.failWrite) throw Object.assign(new Error('private-debug-marker'), { name: 'QuotaExceededError' });
    this.value = value;
    this.writes++;
  }
}

const observation = (id: string): Observation => ({
  id, createdAt: '2026-11-07T12:00:00.000Z', sampleRate: 48000, fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096, dominantFrequencyHz: 440, topPeaksHz: [440],
  rmsLevel: 0.1, durationSeconds: 4, mode: 'audio-file',
});

function mutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(commit: () => T): Promise<T> => {
    const next = tail.then(commit);
    tail = next.catch(() => {});
    return next;
  };
}

test('only an absent archive is treated as genuinely empty', () => {
  const storage = new MemoryArchive();
  assert.deepEqual(readObservationArchive(storage), { items: [], status: 'ready', issue: '' });
  storage.value = '';
  assert.equal(readObservationArchive(storage).status, 'damaged');
});

test('malformed and non-array archives are preserved byte for byte and block new saves', async () => {
  for (const raw of ['{"broken":', '{"notes":"private-fixture"}']) {
    const storage = new MemoryArchive();
    storage.value = raw;
    await assert.rejects(appendObservation(observation('new'), { storage }), /unreadable/);
    assert.equal(storage.value, raw);
    assert.equal(storage.writes, 0);
    assert.equal(readLocalRecoveryCopy(storage), raw);
  }
});

test('partially invalid archives expose readable records without discarding unreadable originals', async () => {
  const storage = new MemoryArchive();
  storage.value = JSON.stringify([observation('valid'), { id: 'damaged', notes: 'recover-me' }]);
  const original = storage.value;
  const archive = readObservationArchive(storage);
  assert.equal(archive.status, 'damaged');
  assert.deepEqual(archive.items.map(item => item.id), ['valid']);
  assert.equal(archive.raw, original);
  assert.equal(archive.unreadableCount, 1);
  await assert.rejects(appendObservation(observation('new'), { storage }));
  assert.equal(storage.value, original);
});

test('duplicate identities are not silently rewritten or rendered twice', () => {
  const storage = new MemoryArchive();
  storage.value = JSON.stringify([observation('same'), observation('same')]);
  const archive = readObservationArchive(storage);
  assert.equal(archive.status, 'damaged');
  assert.equal(archive.items.length, 1);
  assert.equal(storage.writes, 0);
});

test('saving re-reads the latest archive rather than replacing it with a stale page snapshot', async () => {
  const storage = new MemoryArchive();
  storage.value = JSON.stringify([observation('earlier')]);
  const stalePage = readObservationArchive(storage);
  await appendObservation(observation('other-tab'), { storage });
  const next = await appendObservation(observation('new'), { storage });
  assert.equal(stalePage.items.length, 1);
  assert.deepEqual(next.map(item => item.id), ['new', 'other-tab', 'earlier']);
});

test('quota failure does not report a successful commit or expose an internal error payload', async () => {
  const storage = new MemoryArchive();
  storage.value = JSON.stringify([observation('earlier')]);
  const original = storage.value;
  storage.failWrite = true;
  await assert.rejects(appendObservation(observation('new'), { storage }), cause => {
    assert.match(localObservationErrorMessage(cause), /storage is full/);
    assert.doesNotMatch(localObservationErrorMessage(cause), /private-debug-marker/);
    return true;
  });
  assert.equal(storage.value, original);
  assert.equal(storage.writes, 0);
});

test('unavailable storage is distinguished from empty storage and cannot be overwritten', async () => {
  const storage = new MemoryArchive();
  storage.failRead = true;
  assert.equal(readObservationArchive(storage).status, 'unavailable');
  await assert.rejects(appendObservation(observation('new'), { storage }), /cannot be read/);
  assert.equal(storage.writes, 0);
});

test('invalid measurements and duplicate new identities cannot alter the archive', async () => {
  const storage = new MemoryArchive();
  await appendObservation(observation('existing'), { storage });
  const original = storage.value;
  await assert.rejects(appendObservation(observation('existing'), { storage }), /already exists/);
  await assert.rejects(appendObservation({ ...observation('invalid'), dominantFrequencyHz: -1 }, { storage }), /validated/);
  assert.equal(storage.value, original);
});

test('a shared exclusive lock serializes concurrent saves and the explicit clear action', async () => {
  const storage = new MemoryArchive();
  const options = { storage, runExclusive: mutex() };
  await Promise.all([
    appendObservation(observation('first'), options),
    appendObservation(observation('second'), options),
  ]);
  assert.deepEqual(readObservationArchive(storage).items.map(item => item.id), ['second', 'first']);
  await Promise.all([
    writeObservations([], options),
    appendObservation(observation('after-clear'), options),
  ]);
  assert.deepEqual(readObservationArchive(storage).items.map(item => item.id), ['after-clear']);
});

test('recovery downloads return the original content, not a repaired or filtered replacement', () => {
  const storage = new MemoryArchive();
  storage.value = 'original unreadable private-fixture';
  assert.equal(readLocalRecoveryCopy(storage), storage.value);
  assert.equal(storage.writes, 0);
});
