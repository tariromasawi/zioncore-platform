import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CIG_METHOD_IDS,
  ResearchAgentRouter,
  ResearchAgentRoleRegistry,
  ResearchGridRegistry,
  SIGNAL_ADAPTER_IDS,
  researchAgentRoleRegistry,
  researchAgentRouter,
  researchGridRegistry,
  signalAdapterRegistry,
} from '@/lib/research-grid';

function createConsentedTestRoleRegistry() {
  return new ResearchAgentRoleRegistry([{
    id: 'role.test-read-only',
    label: 'Test read-only reviewer',
    description: 'Test-only role for consent and budget routing.',
    tasks: ['descriptive-summary', 'pattern-comparison', 'multimodal-interpretation'],
    modalities: ['acoustic', 'symbolic'],
    dataScopes: ['acoustic.frequency-and-amplitude-metrics', 'aggregate.session-count'],
    tools: ['tool.local.acoustic-statistics', 'tool.approved.firebase-ai-json'],
    permittedActions: [
      'read-measurement-summary',
      'calculate-descriptive-statistics',
      'request-approved-model',
      'return-structured-output',
    ],
    maxCostUsd: 0.05,
    maxObservations: 30,
    requiresConsent: true,
    permissions: {
      readScopedMeasurements: true,
      readPersonalContent: false,
      readIdentity: false,
      writeResearchRecords: false,
      arbitraryNetwork: false,
      approvedModelCall: true,
      microphoneCapture: false,
      localAudioOutput: false,
      externalTransmission: false,
      billing: false,
      administration: false,
    },
  }]);
}

test('domain and method registries accept new plugins and notify subscribers', () => {
  const registry = new ResearchGridRegistry([], []);
  let notifications = 0;
  const unsubscribe = registry.subscribe(() => { notifications += 1; });
  registry.registerDomain({
    id: 'radio-research',
    label: 'Radio Research',
    description: 'A future radio-sensor research domain.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['radio-astronomy'],
  });
  registry.registerMethod({
    id: 'radio.capture.v1',
    version: '1.0.0',
    label: 'Radio capture adapter',
    description: 'A future adapter-backed capture method.',
    domainIds: ['radio-research'],
    modalities: ['radio-astronomy'],
    kind: 'observation',
  });

  assert.equal(registry.getDomain('radio-research')?.availableModalities[0], 'radio-astronomy');
  assert.equal(registry.listMethods('radio-research')[0]?.id, 'radio.capture.v1');
  assert.equal(notifications, 2);
  assert.throws(() => registry.registerDomain({
    id: 'radio-research',
    label: 'Duplicate',
    description: 'Duplicate.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['radio-astronomy'],
  }), /already registered/);
  unsubscribe();
});

test('the acoustic adapter normalizes measured values with units and source provenance', () => {
  const normalized = signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, {
    id: '22222222-2222-4222-8222-222222222222',
    window: {
      startedAt: '2026-11-09T10:00:00.000Z',
      endedAt: '2026-11-09T10:00:02.000Z',
      durationSeconds: 2,
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625],
    rmsLevel: 0.1,
  });

  assert.equal(normalized.modality, 'acoustic');
  assert.equal(normalized.provenance.classification, 'measured');
  assert.ok(normalized.metrics.some(metric => metric.name === 'rms-amplitude' && metric.unit === 'full-scale-fraction'));
  assert.throws(() => signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, {}));
  assert.throws(() => signalAdapterRegistry.normalize('adapter.not-registered', {}), /No signal adapter/);
});

test('cost-aware routing selects the cheapest compatible agent and enforces consent', () => {
  const local = researchAgentRouter.select({
    task: 'pattern-comparison',
    modalities: ['acoustic'],
    maxCostUsd: 0,
  });
  assert.equal(local?.id, 'agent.local-acoustic-statistics');

  const modelOnlyRouter = new ResearchAgentRouter([{
    id: 'agent.consent-required',
    label: 'Consent-required research model',
    roleId: 'role.test-read-only',
    kind: 'ai',
    provider: 'firebase-ai',
    tasks: ['multimodal-interpretation'],
    modalities: ['acoustic', 'symbolic'],
    estimatedCostUsd: 0.02,
    enabled: true,
    requiresConsent: true,
    run: () => ({
      summary: 'A consent-gated test result.',
      metrics: [],
      limitations: ['Test handler only.'],
    }),
  }], createConsentedTestRoleRegistry());
  assert.equal(modelOnlyRouter.select({
    task: 'multimodal-interpretation',
    modalities: ['acoustic', 'symbolic'],
    maxCostUsd: 0.01,
    consentGranted: true,
  }), null);
  assert.equal(modelOnlyRouter.select({
    task: 'multimodal-interpretation',
    modalities: ['acoustic', 'symbolic'],
    maxCostUsd: 0.03,
  }), null);
  assert.equal(modelOnlyRouter.select({
    task: 'multimodal-interpretation',
    modalities: ['acoustic', 'symbolic'],
    maxCostUsd: 0.03,
    consentGranted: true,
  })?.id, 'agent.consent-required');
});

