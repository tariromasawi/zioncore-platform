import { z } from 'zod';
import {
  CIG_DOMAIN_IDS,
  CIG_METHOD_IDS,
  SIGNAL_ADAPTER_IDS,
  researchAgentRouter,
  researchGridRegistry,
  signalAdapterRegistry,
  universalExperimentSchema,
  type UniversalExperiment,
} from '@/lib/research-grid';
import { instrumentRegistry } from '@/lib/hardware-instruments';

export const CELESTIAL_STORAGE_KEY = 'zioncore.celestial.sessions.v1';
export const ANONYMOUS_RESEARCH_SCOPE = 'anonymous-browser';
export const CELESTIAL_PROTOCOL_ID = 'ZC-EXP-DTMF-v1';
export const CELESTIAL_MAX_MESSAGE_BYTES = 120;
export const CELESTIAL_MAX_SAVED_SESSIONS = 100;
export const CELESTIAL_SAMPLE_RATE_HZ = 44_100;
export const CELESTIAL_INTER_SYMBOL_GAP_MS = 12;
export const CELESTIAL_SYMBOL_DURATION_OPTIONS = [50, 75, 100] as const;
export const CELESTIAL_OUTPUT_LEVEL_OPTIONS = [0.04, 0.08, 0.12] as const;

const DTMF_LOW_HZ = [697, 770, 852, 941] as const;
const DTMF_HIGH_HZ = [1209, 1336, 1477, 1633] as const;
const SYNC_NIBBLES = [15, 15, 10, 5] as const;
const FRAME_MAGIC = [0x5a, 0x43] as const;
const FRAME_VERSION = 1;
const CRC_POLYNOMIAL = 0x1021;
const CRC_INITIAL = 0xffff;

export const RESEARCH_DOMAINS = CIG_DOMAIN_IDS;

export type ResearchDomain = string;
export type ResearchIntent = 'research-message' | 'prayer';
export type HypothesisStatus = 'open' | 'tentative' | 'not-observed';
export type ResearchIdentityType = 'firebase-uid' | 'anonymous-browser';

export type ResearchSource = {
  type: 'human-authored' | 'microphone-observation';
  label: string;
  capturedAt: string;
};

export type ResearchMessage = {
  text: string;
  intent: ResearchIntent;
  source: ResearchSource;
};

export type ExperimentalEncoding = {
  protocolId: typeof CELESTIAL_PROTOCOL_ID;
  method: 'four-by-four-dual-tone-nibble';
  symbolDurationMs: (typeof CELESTIAL_SYMBOL_DURATION_OPTIONS)[number];
  interSymbolGapMs: typeof CELESTIAL_INTER_SYMBOL_GAP_MS;
  outputChannel: 'local-speaker';
  sampleRateHz: typeof CELESTIAL_SAMPLE_RATE_HZ;
  outputLevel: (typeof CELESTIAL_OUTPUT_LEVEL_OPTIONS)[number];
  carrierFrequenciesHz: number[];
};

export type EncodedSignal = {
  protocolId: typeof CELESTIAL_PROTOCOL_ID;
  symbols: number[];
  payloadByteLength: number;
  checksum: number;
  symbolDurationMs: number;
  interSymbolGapMs: number;
  sampleRateHz: number;
  durationSeconds: number;
  carrierFrequenciesHz: number[];
};

export type ObservationWindow = {
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  source: 'browser-microphone';
};

export type ResearchObservation = {
  id: string;
  instrumentId?: string;
  source: ResearchSource;
  window: ObservationWindow;
  sampleRateHz: number;
  fftSize: number;
  frequencyResolutionHz: number;
  dominantFrequencyHz: number | null;
  topPeaksHz: number[];
  rmsLevel: number;
  notes: string;
};

export type ResearchInterpretation = {
  measuredPattern: string;
  uncertainty: string;
  personalReflection: string;
  createdAt: string;
};

export type ResearchFinding = {
  statement: string;
  basis: string;
  confidence: 'low' | 'moderate';
  createdAt: string;
};

export type ResearchHypothesis = {
  statement: string;
  status: HypothesisStatus;
  updatedAt: string;
};

