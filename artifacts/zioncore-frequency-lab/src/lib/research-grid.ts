import { z } from 'zod';

export const CIG_EXPERIMENT_SCHEMA = 'zc-cig-experiment/v1' as const;

export const CIG_MODALITIES = [
  'acoustic',
  'biological-acoustic',
  'electromagnetic',
  'geophysical',
  'radio-astronomy',
  'symbolic',
  'multimodal',
  'unknown',
] as const;
export type CIGModality = (typeof CIG_MODALITIES)[number];

export const CIG_DOMAIN_IDS = [
  'celestial-exploration',
  'divine-devotional',
  'ancestral-heritage',
  'environmental-interaction',
  'unknown-intelligence',
] as const;

export const CIG_METHOD_IDS = {
  humanInput: 'zcig.human-authored-input',
  localToneEncoding: 'ZC-EXP-DTMF-v1',
  microphoneSpectrum: 'acoustic.browser-microphone-spectrum',
  measuredSummary: 'analysis.acoustic-descriptive-summary',
} as const;

export type ResearchDomainDefinition = {
  id: string;
  label: string;
  description: string;
  version: string;
  readiness: 'acoustic-prototype' | 'research-framing';
  availableModalities: CIGModality[];
};

export type ResearchMethodDefinition = {
  id: string;
  version: string;
  label: string;
  description: string;
  domainIds: string[];
  modalities: CIGModality[];
  kind: 'input' | 'encoding' | 'observation' | 'analysis';
};

const DEFAULT_DOMAINS: ResearchDomainDefinition[] = [
  {
    id: 'celestial-exploration',
    label: 'Celestial Exploration',
    description: 'Explore hypotheses with symbolic messages and a local acoustic instrument. This prototype does not receive or identify astronomical signals.',
    version: '1.0.0',
    readiness: 'acoustic-prototype',
    availableModalities: ['acoustic', 'symbolic'],
  },
  {
    id: 'divine-devotional',
    label: 'Divine Devotional',
    description: 'Frame a human-authored prayer or reflection. Current instruments remain symbolic text and local audible sound.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['acoustic', 'symbolic'],
  },
  {
    id: 'ancestral-heritage',
    label: 'Ancestral Heritage',
    description: 'Record cultural or family-history hypotheses without treating a sound pattern as evidence of an ancestral source.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['acoustic', 'symbolic'],
  },
  {
    id: 'environmental-interaction',
    label: 'Environmental Interaction',
    description: 'Document locally measured sound in an environment. The microphone records acoustic features only.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['acoustic', 'symbolic'],
  },
  {
    id: 'unknown-intelligence',
    label: 'Unknown Intelligence',
    description: 'Keep a question open while recording measured data separately from ideas about its origin.',
    version: '1.0.0',
    readiness: 'research-framing',
    availableModalities: ['acoustic', 'symbolic', 'unknown'],
  },
];

const validId = /^[A-Za-z0-9][A-Za-z0-9.-]{1,95}$/;
const isModality = (value: string): value is CIGModality =>
  (CIG_MODALITIES as readonly string[]).includes(value);

