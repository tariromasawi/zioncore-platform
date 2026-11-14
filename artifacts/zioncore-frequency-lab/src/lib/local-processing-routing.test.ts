import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const browserLocalModules = [
  'live-lab.ts',
  'audio-file-analysis.ts',
  'dsp-config.ts',
  'dsp-playback.ts',
  'acoustic-message.ts',
  'research-comparison.ts',
  'research-grid.ts',
] as const;

for (const moduleName of browserLocalModules) {
  test(`${moduleName} stays free of cloud AI and network request calls`, async () => {
    const source = await readFile(new URL(`./${moduleName}`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source,
      /firebase\/ai|GoogleAIBackend|generateContent|\bfetch\s*\(|XMLHttpRequest|axios\./,
    );
  });
}
