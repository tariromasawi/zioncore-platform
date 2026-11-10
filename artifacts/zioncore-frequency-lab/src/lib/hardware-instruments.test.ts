import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  InstrumentRegistry,
  browserMicrophoneInstrument,
  developmentToneSimulator,
  instrumentRegistry,
} from '@/lib/hardware-instruments';

test('the browser microphone is registered as live and explicitly uncalibrated', () => {
  const descriptor = instrumentRegistry.get(browserMicrophoneInstrument.descriptor.id)?.descriptor;
  assert.equal(descriptor?.sourceType, 'live');
  assert.equal(descriptor?.kind, 'microphone');
  assert.equal(descriptor?.calibration.status, 'uncalibrated');
  assert.deepEqual(descriptor?.modalities, ['acoustic']);
});

test('simulated instruments are unavailable outside development builds', async () => {
  const productionRegistry = new InstrumentRegistry('production');
  assert.throws(() => productionRegistry.register(developmentToneSimulator), /development builds/);
  assert.throws(() => new InstrumentRegistry('development'), /production build/);
  await assert.rejects(developmentToneSimulator.acquire(), /development builds/);
  assert.equal((await developmentToneSimulator.discover()).status, 'unsupported');
});

test('instrument discovery reports unsupported environments without requesting permission', async () => {
  const discovery = await browserMicrophoneInstrument.discover();
  if (typeof navigator === 'undefined') {
    assert.equal(discovery.status, 'unsupported');
    assert.equal(discovery.availableInputCount, null);
  } else {
    assert.ok(['ready', 'permission-required', 'permission-denied', 'unsupported', 'insecure-context'].includes(discovery.status));
  }
});
