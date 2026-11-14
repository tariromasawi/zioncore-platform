import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PacketReplayWindow } from './packet-replay-window';

const id = (digit: string) => digit.repeat(32);

test('marks repeated valid packet IDs within a bounded session window', () => {
  const window = new PacketReplayWindow(2);
  assert.equal(window.observe(id('a')), false);
  assert.equal(window.observe(id('b')), false);
  assert.equal(window.observe(id('a')), true);
  assert.equal(window.observe(id('c')), false);
  assert.equal(window.observe(id('a')), false);
  assert.equal(window.observe(id('c')), true);
});

test('rejects malformed IDs and unsafe window sizes', () => {
  assert.throws(() => new PacketReplayWindow(0), /between 1 and 4,096/);
  assert.throws(() => new PacketReplayWindow(4_097), /between 1 and 4,096/);
  assert.throws(() => new PacketReplayWindow(1.5), /between 1 and 4,096/);
  assert.throws(() => new PacketReplayWindow().observe('not-a-packet-id'), /16 bytes/);
});
