import { z } from 'zod';

export const signalModalitySchema = z.enum([
  'acoustic',
  'bioelectrical-measurement',
  'radio-frequency-iq',
  'acceleration',
  'environmental-measurement',
  'geophysical-measurement',
  'astronomical-measurement',
  'unknown-digital-signal',
]);

export const domainAvailabilitySchema = z.enum([
  'available-now',
  'file-import',
  'interpretive-layer',
  'hypothesis-only',
  'hardware-required',
  'research-path',
]);

const researchMethodSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(3).max(100),
  execution: z.enum([
    'browser-local',
    'credit-quoted',
    'compatible-instrument',
    'research-only',
  ]),
  purpose: z.string().min(8).max(240),
}).strict();

export const intelligenceDomainSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,64}$/),
  name: z.string().min(2).max(100),
  modality: signalModalitySchema,
  availability: domainAvailabilitySchema,
  supportedSources: z.array(z.string().min(2).max(80)).max(12),
  methods: z.array(researchMethodSchema).max(12),
  interpretationLayer: z.enum([
    'measurement',
    'evidence-based-hypothesis',
    'user-selected-reflection',
    'future-research',
  ]),
  guidance: z.string().min(12).max(260),
}).strict();

export type SignalModality = z.infer<typeof signalModalitySchema>;
export type IntelligenceDomain = z.infer<typeof intelligenceDomainSchema>;

