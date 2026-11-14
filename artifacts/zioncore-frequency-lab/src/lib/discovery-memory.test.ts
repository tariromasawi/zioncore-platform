import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANONYMOUS_RESEARCH_SCOPE,
  createResearchSession,
  encodeCelestialMessage,
  reviseResearchHypothesis,
  readResearchSessions,
  validateResearchSession,
  writeResearchSessions,
  type ResearchObservation,
} from '@/lib/celestial-experiment';
import { recordDiscoveryMemoryVersions } from '@/lib/discovery-memory';

const observation: ResearchObservation = {
  id: '22222222-2222-4222-8222-222222222222',
  source: {
    type: 'microphone-observation',
    label: 'Browser microphone',
    capturedAt: '2026-11-12T12:00:00.000Z',
  },
  window: {
    startedAt: '2026-11-12T12:00:00.000Z',
    endedAt: '2026-11-12T12:00:02.000Z',
    durationSeconds: 2,
    source: 'browser-microphone',
  },
  sampleRateHz: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 881.25],
  rmsLevel: 0.12,
  notes: 'Human-authored observation note.',
};

function sessionFixture() {
  const base = createResearchSession({
    id: '11111111-1111-4111-8111-111111111111',
    now: '2026-11-12T12:00:00.000Z',
  });
  const signal = encodeCelestialMessage('A saved research message');
  return {
    ...base,
    message: { ...base.message, text: 'A saved research message' },
    signal,
    observations: [observation],
    hypothesis: {
      statement: 'A user-authored test hypothesis.',
      status: 'open' as const,
      updatedAt: '2026-11-12T12:00:03.000Z',
      source: 'user-authored' as const,
      revisionHistory: [],
    },
    interpretation: {
      measuredPattern: 'A peak is present in this recorded window.',
      uncertainty: 'The source is not identified.',
      personalReflection: 'A personal reflection.',
      createdAt: '2026-11-12T12:00:04.000Z',
      provenance: {
        source: 'user-authored' as const,
        observationId: observation.id,
        methodId: 'user-authored-observation-interpretation',
        methodVersion: '1.0.0',
      },
    },
  };
}

test('discovery memory versions experiment, protocol, hypothesis, and interpretation separately', () => {
  const session = sessionFixture();
  const first = recordDiscoveryMemoryVersions(session, undefined, '2026-11-12T12:01:00.000Z');
  assert.equal(validateResearchSession(first).success, true);
  assert.deepEqual(
    [...new Set(first.discoveryVersions?.map(version => version.kind))].sort(),
    ['experiment', 'hypothesis', 'interpretation', 'protocol'],
  );

  const hypothesisRevision = reviseResearchHypothesis(
    first,
    'A revised, still unverified hypothesis.',
    'tentative',
    '2026-11-12T12:02:00.000Z',
  );
  const revisedHypothesis = recordDiscoveryMemoryVersions(
    hypothesisRevision,
    first,
    '2026-11-12T12:02:00.000Z',
  );
  const counts = Object.fromEntries(
    ['experiment', 'protocol', 'hypothesis', 'interpretation'].map(kind => [
      kind,
      revisedHypothesis.discoveryVersions?.filter(version => version.kind === kind).length,
    ]),
  );
  assert.deepEqual(counts, { experiment: 1, protocol: 1, hypothesis: 2, interpretation: 1 });
  assert.equal(validateResearchSession(revisedHypothesis).success, true);
});

