import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserMicrophoneInstrument } from '@/lib/hardware-instruments';
import {
  normalizeInstrumentMeasurement,
  normalizeSensorObservation,
  SENSOR_ADAPTER_CONTRACT_VERSION,
  sensorObservationSchema,
  type InstrumentSensorAdapter,
  type SensorAdapterContext,
  type SensorMeasurementAdapter,
} from '@/lib/sensor-adapter-contract';

const liveContext: SensorAdapterContext = {
  observationId: '9e122b3c-d0e8-43b0-81e2-c995df02d333',
  instrumentId: 'instrument.browser-microphone-web-audio',
  modality: 'acoustic',
  sourceType: 'live',
  time: {
    observedStartAt: '2026-11-12T10:00:00.000Z',
    observedEndAt: '2026-11-12T10:00:02.000Z',
    receivedAt: '2026-11-12T10:00:02.010Z',
    clock: 'host-utc',
    uncertaintyMs: null,
  },
  permission: { status: 'granted', scope: 'microphone', userInitiated: true },
  calibration: {
    status: 'uncalibrated',
    checkedAt: null,
    reference: 'No absolute SPL calibration was applied.',
  },
};

type AcousticInput = { dominantFrequencyHz: number; rmsLevel: number };

const acousticAdapter: SensorMeasurementAdapter<AcousticInput> = {
  id: 'adapter.browser-acoustic-spectrum',
  version: '1.0.0',
  modality: 'acoustic',
  normalize(input, context) {
    return {
      contractVersion: SENSOR_ADAPTER_CONTRACT_VERSION,
      ...context,
      channels: [
        { id: 'dominant-frequency', unit: 'Hz', values: [input.dominantFrequencyHz], sampleRateHz: null },
        { id: 'rms-amplitude', unit: 'full-scale-fraction', values: [input.rmsLevel], sampleRateHz: null },
      ],
      provenance: {
        adapterId: this.id,
        adapterVersion: this.version,
        acquisitionMethod: 'browser-microphone',
        classification: 'measured',
        softwareVersion: 'zioncore-frequency-lab@0.0.0',
        sourceLabel: 'Browser microphone spectral summary',
        physicalDeviceIdentity: 'not-collected',
      },
    };
  },
};

test('adapter normalization keeps units, UTC observation times, permission, calibration, and provenance together', () => {
  const result = normalizeSensorObservation(acousticAdapter, {
    dominantFrequencyHz: 440.5,
    rmsLevel: 0.12,
  }, liveContext);

  assert.equal(result.contractVersion, SENSOR_ADAPTER_CONTRACT_VERSION);
  assert.equal(result.time.observedStartAt, liveContext.time.observedStartAt);
  assert.equal(result.time.receivedAt, liveContext.time.receivedAt);
  assert.equal(result.permission.status, 'granted');
  assert.equal(result.calibration.status, 'uncalibrated');
  assert.deepEqual(result.channels.map(channel => channel.unit), ['Hz', 'full-scale-fraction']);
  assert.equal(result.provenance.classification, 'measured');
  assert.equal(result.provenance.physicalDeviceIdentity, 'not-collected');
});

test('imported, simulated, and provider data must declare their correct permission and source classifications', () => {
  const validImported = {
    ...normalizeSensorObservation(acousticAdapter, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext),
    sourceType: 'imported',
    permission: { status: 'not-required', scope: 'file-selection', userInitiated: true },
    provenance: {
      ...normalizeSensorObservation(acousticAdapter, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext).provenance,
      acquisitionMethod: 'local-file',
      classification: 'imported',
    },
  };
  assert.equal(sensorObservationSchema.safeParse(validImported).success, true);
  assert.equal(sensorObservationSchema.safeParse({
    ...validImported,
    permission: { status: 'granted', scope: 'microphone', userInitiated: true },
  }).success, false);

  const simulated = {
    ...validImported,
    sourceType: 'simulated',
    permission: { status: 'not-required', scope: 'none', userInitiated: false },
    provenance: {
      ...validImported.provenance,
      acquisitionMethod: 'synthetic',
      classification: 'simulated',
    },
  };
  assert.equal(sensorObservationSchema.safeParse(simulated).success, true);
  assert.equal(sensorObservationSchema.safeParse({
    ...simulated,
    provenance: { ...simulated.provenance, classification: 'measured' },
  }).success, false);

  const provider = {
    ...validImported,
    sourceType: 'provider-derived',
    permission: { status: 'not-required', scope: 'provider-feed', userInitiated: false },
    provenance: {
      ...validImported.provenance,
      acquisitionMethod: 'provider-api',
      classification: 'provider-derived',
    },
  };
  assert.equal(sensorObservationSchema.safeParse(provider).success, true);
});

