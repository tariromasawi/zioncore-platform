import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANONYMOUS_RESEARCH_SCOPE,
  CELESTIAL_PROTOCOL_ID,
  createCelestialWaveform,
  createUniversalExperiment,
  createResearchSession,
  crc16Ccitt,
  decodeCelestialSymbols,
  encodeCelestialMessage,
  readResearchSessions,
  researchStorageKeyForOwner,
  researchStorageKeyForScope,
  summarizeResearchPatterns,
  validateResearchSession,
  writeResearchSessions,
} from '@/lib/celestial-experiment';
import { validateUniversalExperiment } from '@/lib/research-grid';

test('CRC-16/CCITT matches the standard check value', () => {
  assert.equal(crc16Ccitt(new TextEncoder().encode('123456789')), 0x29b1);
});

test('versioned experimental symbols round-trip Unicode text', () => {
  const message = 'MWARI NDI MWARI. Tsvakurudzo yakazaruka.';
  const signal = encodeCelestialMessage(message, 50);

  assert.equal(signal.protocolId, CELESTIAL_PROTOCOL_ID);
  assert.equal(signal.symbolDurationMs, 50);
  assert.equal(signal.payloadByteLength, new TextEncoder().encode(message).length);
  assert.equal(decodeCelestialSymbols(signal.symbols), message);
});

test('encoding rejects blank text, unsupported timing, and oversized UTF-8 payloads', () => {
  assert.throws(() => encodeCelestialMessage('  '), /Write a message/);
  assert.throws(() => encodeCelestialMessage('valid', 60), /supported symbol duration/);
  assert.throws(() => encodeCelestialMessage('a'.repeat(121)), /limited to 120 UTF-8 bytes/);
  assert.throws(() => encodeCelestialMessage('é'.repeat(61)), /limited to 120 UTF-8 bytes/);
});

test('decoder rejects damaged packets and invalid sync symbols', () => {
  const signal = encodeCelestialMessage('A clear test packet');
  const damaged = [...signal.symbols];
  damaged[damaged.length - 1] = (damaged[damaged.length - 1] + 1) % 16;
  assert.throws(() => decodeCelestialSymbols(damaged), /checksum failed/);
  assert.throws(() => decodeCelestialSymbols([0, ...signal.symbols.slice(1)]), /sync sequence/);
});

test('waveform is bounded and its duration matches the generated sample count', () => {
  const signal = encodeCelestialMessage('Short sample', 50);
  const waveform = createCelestialWaveform(signal, 0.08);
  const peak = waveform.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);

  assert.ok(waveform.length > 0);
  assert.ok(peak <= 0.12);
  assert.ok(Math.abs(waveform.length / signal.sampleRateHz - signal.durationSeconds) < 0.001);
  assert.throws(() => createCelestialWaveform(signal, 0.5), /between 0.02 and 0.12/);
});

test('research sessions validate and pattern summaries use measured observations only', () => {
  const session = createResearchSession({
    id: '11111111-1111-4111-8111-111111111111',
    now: '2026-11-09T10:00:00.000Z',
  });
  assert.equal(validateResearchSession(session).success, true);

  const withReading = {
    ...session,
    observations: [{
      id: '22222222-2222-4222-8222-222222222222',
      source: {
        type: 'microphone-observation' as const,
        label: 'Browser microphone',
        capturedAt: session.createdAt,
      },
      window: {
        startedAt: session.createdAt,
        endedAt: '2026-11-09T10:00:02.000Z',
        durationSeconds: 2,
        source: 'browser-microphone' as const,
      },
      sampleRateHz: 48000,
      fftSize: 4096,
      frequencyResolutionHz: 48000 / 4096,
      dominantFrequencyHz: 440.625,
      topPeaksHz: [440.625, 880.5],
      rmsLevel: 0.12,
      notes: 'A steady tone was audible.',
    }],
  };
  const summary = summarizeResearchPatterns([withReading]);

  assert.equal(summary?.observationCount, 1);
  assert.equal(summary?.medianDominantFrequencyHz, 440.625);
  assert.match(summary?.limitation ?? '', /do not identify a source/);
  assert.equal(summarizeResearchPatterns([session]), null);
  const secondObservation = {
    ...withReading.observations[0],
    id: '33333333-3333-4333-8333-333333333333',
    dominantFrequencyHz: 600,
  };
  assert.equal(
    summarizeResearchPatterns([{ ...session, observations: [withReading.observations[0], secondObservation] }])
      ?.medianDominantFrequencyHz,
    (440.625 + 600) / 2,
  );
});

