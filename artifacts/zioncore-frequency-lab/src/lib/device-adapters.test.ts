import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AdapterRegistry,
  browserCapabilitySummary,
  createDefaultAdapterRegistry,
  detectBrowserCapabilities,
  DEVICE_ADAPTERS,
  validateSignalEnvelope,
  ZIONCORE_ADAPTER_SDK_VERSION,
} from './device-adapters';

test('registers the named adapter profiles with separate signal domains', () => {
  const registry = createDefaultAdapterRegistry();
  assert.equal(registry.list().length, DEVICE_ADAPTERS.length);
  assert.equal(registry.get('rtl-sdr-blog-v4')?.manifest.category, 'radio-iq');
  assert.equal(registry.get('phidget-mot0100')?.manifest.category, 'acceleration');
  assert.equal(registry.get('audiomoth-1-2')?.manifest.category, 'acoustic-pressure');
  assert.equal(registry.get('echo-meter-touch-2-pro')?.manifest.integrationStatus, 'file-path');
});

test('rejects duplicate adapters and incompatible SDK majors', () => {
  const registry = createDefaultAdapterRegistry();
  const manifest = DEVICE_ADAPTERS[0];
  assert.throws(() => registry.register({
    manifest,
    sdkVersion: ZIONCORE_ADAPTER_SDK_VERSION,
    validatePayload: () => true,
  }), /already registered/);
  const emptyRegistry = new AdapterRegistry();
  assert.throws(() => emptyRegistry.register({
    manifest: DEVICE_ADAPTERS[1],
    sdkVersion: '2.0.0',
    validatePayload: () => true,
  }), /major version/);
});

test('detects only APIs exposed by the browser and reports unavailable paths clearly', () => {
  const fakeNavigator = {
    platform: 'TestOS',
    userAgent: 'TestBrowser',
    mediaDevices: { getUserMedia: () => Promise.resolve({}) },
  } as unknown as Navigator;
  const fakeBrowser = {
    isSecureContext: false,
    navigator: fakeNavigator,
  } as Pick<Window, 'isSecureContext' | 'navigator'>;
  const capabilities = detectBrowserCapabilities(fakeBrowser);
  assert.equal(capabilities.secureContext, false);
  assert.equal(capabilities.mediaDevices, true);
  assert.equal(capabilities.webUsb, false);
  assert.equal(capabilities.webSerial, false);
  assert.equal(capabilities.platform, 'TestOS');
  assert.ok(browserCapabilitySummary(capabilities).some(value => value.includes('Secure context required')));
});

test('validates universal signal envelopes without equating acoustic, RF, and acceleration data', () => {
  const acoustic = {
    schemaVersion: 1,
    adapterId: 'generic-browser-microphone',
    signalDomain: 'acoustic-pressure',
    capturedAt: new Date(0).toISOString(),
    sampleRateHz: 48_000,
    calibration: { status: 'uncalibrated' },
    payload: {
      kind: 'acoustic-pressure',
      samples: new Float32Array([0, 0.2, -0.2]),
      unit: 'relative-digital-amplitude',
    },
  } as const;
  assert.equal(validateSignalEnvelope(acoustic, { id: 'generic-browser-microphone', category: 'acoustic-pressure' }), true);
  assert.equal(validateSignalEnvelope(acoustic, { id: 'rtl-sdr-blog-v4', category: 'radio-iq' }), false);
  assert.equal(validateSignalEnvelope({
    ...acoustic,
    payload: { kind: 'radio-iq', samples: new ArrayBuffer(16), format: 'cf32', centerFrequencyHz: 100_000_000 },
  }), false, 'payload domain cannot disagree with envelope domain');
  assert.equal(validateSignalEnvelope({
    ...acoustic,
    signalDomain: 'acceleration',
    payload: { kind: 'acceleration', x: new Float32Array([1]), y: new Float32Array([]), z: new Float32Array([1]), unit: 'g' },
  }), false, 'mismatched axis lengths must be rejected');
});
