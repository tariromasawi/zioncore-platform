import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAIRequestGuard } from './ai-request-guard';

test('applies a per-user cooldown and allows another user independently', () => {
  let now = 1000;
  const guard = createAIRequestGuard({ cooldownMs: 15000, now: () => now });
  const first = guard.acquire('user-a');
  assert.equal(first.allowed, true);
  if (first.allowed) first.release();

  assert.deepEqual(guard.acquire('user-a'), { allowed: false, reason: 'cooldown' });
  const other = guard.acquire('user-b');
  assert.equal(other.allowed, true);
  if (other.allowed) other.release();

  now += 15000;
  const retry = guard.acquire('user-a');
  assert.equal(retry.allowed, true);
  if (retry.allowed) retry.release();
});

test('caps concurrent interpretations and makes release idempotent', () => {
  const guard = createAIRequestGuard({ maxConcurrent: 1, now: () => 1000 });
  const first = guard.acquire('user-a');
  assert.equal(first.allowed, true);
  assert.deepEqual(guard.acquire('user-b'), { allowed: false, reason: 'capacity' });
  if (first.allowed) {
    first.release();
    first.release();
  }
  const second = guard.acquire('user-b');
  assert.equal(second.allowed, true);
  if (second.allowed) second.release();
});

test('bounds the per-process cooldown map when many distinct accounts arrive', () => {
  let now = 1000;
  const guard = createAIRequestGuard({
    cooldownMs: 60_000,
    maxConcurrent: 10,
    maxTrackedUsers: 2,
    now: () => now,
  });
  for (const uid of ['user-a', 'user-b', 'user-c']) {
    const result = guard.acquire(uid);
    assert.equal(result.allowed, true);
    if (result.allowed) result.release();
  }

  // The oldest entry was evicted to keep memory bounded.
  const evictedUser = guard.acquire('user-a');
  assert.equal(evictedUser.allowed, true);
  if (evictedUser.allowed) evictedUser.release();

  now += 60_000;
  const expired = guard.acquire('user-b');
  assert.equal(expired.allowed, true);
  if (expired.allowed) expired.release();
});