export type ResearchSession = {
  schemaVersion: 1;
  id: string;
  domain: ResearchDomain;
  createdAt: string;
  updatedAt: string;
  message: ResearchMessage;
  encoding: ExperimentalEncoding;
  signal: EncodedSignal | null;
  transmission: {
    authorizedAt: string;
    completedAt: string | null;
    outputChannel: 'local-speaker';
    stoppedEarly: boolean;
  } | null;
  observationWindow: ObservationWindow | null;
  observations: ResearchObservation[];
  interpretation: ResearchInterpretation | null;
  hypothesis: ResearchHypothesis | null;
  findings: ResearchFinding[];
  universalExperiment?: UniversalExperiment;
};

const isoDate = z.string().datetime();
const sourceSchema = z.object({
  type: z.enum(['human-authored', 'microphone-observation']),
  label: z.string().min(1).max(100),
  capturedAt: isoDate,
}).strict();

const observationWindowSchema = z.object({
  startedAt: isoDate,
  endedAt: isoDate,
  durationSeconds: z.number().finite().positive().max(3600),
  source: z.literal('browser-microphone'),
}).strict();

const observationSchema = z.object({
  id: z.string().uuid(),
  instrumentId: z.string().min(1).max(120).optional(),
  source: sourceSchema,
  window: observationWindowSchema,
  sampleRateHz: z.number().int().min(8000).max(192000),
  fftSize: z.number().int().min(2048).max(8192),
  frequencyResolutionHz: z.number().finite().positive(),
  dominantFrequencyHz: z.number().finite().positive().nullable(),
  topPeaksHz: z.array(z.number().finite().positive()).max(6),
  rmsLevel: z.number().finite().min(0).max(1),
  notes: z.string().max(2000),
}).strict().superRefine((observation, context) => {
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

const sessionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  domain: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]{1,95}$/),
  createdAt: isoDate,
  updatedAt: isoDate,
  message: z.object({
    text: z.string().max(CELESTIAL_MAX_MESSAGE_BYTES),
    intent: z.enum(['research-message', 'prayer']),
    source: sourceSchema,
  }).strict(),
  encoding: z.object({
    protocolId: z.literal(CELESTIAL_PROTOCOL_ID),
    method: z.literal('four-by-four-dual-tone-nibble'),
    symbolDurationMs: z.union([
      z.literal(50),
      z.literal(75),
      z.literal(100),
    ]),
    interSymbolGapMs: z.literal(CELESTIAL_INTER_SYMBOL_GAP_MS),
    outputChannel: z.literal('local-speaker'),
    sampleRateHz: z.literal(CELESTIAL_SAMPLE_RATE_HZ),
    outputLevel: z.union([
      z.literal(0.04),
      z.literal(0.08),
      z.literal(0.12),
    ]),
    carrierFrequenciesHz: z.array(z.number().int()).length(8),
  }).strict(),
  signal: z.object({
    protocolId: z.literal(CELESTIAL_PROTOCOL_ID),
    symbols: z.array(z.number().int().min(0).max(15)).max(400),
    payloadByteLength: z.number().int().min(1).max(CELESTIAL_MAX_MESSAGE_BYTES),
    checksum: z.number().int().min(0).max(65535),
    symbolDurationMs: z.number().int().positive().max(100),
    interSymbolGapMs: z.number().int().nonnegative().max(100),
    sampleRateHz: z.number().int().min(8000).max(192000),
    durationSeconds: z.number().finite().positive().max(120),
    carrierFrequenciesHz: z.array(z.number().int()).length(8),
  }).strict().nullable(),
  transmission: z.object({
    authorizedAt: isoDate,
    completedAt: isoDate.nullable(),
    outputChannel: z.literal('local-speaker'),
    stoppedEarly: z.boolean(),
  }).strict().nullable(),
  observationWindow: observationWindowSchema.nullable(),
  observations: z.array(observationSchema).max(30),
  interpretation: z.object({
    measuredPattern: z.string().max(1500),
    uncertainty: z.string().max(1500),
    personalReflection: z.string().max(1500),
    createdAt: isoDate,
  }).strict().nullable(),
  hypothesis: z.object({
    statement: z.string().max(1200),
    status: z.enum(['open', 'tentative', 'not-observed']),
    updatedAt: isoDate,
  }).strict().nullable(),
  findings: z.array(z.object({
    statement: z.string().min(1).max(1000),
    basis: z.string().min(1).max(1000),
    confidence: z.enum(['low', 'moderate']),
    createdAt: isoDate,
  }).strict()).max(30),
  universalExperiment: universalExperimentSchema.optional(),
}).strict().superRefine((session, context) => {
  if (new TextEncoder().encode(session.message.text).byteLength > CELESTIAL_MAX_MESSAGE_BYTES) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message', 'text'],
      message: `Message must be no more than ${CELESTIAL_MAX_MESSAGE_BYTES} UTF-8 bytes.`,
    });
  }
});