export class ResearchGridRegistry {
  private readonly domains = new Map<string, ResearchDomainDefinition>();
  private readonly methods = new Map<string, ResearchMethodDefinition>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  constructor(
    domains: ResearchDomainDefinition[] = DEFAULT_DOMAINS,
    methods: ResearchMethodDefinition[] = createDefaultMethods(),
  ) {
    for (const domain of domains) this.registerDomain(domain);
    for (const method of methods) this.registerMethod(method);
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getRevision = () => this.revision;

  registerDomain(domain: ResearchDomainDefinition) {
    if (!validId.test(domain.id) || !domain.label.trim() || domain.label.length > 100
      || !domain.version.trim() || domain.version.length > 40 || domain.description.length > 600) {
      throw new Error('A research domain needs a valid id, label, and version.');
    }
    if (this.domains.has(domain.id)) throw new Error(`Research domain "${domain.id}" is already registered.`);
    if (domain.availableModalities.length === 0) {
      throw new Error('A research domain must declare at least one modality.');
    }
    if (domain.availableModalities.some(modality => !isModality(modality))) {
      throw new Error('A research domain declares an unsupported modality identifier.');
    }
    this.domains.set(domain.id, { ...domain, availableModalities: [...domain.availableModalities] });
    this.changed();
  }

  registerMethod(method: ResearchMethodDefinition) {
    if (!validId.test(method.id) || !method.version.trim() || method.version.length > 40
      || !method.label.trim() || method.label.length > 120 || method.description.length > 600) {
      throw new Error('A research method needs a valid id, label, and version.');
    }
    if (this.methods.has(method.id)) throw new Error(`Research method "${method.id}" is already registered.`);
    if (method.domainIds.length === 0 || method.domainIds.some(id => !this.domains.has(id))) {
      throw new Error('Register every research domain before registering a method for it.');
    }
    if (method.modalities.length === 0) throw new Error('A research method must declare at least one modality.');
    if (method.modalities.some(modality => !isModality(modality))) {
      throw new Error('A research method declares an unsupported modality identifier.');
    }
    this.methods.set(method.id, {
      ...method,
      domainIds: [...method.domainIds],
      modalities: [...method.modalities],
    });
    this.changed();
  }

  getDomain(id: string) {
    return this.domains.get(id);
  }

  getMethod(id: string) {
    return this.methods.get(id);
  }

  listDomains() {
    return [...this.domains.values()];
  }

  listMethods(domainId?: string) {
    const methods = [...this.methods.values()];
    return domainId ? methods.filter(method => method.domainIds.includes(domainId)) : methods;
  }

  private changed() {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }
}

function createDefaultMethods(): ResearchMethodDefinition[] {
  const domainIds = [...CIG_DOMAIN_IDS];
  return [
    {
      id: CIG_METHOD_IDS.humanInput,
      version: '1.0.0',
      label: 'Human-authored input',
      description: 'A participant-authored message or prayer; not generated as a received communication.',
      domainIds,
      modalities: ['symbolic'],
      kind: 'input',
    },
    {
      id: CIG_METHOD_IDS.localToneEncoding,
      version: '1.0.0',
      label: 'Local dual-tone encoding',
      description: 'Encodes text into the versioned experimental tone-symbol packet for local speaker playback.',
      domainIds,
      modalities: ['acoustic', 'symbolic'],
      kind: 'encoding',
    },
    {
      id: CIG_METHOD_IDS.microphoneSpectrum,
      version: '1.0.0',
      label: 'Browser microphone spectrum',
      description: 'Measures a microphone window using the Web Audio analyser; raw audio is not retained.',
      domainIds,
      modalities: ['acoustic'],
      kind: 'observation',
    },
    {
      id: CIG_METHOD_IDS.measuredSummary,
      version: '1.0.0',
      label: 'Measured acoustic summary',
      description: 'Computes descriptive statistics from validated acoustic measurements only.',
      domainIds,
      modalities: ['acoustic'],
      kind: 'analysis',
    },
  ];
}

export const researchGridRegistry = new ResearchGridRegistry();

const isoDate = z.string().datetime();
const domainIdSchema = z.string().regex(validId);
const metricSchema = z.object({
  name: z.string().min(1).max(80),
  value: z.number().finite().nullable(),
  unit: z.string().min(1).max(40),
}).strict();

const normalizedObservationSchema = z.object({
  sourceObservationId: z.string().min(1).max(120),
  modality: z.enum(CIG_MODALITIES),
  instrumentId: z.string().min(1).max(120),
  window: z.object({
    startedAt: isoDate,
    endedAt: isoDate,
    durationSeconds: z.number().finite().positive().max(3600),
  }).strict(),
  metrics: z.array(metricSchema).min(1).max(64),
  provenance: z.object({
    adapterId: z.string().min(1).max(120),
    adapterVersion: z.string().min(1).max(40),
    classification: z.literal('measured'),
  }).strict(),
}).strict();

export type NormalizedSignalObservation = z.infer<typeof normalizedObservationSchema>;

export type SignalAdapter = {
  id: string;
  version: string;
  inputModality: CIGModality;
  normalize(input: unknown): NormalizedSignalObservation;
};

export class SignalAdapterRegistry {
  private readonly adapters = new Map<string, SignalAdapter>();

