import { z } from 'zod';

const instrumentProvenanceSchema = z.object({
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

export const observationSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  createdAt: z.string().datetime({ offset: true }),
  sampleRate: z.number().int().min(8000).max(192000),
  fftSize: z.union([z.literal(2048), z.literal(4096), z.literal(8192)]),
  frequencyResolutionHz: z.number().positive().finite(),
  dominantFrequencyHz: z.number().positive().finite().nullable(),
  topPeaksHz: z.array(z.number().positive().finite()).max(6),
  rmsLevel: z.number().min(0).max(1),
  durationSeconds: z.number().finite().min(0).max(86400),
  mode: z.enum(['microphone', 'audio-file']),
  instrumentProvenance: instrumentProvenanceSchema.optional(),
  notes: z.string().max(4000).optional(),
}).strict().superRefine((observation, context) => {
  const nyquist = observation.sampleRate / 2;
  const expectedResolution = observation.sampleRate / observation.fftSize;
  if (Math.abs(observation.frequencyResolutionHz - expectedResolution) > 0.000001) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['frequencyResolutionHz'],
      message: 'Resolution must equal sample rate divided by FFT size.',
    });
  }
  if (observation.dominantFrequencyHz != null && observation.dominantFrequencyHz > nyquist) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dominantFrequencyHz'],
      message: 'Dominant frequency cannot exceed the Nyquist frequency.',
    });
  }
  observation.topPeaksHz.forEach((peak, index) => {
    if (peak > nyquist) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['topPeaksHz', index],
        message: 'A spectral peak cannot exceed the Nyquist frequency.',
      });
    }
  });
});

export type ValidatedObservation = z.infer<typeof observationSchema>;

export function validateObservation(value: unknown) {
  return observationSchema.safeParse(value);
}