export const builtInIntelligenceDomains: IntelligenceDomain[] = [
  {
    id: 'acoustic-patterns',
    name: 'Acoustic frequency patterns',
    modality: 'acoustic',
    availability: 'available-now',
    supportedSources: ['browser microphone', 'standard audio file', 'high-rate WAV file'],
    methods: [
      { id: 'spectral-peak-comparison', name: 'Spectral peak comparison', execution: 'browser-local', purpose: 'Compare measured peaks and capture settings across observations.' },
      { id: 'recording-settings-check', name: 'Recording-settings check', execution: 'browser-local', purpose: 'Flag sample-rate, FFT-size, and capture-mode differences before interpreting changes.' },
      { id: 'spectrogram-review', name: 'Spectrogram and temporal review', execution: 'browser-local', purpose: 'Inspect how measurable frequency energy changes over time.' },
      { id: 'zioncore-interpretation', name: 'ZionCore interpretation', execution: 'credit-quoted', purpose: 'Request a detailed reading after reviewing and approving the current quote.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'Begin with measured frequency, level, timing, and capture conditions; source and meaning remain separate questions.',
  },
  {
    id: 'bioacoustic-exploration',
    name: 'Animal and bioacoustic exploration',
    modality: 'acoustic',
    availability: 'hypothesis-only',
    supportedSources: ['field recording', 'audio file', 'ultrasonic WAV file'],
    methods: [
      { id: 'recurring-vocal-patterns', name: 'Recurring vocal-pattern comparison', execution: 'browser-local', purpose: 'Compare timing and spectral patterns between recordings.' },
      { id: 'animal-context-reading', name: 'Animal-context interpretation', execution: 'credit-quoted', purpose: 'Generate a clearly labelled research hypothesis from the provided signal and context.' },
    ],
    interpretationLayer: 'evidence-based-hypothesis',
    guidance: 'Use traceable reference recordings for species or behavior claims; unsupported source identifications remain hypotheses.',
  },
  {
    id: 'environmental-acoustics',
    name: 'Environmental sound and ambience',
    modality: 'acoustic',
    availability: 'available-now',
    supportedSources: ['browser microphone', 'standard audio file', 'field recording'],
    methods: [
      { id: 'ambient-spectrum', name: 'Ambient spectrum review', execution: 'browser-local', purpose: 'Describe measured spectral and temporal characteristics of an environmental recording.' },
      { id: 'repeat-condition-test', name: 'Repeat-condition experiment', execution: 'browser-local', purpose: 'Compare captures made with similar settings and recording conditions.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'ZionCore can describe sound patterns; the user supplies place, context, and personal meaning.',
  },
  {
    id: 'ultrasonic-acoustics',
    name: 'Ultrasonic acoustic research',
    modality: 'acoustic',
    availability: 'file-import',
    supportedSources: ['high-rate WAV file', 'compatible high-sample-rate receiver'],
    methods: [
      { id: 'native-rate-spectrum', name: 'Native-rate spectral analysis', execution: 'browser-local', purpose: 'Analyze the recorded bandwidth supported by the file sample rate without resampling upward.' },
      { id: 'ultrasonic-capture-check', name: 'Receiver and capture verification', execution: 'compatible-instrument', purpose: 'Validate live capture against a known safe tone and a documented receiver.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'A high sample rate supports analysis bandwidth but does not by itself prove microphone or receiver response.',
  },
  {
    id: 'spiritual-reflection',
    name: 'Spiritual and devotional reflection',
    modality: 'acoustic',
    availability: 'interpretive-layer',
    supportedSources: ['user-selected acoustic observation', 'user-selected faith or personal context'],
    methods: [
      { id: 'chosen-context-reflection', name: 'User-chosen reflection', execution: 'credit-quoted', purpose: 'Offer a clearly labelled spiritual reflection grounded in the selected context and observed measurements.' },
    ],
    interpretationLayer: 'user-selected-reflection',
    guidance: 'Reflection is an additional meaning-making layer selected by the user, not a sensor measurement or verified supernatural attribution.',
  },
  {
    id: 'celestial-inquiry',
    name: 'Celestial signal inquiry',
    modality: 'acoustic',
    availability: 'hypothesis-only',
    supportedSources: ['user-selected acoustic observation', 'compatible receiver recording'],
    methods: [
      { id: 'repeat-control-comparison', name: 'Repeat and control comparison', execution: 'browser-local', purpose: 'Compare repeated captures and known controls before developing a source hypothesis.' },
      { id: 'celestial-context-reading', name: 'Celestial-context interpretation', execution: 'credit-quoted', purpose: 'Explore a user-selected celestial question as a clearly labelled hypothesis.' },
    ],
    interpretationLayer: 'evidence-based-hypothesis',
    guidance: 'Acoustic patterns can be explored through a celestial lens; attribution requires independent, appropriate instrument evidence.',
  },
  {
    id: 'radio-frequency-reception',
    name: 'Radio-frequency signal reception',
    modality: 'radio-frequency-iq',
    availability: 'file-import',
    supportedSources: ['SDR IQ recording', 'authorized receiver export'],
    methods: [
      { id: 'iq-spectrum-analysis', name: 'IQ spectrum analysis', execution: 'browser-local', purpose: 'Inspect supported complex-sample recordings while preserving radio-frequency units and metadata.' },
      { id: 'receiver-required', name: 'Live receiver acquisition', execution: 'compatible-instrument', purpose: 'Acquire through an authorized receiver or authenticated local bridge.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'Radio-frequency data requires an RF receiver or IQ file; an ordinary microphone does not measure RF.',
  },
  {
    id: 'vibration-sensing',
    name: 'Vibration and acceleration',
    modality: 'acceleration',
    availability: 'file-import',
    supportedSources: ['accelerometer CSV', 'compatible motion sensor'],
    methods: [
      { id: 'acceleration-spectrum', name: 'Acceleration spectrum', execution: 'browser-local', purpose: 'Analyze timestamped acceleration values in their original physical units.' },
      { id: 'motion-sensor-bridge', name: 'Live sensor bridge', execution: 'compatible-instrument', purpose: 'Read a supported accelerometer through an authorized device connection.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'Acceleration is kept distinct from acoustic pressure and radio-frequency samples.',
  },
  {
    id: 'geophysical-measurements',
    name: 'Geophysical measurements',
    modality: 'geophysical-measurement',
    availability: 'research-path',
    supportedSources: ['future compatible field instrument'],
    methods: [
      { id: 'geophysical-adapter', name: 'Geophysical sensor adapter', execution: 'research-only', purpose: 'Add a documented adapter with units, calibration metadata, and provenance before analysis.' },
    ],
    interpretationLayer: 'future-research',
    guidance: 'The domain is prepared for documented instrument adapters; no geophysical reading is inferred from microphone data.',
  },
  {
    id: 'radio-astronomy',
    name: 'Radio astronomy and astronomical signals',
    modality: 'astronomical-measurement',
    availability: 'research-path',
    supportedSources: ['future compatible radio-astronomy receiver', 'authorized instrument export'],
    methods: [
      { id: 'astronomy-adapter', name: 'Astronomical receiver adapter', execution: 'research-only', purpose: 'Add instrument-specific units, acquisition metadata, calibration, and provenance.' },
    ],
    interpretationLayer: 'future-research',
    guidance: 'Astronomical observations require appropriate receivers and traceable instrument data.',
  },
  {
    id: 'hydroacoustic-research',
    name: 'Hydrophone and underwater acoustics',
    modality: 'acoustic',
    availability: 'file-import',
    supportedSources: ['hydrophone WAV recording', 'compatible audio interface'],
    methods: [
      { id: 'hydrophone-spectrum', name: 'Underwater recording spectrum', execution: 'browser-local', purpose: 'Inspect supported audio-file measurements while retaining the source label and units supplied by the instrument.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'A WAV can be measured as audio; underwater pressure calibration and hydrophone response require instrument metadata.',
  },
  {
    id: 'plant-electrophysiology',
    name: 'Plant electrophysiology and biological sensors',
    modality: 'bioelectrical-measurement',
    availability: 'file-import',
    supportedSources: ['timestamped sensor CSV', 'future documented bioelectrical adapter'],
    methods: [
      { id: 'bioelectrical-timeseries', name: 'Bioelectrical time-series inspection', execution: 'browser-local', purpose: 'Summarize timestamped values while preserving the source-provided unit; biological interpretation requires a validated protocol.' },
      { id: 'bioelectrical-adapter', name: 'Specialist sensor adapter', execution: 'research-only', purpose: 'Add documented sensor units, sampling, calibration, and reference data before interpreting biological meaning.' },
    ],
    interpretationLayer: 'evidence-based-hypothesis',
    guidance: 'Generic time-series measurements can be inspected; plant response or communication claims need a validated sensor method and references.',
  },
  {
    id: 'astronomical-public-data',
    name: 'Astronomical public datasets',
    modality: 'astronomical-measurement',
    availability: 'file-import',
    supportedSources: ['compatible timestamped CSV or TXT export', 'future observatory adapter'],
    methods: [
      { id: 'astronomy-timeseries-import', name: 'Timestamped dataset inspection', execution: 'browser-local', purpose: 'Summarize supported timestamped tabular exports without asserting astronomical origin from values alone.' },
      { id: 'astronomy-reference-review', name: 'Instrument provenance review', execution: 'research-only', purpose: 'Retain observatory, instrument, calibration, and source metadata for later expert comparison.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'Supported table exports can be inspected; specialized FITS/HDF5 parsing and observatory validation require dedicated adapters.',
  },
  {
    id: 'multichannel-spatial-signals',
    name: 'Multichannel and spatial recordings',
    modality: 'acoustic',
    availability: 'file-import',
    supportedSources: ['multichannel WAV metadata', 'future synchronized sensor streams'],
    methods: [
      { id: 'channel-metadata-review', name: 'Channel and timebase review', execution: 'browser-local', purpose: 'Retain channel count and capture timing where the source format declares them.' },
      { id: 'spatial-reconstruction', name: 'Spatial reconstruction', execution: 'research-only', purpose: 'Requires synchronized, calibrated channels and known sensor geometry.' },
    ],
    interpretationLayer: 'measurement',
    guidance: 'Channel metadata is distinct from spatial reconstruction, which needs synchronized calibrated sensors and their geometry.',
  },
];

export function createIntelligenceDomainRegistry(
  initial: readonly IntelligenceDomain[] = builtInIntelligenceDomains,
) {
  const domains = new Map<string, IntelligenceDomain>();
  for (const candidate of initial) {
    const domain = intelligenceDomainSchema.parse(candidate);
    if (domains.has(domain.id)) throw new Error(`Duplicate intelligence domain: ${domain.id}`);
    domains.set(domain.id, domain);
  }

  return {
    list(): IntelligenceDomain[] {
      return [...domains.values()].map(domain => structuredClone(domain));
    },
    get(id: string): IntelligenceDomain | null {
      const domain = domains.get(id);
      return domain ? structuredClone(domain) : null;
    },
    register(candidate: unknown): IntelligenceDomain {
      const domain = intelligenceDomainSchema.parse(candidate);
      if (domains.has(domain.id)) throw new Error(`Duplicate intelligence domain: ${domain.id}`);
      domains.set(domain.id, domain);
      return structuredClone(domain);
    },
  };
}

export const cosmicIntelligenceGrid = createIntelligenceDomainRegistry();

export const universalSignalSchema = z.object({
  id: z.string().min(1).max(128),
  modality: signalModalitySchema,
  source: z.object({
    kind: z.enum(['microphone', 'audio-file', 'sdr-file', 'accelerometer-file', 'sensor-bridge', 'other']),
    label: z.string().min(1).max(120),
    deviceModel: z.string().max(120).nullable(),
  }).strict(),
  sampleRateHz: z.number().positive().finite().nullable(),
  channelCount: z.number().int().min(1).max(64).nullable(),
  measurements: z.array(z.object({
    name: z.string().min(1).max(64),
    value: z.number().finite().nullable(),
    unit: z.string().min(1).max(32),
    uncertainty: z.number().min(0).finite().nullable(),
  }).strict()).max(64),
  capturedAt: z.string().datetime(),
  timebase: z.object({
    startAt: z.string().datetime().nullable(),
    durationSeconds: z.number().min(0).finite().nullable(),
    sampleClockHz: z.number().positive().finite().nullable(),
  }).strict(),
  spatialContext: z.object({
    coordinateSystem: z.string().min(2).max(80),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    elevationMeters: z.number().finite().nullable(),
  }).strict().nullable(),
  calibration: z.object({
    status: z.enum(['documented', 'manufacturer-specification', 'uncalibrated', 'unknown']),
    method: z.string().max(160).nullable(),
    reference: z.string().max(160).nullable(),
    uncertaintyUnit: z.string().max(32).nullable(),
  }).strict(),
  provenance: z.object({
    sourceRecordId: z.string().min(1).max(128),
    origin: z.enum(['microphone', 'audio-file', 'sdr-file', 'accelerometer-file', 'sensor-bridge', 'other']),
    transformations: z.array(z.string().min(1).max(120)).max(16),
  }).strict(),
}).strict();

export const universalExperimentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(128),
  createdAt: z.string().datetime(),
  participant: z.object({
    scope: z.literal('browser-profile'),
    reference: z.literal('current-local-participant'),
  }).strict(),
  domainId: z.string().regex(/^[a-z0-9-]{2,64}$/),
  instrument: z.object({
    category: z.enum(['browser-audio', 'recording-file', 'sdr', 'accelerometer', 'environmental-sensor', 'other']),
    model: z.string().max(120).nullable(),
    identification: z.enum(['identified', 'generic', 'unknown']),
  }).strict(),
  source: z.object({
    kind: z.enum(['saved-observations', 'live-capture', 'imported-recording', 'transmission-experiment', 'other']),
    label: z.string().min(1).max(120),
    observationIds: z.array(z.string().min(1).max(128)).max(32),
  }).strict(),
  signals: z.array(universalSignalSchema).min(1).max(32),
  hypothesis: z.object({
    statement: z.string().min(1).max(500),
    status: z.enum(['unverified', 'supported-by-repeat', 'inconclusive', 'rejected']),
  }).strict(),
  methods: z.array(z.string().regex(/^[a-z0-9-]{2,64}$/)).min(1).max(32),
  interpretation: z.array(z.object({
    layer: z.enum(['measurement', 'evidence-based-hypothesis', 'ai-generated-hypothesis', 'spiritual-reflection']),
    content: z.string().min(1).max(2_000),
    evidenceRefs: z.array(z.string().max(128)).max(32),
  }).strict()).max(16),
  transmission: z.object({
    status: z.enum(['not-used', 'emitted', 'detected', 'integrity-checked']),
    protocol: z.string().max(80).nullable(),
    evidenceRef: z.string().max(128).nullable(),
  }).strict(),
  results: z.array(z.object({
    name: z.string().min(1).max(100),
    value: z.string().min(1).max(500),
    status: z.enum(['measured', 'derived', 'hypothesis', 'unavailable']),
  }).strict()).max(64),
  provenance: z.object({
    application: z.literal('ZionCore'),
    algorithmVersion: z.string().min(1).max(64),
    storage: z.literal('browser-local'),
    rawAudioIncluded: z.literal(false),
    sourceObservationNotesIncluded: z.literal(false),
  }).strict(),
}).strict();

export type UniversalSignal = z.infer<typeof universalSignalSchema>;
export type UniversalExperiment = z.infer<typeof universalExperimentSchema>;
