import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ZIONCORE_GENESIS_SOURCE_SHA256 } from './genesis-context';

test('the Genesis archive is preserved byte-for-byte from the supplied source', async () => {
  const original = await readFile(new URL('../content/genesis-declaration.txt', import.meta.url));
  assert.equal(
    createHash('sha256').update(original).digest('hex'),
    ZIONCORE_GENESIS_SOURCE_SHA256,
  );
  assert.match(original.toString('utf8'), /^THE FIRST DECLARATION/);
});
