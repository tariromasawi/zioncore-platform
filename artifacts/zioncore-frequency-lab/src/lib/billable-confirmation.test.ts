import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBillableQuoteConfirmed } from './billable-confirmation';

test('a paid request requires confirmation of the active quote', () => {
  assert.equal(isBillableQuoteConfirmed('quote-1', 'quote-1'), true);
  assert.equal(isBillableQuoteConfirmed('quote-1', null), false);
  assert.equal(isBillableQuoteConfirmed('quote-1', 'quote-older'), false);
  assert.equal(isBillableQuoteConfirmed(null, 'quote-1'), false);
  assert.equal(isBillableQuoteConfirmed('', ''), false);
});