test('agent execution validates its output and only runs after budget and consent checks', async () => {
  let runs = 0;
  const router = new ResearchAgentRouter([{
    id: 'agent.async-research',
    label: 'Async research agent',
    roleId: 'role.test-read-only',
    kind: 'ai',
    provider: 'firebase-ai',
    tasks: ['multimodal-interpretation'],
    modalities: ['acoustic'],
    estimatedCostUsd: 0.01,
    enabled: true,
    requiresConsent: true,
    run: async input => {
      runs += 1;
      return {
        summary: `Processed ${input.observations.length} observation(s).`,
        metrics: [],
        limitations: ['Research output, not empirical confirmation.'],
      };
    },
  }], createConsentedTestRoleRegistry());
  const input = { observations: [], sessionsWithObservations: 0 };

  assert.equal(await router.execute({
    task: 'multimodal-interpretation',
    modalities: ['acoustic'],
    maxCostUsd: 0.005,
    consentGranted: true,
  }, input), null);
  assert.equal(await router.execute({
    task: 'multimodal-interpretation',
    modalities: ['acoustic'],
    maxCostUsd: 0.02,
  }, input), null);
  assert.equal(runs, 0);

  const result = await router.execute({
    task: 'multimodal-interpretation',
    modalities: ['acoustic'],
    maxCostUsd: 0.02,
    consentGranted: true,
  }, input);
  assert.equal(runs, 1);
  assert.equal(result?.agent.estimatedCostUsd, 0.01);
  assert.equal(result?.output.summary, 'Processed 0 observation(s).');
});

test('active specialist receives only frozen role-scoped frequency and level metrics', () => {
  let received: unknown;
  const router = new ResearchAgentRouter([{
    id: 'agent.test-scoped-reader',
    label: 'Test scoped acoustic reader',
    roleId: 'role.acoustic-measurement-analyst',
    kind: 'deterministic',
    provider: 'browser',
    tasks: ['descriptive-summary'],
    modalities: ['acoustic'],
    estimatedCostUsd: 0,
    enabled: true,
    requiresConsent: false,
    run: input => {
      received = input;
      return {
        summary: 'Read-only test summary.',
        metrics: [],
        limitations: ['Test only.'],
      };
    },
  }]);
  const normalized = signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, {
    id: '33333333-3333-4333-8333-333333333333',
    instrumentId: 'PRIVATE_INSTRUMENT_ID',
    window: {
      startedAt: '2026-11-09T10:00:00.000Z',
      endedAt: '2026-11-09T10:00:02.000Z',
      durationSeconds: 2,
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625],
    rmsLevel: 0.1,
  });

  router.executeSync({
    task: 'descriptive-summary',
    modalities: ['acoustic'],
    maxCostUsd: 0,
  }, { observations: [normalized], sessionsWithObservations: 1 });

  const scoped = received as {
    observations: Array<{ metrics: Array<{ name: string; value: number | null; unit: string }> }>;
    sessionsWithObservations: number;
  };
  assert.deepEqual(Object.keys(scoped).sort(), ['observations', 'sessionsWithObservations']);
  assert.deepEqual(Object.keys(scoped.observations[0] ?? {}), ['metrics']);
  assert.deepEqual(scoped.observations[0]?.metrics.map(metric => metric.name), [
    'dominant-frequency',
    'rms-amplitude',
  ]);
  assert.equal(scoped.sessionsWithObservations, 1);
  assert.equal(Object.isFrozen(scoped), true);
  assert.equal(Object.isFrozen(scoped.observations), true);
  assert.equal(Object.isFrozen(scoped.observations[0]), true);
  assert.equal(Object.isFrozen(scoped.observations[0]?.metrics), true);
  assert.equal(Object.isFrozen(scoped.observations[0]?.metrics[0]), true);
  assert.equal(normalized.instrumentId, 'PRIVATE_INSTRUMENT_ID');
  assert.equal(normalized.sourceObservationId, '33333333-3333-4333-8333-333333333333');
});

test('agent roles reject write access and agents cannot exceed their declared role', () => {
  const base = researchAgentRoleRegistry.get('role.acoustic-measurement-analyst');
  assert.ok(base);
  assert.throws(() => new ResearchAgentRoleRegistry([{
    ...base,
    id: 'role.unsafe-write',
    permissions: { ...base.permissions, writeResearchRecords: true },
  }]), /read-only/);

  assert.throws(() => new ResearchAgentRouter([{
    id: 'agent.over-budget',
    label: 'Over-budget test agent',
    roleId: 'role.acoustic-measurement-analyst',
    kind: 'deterministic',
    provider: 'browser',
    tasks: ['descriptive-summary'],
    modalities: ['acoustic'],
    estimatedCostUsd: 0.01,
    enabled: true,
    requiresConsent: false,
    run: () => ({ summary: '', metrics: [], limitations: [] }),
  }]), /cost ceiling/);
});

test('current registry exposes only the implemented local acoustic path as a prototype', () => {
  assert.equal(researchGridRegistry.getDomain('celestial-exploration')?.readiness, 'acoustic-prototype');
  assert.ok(researchGridRegistry.getMethod(CIG_METHOD_IDS.localToneEncoding));
  assert.ok(researchGridRegistry.getMethod(CIG_METHOD_IDS.microphoneSpectrum));
  const agents = researchAgentRouter.list();
  assert.equal(agents.length, 1);
  assert.equal(agents[0]?.role.id, 'role.acoustic-measurement-analyst');
  assert.equal(agents[0]?.role.maxCostUsd, 0);
  assert.equal(agents[0]?.role.permissions.writeResearchRecords, false);
  assert.equal(agents[0]?.role.permissions.approvedModelCall, false);
});
