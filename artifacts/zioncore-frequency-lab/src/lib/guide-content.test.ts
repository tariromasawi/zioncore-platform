import test from 'node:test';
import assert from 'node:assert/strict';
import { countGuideText, guideArticles, guideFaq } from './guide-content';

test('ZionCore field guide contains at least 50,000 characters of distinct reader-facing content', () => {
  assert.equal(guideArticles.length, 23);
  assert.equal(guideFaq.length, 32);
  assert.ok(countGuideText() >= 50_000, `Guide contains ${countGuideText()} characters`);
});