test('strict schemas reject unknown units, device identifiers, coordinates, and non-finite values', () => {
  const valid = normalizeSensorObservation(acousticAdapter, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    channels: [{ ...valid.channels[0], unit: 'guessed-units' }],
  }).success, false);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    physicalDeviceId: 'browser-hardware-id',
  }).success, false);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    location: { latitude: 51.5, longitude: -0.1 },
  }).success, false);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    channels: [{ ...valid.channels[0], values: [Number.NaN] }],
  }).success, false);
});

test('timestamps must be valid and ordered, and channel payloads are bounded', () => {
  const valid = normalizeSensorObservation(acousticAdapter, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    time: { ...valid.time, observedEndAt: '2026-11-12T09:59:59.000Z' },
  }).success, false);
  assert.equal(sensorObservationSchema.safeParse({
    ...valid,
    time: { ...valid.time, receivedAt: 'not-a-timestamp' },
  }).success, false);

  const oversized = {
    ...valid,
    channels: [
      { id: 'channel-a', unit: 'count', values: new Array(25_000).fill(1), sampleRateHz: null },
      { id: 'channel-b', unit: 'count', values: new Array(25_001).fill(1), sampleRateHz: null },
    ],
  };
  assert.equal(sensorObservationSchema.safeParse(oversized).success, false);

  assert.throws(
    () => normalizeSensorObservation({
      ...acousticAdapter,
      normalize(input, context) {
        const valid = acousticAdapter.normalize(input, context);
        return {
          ...valid,
          channels: [
            { id: 'channel-a', unit: 'count', values: new Array(25_000).fill(1), sampleRateHz: null },
            { id: 'channel-b', unit: 'count', values: new Array(25_001).fill(1), sampleRateHz: null },
          ],
        };
      },
    }, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext),
    /more than 50000 values/,
  );
});

test('normalization rejects modality, adapter version, or acquisition-context mismatches', () => {
  assert.throws(
    () => normalizeSensorObservation({
      ...acousticAdapter,
      modality: 'geophysical',
    }, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext),
    /modality does not match/,
  );
  assert.throws(
    () => normalizeSensorObservation({
      ...acousticAdapter,
      version: 'invalid',
    }, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext),
    /stable ID and semantic version/,
  );
  assert.throws(
    () => normalizeSensorObservation({
      ...acousticAdapter,
      normalize(input, context) {
        return {
          ...acousticAdapter.normalize(input, context),
          instrumentId: 'instrument.other-microphone',
        };
      },
    }, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, liveContext),
    /does not match the supplied acquisition context/,
  );
});

test('instrument lifecycle adapters pair with a matching measurement normalizer', () => {
  const adapter: InstrumentSensorAdapter<AcousticInput> = {
    ...browserMicrophoneInstrument,
    measurementAdapterId: acousticAdapter.id,
    measurementAdapterVersion: acousticAdapter.version,
    measurementModality: 'acoustic',
    normalizeMeasurement: (input, context) => acousticAdapter.normalize(input, context),
  };
  const result = normalizeInstrumentMeasurement(adapter, {
    dominantFrequencyHz: 440,
    rmsLevel: 0.1,
  }, liveContext);
  assert.equal(result.instrumentId, browserMicrophoneInstrument.descriptor.id);

  assert.throws(
    () => normalizeInstrumentMeasurement(adapter, { dominantFrequencyHz: 440, rmsLevel: 0.1 }, {
      ...liveContext,
      sourceType: 'simulated',
    }),
    /source type does not match/,
  );
});
