import packageMetadata from '../../package.json' with { type: 'json' };
import { z } from 'zod';
import {
  BROWSER_MICROPHONE_INSTRUMENT_ID,
  type CalibrationRecord,
  type InstrumentDescriptor,
} from '@/lib/hardware-instruments';

export const instrumentProvenanceSchema = z.object({
  instrumentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,119}$/),
  instrumentName: z.string().min(1).max(120),
  acquisitionMethod: z.enum(['browser-microphone', 'local-wav-file']),
  physicalDeviceIdentity: z.literal('not-collected'),
  inputChannels: z.number().int().min(1).max(32).nullable(),
  units: z.object({
    frequency: z.literal('Hz'),
    frequencyResolution: z.literal('Hz'),
    amplitude: z.literal('FS'),
    duration: z.literal('seconds'),
  }).strict(),
  calibration: z.object({
    status: z.enum(['not-applicable', 'uncalibrated', 'user-calibrated', 'factory-calibrated']),
    checkedAt: z.string().datetime({ offset: true }).nullable(),
    reference: z.string().min(1).max(240),
  }).strict(),
  softwareVersion: z.string().min(1).max(160),
}).strict();

export type InstrumentProvenance = z.infer<typeof instrumentProvenanceSchema>;
export type AcquisitionMethod = InstrumentProvenance['acquisitionMethod'];

export const INSTRUMENT_SOFTWARE_VERSION =
  `${packageMetadata.name}@${packageMetadata.version}`;

const wavImporterCalibration: CalibrationRecord = {
  status: 'uncalibrated',
  checkedAt: null,
  reference: 'WAV calibration metadata is not interpreted or applied.',
};

const browserCalibrationFallback: CalibrationRecord = {
  status: 'uncalibrated',
  checkedAt: null,
  reference: 'Browser microphone input is not calibrated for absolute sound-pressure measurements.',
};

export function createInstrumentProvenance(
  acquisitionMethod: AcquisitionMethod,
  instrument?: InstrumentDescriptor | null,
): InstrumentProvenance {
  const isFile = acquisitionMethod === 'local-wav-file';
  const calibration = isFile
    ? wavImporterCalibration
    : instrument?.calibration ?? browserCalibrationFallback;

  return instrumentProvenanceSchema.parse({
    instrumentId: isFile
      ? 'instrument.local-wav-import'
      : instrument?.id ?? BROWSER_MICROPHONE_INSTRUMENT_ID,
    instrumentName: isFile
      ? 'Local WAV file importer'
      : instrument?.name ?? 'Browser microphone and Web Audio analyser',
    acquisitionMethod,
    physicalDeviceIdentity: 'not-collected',
    inputChannels: isFile ? null : instrument?.capabilities.inputChannels ?? null,
    units: {
      frequency: 'Hz',
      frequencyResolution: 'Hz',
      amplitude: 'FS',
      duration: 'seconds',
    },
    calibration,
    softwareVersion: INSTRUMENT_SOFTWARE_VERSION,
  });
}