export function crc16Ccitt(bytes: Uint8Array) {
  let crc = CRC_INITIAL;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ CRC_POLYNOMIAL) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function nibblesFromBytes(bytes: Uint8Array) {
  return Array.from(bytes).flatMap(byte => [byte >>> 4, byte & 0x0f]);
}

function bytesFromNibbles(symbols: number[]) {
  if (symbols.length % 2 !== 0 || symbols.some(value => !Number.isInteger(value) || value < 0 || value > 15)) {
    throw new Error('The experimental signal has an invalid symbol sequence.');
  }
  const bytes = new Uint8Array(symbols.length / 2);
  for (let index = 0; index < symbols.length; index += 2) {
    bytes[index / 2] = (symbols[index] << 4) | symbols[index + 1];
  }
  return bytes;
}

export function encodeCelestialMessage(
  message: string,
  symbolDurationMs: number = 75,
): EncodedSignal {
  if (!message.trim()) throw new Error('Write a message before generating a signal.');
  if (!CELESTIAL_SYMBOL_DURATION_OPTIONS.some(option => option === symbolDurationMs)) {
    throw new Error('Choose a supported symbol duration.');
  }
  const payload = new TextEncoder().encode(message);
  if (payload.length > CELESTIAL_MAX_MESSAGE_BYTES) {
    throw new Error(`The encoded message is limited to ${CELESTIAL_MAX_MESSAGE_BYTES} UTF-8 bytes.`);
  }

  const frame = new Uint8Array(5 + payload.length);
  frame.set(FRAME_MAGIC, 0);
  frame[2] = FRAME_VERSION;
  frame[3] = (payload.length >>> 8) & 0xff;
  frame[4] = payload.length & 0xff;
  frame.set(payload, 5);
  const checksum = crc16Ccitt(frame);
  const packetBytes = new Uint8Array(frame.length + 2);
  packetBytes.set(frame);
  packetBytes[frame.length] = checksum >>> 8;
  packetBytes[frame.length + 1] = checksum & 0xff;
  const symbols = [...SYNC_NIBBLES, ...nibblesFromBytes(packetBytes)];
  const durationSeconds = symbols.length
    * (symbolDurationMs + CELESTIAL_INTER_SYMBOL_GAP_MS) / 1000;

  return {
    protocolId: CELESTIAL_PROTOCOL_ID,
    symbols,
    payloadByteLength: payload.length,
    checksum,
    symbolDurationMs,
    interSymbolGapMs: CELESTIAL_INTER_SYMBOL_GAP_MS,
    sampleRateHz: CELESTIAL_SAMPLE_RATE_HZ,
    durationSeconds,
    carrierFrequenciesHz: [...DTMF_LOW_HZ, ...DTMF_HIGH_HZ],
  };
}

export function decodeCelestialSymbols(symbols: number[]) {
  if (symbols.length < SYNC_NIBBLES.length || !SYNC_NIBBLES.every((value, index) => symbols[index] === value)) {
    throw new Error('The experimental packet sync sequence is missing.');
  }
  const bytes = bytesFromNibbles(symbols.slice(SYNC_NIBBLES.length));
  if (bytes.length < 7) throw new Error('The experimental packet is incomplete.');
  if (bytes[0] !== FRAME_MAGIC[0] || bytes[1] !== FRAME_MAGIC[1] || bytes[2] !== FRAME_VERSION) {
    throw new Error('The experimental packet header or version is not recognized.');
  }
  const payloadLength = (bytes[3] << 8) | bytes[4];
  if (payloadLength > CELESTIAL_MAX_MESSAGE_BYTES || bytes.length !== 5 + payloadLength + 2) {
    throw new Error('The experimental packet length does not match its frame.');
  }
  const frame = bytes.slice(0, 5 + payloadLength);
  const expectedCrc = crc16Ccitt(frame);
  const actualCrc = (bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1];
  if (actualCrc !== expectedCrc) throw new Error('The experimental packet checksum failed.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(5, 5 + payloadLength));
  } catch {
    throw new Error('The experimental packet payload is not valid UTF-8.');
  }
}