test('universal experiments preserve provenance across message, method, instrument, and observation', () => {
  const session = createResearchSession({
    id: '11111111-1111-4111-8111-111111111111',
    now: '2026-11-09T10:00:00.000Z',
    domain: 'environmental-interaction',
  });
  const message = 'A controlled local test.';
  const signal = encodeCelestialMessage(message);
  const observation = {
    id: '22222222-2222-4222-8222-222222222222',
    source: { type: 'microphone-observation' as const, label: 'Browser microphone', capturedAt: session.createdAt },
    window: {
      startedAt: session.createdAt,
      endedAt: '2026-11-09T10:00:02.000Z',
      durationSeconds: 2,
      source: 'browser-microphone' as const,
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625, 880.5],
    rmsLevel: 0.12,
    notes: 'Controlled test note.',
  };
  const completedSession = {
    ...session,
    message: { ...session.message, text: message },
    signal,
    transmission: {
      authorizedAt: session.createdAt,
      completedAt: '2026-11-09T10:00:01.000Z',
      outputChannel: 'local-speaker' as const,
      stoppedEarly: false,
    },
    observations: [observation],
    hypothesis: { statement: 'A testable question.', status: 'open' as const, updatedAt: session.createdAt },
    interpretation: {
      measuredPattern: 'A peak was recorded.',
      uncertainty: 'Room noise was not calibrated.',
      personalReflection: '',
      createdAt: session.createdAt,
    },
  };
  const experiment = createUniversalExperiment(completedSession, 'owner_uid_1');

  assert.equal(validateUniversalExperiment(experiment).success, true);
  assert.equal(experiment.participant.reference, 'owner_uid_1');
  assert.equal(experiment.domain.id, 'environmental-interaction');
  assert.equal(experiment.signal.protocolId, CELESTIAL_PROTOCOL_ID);
  assert.equal(experiment.transmission.externalTransmission, false);
  assert.equal(experiment.results.analysisAgent?.estimatedCostUsd, 0);
  assert.equal(experiment.observations[0]?.modality, 'acoustic');
  assert.ok(experiment.observations[0]?.metrics.some(metric => metric.name === 'dominant-frequency' && metric.unit === 'Hz'));
  assert.equal(experiment.provenance.storage, 'browser-local-unencrypted');
  assert.equal(validateResearchSession({ ...completedSession, universalExperiment: experiment }).success, true);
});

test('local archive namespaces are per authenticated Firebase UID', () => {
  const first = researchStorageKeyForOwner('owner_uid_1');
  const second = researchStorageKeyForOwner('owner_uid_2');
  assert.notEqual(first, second);
  assert.throws(() => researchStorageKeyForOwner(''), /Sign in/);
});

test('local archives round-trip independently per signed-in UID', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    const session = createResearchSession({
      id: '11111111-1111-4111-8111-111111111111',
      now: '2026-11-09T10:00:00.000Z',
    });
    writeResearchSessions('owner_uid_1', [session]);
    const [saved] = readResearchSessions('owner_uid_1');
    assert.equal(saved?.universalExperiment?.schemaVersion, 'zc-cig-experiment/v1');
    assert.equal(saved?.universalExperiment?.participant.reference, 'owner_uid_1');
    const legacyKey = researchStorageKeyForOwner('owner_uid_2');
    const legacyJson = JSON.stringify([session]);
    values.set(legacyKey, legacyJson);
    const [migrated] = readResearchSessions('owner_uid_2');
    assert.equal(migrated?.universalExperiment?.schemaVersion, 'zc-cig-experiment/v1');
    assert.equal(values.get(legacyKey), legacyJson, 'legacy data is not rewritten during read-only migration');
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('anonymous visitor archive stays separate and is labelled as a browser identity', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    const visitorSession = createResearchSession({
      id: '22222222-2222-4222-8222-222222222222',
      now: '2026-11-10T10:00:00.000Z',
    });
    writeResearchSessions(ANONYMOUS_RESEARCH_SCOPE, [visitorSession], 'anonymous-browser');
    const [saved] = readResearchSessions(ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');

    assert.notEqual(
      researchStorageKeyForScope(ANONYMOUS_RESEARCH_SCOPE),
      researchStorageKeyForOwner('owner_uid_1'),
    );
    assert.equal(saved?.universalExperiment?.participant.identityType, 'anonymous-browser');
    assert.equal(saved?.universalExperiment?.participant.reference, ANONYMOUS_RESEARCH_SCOPE);
    assert.equal(readResearchSessions('owner_uid_1').length, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
