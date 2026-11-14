import { z } from 'zod';
import { CIG_MODALITIES, type CIGModality } from '@/lib/research-grid';
import type { InstrumentAdapter } from '@/lib/hardware-instruments';

export const SENSOR_ADAPTER_CONTRACT_VERSION = 'zc-sensor-observation/v1' as const;
export const SENSOR_MAX_CHANNELS = 32;
export const SENSOR_MAX_TOTAL_VALUES = 50_000;

export const SENSOR_MEASUREMENT_UNITS = [
  'm',
  'kg',
  's',
  'mol',
  'cd',
  'Hz',
  'N',
  'Pa',
  'J',
  'W',
  'C',
  'F',
  'ohm',
  'S',
  'Wb',
  'm/s2',
  'm/s',
  'T',
  'V',
  'A',
  'K',
  'degC',
  'mV',
  'uV',
  'nm',
  'lm',
  'lx',
  'ppm',
  'count',
  'full-scale-fraction',
  'samples',
  'seconds',
  'dB_SPL',
  'dBFS',
  'rad',
  'deg',
] as const;

export type SensorMeasurementUnit = (typeof SENSOR_MEASUREMENT_UNITS)[number];

const instrumentIdSchema = z.string().regex(/^instrument\.[a-z0-9][a-z0-9._-]{1,107}$/);
const adapterIdSchema = z.string().regex(/^adapter\.[a-z0-9][a-z0-9.-]{1,82}$/);
const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
const isoTimestampSchema = z.string().datetime({ offset: true });

export const sensorAdapterContextSchema = z.object({
  observationId: z.string().uuid(),
  instrumentId: instrumentIdSchema,
  modality: z.enum(CIG_MODALITIES),
  sourceType: z.enum(['live', 'imported', 'simulated', 'provider-derived']),
  time: z.object({
    observedStartAt: isoTimestampSchema,
    observedEndAt: isoTimestampSchema,
    receivedAt: isoTimestampSchema,
    clock: z.enum(['instrument-utc', 'host-utc', 'provider-utc', 'unknown']),
    uncertaintyMs: z.number().finite().min(0).max(86_400_000).nullable(),
  }).strict(),
  permission: z.object({
    status: z.enum(['granted', 'not-required', 'unknown']),
    scope: z.enum(['microphone', 'sensor', 'file-selection', 'provider-feed', 'none', 'unknown']),
    userInitiated: z.boolean(),
  }).strict(),
  calibration: z.object({
    status: z.enum(['not-applicable', 'uncalibrated', 'user-calibrated', 'factory-calibrated']),
    checkedAt: isoTimestampSchema.nullable(),
    reference: z.string().min(1).max(240),
  }).strict(),
}).strict().superRefine((context, issueContext) => {
  if (Date.parse(context.time.observedEndAt) < Date.parse(context.time.observedStartAt)) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['time', 'observedEndAt'],
      message: 'Observation end time must not precede its start time.',
    });
  }
});

export type SensorAdapterContext = z.infer<typeof sensorAdapterContextSchema>;

const sensorChannelSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
  unit: z.enum(SENSOR_MEASUREMENT_UNITS),
  values: z.array(z.number().finite()).min(1).max(SENSOR_MAX_TOTAL_VALUES),
  sampleRateHz: z.number().finite().positive().max(10_000_000).nullable(),
}).strict();

export const sensorObservationSchema = z.object({
  contractVersion: z.literal(SENSOR_ADAPTER_CONTRACT_VERSION),
  observationId: z.string().uuid(),
  instrumentId: instrumentIdSchema,
  modality: z.enum(CIG_MODALITIES),
  sourceType: z.enum(['live', 'imported', 'simulated', 'provider-derived']),
  time: z.object({
    observedStartAt: isoTimestampSchema,
    observedEndAt: isoTimestampSchema,
    receivedAt: isoTimestampSchema,
    clock: z.enum(['instrument-utc', 'host-utc', 'provider-utc', 'unknown']),
    uncertaintyMs: z.number().finite().min(0).max(86_400_000).nullable(),
  }).strict(),
  permission: z.object({
    status: z.enum(['granted', 'not-required', 'unknown']),
    scope: z.enum(['microphone', 'sensor', 'file-selection', 'provider-feed', 'none', 'unknown']),
    userInitiated: z.boolean(),
  }).strict(),
  calibration: z.object({
    status: z.enum(['not-applicable', 'uncalibrated', 'user-calibrated', 'factory-calibrated']),
    checkedAt: isoTimestampSchema.nullable(),
    reference: z.string().min(1).max(240),
  }).strict(),
  channels: z.array(sensorChannelSchema).min(1).max(SENSOR_MAX_CHANNELS),
  provenance: z.object({
    adapterId: adapterIdSchema,
    adapterVersion: semanticVersionSchema,
    acquisitionMethod: z.enum(['browser-microphone', 'local-file', 'device-api', 'provider-api', 'synthetic']),
    classification: z.enum(['measured', 'imported', 'simulated', 'provider-derived']),
    softwareVersion: z.string().min(1).max(160),
    sourceLabel: z.string().min(1).max(120),
    physicalDeviceIdentity: z.literal('not-collected'),
  }).strict(),
}).strict().superRefine((observation, issueContext) => {
  if (Date.parse(observation.time.observedEndAt) < Date.parse(observation.time.observedStartAt)) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['time', 'observedEndAt'],
      message: 'Observation end time must not precede its start time.',
    });
  }

  const totalValues = observation.channels.reduce((total, channel) => total + channel.values.length, 0);
  if (totalValues > SENSOR_MAX_TOTAL_VALUES) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['channels'],
      message: 'A normalized observation cannot contain more than 50,000 values.',
    });
  }

  const expectedClassification = {
    live: 'measured',
    imported: 'imported',
    simulated: 'simulated',
    'provider-derived': 'provider-derived',
  }[observation.sourceType];
  if (observation.provenance.classification !== expectedClassification) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['provenance', 'classification'],
      message: 'Provenance classification must match the declared source type.',
    });
  }

  if (observation.sourceType === 'imported'
    && (observation.permission.status !== 'not-required' || observation.permission.scope !== 'file-selection')) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permission'],
      message: 'Imported files must record file selection, not sensor permission.',
    });
  }
  if (observation.sourceType === 'simulated'
    && (observation.permission.status !== 'not-required' || observation.permission.scope !== 'none')) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permission'],
      message: 'Synthetic data must not claim physical-device permission.',
    });
  }
  if (observation.sourceType === 'provider-derived'
    && (observation.permission.status !== 'not-required' || observation.permission.scope !== 'provider-feed')) {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permission'],
      message: 'Provider-derived data must identify its provider-feed permission scope.',
    });
  }
  if (observation.sourceType === 'live' && observation.permission.scope !== 'microphone'
    && observation.permission.scope !== 'sensor' && observation.permission.scope !== 'unknown') {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permission', 'scope'],
      message: 'Live sensor observations must identify a sensor-related permission scope.',
    });
  }
  if (observation.sourceType === 'live' && observation.permission.status === 'not-required') {
    issueContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['permission', 'status'],
      message: 'A live sensor observation cannot declare that permission was not required.',
    });
  }
});

