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
  decodeCelestialSymbolText,
  CELESTIAL_MAX_SYMBOLS,
  encodeCelestialMessage,
  readResearchSessions,
  researchStorageKeyForOwner,
  researchStorageKeyForScope,
  reviseResearchHypothesis,
  USER_AUTHORED_INTERPRETATION_METHOD_ID,
  USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
  summarizeResearchPatterns,
  validateResearchSession,
  writeResearchSessions,
} from '@/lib/celestial-experiment';
import { validateUniversalExperiment } from '@/lib/research-grid';
import { createInstrumentProvenance } from '@/lib/instrument-provenance';

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

test('golden DTMF v1 symbol fixture remains byte-for-byte decodable', () => {
  const message = 'MWARI NDI MWARI.';
  const goldenHex = 'FFA55A430100104D57415249204E4449204D574152492EE097';
  const signal = encodeCelestialMessage(message, 75);
  const encodedHex = signal.symbols
    .map(symbol => symbol.toString(16).toUpperCase())
    .join('');

  assert.equal(signal.protocolId, CELESTIAL_PROTOCOL_ID);
  assert.equal(signal.sampleRateHz, 44_100);
  assert.equal(signal.durationSeconds, 4.35);
  assert.equal(encodedHex, goldenHex);
  assert.equal(decodeCelestialSymbolText(goldenHex), message);
  assert.equal(decodeCelestialSymbols(signal.symbols), message);
});