export function createCelestialWaveform(
  signal: EncodedSignal,
  outputLevel: number,
): Float32Array {
  if (!Number.isFinite(outputLevel) || outputLevel < 0.02 || outputLevel > 0.12) {
    throw new Error('Output level must be between 0.02 and 0.12.');
  }
  const sampleRate = signal.sampleRateHz;
  const symbolSamples = Math.round(sampleRate * signal.symbolDurationMs / 1000);
  const gapSamples = Math.round(sampleRate * signal.interSymbolGapMs / 1000);
  const samplesPerStep = symbolSamples + gapSamples;
  const waveform = new Float32Array(signal.symbols.length * samplesPerStep);
  const fadeSamples = Math.max(1, Math.round(sampleRate * 0.006));

  signal.symbols.forEach((symbol, symbolIndex) => {
    if (!Number.isInteger(symbol) || symbol < 0 || symbol > 15) {
      throw new Error('The experimental signal contains an invalid tone symbol.');
    }
    const lowHz = DTMF_LOW_HZ[Math.floor(symbol / 4)];
    const highHz = DTMF_HIGH_HZ[symbol % 4];
    const offset = symbolIndex * samplesPerStep;
    for (let sample = 0; sample < symbolSamples; sample++) {
      const edge = Math.min(sample, symbolSamples - sample - 1);
      const envelope = Math.min(1, edge / fadeSamples);
      const time = sample / sampleRate;
      waveform[offset + sample] = (
        Math.sin(2 * Math.PI * lowHz * time)
        + Math.sin(2 * Math.PI * highHz * time)
      ) * outputLevel * 0.45 * envelope;
    }
  });
  return waveform;
}

export function createResearchSession(
  options: { id?: string; now?: string; domain?: ResearchDomain } = {},
): ResearchSession {
  const now = options.now ?? new Date().toISOString();
  return {
    schemaVersion: 1,
    id: options.id ?? crypto.randomUUID(),
    domain: options.domain ?? 'celestial-exploration',
    createdAt: now,
    updatedAt: now,
    message: {
      text: '',
      intent: 'research-message',
      source: { type: 'human-authored', label: 'User-composed text', capturedAt: now },
    },
    encoding: {
      protocolId: CELESTIAL_PROTOCOL_ID,
      method: 'four-by-four-dual-tone-nibble',
      symbolDurationMs: 75,
      interSymbolGapMs: CELESTIAL_INTER_SYMBOL_GAP_MS,
      outputChannel: 'local-speaker',
      sampleRateHz: CELESTIAL_SAMPLE_RATE_HZ,
      outputLevel: 0.08,
      carrierFrequenciesHz: [...DTMF_LOW_HZ, ...DTMF_HIGH_HZ],
    },
    signal: null,
    transmission: null,
    observationWindow: null,
    observations: [],
    interpretation: null,
    hypothesis: null,
    findings: [],
  };
}

export function validateResearchSession(value: unknown) {
  return sessionSchema.safeParse(value);
}