  register(adapter: SignalAdapter) {
    if (!validId.test(adapter.id) || !adapter.version.trim()) {
      throw new Error('A signal adapter needs a valid id and version.');
    }
    if (this.adapters.has(adapter.id)) throw new Error(`Signal adapter "${adapter.id}" is already registered.`);
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string) {
    return this.adapters.get(id);
  }

  normalize(id: string, input: unknown) {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`No signal adapter is registered for "${id}".`);
    const normalized = normalizedObservationSchema.parse(adapter.normalize(input));
    if (normalized.modality !== adapter.inputModality) {
      throw new Error(`Signal adapter "${id}" returned a modality that does not match its registration.`);
    }
    return normalized;
  }

  list() {
    return [...this.adapters.values()];
  }
}

const acousticObservationInputSchema = z.object({
  id: z.string().uuid(),
  instrumentId: z.string().min(1).max(120).optional(),
  window: z.object({
    startedAt: isoDate,
    endedAt: isoDate,
    durationSeconds: z.number().finite().positive().max(3600),
  }),
  sampleRateHz: z.number().int().min(8000).max(192000),
  fftSize: z.number().int().min(2048).max(8192),
  frequencyResolutionHz: z.number().finite().positive(),
  dominantFrequencyHz: z.number().finite().positive().nullable(),
  topPeaksHz: z.array(z.number().finite().positive()).max(6),
  rmsLevel: z.number().finite().min(0).max(1),
}).superRefine((observation, context) => {
  if (observation.frequencyResolutionHz !== observation.sampleRateHz / observation.fftSize) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['frequencyResolutionHz'],
      message: 'Frequency resolution must match the sample rate and FFT size.',
    });
  }
  const nyquist = observation.sampleRateHz / 2;
  if (observation.dominantFrequencyHz != null && observation.dominantFrequencyHz > nyquist) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dominantFrequencyHz'],
      message: 'Dominant frequency cannot exceed Nyquist.',
    });
  }
  if (observation.topPeaksHz.some(peak => peak > nyquist)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['topPeaksHz'],
      message: 'A peak cannot exceed Nyquist.',
    });
  }
});

export const SIGNAL_ADAPTER_IDS = {
  browserAcoustic: 'adapter.browser-acoustic-spectrum',
} as const;

export const signalAdapterRegistry = new SignalAdapterRegistry();
signalAdapterRegistry.register({
  id: SIGNAL_ADAPTER_IDS.browserAcoustic,
  version: '1.0.0',
  inputModality: 'acoustic',
  normalize(input) {
    const observation = acousticObservationInputSchema.parse(input);
    const metrics = [
      { name: 'dominant-frequency', value: observation.dominantFrequencyHz, unit: 'Hz' },
      ...observation.topPeaksHz.map((value, index) => ({
        name: `peak-frequency-${index + 1}`,
        value,
        unit: 'Hz',
      })),
      { name: 'rms-amplitude', value: observation.rmsLevel, unit: 'full-scale-fraction' },
      { name: 'sample-rate', value: observation.sampleRateHz, unit: 'Hz' },
      { name: 'fft-size', value: observation.fftSize, unit: 'samples' },
      { name: 'frequency-resolution', value: observation.frequencyResolutionHz, unit: 'Hz' },
    ];
    return {
      sourceObservationId: observation.id,
      modality: 'acoustic',
      instrumentId: observation.instrumentId ?? 'instrument.browser-microphone-web-audio',
      window: observation.window,
      metrics,
      provenance: {
        adapterId: SIGNAL_ADAPTER_IDS.browserAcoustic,
        adapterVersion: '1.0.0',
        classification: 'measured',
      },
    };
  },
});