test('hexadecimal packet text decodes locally with optional separators', () => {
  const message = 'A local decoder test';
  const signal = encodeCelestialMessage(message);
  const hexSymbols = signal.symbols.map(symbol => symbol.toString(16).toUpperCase()).join('');

  assert.equal(decodeCelestialSymbolText(hexSymbols), message);
  assert.equal(decodeCelestialSymbolText([...hexSymbols].join(' ')), message);
  assert.equal(decodeCelestialSymbolText(signal.symbols.map(symbol => symbol.toString(16)).join(',')), message);
  assert.equal(encodeCelestialMessage('x'.repeat(120)).symbols.length, CELESTIAL_MAX_SYMBOLS);
  assert.throws(() => decodeCelestialSymbolText(''), /Paste the hexadecimal symbol sequence/);
  assert.throws(() => decodeCelestialSymbolText('not-hex'), /Use hexadecimal symbols/);
  assert.throws(
    () => decodeCelestialSymbolText('A'.repeat(CELESTIAL_MAX_SYMBOLS + 1)),
    /cannot exceed/,
  );
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
      instrumentId: 'instrument.browser-microphone-web-audio',
      instrumentProvenance: createInstrumentProvenance('browser-microphone'),
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
  assert.equal(validateResearchSession(withReading).success, true);
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

test('user-authored interpretation provenance links to the exact observation and survives experiment mapping', () => {
  const session = createResearchSession({
    id: '66666666-6666-4666-8666-666666666666',
    now: '2026-11-09T10:00:00.000Z',
  });
  const observation: ResearchObservation = {
    id: '77777777-7777-4777-8777-777777777777',
    source: {
      type: 'microphone-observation',
      label: 'Browser microphone',
      capturedAt: session.createdAt,
    },
    window: {
      startedAt: session.createdAt,
      endedAt: '2026-11-09T10:00:02.000Z',
      durationSeconds: 2,
      source: 'browser-microphone',
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625],
    rmsLevel: 0.1,
    notes: '',
  };
  const interpretation = {
    measuredPattern: 'A stable peak appeared in this window.',
    uncertainty: 'The source is not identified.',
    personalReflection: '',
    createdAt: '2026-11-09T10:00:03.000Z',
    provenance: {
      source: 'user-authored' as const,
      observationId: observation.id,
      methodId: USER_AUTHORED_INTERPRETATION_METHOD_ID,
      methodVersion: USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
    },
  };
  const linked = { ...session, observations: [observation], interpretation };
  assert.equal(validateResearchSession(linked).success, true);

  const experiment = createUniversalExperiment(linked, ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');
  assert.equal(experiment.interpretation?.provenance?.observationId, observation.id);
  assert.equal(validateUniversalExperiment(experiment).success, true);
  assert.equal(validateResearchSession({
    ...linked,
    interpretation: {
      ...interpretation,
      provenance: { ...interpretation.provenance, observationId: '88888888-8888-4888-8888-888888888888' },
    },
  }).success, false);
  assert.equal(validateUniversalExperiment({
    ...experiment,
    interpretation: {
      ...experiment.interpretation!,
      provenance: { ...interpretation.provenance, observationId: '88888888-8888-4888-8888-888888888888' },
    },
  }).success, false);
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

test('end-to-end local session encodes, previews, analyzes, saves, and exports its research record', () => {
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
      id: '44444444-4444-4444-8444-444444444444',
      now: '2026-11-09T10:00:00.000Z',
    });
    const message = 'Controlled local research test.';
    const signal = encodeCelestialMessage(message, 75);
    const waveform = createCelestialWaveform(signal, 0.04);
    assert.ok(waveform.length > 0, 'the generated preview contains real audio samples');
    assert.ok(Math.max(...waveform.slice(0, 1000).map(Math.abs)) <= 0.04);
    assert.equal(decodeCelestialSymbols(signal.symbols), message);

    const observation = {
      id: '55555555-5555-4555-8555-555555555555',
      instrumentId: 'instrument.browser-microphone-web-audio',
      instrumentProvenance: createInstrumentProvenance('browser-microphone'),
      source: {
        type: 'microphone-observation' as const,
        label: 'Controlled test observation fixture',
        capturedAt: '2026-11-09T10:00:05.000Z',
      },
      window: {
        startedAt: '2026-11-09T10:00:03.000Z',
        endedAt: '2026-11-09T10:00:05.000Z',
        durationSeconds: 2,
        source: 'browser-microphone' as const,
      },
      sampleRateHz: 48000,
      fftSize: 4096,
      frequencyResolutionHz: 48000 / 4096,
      dominantFrequencyHz: 440.625,
      topPeaksHz: [440.625, 880.5],
      rmsLevel: 0.12,
      notes: 'Deterministic fixture for the saved-session pipeline; no microphone was activated.',
    };
    const completedSession = {
      ...session,
      message: {
        text: message,
        intent: 'research-message' as const,
        source: { type: 'human-authored' as const, label: 'User-composed text', capturedAt: session.createdAt },
      },
      signal,
      transmission: {
        authorizedAt: '2026-11-09T10:00:01.000Z',
        completedAt: '2026-11-09T10:00:02.000Z',
        outputChannel: 'local-speaker' as const,
        stoppedEarly: false,
      },
      observationWindow: observation.window,
      observations: [observation],
      interpretation: {
        measuredPattern: 'One fixture peak at 440.625 Hz.',
        uncertainty: 'The fixture does not represent a real environment.',
        personalReflection: '',
        createdAt: '2026-11-09T10:00:06.000Z',
      },
      hypothesis: {
        statement: 'A controlled question to revisit.',
        status: 'open' as const,
        updatedAt: '2026-11-09T10:00:06.000Z',
      },
    };

    const analysis = summarizeResearchPatterns([completedSession]);
    assert.equal(analysis?.observationCount, 1);
    assert.equal(analysis?.medianDominantFrequencyHz, 440.625);
    assert.match(analysis?.limitation ?? '', /do not identify a source/);

    const record = {
      ...completedSession,
      universalExperiment: createUniversalExperiment(completedSession, ANONYMOUS_RESEARCH_SCOPE),
    };
    assert.equal(validateResearchSession(record).success, true);
    writeResearchSessions(ANONYMOUS_RESEARCH_SCOPE, [record], 'anonymous-browser');

    const [saved] = readResearchSessions(ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');
    assert.equal(saved?.message.text, message);
    assert.equal(saved?.transmission?.outputChannel, 'local-speaker');
    assert.equal(saved?.observations[0]?.instrumentProvenance?.softwareVersion, createInstrumentProvenance('browser-microphone').softwareVersion);
    assert.equal(saved?.universalExperiment?.signal.protocolId, CELESTIAL_PROTOCOL_ID);
    const exported = JSON.stringify(saved);
    assert.match(exported, /Controlled local research test/);
    assert.match(exported, /instrumentProvenance/);
    assert.match(exported, /universalExperiment/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('hypothesis revisions preserve earlier user wording and leave observations separate', () => {
  const session = createResearchSession({
    id: '66666666-6666-4666-8666-666666666666',
    now: '2026-11-09T10:00:00.000Z',
  });
  const observation = {
    id: '77777777-7777-4777-8777-777777777777',
    source: {
      type: 'microphone-observation' as const,
      label: 'Local microphone',
      capturedAt: '2026-11-09T10:00:02.000Z',
    },
    window: {
      startedAt: '2026-11-09T10:00:00.000Z',
      endedAt: '2026-11-09T10:00:02.000Z',
      durationSeconds: 2,
      source: 'browser-microphone' as const,
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625],
    rmsLevel: 0.08,
    notes: 'Original measurement.',
  };
  const withObservation = {
    ...session,
    observations: [observation],
    interpretation: {
      measuredPattern: 'A measured peak at 440.625 Hz.',
      uncertainty: 'The microphone is not calibrated.',
      personalReflection: 'I will revisit this later.',
      createdAt: '2026-11-09T10:00:03.000Z',
    },
  };
  const first = reviseResearchHypothesis(
    withObservation,
    'A tone may recur in repeated windows.',
    'open',
    '2026-11-09T10:01:00.000Z',
  );
  const revised = reviseResearchHypothesis(
    first,
    'The tone may track the device position.',
    'tentative',
    '2026-11-09T10:02:00.000Z',
  );

  assert.equal(revised.hypothesis?.source, 'user-authored');
  assert.equal(revised.hypothesis?.statement, 'The tone may track the device position.');
  assert.deepEqual(revised.hypothesis?.revisionHistory, [{
    statement: 'A tone may recur in repeated windows.',
    status: 'open',
    updatedAt: '2026-11-09T10:01:00.000Z',
    source: 'user-authored',
  }]);
  assert.deepEqual(revised.observations, withObservation.observations);
  assert.equal(revised.interpretation, withObservation.interpretation);
  assert.equal(revised.universalExperiment, undefined, 'derived experiment is rebuilt from the revised record when saved');
  assert.equal(validateResearchSession(revised).success, true);
  assert.equal(validateResearchSession({
    ...revised,
    hypothesis: { ...revised.hypothesis!, source: 'ai-generated' },
  }).success, false, 'AI output cannot be stored in the user-hypothesis field');
  const capped = {
    ...withObservation,
    hypothesis: {
      statement: 'Latest hypothesis.',
      status: 'open' as const,
      updatedAt: '2026-11-09T10:03:00.000Z',
      source: 'user-authored' as const,
      revisionHistory: Array.from({ length: 20 }, (_, index) => ({
        statement: `Earlier hypothesis ${index + 1}`,
        status: 'open' as const,
        updatedAt: '2026-11-09T10:00:00.000Z',
        source: 'user-authored' as const,
      })),
    },
  };
  assert.throws(
    () => reviseResearchHypothesis(capped, 'One more hypothesis.', 'open', '2026-11-09T10:04:00.000Z'),
    /20-revision history limit/,
  );
  assert.throws(
    () => reviseResearchHypothesis(withObservation, 'x'.repeat(1201), 'open', '2026-11-09T10:04:00.000Z'),
    /1,200 characters/,
  );
  assert.equal(capped.hypothesis.revisionHistory.length, 20, 'no existing revision is discarded');

  const experiment = createUniversalExperiment(revised, ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');
  assert.equal(experiment.hypothesis?.statement, 'The tone may track the device position.');
  assert.equal(experiment.hypothesis?.source, 'user-authored');
  assert.equal('revisionHistory' in (experiment.hypothesis ?? {}), false);

  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    writeResearchSessions(ANONYMOUS_RESEARCH_SCOPE, [revised], 'anonymous-browser');
    const [saved] = readResearchSessions(ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');
    assert.deepEqual(saved?.hypothesis?.revisionHistory, revised.hypothesis?.revisionHistory);
    assert.deepEqual(saved?.observations, revised.observations);
    assert.deepEqual(saved?.interpretation, revised.interpretation);
    assert.equal(saved?.universalExperiment?.hypothesis?.statement, revised.hypothesis?.statement);
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
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
    writeResearchSessions(ANONYMOUS_RESEARCH_SCOPE, [visitorSession]);
    const [saved] = readResearchSessions(ANONYMOUS_RESEARCH_SCOPE);

    assert.notEqual(
      researchStorageKeyForScope(ANONYMOUS_RESEARCH_SCOPE),
      researchStorageKeyForOwner('owner_uid_1'),
    );
    assert.equal(saved?.universalExperiment?.participant.identityType, 'anonymous-browser');
    assert.equal(saved?.universalExperiment?.participant.reference, ANONYMOUS_RESEARCH_SCOPE);
    assert.equal(readResearchSessions('owner_uid_1').length, 0);
    assert.throws(
      () => createUniversalExperiment(visitorSession, ANONYMOUS_RESEARCH_SCOPE, 'firebase-uid'),
      /does not match its visitor or account scope/,
    );
    assert.throws(
      () => readResearchSessions('owner_uid_1', 'anonymous-browser'),
      /does not match its visitor or account scope/,
    );
    assert.throws(
      () => researchStorageKeyForOwner(ANONYMOUS_RESEARCH_SCOPE),
      /cannot be used as a Firebase owner UID/,
    );
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
