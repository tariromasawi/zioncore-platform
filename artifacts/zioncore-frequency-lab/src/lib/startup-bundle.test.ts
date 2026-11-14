import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNoStartupGenesis,
  assertStartupBudget,
  collectStartupChunks,
  type StartupChunk,
} from './startup-bundle';

function chunk(fileName: string, isEntry = false, imports: string[] = []): StartupChunk {
  return { type: 'chunk', fileName, isEntry, imports, code: '', modules: {} };
}

test('startup inspection follows static dependencies, not deferred feature chunks', () => {
  const bundle = {
    'main.js': chunk('main.js', true, ['shared.js']),
    'shared.js': chunk('shared.js'),
    'later.js': chunk('later.js'),
  };
  assert.deepEqual(collectStartupChunks(bundle).map(item => item.fileName).sort(), ['main.js', 'shared.js']);
});

test('shared and circular startup imports are counted only once', () => {
  const bundle = {
    'main.js': chunk('main.js', true, ['shared.js']),
    'second.js': chunk('second.js', true, ['shared.js']),
    'shared.js': chunk('shared.js', false, ['main.js']),
  };
  assert.equal(collectStartupChunks(bundle).length, 3);
});

test('the guard rejects seed data in an entry or static dependency', () => {
  const main = chunk('main.js', true, ['shared.js']);
  const shared = chunk('shared.js');
  shared.modules['/workspace/lib/frequency-ai-contract/src/genesis-seed.ts'] = { renderedLength: 10 };
  assert.throws(() => assertNoStartupGenesis(collectStartupChunks({ 'main.js': main, 'shared.js': shared })), /Genesis/);
});

test('an eliminated seed module or a genuinely deferred module does not fail startup inspection', () => {
  const main = chunk('main.js', true);
  main.modules['/workspace/lib/frequency-ai-contract/src/genesis-seed.ts'] = { renderedLength: 0 };
  const later = chunk('later.js');
  later.modules['/workspace/lib/frequency-ai-contract/src/genesis-seed.ts'] = { renderedLength: 100 };
  assert.doesNotThrow(() => assertNoStartupGenesis(collectStartupChunks({ 'main.js': main, 'later.js': later })));
});

test('enforces the measured initial JavaScript gzip ceiling', () => {
  assert.doesNotThrow(() => assertStartupBudget(200_000));
  assert.doesNotThrow(() => assertStartupBudget(199_999));
  assert.throws(() => assertStartupBudget(200_001), /gzip budget/);
  assert.throws(() => assertStartupBudget(Number.NaN), /finite positive/);
});