export const universalExperimentSchema = z.object({
  schemaVersion: z.literal(CIG_EXPERIMENT_SCHEMA),
  id: z.string().uuid(),
  participant: z.object({
    reference: z.string().min(1).max(128),
    identityType: z.enum(['firebase-uid', 'anonymous-browser']),
  }).strict(),
  domain: z.object({
    id: domainIdSchema,
    label: z.string().min(1).max(100),
    registryVersion: z.string().min(1).max(40),
  }).strict(),
  instruments: z.array(z.object({
    id: z.string().min(1).max(120),
    role: z.enum(['input', 'output', 'software']),
    modality: z.enum(CIG_MODALITIES),
    name: z.string().min(1).max(120),
    calibration: z.enum(['not-applicable', 'uncalibrated', 'calibrated']),
  }).strict()).min(1).max(10),
  sources: z.array(z.object({
    id: z.string().min(1).max(160),
    recordReference: z.string().min(1).max(200),
    kind: z.enum(['human-authored', 'environmental-observation', 'astronomical', 'unknown']),
    label: z.string().min(1).max(120),
    capturedAt: isoDate,
    content: z.string().max(120).nullable(),
  }).strict()).min(1).max(32),
  signal: z.object({
    modality: z.enum(CIG_MODALITIES),
    protocolId: z.string().min(1).max(120).nullable(),
    generatedContent: z.string().max(120),
    encodedSymbols: z.array(z.number().int().min(0).max(15)).max(400),
    sampleRateHz: z.number().int().positive().nullable(),
    carrierFrequenciesHz: z.array(z.number().int().positive()).length(8).nullable(),
    durationSeconds: z.number().finite().nonnegative(),
    checksum: z.number().int().min(0).max(65535).nullable(),
  }).strict(),
  methods: z.array(z.object({
    id: z.string().min(1).max(120),
    version: z.string().min(1).max(40),
    parameters: z.array(z.object({
      name: z.string().min(1).max(80),
      value: z.union([z.string().max(160), z.number().finite(), z.boolean()]),
      unit: z.string().max(40).optional(),
    }).strict()).max(32),
  }).strict()).min(1).max(12),
  hypothesis: z.object({
    statement: z.string().max(1200),
    status: z.enum(['open', 'tentative', 'not-observed']),
    updatedAt: isoDate,
  }).strict().nullable(),
  interpretation: z.object({
    measuredPattern: z.string().max(1500),
    uncertainty: z.string().max(1500),
    personalReflection: z.string().max(1500),
    createdAt: isoDate,
  }).strict().nullable(),
  transmission: z.object({
    status: z.enum(['not-started', 'authorized', 'completed', 'stopped']),
    channel: z.enum(['none', 'local-speaker']),
    authorizedAt: isoDate.nullable(),
    completedAt: isoDate.nullable(),
    externalTransmission: z.literal(false),
  }).strict(),
  observations: z.array(normalizedObservationSchema).max(30),
  results: z.object({
    observationCount: z.number().int().min(0).max(30),
    analysisAgent: z.object({
      id: z.string().min(1).max(120),
      kind: z.enum(['deterministic', 'ai']),
      provider: z.enum(['browser', 'firebase-ai', 'gemini', 'openai', 'custom']),
      estimatedCostUsd: z.number().finite().min(0),
    }).strict().nullable(),
    descriptiveSummary: z.object({
      medianDominantFrequencyHz: z.number().finite().nullable(),
      meanRmsLevel: z.number().finite().min(0).max(1),
      message: z.string().max(500),
      limitation: z.string().max(500),
    }).strict().nullable(),
    findings: z.array(z.object({
      statement: z.string().min(1).max(1000),
      basis: z.string().min(1).max(1000),
      confidence: z.enum(['low', 'moderate']),
      createdAt: isoDate,
    }).strict()).max(30),
  }).strict(),
  provenance: z.object({
    sourceSessionId: z.string().uuid(),
    createdAt: isoDate,
    updatedAt: isoDate,
    generatedBy: z.literal('zioncore-research-grid'),
    storage: z.literal('browser-local-unencrypted'),
    adapters: z.array(z.object({
      id: z.string().min(1).max(120),
      version: z.string().min(1).max(40),
    }).strict()).max(12),
  }).strict(),
}).strict();

