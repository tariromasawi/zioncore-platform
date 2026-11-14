import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserMicrophoneInstrument } from '@/lib/hardware-instruments';
import {
  createInstrumentProvenance,
  instrumentProvenanceSchema,
  INSTRUMENT_SOFTWARE_VERSION,
} from '@/lib/instrument-provenance';

test('microphone provenance records the adapter, units, calibration, and software version', () => {
  const provenance = createInstrumentProvenance(
    'browser-microphone',
    browserMicrophoneInstrument.descriptor,
  );

  assert.equal(instrumentProvenanceSchema.safeParse(provenance).success, true);
  assert.equal(provenance.instrumentId, browserMicrophoneInstrument.descriptor.id);
  assert.equal(provenance.physicalDeviceIdentity, 'not-collected');
  assert.equal(provenance.calibration.status, 'uncalibrated');
  assert.equal(provenance.units.frequency, 'Hz');
  assert.equal(provenance.units.amplitude, 'FS');
  assert.equal(provenance.softwareVersion, INSTRUMENT_SOFTWARE_VERSION);
  assert.match(provenance.softwareVersion, /zioncore-frequency-lab@/);
});

test('local WAV provenance is not mislabeled as a physical instrument measurement', () => {
  const provenance = createInstrumentProvenance('local-wav-file');

  assert.equal(provenance.instrumentId, 'instrument.local-wav-import');
  assert.equal(provenance.instrumentName, 'Local WAV file importer');
  assert.equal(provenance.inputChannels, null);
  assert.equal(provenance.calibration.status, 'uncalibrated');
  assert.match(provenance.calibration.reference, /not interpreted or applied/);
});

test('provenance schema rejects unexpected hardware identifiers and units', () => {
  const provenance = createInstrumentProvenance('browser-microphone');
  assert.equal(instrumentProvenanceSchema.safeParse({
    ...provenance,
    physicalDeviceIdentity: 'captured-device-id',
  }).success, false);
  assert.equal(instrumentProvenanceSchema.safeParse({
    ...provenance,
    units: { ...provenance.units, amplitude: 'dB SPL' },
  }).success, false);
});
