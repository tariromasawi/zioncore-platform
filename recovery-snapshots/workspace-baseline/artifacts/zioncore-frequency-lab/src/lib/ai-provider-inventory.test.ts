import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessProviderRuntime,
  CONNECTED_MODEL_PROVIDER,
  EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD,
  FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD,
  GEMINI_FLASH_LITE_STANDARD_PRICING,
} from '@/lib/ai-provider-inventory';

test('inventory identifies the one cloud model path without claiming a live connection', () => {
  assert.equal(CONNECTED_MODEL_PROVIDER.modelId, 'gemini-3.5-flash-lite');
  assert.equal(CONNECTED_MODEL_PROVIDER.modelListedAsSupported, true);
  assert.equal(CONNECTED_MODEL_PROVIDER.configuredInCode, true);
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    projectSecurityConfirmed: false,
  }).liveModelAvailability, 'not-tested');
});

test('runtime readiness distinguishes SDK configuration from token and project checks', () => {
  assert.deepEqual(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    projectSecurityConfirmed: false,
  }), {
    configuration: 'initialized',
    appCheck: 'initialized-token-unverified',
    projectSecurityGate: 'not-confirmed',
    aiRequestsAllowed: false,
    liveModelAvailability: 'not-tested',
    projectQuota: 'not-readable-from-client',
    projectBillingTier: 'not-readable-from-client',
  });
  assert.equal(assessProviderRuntime({
    projectMismatch: true,
    aiConfigured: false,
    appCheckInitialized: false,
    projectSecurityConfirmed: false,
  }).configuration, 'project-mismatch');
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    projectSecurityConfirmed: true,
  }).projectSecurityGate, 'confirmed-by-operator');
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    projectSecurityConfirmed: true,
  }).aiRequestsAllowed, true);
});

test('published paid-tier output pricing matches the configured generation cap', () => {
  assert.equal(GEMINI_FLASH_LITE_STANDARD_PRICING.outputUsdPerMillionTokens, 2.5);
  assert.equal(FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD, 0.00175);
  assert.equal(EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD.toFixed(5), '0.00150');
  assert.equal(CONNECTED_MODEL_PROVIDER.dataSent.length, 4);
  assert.ok(CONNECTED_MODEL_PROVIDER.dataNotSent.includes('Raw audio or microphone recordings'));
  assert.equal(CONNECTED_MODEL_PROVIDER.experimentDesignOutputTokenLimit, 600);
  assert.equal(CONNECTED_MODEL_PROVIDER.experimentDesignDataSent.length, 3);
});