export type UniversalExperiment = z.infer<typeof universalExperimentSchema>;

export function validateUniversalExperiment(value: unknown) {
  return universalExperimentSchema.safeParse(value);
}

export type ResearchTask = 'descriptive-summary' | 'pattern-comparison' | 'multimodal-interpretation';
export type ResearchAgentDescriptor = {
  id: string;
  label: string;
  kind: 'deterministic' | 'ai';
  provider: 'browser' | 'firebase-ai' | 'gemini' | 'openai' | 'custom';
  tasks: ResearchTask[];
  modalities: CIGModality[];
  estimatedCostUsd: number | null;
  enabled: boolean;
  requiresConsent: boolean;
};

export type ResearchAgentInput = {
  experimentId: string;
  observations: NormalizedSignalObservation[];
  sessionsWithObservations: number;
};

export type ResearchAgentOutput = {
  summary: string;
  metrics: Array<{ name: string; value: number | null; unit: string }>;
  limitations: string[];
};

export type ResearchAgent = ResearchAgentDescriptor & {
  run(input: ResearchAgentInput): ResearchAgentOutput | Promise<ResearchAgentOutput>;
};

const researchAgentOutputSchema = z.object({
  summary: z.string().max(500),
  metrics: z.array(z.object({
    name: z.string().min(1).max(80),
    value: z.number().finite().nullable(),
    unit: z.string().min(1).max(40),
  }).strict()).max(64),
  limitations: z.array(z.string().min(1).max(500)).max(16),
}).strict();

function metricValue(observation: NormalizedSignalObservation, name: string) {
  return observation.metrics.find(metric => metric.name === name)?.value ?? null;
}

function localAcousticStatistics(input: ResearchAgentInput): ResearchAgentOutput {
  const frequencies = input.observations
    .map(observation => metricValue(observation, 'dominant-frequency'))
    .filter((value): value is number => value != null);
  const levels = input.observations
    .map(observation => metricValue(observation, 'rms-amplitude'))
    .filter((value): value is number => value != null);
  const sorted = [...frequencies].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length === 0
    ? null
    : sorted.length % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  const meanRms = levels.length === 0
    ? null
    : levels.reduce((sum, value) => sum + value, 0) / levels.length;
  return {
    summary: frequencies.length === 0
      ? 'Microphone windows were recorded, but no dominant peak cleared the instrument threshold.'
      : `${frequencies.length} microphone window(s) contained a dominant spectral peak. Median measured peak: ${median?.toFixed(1)} Hz.`,
    metrics: [
      { name: 'observation-count', value: input.observations.length, unit: 'windows' },
      { name: 'sessions-with-observations', value: input.sessionsWithObservations, unit: 'sessions' },
      { name: 'median-dominant-frequency', value: median, unit: 'Hz' },
      { name: 'mean-rms-amplitude', value: meanRms, unit: 'full-scale-fraction' },
    ],
    limitations: [
      'These measurements describe sound pressure at the microphone.',
      'They do not identify a source or establish that a communication response occurred.',
    ],
  };
}

export class ResearchAgentRouter {
  private readonly agents = new Map<string, ResearchAgent>();

  constructor(agents: ResearchAgent[] = []) {
    for (const agent of agents) this.register(agent);
  }

