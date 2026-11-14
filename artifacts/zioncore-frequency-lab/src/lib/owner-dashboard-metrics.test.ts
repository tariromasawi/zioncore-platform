import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPaymentWindowCount } from './owner-dashboard-metrics';

test('a complete query with no payment rows reports a confirmed zero', () => {
  assert.deepEqual(getPaymentWindowCount({
    status: 'connected',
    truncated: false,
    currencyTotals: [],
  }), {
    value: 0,
    certainty: 'complete',
    lowerBound: false,
    emptyWindow: true,
  });
});

test('unavailable and disabled Stripe data are not rendered as zero', () => {
  for (const status of ['unavailable', 'not_enabled'] as const) {
    assert.deepEqual(getPaymentWindowCount({
      status,
      truncated: false,
      currencyTotals: [],
    }), {
      value: null,
      certainty: 'unavailable',
      lowerBound: false,
      emptyWindow: false,
    });
  }
});

test('an incomplete scan with no observed payments does not claim zero', () => {
  assert.deepEqual(getPaymentWindowCount({
    status: 'connected',
    truncated: true,
    currencyTotals: [],
  }), {
    value: null,
    certainty: 'partial',
    lowerBound: false,
    emptyWindow: false,
  });
});

test('truncated results with observed payments are marked as a lower bound', () => {
  assert.deepEqual(getPaymentWindowCount({
    status: 'connected',
    truncated: true,
    currencyTotals: [{ paymentCount: 4 }, { paymentCount: 2 }],
  }), {
    value: 6,
    certainty: 'partial',
    lowerBound: true,
    emptyWindow: false,
  });
});

test('a complete refund-only window reports zero payments without calling it empty', () => {
  assert.deepEqual(getPaymentWindowCount({
    status: 'connected',
    truncated: false,
    currencyTotals: [{ paymentCount: 0 }],
  }), {
    value: 0,
    certainty: 'complete',
    lowerBound: false,
    emptyWindow: false,
  });
});

test('truncated refund-only results do not establish a confirmed zero', () => {
  assert.deepEqual(getPaymentWindowCount({
    status: 'connected',
    truncated: true,
    currencyTotals: [{ paymentCount: 0 }],
  }), {
    value: null,
    certainty: 'partial',
    lowerBound: false,
    emptyWindow: false,
  });
});