export function createUniversalExperiment(
  session: ResearchSession,
  participantRef: string,
  identityType: ResearchIdentityType = 'firebase-uid',
): UniversalExperiment {
  researchStorageKeyForScope(participantRef);
  const domainDefinition = researchGridRegistry.getDomain(session.domain);
  const observations = session.observations.map(observation =>
    signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, observation));
  const summary = observations.length > 0 ? summarizeResearchPatterns([session]) : null;
  const analysisAgent = summary?.agent ?? null;
  const methods: UniversalExperiment['methods'] = [{
    id: CIG_METHOD_IDS.humanInput,
    version: researchGridRegistry.getMethod(CIG_METHOD_IDS.humanInput)?.version ?? '1.0.0',
    parameters: [{ name: 'intent', value: session.message.intent }],
  }];
  const instruments: UniversalExperiment['instruments'] = [{
    id: 'instrument.zioncore-research-interface',
    role: 'software',
    modality: 'symbolic',
    name: 'ZionCore Research Interface',
    calibration: 'not-applicable',
  }];
  const sources: UniversalExperiment['sources'] = [{
    id: `${session.id}:message`,
    recordReference: `session:${session.id}:message`,
    kind: 'human-authored',
    label: session.message.source.label,
    capturedAt: session.message.source.capturedAt,
    content: null,
  }];
  const adapters: UniversalExperiment['provenance']['adapters'] = [];

  if (session.signal) {
    const method = researchGridRegistry.getMethod(CIG_METHOD_IDS.localToneEncoding);
    methods.push({
      id: CIG_METHOD_IDS.localToneEncoding,
      version: method?.version ?? '1.0.0',
      parameters: [
        { name: 'symbolDuration', value: session.signal.symbolDurationMs, unit: 'ms' },
        { name: 'interSymbolGap', value: session.signal.interSymbolGapMs, unit: 'ms' },
        { name: 'outputLevel', value: session.encoding.outputLevel, unit: 'full-scale fraction' },
      ],
    });
    instruments.push({
      id: 'instrument.webaudio-local-speaker',
      role: 'output',
      modality: 'acoustic',
      name: 'Local Web Audio speaker output',
      calibration: 'not-applicable',
    });
  }

  if (observations.length > 0) {
    const adapter = signalAdapterRegistry.get(SIGNAL_ADAPTER_IDS.browserAcoustic);
    const method = researchGridRegistry.getMethod(CIG_METHOD_IDS.microphoneSpectrum);
    const sampleRates = [...new Set(session.observations.map(item => item.sampleRateHz))].sort((a, b) => a - b);
    const fftSizes = [...new Set(session.observations.map(item => item.fftSize))].sort((a, b) => a - b);
    methods.push({
      id: CIG_METHOD_IDS.microphoneSpectrum,
      version: method?.version ?? '1.0.0',
      parameters: [
        { name: 'sampleRatesHz', value: sampleRates.join(',') },
        { name: 'fftSizes', value: fftSizes.join(',') },
      ],
    });
    const inputInstrumentIds = [...new Set(session.observations.map(item =>
      item.instrumentId ?? 'instrument.browser-microphone-web-audio'))];
    for (const instrumentId of inputInstrumentIds) {
      const descriptor = instrumentRegistry.get(instrumentId)?.descriptor;
      const calibration = descriptor?.calibration.status;
      instruments.push({
        id: instrumentId,
        role: 'input',
        modality: descriptor?.modalities[0] ?? 'acoustic',
        name: descriptor?.name ?? instrumentId,
        calibration: calibration === 'not-applicable'
          ? 'not-applicable'
          : calibration === 'factory-calibrated' || calibration === 'user-calibrated'
            ? 'calibrated'
            : 'uncalibrated',
      });
    }
    if (adapter) adapters.push({ id: adapter.id, version: adapter.version });
  }

  if (analysisAgent && summary) {
    const method = researchGridRegistry.getMethod(CIG_METHOD_IDS.measuredSummary);
    methods.push({
      id: CIG_METHOD_IDS.measuredSummary,
      version: method?.version ?? '1.0.0',
      parameters: [{ name: 'costBudget', value: 0, unit: 'USD' }],
    });
  }

  for (const observation of session.observations) {
    sources.push({
      id: `${session.id}:observation:${observation.id}`,
      recordReference: `session:${session.id}:observation:${observation.id}`,
      kind: 'environmental-observation',
      label: observation.source.label,
      capturedAt: observation.source.capturedAt,
      content: null,
    });
  }

  return universalExperimentSchema.parse({
    schemaVersion: 'zc-cig-experiment/v1',
    id: session.id,
    participant: { reference: participantRef, identityType },
    domain: {
      id: session.domain,
      label: domainDefinition?.label ?? session.domain,
      registryVersion: domainDefinition?.version ?? 'unregistered',
    },
    instruments,
    sources,
    signal: {
      modality: session.signal ? 'acoustic' : 'symbolic',
      protocolId: session.signal?.protocolId ?? null,
      generatedContent: session.message.text,
      encodedSymbols: session.signal?.symbols ?? [],
      sampleRateHz: session.signal?.sampleRateHz ?? null,
      carrierFrequenciesHz: session.signal?.carrierFrequenciesHz ?? null,
      durationSeconds: session.signal?.durationSeconds ?? 0,
      checksum: session.signal?.checksum ?? null,
    },
    methods,
    hypothesis: session.hypothesis,
    interpretation: session.interpretation,
    transmission: {
      status: !session.transmission
        ? 'not-started'
        : session.transmission.stoppedEarly
          ? 'stopped'
          : session.transmission.completedAt
            ? 'completed'
            : 'authorized',
      channel: session.transmission?.outputChannel ?? 'none',
      authorizedAt: session.transmission?.authorizedAt ?? null,
      completedAt: session.transmission?.completedAt ?? null,
      externalTransmission: false,
    },
    observations,
    results: {
      observationCount: observations.length,
      analysisAgent: analysisAgent && summary ? {
        id: analysisAgent.id,
        kind: analysisAgent.kind,
        provider: analysisAgent.provider,
        estimatedCostUsd: analysisAgent.estimatedCostUsd ?? 0,
      } : null,
      descriptiveSummary: summary ? {
        medianDominantFrequencyHz: summary.medianDominantFrequencyHz,
        meanRmsLevel: summary.meanRmsLevel,
        message: summary.message,
        limitation: summary.limitation,
      } : null,
      findings: session.findings,
    },
    provenance: {
      sourceSessionId: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      generatedBy: 'zioncore-research-grid',
      storage: 'browser-local-unencrypted',
      adapters,
    },
  });
}

