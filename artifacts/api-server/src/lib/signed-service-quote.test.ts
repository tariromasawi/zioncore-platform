import assert from 'node:assert/strict';
import test from 'node:test';
import {
  issueServiceQuote,
  SERVICE_QUOTE_TTL_MS,
  verifyServiceQuote,
  type ServiceQuoteExpectation,
} from './signed-service-quote';

const env = { SESSION_SECRET: 'zioncore-test-quote-secret-0123456789' } as NodeJS.ProcessEnv;
const expectation: ServiceQuoteExpectation = {
  uid: 'customer-uid',
  service: 'interpretation',
  credits: 35,
  pricingVersion: 'approved-v1',
  scope: 'interpretation:derived-features-v1',
};

test('issues a short-lived signed quote that is bound to account, service and price', () => {
  const now = 1_800_000_000_000;
  const issued = issueServiceQuote(expectation, env, now);
  assert.ok(issued);
  assert.equal(issued.currency, 'gbp');
  assert.equal(issued.amountMinor, expectation.credits);
  assert.equal(Date.parse(issued.expiresAt), now + SERVICE_QUOTE_TTL_MS);

  const verified = verifyServiceQuote(issued.quoteToken, expectation, env, now + 1);
  assert.equal(verified.ok, true);
  if (verified.ok) assert.equal(verified.quote.quoteId, issued.quoteId);
});

test('rejects tampered and account-, service-, price-, or scope-mismatched quotes', () => {
  const issued = issueServiceQuote(expectation, env, 1_800_000_000_000);
  assert.ok(issued);
  const changedFinalCharacter = issued.quoteToken.endsWith('A') ? 'B' : 'A';
  assert.equal(
    verifyServiceQuote(`${issued.quoteToken.slice(0, -1)}${changedFinalCharacter}`, expectation, env).ok,
    false,
  );
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, { ...expectation, uid: 'other-user' }, env),
    { ok: false, reason: 'mismatch' },
  );
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, { ...expectation, credits: 36 }, env),
    { ok: false, reason: 'mismatch' },
  );
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, { ...expectation, service: 'audio-review' }, env),
    { ok: false, reason: 'mismatch' },
  );
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, { ...expectation, scope: 'other-scope' }, env),
    { ok: false, reason: 'mismatch' },
  );
});

test('rejects expired quotes and fails closed without a sufficiently strong signing secret', () => {
  const now = 1_800_000_000_000;
  const issued = issueServiceQuote(expectation, env, now);
  assert.ok(issued);
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, expectation, env, now + SERVICE_QUOTE_TTL_MS),
    { ok: false, reason: 'expired' },
  );
  assert.equal(issueServiceQuote(expectation, { SESSION_SECRET: 'short' } as NodeJS.ProcessEnv, now), null);
  assert.deepEqual(
    verifyServiceQuote(issued.quoteToken, expectation, {} as NodeJS.ProcessEnv, now),
    { ok: false, reason: 'unconfigured' },
  );
});
