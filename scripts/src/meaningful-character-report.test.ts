import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  characterModuleForPath,
  countUtf8DecodedCharacters,
  isEligibleProjectPath,
} from './meaningful-character-report';

test('counts Unicode code points after UTF-8 decoding', () => {
  assert.equal(countUtf8DecodedCharacters('A🌟界'), 3);
});

test('ignores binary content containing a null byte', () => {
  assert.equal(countUtf8DecodedCharacters('source\0binary'), null);
});

test('counts human-maintained source, test, documentation, and config files', () => {
  for (const path of [
    'artifacts/zioncore-frequency-lab/src/App.tsx',
    'artifacts/api-server/src/lib/ledger.test.ts',
    'artifacts/api-server/STRIPE_SETUP.md',
    'lib/api-spec/openapi.yaml',
    'scripts/package.json',
  ]) {
    assert.equal(isEligibleProjectPath(path), true, path);
  }
});

test('excludes dependencies, generated files, build output, prompts, and lockfiles', () => {
  for (const path of [
    'node_modules/react/index.js',
    'artifacts/app/dist/assets/app.js',
    'lib/api-zod/src/generated/types/wallet.ts',
    'attached_assets/prompt.txt',
    'pnpm-lock.yaml',
  ]) {
    assert.equal(isEligibleProjectPath(path), false, path);
  }
});

test('groups counts by independently maintainable project module', () => {
  assert.equal(
    characterModuleForPath('artifacts/api-server/src/lib/wallet.ts'),
    'artifacts/api-server',
  );
  assert.equal(characterModuleForPath('scripts/src/measure.ts'), 'scripts');
  assert.equal(characterModuleForPath('package.json'), 'root');
});