test('interpretation and protocol revisions preserve raw observations and reference them by ID only', () => {
  const first = recordDiscoveryMemoryVersions(sessionFixture(), undefined, '2026-11-12T12:01:00.000Z');
  const before = structuredClone(first.observations);
  const protocolEdit = {
    ...first,
    encoding: { ...first.encoding, symbolDurationMs: 100 as const },
  };
  const protocolRevised = recordDiscoveryMemoryVersions(protocolEdit, first, '2026-11-12T12:03:00.000Z');
  const interpretationEdit = {
    ...protocolRevised,
    interpretation: {
      ...protocolRevised.interpretation!,
      measuredPattern: 'A later user-authored description.',
      createdAt: '2026-11-12T12:04:00.000Z',
    },
  };
  const allRevised = recordDiscoveryMemoryVersions(
    interpretationEdit,
    protocolRevised,
    '2026-11-12T12:04:00.000Z',
  );
  assert.deepEqual(allRevised.observations, before);
  assert.equal(allRevised.discoveryVersions?.filter(version => version.kind === 'protocol').length, 2);
  assert.equal(allRevised.discoveryVersions?.filter(version => version.kind === 'interpretation').length, 2);
  assert.ok(allRevised.discoveryVersions?.every(version => version.observationRefs.includes(observation.id)
    || version.kind === 'interpretation'));
  const versionsJson = JSON.stringify(allRevised.discoveryVersions);
  assert.match(versionsJson, /22222222-2222-4222-8222-222222222222/);
  assert.doesNotMatch(versionsJson, /rmsLevel|dominantFrequencyHz|topPeaksHz/);
  assert.equal(validateResearchSession(allRevised).success, true);
});

test('experiment changes create a new experiment version without changing its protocol version', () => {
  const first = recordDiscoveryMemoryVersions(sessionFixture(), undefined, '2026-11-12T12:01:00.000Z');
  const experimentEdit = {
    ...first,
    domain: 'environmental-interaction',
    message: { ...first.message, text: 'A revised research message' },
  };
  const revised = recordDiscoveryMemoryVersions(experimentEdit, first, '2026-11-12T12:05:00.000Z');
  assert.equal(revised.discoveryVersions?.filter(version => version.kind === 'experiment').length, 2);
  assert.equal(revised.discoveryVersions?.filter(version => version.kind === 'protocol').length, 1);
  assert.equal(
    revised.discoveryVersions?.find(version => version.kind === 'experiment' && version.version === 2)?.snapshot.message.text,
    'A revised research message',
  );
  assert.equal(validateResearchSession(revised).success, true);
});

test('legacy hypothesis revisions are migrated into the version ledger without dropping earlier wording', () => {
  const base = createResearchSession({
    id: '33333333-3333-4333-8333-333333333333',
    now: '2026-11-12T12:00:00.000Z',
  });
  const initial = reviseResearchHypothesis(base, 'First wording.', 'open', '2026-11-12T12:01:00.000Z');
  const updated = reviseResearchHypothesis(initial, 'Second wording.', 'tentative', '2026-11-12T12:02:00.000Z');
  const migrated = recordDiscoveryMemoryVersions(
    updated,
    initial,
    '2026-11-12T12:03:00.000Z',
  );
  const hypothesisVersions = migrated.discoveryVersions?.filter(version => version.kind === 'hypothesis') ?? [];
  assert.deepEqual(hypothesisVersions.map(version => version.snapshot.statement), [
    'First wording.',
    'Second wording.',
  ]);
  assert.equal(validateResearchSession(migrated).success, true);
});

test('discovery versions reject sequence gaps and references to unknown observations', () => {
  const first = recordDiscoveryMemoryVersions(sessionFixture());
  const badSequence = {
    ...first,
    discoveryVersions: first.discoveryVersions?.map((version, index) => (
      version.kind === 'hypothesis' && index === first.discoveryVersions?.findIndex(item => item.kind === 'hypothesis')
        ? { ...version, version: version.version + 1 }
        : version
    )),
  };
  assert.equal(validateResearchSession(badSequence).success, false);

  const badReference = {
    ...first,
    discoveryVersions: first.discoveryVersions?.map(version => (
      version.kind === 'interpretation'
        ? { ...version, observationRefs: ['99999999-9999-4999-8999-999999999999'] }
        : version
    )),
  };
  assert.equal(validateResearchSession(badReference).success, false);
});

test('account-scoped local archive preserves version ledgers without altering raw observations', () => {
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
    const versioned = recordDiscoveryMemoryVersions(sessionFixture(), undefined, '2026-11-12T12:01:00.000Z');
    writeResearchSessions(ANONYMOUS_RESEARCH_SCOPE, [versioned], 'anonymous-browser');
    const [saved] = readResearchSessions(ANONYMOUS_RESEARCH_SCOPE, 'anonymous-browser');
    assert.deepEqual(saved.discoveryVersions, versioned.discoveryVersions);
    assert.deepEqual(saved.observations, versioned.observations);
    assert.equal(saved.universalExperiment?.provenance.sourceSessionId, versioned.id);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
