import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';

test('database integration tests accept only explicit local emulator targets', () => {
  for (const host of ['127.0.0.1:8085', 'localhost:8085', '[::1]:8085']) {
    assert.doesNotThrow(() => assertLocalFirestoreEmulator(host));
  }
});

test('database integration tests reject absent, remote and malformed targets before initializing Firebase', () => {
  for (const host of [
    undefined, '', 'firestore.googleapis.com:443', 'example.com:8085',
    '127.0.0.1', 'http://127.0.0.1:8085', '127.0.0.1:0', '127.0.0.1:65536',
    '127.0.0.1:8085/path', 'user@localhost:8085', '127.0.0.1:8085?other=1',
  ]) assert.throws(() => assertLocalFirestoreEmulator(host), /loopback Firestore emulator/);
});
