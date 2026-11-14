import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deleteObservationsFromStorage,
  getObservationStorageKey,
  readObservationsForExport,
  readVerifiedObservations,
  toCsv,
  upsertObservation,
  type Observation,
  type SavedInterpretation,
} from '@/lib/observations';
import { browserMicrophoneInstrument } from '@/lib/hardware-instruments';
import { createInstrumentProvenance } from '@/lib/instrument-provenance';

const observation = (id: string, dominantFrequencyHz = 440.625): Observation => ({
  id,
  createdAt: '2026-11-09T20:00:00.000Z',
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz,
  topPeaksHz: [dominantFrequencyHz],
  rmsLevel: 0.12,
  durationSeconds: 8,
  mode: 'microphone',
});

function withMockLocalStorage(values: Map<string, string>, callback: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    callback();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('upsert adds a new observation to the start of history', () => {
  const existing = observation('older');
  const newest = observation('newest');
  assert.deepEqual(upsertObservation([existing], newest), [newest, existing]);
});

test('upsert replaces only the measurement with the same capture ID', () => {
  const existing = observation('capture-1');
  const revised = { ...existing, dominantFrequencyHz: 880.5, topPeaksHz: [880.5] };
  assert.deepEqual(upsertObservation([existing], revised), [revised]);
});

test('CSV export keeps interpretations separate and links them to exact observations', () => {
  const item: Observation = {
    ...observation('capture-export'),
    notes: 'room, "quiet"',
    instrumentProvenance: createInstrumentProvenance(
      'browser-microphone',
      browserMicrophoneInstrument.descriptor,
    ),
  };
  const interpretation: SavedInterpretation = {
    scientificInterpretation: 'A narrow peak was measured.',
    confidence: 'low',
    uncertainty: 'The source is not identified.',
    possibleSources: ['A steady tone', 'Room equipment'],
    evidenceUsed: ['Dominant frequency bin: 440.63 Hz.'],
    limitations: ['RMS is not calibrated sound pressure.'],
    faithReflection: 'Personal reflection only.',
    model: 'gemini-3.8-flash',
    provenance: {
      source: 'ai-generated',
      observationId: 'capture-export',
      methodId: 'frequency-measurement-explanation',
      methodVersion: '1.0.0',
      promptVersion: '1.0.0',
      provider: 'firebase-ai-google',
      modelId: 'gemini-3.8-flash',
      generatedAt: '2026-11-12T10:00:00.000Z',
      clientRoundTripMs: 842,
    },
  };
  const [header, row] = toCsv([item], [interpretation]).split('\n');
  assert.match(header, /interpretationScientificInterpretation/);
  assert.match(header, /interpretationPossibleSources/);
  assert.match(header, /interpretationEvidenceUsed/);
  assert.match(header, /interpretationLimitations/);
  assert.match(header, /interpretationObservationId/);
  assert.match(header, /interpretationMethodVersion/);
  assert.match(header, /interpretationGeneratedAt/);
  assert.match(header, /interpretationClientRoundTripMs/);
  assert.match(header, /instrumentName/);
  assert.match(header, /calibrationStatus/);
  assert.match(row, /"room, ""quiet"""/);
  assert.match(row, /"browser-microphone"/);
  assert.match(row, /"capture-export"/);
  assert.match(row, /"frequency-measurement-explanation"/);
  assert.match(row, /"2026-11-12T10:00:00.000Z"/);
  assert.match(row, /"842"/);
  assert.match(row, /"FS"/);
  assert.match(row, /"not-collected"/);
  assert.match(row, /"A narrow peak was measured\."/);
  assert.match(row, /"A steady tone;Room equipment"/);
  assert.match(row, /"Dominant frequency bin: 440\.63 Hz\."/);
  assert.match(row, /"RMS is not calibrated sound pressure\."/);
});

test('CSV export refuses interpretation records linked to another observation', () => {
  assert.throws(
    () => toCsv([observation('record-1')], [{
      scientificInterpretation: 'A narrow peak was measured.',
      confidence: 'low',
      uncertainty: 'The source is not identified.',
      possibleSources: ['A steady tone'],
      faithReflection: null,
      model: 'gemini-3.8-flash',
      provenance: {
        source: 'ai-generated',
        observationId: 'record-2',
        methodId: 'frequency-measurement-explanation',
        methodVersion: '1.0.0',
        promptVersion: '1.0.0',
        provider: 'firebase-ai-google',
        modelId: 'gemini-3.8-flash',
        generatedAt: '2026-11-12T10:00:00.000Z',
      },
    }]),
    /uniquely linked to one included observation/,
  );
});

test('account-local observation archives are isolated without migrating legacy device records', () => {
  const firstAccount = getObservationStorageKey('uid/one');
  const secondAccount = getObservationStorageKey('uid/two');
  const legacyDevice = getObservationStorageKey();

  assert.notEqual(firstAccount, secondAccount);
  assert.notEqual(firstAccount, legacyDevice);
  assert.match(firstAccount, /\.account\.uid%2Fone$/);
  assert.equal(legacyDevice, 'zioncore.frequency-lab.observations.v1');
});

test('deletion removes only selected records from the explicitly targeted account archive', () => {
  const firstAccountKey = getObservationStorageKey('uid-one');
  const secondAccountKey = getObservationStorageKey('uid-two');
  const visitorKey = getObservationStorageKey();
  const untouchedSecondAccount = JSON.stringify([observation('second-account-record')]);
  const untouchedVisitor = JSON.stringify([observation('visitor-record')]);
  const values = new Map([
    [firstAccountKey, JSON.stringify([observation('remove-this'), observation('keep-this')])],
    [secondAccountKey, untouchedSecondAccount],
    [visitorKey, untouchedVisitor],
  ]);

  withMockLocalStorage(values, () => {
    assert.deepEqual(
      deleteObservationsFromStorage(['remove-this'], 'uid-one'),
      [observation('keep-this')],
    );
  });

  assert.deepEqual(JSON.parse(values.get(firstAccountKey)!), [observation('keep-this')]);
  assert.equal(values.get(secondAccountKey), untouchedSecondAccount);
  assert.equal(values.get(visitorKey), untouchedVisitor);
});

test('deletion refuses to rewrite an archive containing invalid records', () => {
  const key = getObservationStorageKey('uid-one');
  const originalValue = JSON.stringify([observation('valid'), { id: 'invalid' }]);
  const values = new Map([[key, originalValue]]);

  withMockLocalStorage(values, () => {
    assert.throws(
      () => deleteObservationsFromStorage(['valid'], 'uid-one'),
      /invalid record.*No records were deleted/i,
    );
  });

  assert.equal(values.get(key), originalValue);
});

test('deletion refuses ambiguous duplicate observation IDs', () => {
  const key = getObservationStorageKey('uid-one');
  const originalValue = JSON.stringify([observation('duplicate'), observation('duplicate', 880)]);
  const values = new Map([[key, originalValue]]);

  withMockLocalStorage(values, () => {
    assert.throws(
      () => deleteObservationsFromStorage(['duplicate'], 'uid-one'),
      /duplicate record IDs.*No records were deleted/i,
    );
  });

  assert.equal(values.get(key), originalValue);
});

test('export refuses to silently omit invalid account records', () => {
  const key = getObservationStorageKey('uid-one');
  const originalValue = JSON.stringify([observation('valid'), { id: 'invalid' }]);
  const values = new Map([[key, originalValue]]);

  withMockLocalStorage(values, () => {
    assert.throws(
      () => readObservationsForExport('uid-one'),
      /invalid record.*No export was created/i,
    );
  });

  assert.equal(values.get(key), originalValue);
});

test('verified account reads distinguish empty archives from unreadable or invalid storage', () => {
  const key = getObservationStorageKey('uid-one');
  const values = new Map<string, string>();
  withMockLocalStorage(values, () => {
    assert.deepEqual(readVerifiedObservations('uid-one'), []);
    values.set(key, '[]');
    assert.deepEqual(readVerifiedObservations('uid-one'), []);
    for (const invalid of ['{broken', '{}', '[{"id":"incomplete"}]']) {
      values.set(key, invalid);
      assert.throws(() => readVerifiedObservations('uid-one'), /Stored records were left unchanged/);
      assert.equal(values.get(key), invalid);
    }
  });
});
