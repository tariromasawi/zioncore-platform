import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { measureMeaningfulCharacters } from './meaningful-character-report';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

try {
  const report = measureMeaningfulCharacters(workspaceRoot);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Unknown measurement error';
  process.stderr.write(`Could not measure the repository: ${reason}\n`);
  process.exitCode = 1;
}
