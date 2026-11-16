import { z } from 'zod';

const interpretationSchema = z.object({
  scientificInterpretation: z.string().min(1).max(1800),
  confidence: z.enum(['low', 'moderate', 'high']),
  uncertainty: z.string().min(1).max(1200),
  possibleSources: z.array(z.string().min(1).max(240)).max(6),
  faithReflection: z.string().max(900).nullable(),
  model: z.string().min(1).max(100),
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
  mode: z.literal('microphone'),
  notes: z.string().max(4000).optional(),
  interpretation: interpretationSchema.optional(),
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
