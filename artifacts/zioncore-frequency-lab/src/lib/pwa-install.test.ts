import assert from 'node:assert/strict';
import test from 'node:test';
import { isAppleTouchDevice, isStandalonePwa } from './pwa-install';

test('recognizes iPhone and iPad browsers, including iPadOS desktop user agents', () => {
  assert.equal(isAppleTouchDevice('Mozilla/5.0 (iPhone)', 'iPhone', 1), true);
  assert.equal(isAppleTouchDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 5), true);
  assert.equal(isAppleTouchDevice('Mozilla/5.0 (Windows NT)', 'Win32', 0), false);
});

test('hides install prompts for installed standalone apps', () => {
  assert.equal(isStandalonePwa(true, false), true);
  assert.equal(isStandalonePwa(false, true), true);
  assert.equal(isStandalonePwa(false, false), false);
});
