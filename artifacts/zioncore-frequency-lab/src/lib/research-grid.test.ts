import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CIG_METHOD_IDS,
  ResearchAgentRouter,
  ResearchGridRegistry,
  SIGNAL_ADAPTER_IDS,
  researchAgentRouter,
  researchGridRegistry,
  signalAdapterRegistry,
} from '@/lib/research-grid';

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
    kind: 'ai',
    provider: 'firebase-ai',
    tasks: ['multimodal-interpretation'],
    modalities: ['acoustic', 'symbolic'],
    estimatedCostUsd: 0.02,
    enabled: true,
    requiresConsent: true,
  }]);
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

test('current registry exposes only the implemented local acoustic path as a prototype', () => {
  assert.equal(researchGridRegistry.getDomain('celestial-exploration')?.readiness, 'acoustic-prototype');
  assert.ok(researchGridRegistry.getMethod(CIG_METHOD_IDS.localToneEncoding));
  assert.ok(researchGridRegistry.getMethod(CIG_METHOD_IDS.microphoneSpectrum));
});