  register(agent: ResearchAgent) {
    if (!validId.test(agent.id) || !agent.label.trim()) {
      throw new Error('A research agent needs a valid id and label.');
    }
    if (this.agents.has(agent.id)) throw new Error(`Research agent "${agent.id}" is already registered.`);
    if (agent.estimatedCostUsd != null && (!Number.isFinite(agent.estimatedCostUsd) || agent.estimatedCostUsd < 0)) {
      throw new Error('A research agent cost estimate must be a non-negative finite amount.');
    }
    if (agent.tasks.length === 0 || agent.modalities.length === 0) {
      throw new Error('A research agent must declare at least one task and modality.');
    }
    if (typeof agent.run !== 'function') throw new Error('A research agent must provide an executable handler.');
    this.agents.set(agent.id, {
      ...agent,
      tasks: [...agent.tasks],
      modalities: [...agent.modalities],
    });
  }

  select(options: {
    task: ResearchTask;
    modalities: CIGModality[];
    maxCostUsd: number;
    consentGranted?: boolean;
  }) {
    if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd < 0) {
      throw new Error('A research compute budget must be a non-negative finite amount.');
    }
    const selected = this.choose(options);
    return selected ? this.describe(selected) : null;
  }

  async execute(
    options: {
      task: ResearchTask;
      modalities: CIGModality[];
      maxCostUsd: number;
      consentGranted?: boolean;
    },
    input: ResearchAgentInput,
  ) {
    const agent = this.choose(options);
    if (!agent) return null;
    const output = researchAgentOutputSchema.parse(await agent.run(input));
    return { agent: this.describe(agent), output };
  }

  executeSync(
    options: {
      task: ResearchTask;
      modalities: CIGModality[];
      maxCostUsd: number;
      consentGranted?: boolean;
    },
    input: ResearchAgentInput,
  ) {
    const agent = this.choose(options);
    if (!agent) return null;
    const output = agent.run(input);
    if (output != null && typeof output === 'object' && 'then' in output) {
      throw new Error(`Research agent "${agent.id}" is asynchronous; use execute() instead.`);
    }
    return { agent: this.describe(agent), output: researchAgentOutputSchema.parse(output) };
  }

  list(): ResearchAgentDescriptor[] {
    return [...this.agents.values()].map(agent => this.describe(agent));
  }

  private choose(options: {
    task: ResearchTask;
    modalities: CIGModality[];
    maxCostUsd: number;
    consentGranted?: boolean;
  }) {
    if (!Number.isFinite(options.maxCostUsd) || options.maxCostUsd < 0) {
      throw new Error('A research compute budget must be a non-negative finite amount.');
    }
    return [...this.agents.values()]
      .filter(agent => agent.enabled)
      .filter(agent => agent.tasks.includes(options.task))
      .filter(agent => options.modalities.every(modality => agent.modalities.includes(modality)))
      .filter(agent => agent.estimatedCostUsd != null && agent.estimatedCostUsd <= options.maxCostUsd)
      .filter(agent => !agent.requiresConsent || options.consentGranted === true)
      .sort((left, right) => {
        const costDifference = (left.estimatedCostUsd ?? Infinity) - (right.estimatedCostUsd ?? Infinity);
        if (costDifference !== 0) return costDifference;
        return left.kind === right.kind ? left.id.localeCompare(right.id) : left.kind === 'deterministic' ? -1 : 1;
      })[0] ?? null;
  }

  private describe(agent: ResearchAgent): ResearchAgentDescriptor {
    const { run: _run, ...descriptor } = agent;
    return descriptor;
  }
}

export const researchAgentRouter = new ResearchAgentRouter([
  {
    id: 'agent.local-acoustic-statistics',
    label: 'Local measured acoustic statistics',
    kind: 'deterministic',
    provider: 'browser',
    tasks: ['descriptive-summary', 'pattern-comparison'],
    modalities: ['acoustic'],
    estimatedCostUsd: 0,
    enabled: true,
    requiresConsent: false,
    run: localAcousticStatistics,
  },
]);

export const CIG_LIMITATIONS = {
  currentInput: 'The prototype ingests browser microphone measurements and human-authored text only.',
  interpretation: 'Measured acoustic patterns do not identify a source or establish communication.',
  transmission: 'Current playback is local speaker output and is not an external transmission.',
} as const;
