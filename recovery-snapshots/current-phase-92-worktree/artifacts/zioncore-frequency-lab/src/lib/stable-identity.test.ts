import assert from 'node:assert/strict';
import test from 'node:test';
import { loadForStableIdentity } from './stable-identity';

test('a private resource remains bound to the initiating account', async () => {
  const resource = { private: true };
  assert.deepEqual(await loadForStableIdentity(() => 'owner-a', async () => resource), {
    uid: 'owner-a', resource,
  });
});

test('signed-out requests never load the private resource', async () => {
  let loaded = false;
  await assert.rejects(loadForStableIdentity(() => null, async () => { loaded = true; }), /Sign in/);
  assert.equal(loaded, false);
});

test('switching accounts during lazy loading cannot select the replacement account', async () => {
  let uid: string | null = 'owner-a';
  await assert.rejects(loadForStableIdentity(() => uid, async () => {
    uid = 'owner-b'; return {};
  }), /account changed/);
});

test('signing out during lazy loading rejects without returning a private resource', async () => {
  let uid: string | null = 'owner-a';
  await assert.rejects(loadForStableIdentity(() => uid, async () => {
    uid = null; return {};
  }), /account changed/);
});