export function researchStorageKeyForScope(scopeRef: string) {
  if (typeof scopeRef !== 'string' || scopeRef.length < 1 || scopeRef.length > 128) {
    throw new Error('Sign in or provide a local visitor scope for the research archive.');
  }
  return `${CELESTIAL_STORAGE_KEY}.${encodeURIComponent(scopeRef)}`;
}

export function researchStorageKeyForOwner(ownerUid: string) {
  return researchStorageKeyForScope(ownerUid);
}

export function readResearchSessions(
  scopeRef: string,
  identityType: ResearchIdentityType = 'firebase-uid',
): ResearchSession[] {
  if (typeof localStorage === 'undefined') return [];
  const saved = localStorage.getItem(researchStorageKeyForScope(scopeRef));
  if (!saved) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error('Saved research history could not be read. Its stored copy was left unchanged.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved research history has an unexpected format. Its stored copy was left unchanged.');
  }
  const result = z.array(sessionSchema).max(CELESTIAL_MAX_SAVED_SESSIONS).safeParse(parsed);
  if (!result.success) {
    throw new Error('Saved research history failed validation. Its stored copy was left unchanged.');
  }
  return result.data.map(session => ({
    ...session,
    universalExperiment: createUniversalExperiment(session, scopeRef, identityType),
  }));
}

export function writeResearchSessions(
  scopeRef: string,
  sessions: ResearchSession[],
  identityType: ResearchIdentityType = 'firebase-uid',
) {
  if (typeof localStorage === 'undefined') {
    throw new Error('Browser storage is unavailable.');
  }
  const key = researchStorageKeyForScope(scopeRef);
  const canonicalSessions = sessions.map(session => ({
    ...session,
    universalExperiment: createUniversalExperiment(session, scopeRef, identityType),
  }));
  const result = z.array(sessionSchema).max(CELESTIAL_MAX_SAVED_SESSIONS).safeParse(canonicalSessions);
  if (!result.success) {
    throw new Error('Research session failed validation and was not saved.');
  }
  try {
    localStorage.setItem(key, JSON.stringify(result.data));
  } catch {
    throw new Error('Could not save this session in browser storage. Check available space and try again.');
  }
}

export function summarizeResearchPatterns(sessions: ResearchSession[]) {
  const observations = sessions.flatMap(session => session.observations);
  if (observations.length === 0) return null;
  const normalized = observations.map(observation =>
    signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, observation));
  const task = sessions.length > 1 ? 'pattern-comparison' : 'descriptive-summary';
  const execution = researchAgentRouter.executeSync({
    task,
    modalities: ['acoustic'],
    maxCostUsd: 0,
  }, {
    experimentId: sessions.map(session => session.id).join(','),
    observations: normalized,
    sessionsWithObservations: new Set(
      sessions.filter(session => session.observations.length > 0).map(session => session.id),
    ).size,
  });
  if (!execution) return null;
  const metric = (name: string) => execution.output.metrics.find(item => item.name === name)?.value ?? null;
  const medianPeak = metric('median-dominant-frequency');
  const meanRms = metric('mean-rms-amplitude') ?? 0;
  return {
    observationCount: observations.length,
    sessionsWithObservations: new Set(sessions.filter(session => session.observations.length > 0).map(session => session.id)).size,
    medianDominantFrequencyHz: medianPeak,
    meanRmsLevel: meanRms,
    message: execution.output.summary,
    limitation: execution.output.limitations.join(' '),
    agent: execution.agent,
  };
}