export type NormalizedSensorObservation = z.infer<typeof sensorObservationSchema>;

export interface SensorMeasurementAdapter<TInput = unknown> {
  id: string;
  version: string;
  modality: CIGModality;
  normalize(input: TInput, context: SensorAdapterContext): NormalizedSensorObservation;
}

export interface InstrumentSensorAdapter<TInput = unknown> extends InstrumentAdapter {
  measurementAdapterId: string;
  measurementAdapterVersion: string;
  measurementModality: CIGModality;
  normalizeMeasurement(input: TInput, context: SensorAdapterContext): NormalizedSensorObservation;
}

export function normalizeInstrumentMeasurement<TInput>(
  adapter: InstrumentSensorAdapter<TInput>,
  input: TInput,
  untrustedContext: SensorAdapterContext,
): NormalizedSensorObservation {
  const context = sensorAdapterContextSchema.parse(untrustedContext);
  if (adapter.descriptor.id !== context.instrumentId) {
    throw new Error('Sensor measurement instrument ID does not match the adapter descriptor.');
  }
  if (!adapter.descriptor.modalities.includes(context.modality)
    || adapter.measurementModality !== context.modality) {
    throw new Error('Sensor measurement modality is not declared by the instrument adapter.');
  }
  const expectedSourceType = adapter.descriptor.sourceType === 'simulated' ? 'simulated' : 'live';
  if (context.sourceType !== expectedSourceType) {
    throw new Error('Sensor measurement source type does not match the instrument adapter.');
  }
  return normalizeSensorObservation({
    id: adapter.measurementAdapterId,
    version: adapter.measurementAdapterVersion,
    modality: adapter.measurementModality,
    normalize: (rawInput, normalizedContext) => adapter.normalizeMeasurement(rawInput, normalizedContext),
  }, input, context);
}

export function normalizeSensorObservation<TInput>(
  adapter: SensorMeasurementAdapter<TInput>,
  input: TInput,
  untrustedContext: SensorAdapterContext,
): NormalizedSensorObservation {
  const context = sensorAdapterContextSchema.parse(untrustedContext);
  if (!adapterIdSchema.safeParse(adapter.id).success || !semanticVersionSchema.safeParse(adapter.version).success) {
    throw new Error('Sensor adapter metadata must use a stable ID and semantic version.');
  }
  if (adapter.modality !== context.modality) {
    throw new Error('Sensor adapter modality does not match the acquisition context.');
  }

  const candidate = adapter.normalize(input, context);
  if (isRecord(candidate) && Array.isArray(candidate.channels)) {
    if (candidate.channels.length > SENSOR_MAX_CHANNELS) {
      throw new Error(`A normalized sensor observation cannot contain more than ${SENSOR_MAX_CHANNELS} channels.`);
    }
    const totalValues = candidate.channels.reduce((total: number, channel: unknown) => {
      return isRecord(channel) && Array.isArray(channel.values)
        ? total + channel.values.length
        : total;
    }, 0);
    if (totalValues > SENSOR_MAX_TOTAL_VALUES) {
      throw new Error(`A normalized sensor observation cannot contain more than ${SENSOR_MAX_TOTAL_VALUES} values.`);
    }
  }
  const observation = sensorObservationSchema.parse(candidate);
  if (observation.provenance.adapterId !== adapter.id
    || observation.provenance.adapterVersion !== adapter.version
    || observation.modality !== adapter.modality) {
    throw new Error('Normalized sensor provenance does not match the adapter registration.');
  }
  if (observation.observationId !== context.observationId
    || observation.instrumentId !== context.instrumentId
    || observation.sourceType !== context.sourceType
    || JSON.stringify(observation.time) !== JSON.stringify(context.time)
    || JSON.stringify(observation.permission) !== JSON.stringify(context.permission)
    || JSON.stringify(observation.calibration) !== JSON.stringify(context.calibration)) {
    throw new Error('Normalized sensor metadata does not match the supplied acquisition context.');
  }
  return observation;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
