import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { processCheckExitCode, runReleaseChecks } from './release-checks';

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const result = runReleaseChecks(check => {
  const child = spawnSync('pnpm', check.args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: { ...process.env, ...check.env },
    timeout: 8 * 60_000,
    killSignal: 'SIGTERM',
  });
  if (child.error) {
    // Do not serialize inherited environment variables or credential objects.
    process.stderr.write(`[release-check] ${check.id}: process failed or timed out.\n`);
  }
  return processCheckExitCode(child);
}, (check, status) => {
  process.stdout.write(`\n[release-check] ${status}: ${check.id}\n`);
});

if (!result.passed) {
  process.stderr.write(`\nEngineering verification FAILED at ${result.failedCheck}. Later checks were not run.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nLOCAL ENGINEERING CHECKS PASSED.\n');
  process.stdout.write('This is not launch approval or proof of real Google/Apple sign-in, live Stripe fulfillment, production indexes, or live provider generation.\n');
  process.stdout.write('See research/zioncore-release-checklist.md for the remaining operational evidence.\n');
}
