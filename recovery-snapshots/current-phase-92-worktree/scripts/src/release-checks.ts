export interface ReleaseCheck {
  id: string;
  args: string[];
  env?: Record<string, string>;
}

export function processCheckExitCode(result: { status: number | null; error?: unknown; signal?: unknown }): number {
  // A timed-out process can handle SIGTERM and still exit zero. Its execution
  // error must take precedence over that otherwise successful exit status.
  return result.error != null || result.signal != null ? 1 : result.status ?? 1;
}

export const releaseChecks: ReleaseCheck[] = [
  { id: 'workspace-types', args: ['run', 'typecheck'] },
  { id: 'frontend-unit', args: ['--filter', '@workspace/zioncore-frequency-lab', 'test:unit'] },
  { id: 'api-unit', args: ['--filter', '@workspace/api-server', 'test:unit'] },
  { id: 'tooling-unit', args: ['--filter', '@workspace/scripts', 'test'] },
  { id: 'auth-emulator', args: ['--filter', '@workspace/zioncore-frequency-lab', 'test:auth'] },
  { id: 'firestore-rules', args: ['--filter', '@workspace/zioncore-frequency-lab', 'test:rules'] },
  { id: 'wallet-fulfillment-recovery', args: ['--filter', '@workspace/api-server', 'test:wallet'] },
  { id: 'api-production-build', args: ['--filter', '@workspace/api-server', 'build'] },
  {
    id: 'web-production-build',
    args: ['--filter', '@workspace/zioncore-frequency-lab', 'build'],
    // Build-time inputs, not a new server or a change to runtime configuration.
    env: { PORT: '18238', BASE_PATH: '/' },
  },
];

export function runReleaseChecks(
  execute: (check: ReleaseCheck) => number,
  report: (check: ReleaseCheck, status: 'START' | 'PASS' | 'FAIL') => void,
): { passed: boolean; failedCheck?: string } {
  for (const check of releaseChecks) {
    report(check, 'START');
    try {
      if (execute(check) === 0) {
        report(check, 'PASS');
        continue;
      }
    } catch {
      // An execution error is a failed check, never a skipped green result.
    }
    report(check, 'FAIL');
    return { passed: false, failedCheck: check.id };
  }
  return { passed: true };
}
