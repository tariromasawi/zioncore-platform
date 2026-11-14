import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGenesisSeedContext, ZIONCORE_GENESIS_VERSION } from './genesis-seed';

test('the ZionCore seed uses the seven-stage product cycle and names current boundaries', () => {
  const context = buildGenesisSeedContext(false, '');

  assert.equal(ZIONCORE_GENESIS_VERSION, '1.1.0');
  assert.match(
    context,
    /RECEIVE → DECODE → INTERPRET → LEARN → ENCODE → TRANSMIT → OBSERVE/,
  );
  assert.match(context, /customer data never trains a model/i);
  assert.match(context, /not separate engines/i);
  assert.match(context, /Two-device recovery.*unverified/i);
  assert.doesNotMatch(context, /six-stage|six connected stages/i);
});
