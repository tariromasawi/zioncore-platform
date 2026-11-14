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

test('microphone discovery does not start capture or prompt for permission', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let getUserMediaCalls = 0;
  let enumerateDevicesCalls = 0;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          getUserMediaCalls += 1;
          return {} as MediaStream;
        },
        enumerateDevices: async () => {
          enumerateDevicesCalls += 1;
          return [{ kind: 'audioinput' }] as MediaDeviceInfo[];
        },
      },
      permissions: {
        query: async () => ({ state: 'prompt' }),
      },
    } as unknown as Navigator,
  });

  try {
    const discovery = await browserMicrophoneInstrument.discover();
    assert.equal(discovery.permission, 'prompt');
    assert.equal(discovery.status, 'permission-required');
    assert.equal(discovery.availableInputCount, 1);
    assert.equal(enumerateDevicesCalls, 1);
    assert.equal(getUserMediaCalls, 0);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

test('microphone acquisition records negotiated settings and releases the user-granted stream', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let requestedConstraints: MediaStreamConstraints | undefined;
  let stoppedTracks = 0;
  const track = {
    getSettings: () => ({ sampleRate: 44_100, channelCount: 2 }),
    stop: () => { stoppedTracks += 1; },
  } as unknown as MediaStreamTrack;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          requestedConstraints = constraints;
          return stream;
        },
      },
    } as unknown as Navigator,
  });

  try {
    const lease = await browserMicrophoneInstrument.acquire();
    assert.equal(lease.instrumentId, browserMicrophoneInstrument.descriptor.id);
    assert.equal(lease.actualSettings.sampleRateHz, 44_100);
    assert.equal(lease.actualSettings.inputChannels, 2);
    assert.equal(lease.calibration.status, 'uncalibrated');
    assert.equal(Number.isNaN(Date.parse(lease.acquiredAt)), false);
    assert.deepEqual(requestedConstraints?.audio, {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });

    await browserMicrophoneInstrument.release(lease);
    assert.equal(stoppedTracks, 1);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
