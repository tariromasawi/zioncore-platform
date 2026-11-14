import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildGenesisSeedContext,
  ZIONCORE_GENESIS_SOURCE_SHA256,
  ZIONCORE_GENESIS_SOURCE_PATH,
  ZIONCORE_GENESIS_VERSION,
} from './genesis-seed';

test('the ZionCore seed uses the seven-stage product cycle and names current boundaries', () => {
  const context = buildGenesisSeedContext(false, '');

  assert.equal(ZIONCORE_GENESIS_VERSION, '1.3.0');
  assert.match(context, new RegExp(ZIONCORE_GENESIS_SOURCE_SHA256));
  assert.match(context, /bounded operational policy and selected source-linked excerpts/i);
  assert.match(context, /full archive remains unchanged/i);
  assert.match(context, /RECEIVE → DECODE → INTERPRET → LEARN → ENCODE → TRANSMIT → OBSERVE/);
  assert.match(context, /HRH Saint Tariro Masawi, The Anointed Commander/);
  assert.match(context, /customer data does not train models/i);
  assert.match(context, /not separate engines/i);
  assert.doesNotMatch(context, /six-stage|six connected stages/i);
  assert.ok(context.length <= 8000, `Expected bounded provider context; got ${context.length} characters.`);
  assert.doesNotMatch(context, /Tarry Kupakwashe|Karumekangu|Corinna Masawi/);
});

test('the preserved Genesis archive matches its recorded immutable SHA-256', async () => {
  const archive = await readFile(new URL(`../../../${ZIONCORE_GENESIS_SOURCE_PATH}`, import.meta.url));
  const digest = createHash('sha256').update(archive).digest('hex');
  assert.equal(digest, ZIONCORE_GENESIS_SOURCE_SHA256);
  assert.equal(archive.byteLength, 172275);
  assert.match(archive.toString('utf8'), /^THE FIRST DECLARATION/);
});
