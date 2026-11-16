import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GetAdminDashboardSummaryResponse } from '@workspace/api-zod';
import {
  aggregateAiJobEconomics,
  aggregateBalanceTransactions,
} from './owner-dashboard-data';
import { createAiJobFinancialAudit } from './ai-job-financial-audit';

test('admin revenue totals separate gross sales, refunds, and Stripe net by currency', () => {
  assert.deepEqual(aggregateBalanceTransactions([
    { type: 'charge', amount: 250, net: 220, currency: 'gbp' },
    { type: 'charge', amount: 800, net: 760, currency: 'gbp' },
    { type: 'refund', amount: -250, net: -220, currency: 'gbp' },
    { type: 'charge', amount: 1299, net: 1200, currency: 'usd' },
    { type: 'adjustment', amount: 99, net: 99, currency: 'gbp' },
  ]), [
    {
      currency: 'gbp',
      paymentCount: 2,
      grossMinor: 1050,
      refundCount: 1,
      refundedMinor: 250,
      netSalesMinor: 800,
      stripeNetMinor: 760,
    },
    {
      currency: 'usd',
      paymentCount: 1,
      grossMinor: 1299,
      refundCount: 0,
      refundedMinor: 0,
      netSalesMinor: 1299,
      stripeNetMinor: 1200,
    },
  ]);
});

test('revenue aggregation skips malformed Stripe values and keeps zero-payment periods empty', () => {
  assert.deepEqual(aggregateBalanceTransactions([
    { type: 'charge', amount: Number.NaN, net: 10, currency: 'gbp' },
    { type: 'charge', amount: 10, net: 10, currency: 'not-a-currency' },
    { type: 'transfer', amount: 500, net: 500, currency: 'gbp' },
  ]), []);
});

test('AI job economics totals only settled, audited work and withholds incomplete provider cost', () => {
  const audit = createAiJobFinancialAudit({
    quoteId: 'c2bbcf65-aabb-4c61-a709-b1ec3e083d42',
    service: 'interpretation',
    creditsCharged: 200,
    providerUsage: [{
      provider: 'gemini',
      model: 'test-model',
      inputTokens: 1_000,
      outputTokens: 500,
      estimatedCostMicroUsd: 2_000,
    }],
    recordedAtMs: 1_700_000_000_000,
  });
  assert.deepEqual(aggregateAiJobEconomics([
    { status: 'settled', financialAudit: audit },
    { status: 'failed', financialAudit: audit },
    { status: 'settled' },
  ], false), {
    status: 'connected',
    jobsScanned: 3,
    settledJobs: 2,
    auditedJobs: 1,
    unauditedSettledJobs: 1,
    creditsSpent: 200,
    grossServiceValueMinor: 200,
    estimatedProviderCostMicroUsd: null,
    truncated: false,
  });
});

test('admin summary response accepts aggregated fields and rejects unapproved extra data', () => {
  const summary = {
    generatedAt: new Date().toISOString(),
    firebase: {
      projectId: 'ethereal-throne-b20e6',
      identityVerification: 'active',
      firestoreStatus: 'connected',
      accountDirectoryStatus: 'connected',
      accountCount: 1,
      disabledAccountCount: 0,
      accountCountIsLowerBound: false,
    },
    billing: { checkoutMode: 'disabled', checkoutEnabled: false },
    providers: { geminiConfigured: true, openaiConfigured: false, configurationOnly: true },
    stripe: {
      status: 'not_enabled',
      mode: 'disabled',
      periodDays: 0,
      truncated: false,
      currencyTotals: [],
    },
    economics: {
      status: 'connected',
      jobsScanned: 0,
      settledJobs: 0,
      auditedJobs: 0,
      unauditedSettledJobs: 0,
      creditsSpent: 0,
      grossServiceValueMinor: 0,
      estimatedProviderCostMicroUsd: null,
      truncated: false,
    },
    webhooks: {
      status: 'not_enabled',
      appRoute: '/api/stripe/webhook',
      signatureVerification: 'required',
      signingSecretConfigured: false,
      inventoryTruncated: false,
      endpoints: [],
    },
    performance: { uptimeSeconds: 10, rssBytes: 1000, heapUsedBytes: 500, nodeVersion: 'v24.0.0' },
  };

  assert.equal(GetAdminDashboardSummaryResponse.safeParse(summary).success, true);
  const sanitized = GetAdminDashboardSummaryResponse.parse({
    ...summary,
    stripeSecret: 'must never be returned',
  });
  assert.equal('stripeSecret' in sanitized, false);
});
