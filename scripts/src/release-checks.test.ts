import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processCheckExitCode, releaseChecks, runReleaseChecks } from './release-checks';

test('timeouts and termination signals cannot produce a green check even if the child reports exit zero', () => {
  assert.equal(processCheckExitCode({ status: 0, error: new Error('timeout') }), 1);
  assert.equal(processCheckExitCode({ status: 0, signal: 'SIGTERM' }), 1);
  assert.equal(processCheckExitCode({ status: null }), 1);
  assert.equal(processCheckExitCode({ status: 1 }), 1);
  assert.equal(processCheckExitCode({ status: 0, signal: null }), 0);
});

test('a release check includes types, unit tests, isolated identity/rules/accounting tests and both production builds', () => {
  assert.equal(new Set(releaseChecks.map(check => check.id)).size, 9);
  for (const command of ['typecheck', 'test:unit', 'test:auth', 'test:rules', 'test:wallet', 'build']) {
    assert.ok(releaseChecks.some(check => check.args.includes(command)));
  }
  assert.equal(releaseChecks.filter(check => check.args.includes('build')).length, 2);
});

test('one failed check stops the sequence and cannot be reported as passed', () => {
  const visited: string[] = [];
  const statuses: string[] = [];
  const result = runReleaseChecks(check => {
    visited.push(check.id);
    return visited.length === 2 ? 1 : 0;
  }, (check, status) => statuses.push(`${check.id}:${status}`));
  assert.deepEqual(result, { passed: false, failedCheck: releaseChecks[1]!.id });
  assert.equal(visited.length, 2);
  assert.equal(statuses.at(-1), `${releaseChecks[1]!.id}:FAIL`);
});

test('a thrown execution error fails closed', () => {
  let count = 0;
  const result = runReleaseChecks(() => { count++; throw new Error('fixture'); }, () => {});
  assert.equal(result.passed, false);
  assert.equal(count, 1);
});

test('all required checks must succeed before the local engineering result passes', () => {
  let passed = 0;
  assert.deepEqual(runReleaseChecks(() => 0, (_check, status) => {
    if (status === 'PASS') passed++;
  }), { passed: true });
  assert.equal(passed, releaseChecks.length);
});
