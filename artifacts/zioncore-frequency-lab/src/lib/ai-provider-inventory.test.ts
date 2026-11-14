import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessProviderRuntime,
  CONNECTED_MODEL_PROVIDER,
  EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD,
  FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD,
  GEMINI_3_8_FLASH_STANDARD_PRICING,
} from '@/lib/ai-provider-inventory';

test('inventory identifies the one cloud model path without claiming a live connection', () => {
  assert.equal(CONNECTED_MODEL_PROVIDER.modelId, 'gemini-3.8-flash');
  assert.equal(CONNECTED_MODEL_PROVIDER.modelListedAsSupported, true);
  assert.equal(CONNECTED_MODEL_PROVIDER.configuredInCode, true);
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    appCheckTokenExchangeVerified: false,
    projectSecurityConfirmed: false,
    costGuardedBackendAvailable: false,
  }).liveModelAvailability, 'not-tested');
});

test('runtime readiness distinguishes SDK configuration from token and project checks', () => {
  assert.deepEqual(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    appCheckTokenExchangeVerified: false,
    projectSecurityConfirmed: false,
    costGuardedBackendAvailable: false,
  }), {
    configuration: 'initialized',
    appCheck: 'initialized-token-unverified',
    projectSecurityGate: 'not-confirmed',
    requestPath: 'disabled-no-cost-quoted-route',
    aiRequestsAllowed: false,
    liveModelAvailability: 'not-tested',
    projectQuota: 'not-readable-from-client',
    projectBillingTier: 'not-readable-from-client',
  });
  assert.equal(assessProviderRuntime({
    projectMismatch: true,
    aiConfigured: false,
    appCheckInitialized: false,
    appCheckTokenExchangeVerified: false,
    projectSecurityConfirmed: false,
    costGuardedBackendAvailable: false,
  }).configuration, 'project-mismatch');
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    appCheckTokenExchangeVerified: true,
    projectSecurityConfirmed: true,
    costGuardedBackendAvailable: false,
  }).projectSecurityGate, 'confirmed-by-operator');
  assert.equal(assessProviderRuntime({
    projectMismatch: false,
    aiConfigured: true,
    appCheckInitialized: true,
    appCheckTokenExchangeVerified: true,
    projectSecurityConfirmed: true,
    costGuardedBackendAvailable: true,
  }).aiRequestsAllowed, true);
});

test('published Gemini 3.8 Flash prices match conservative output-token ceilings', () => {
  assert.equal(GEMINI_3_8_FLASH_STANDARD_PRICING.inputUsdPerMillionTokens, 0.75);
  assert.equal(GEMINI_3_8_FLASH_STANDARD_PRICING.outputUsdPerMillionTokens, 3.75);
  assert.equal(FREQUENCY_EXPLANATION_OUTPUT_COST_CEILING_USD, 0.002625);
  assert.equal(EXPERIMENT_DESIGN_OUTPUT_COST_CEILING_USD, 0.00225);
  assert.equal(CONNECTED_MODEL_PROVIDER.dataSent.length, 4);
  assert.ok(CONNECTED_MODEL_PROVIDER.dataNotSent.includes('Raw audio or microphone recordings'));
  assert.equal(CONNECTED_MODEL_PROVIDER.experimentDesignOutputTokenLimit, 600);
  assert.equal(CONNECTED_MODEL_PROVIDER.experimentDesignDataSent.length, 3);
});
