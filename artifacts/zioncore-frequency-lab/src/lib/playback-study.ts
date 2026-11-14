import { z } from 'zod';

const requiredText = (label: string, max = 500) => z.string().trim().min(1, `${label} is required.`).max(max);
const measuredLevel = (label: string) => z.number({
  required_error: `${label} is required.`,
  invalid_type_error: `${label} must be a measured number.`,
}).finite().min(0, `${label} cannot be negative.`).max(200, `${label} must be 200 dB or less.`);

export const playbackStudySchema = z.object({
  protocolName: requiredText('Study name', 120),
  targetTaxon: requiredText('Target species or taxon', 160),
  habitat: z.enum(['field', 'forest', 'grassland', 'wetland', 'freshwater', 'marine', 'captive', 'laboratory', 'other'])
    .or(z.literal(''))
    .refine(value => value !== '', 'Choose a habitat category.'),
  stimulusDescription: requiredText('Stimulus description', 600),
  sourceRightsReviewed: z.literal(true, { errorMap: () => ({ message: 'Confirm that source rights and permissions were reviewed.' }) }),
  playbackLevelDbSPL: measuredLevel('Target sound level'),
  ambientLevelDbA: measuredLevel('Ambient level'),
  measurementDistanceMeters: z.number({
    required_error: 'Measurement distance is required.',
    invalid_type_error: 'Measurement distance is required.',
  }).finite().positive('Distance must be greater than zero.').max(100_000),
  calibrationReference: requiredText('Calibration equipment/reference', 240),
  trialDurationSeconds: z.number({
    required_error: 'Trial duration is required.',
    invalid_type_error: 'Trial duration is required.',
  }).finite().positive('Trial duration must be greater than zero.').max(3_600),
  trialsPerSession: z.number({
    required_error: 'Trials per session is required.',
    invalid_type_error: 'Trials per session is required.',
  }).int().min(1).max(100),
  sessionsPerDay: z.number({
    required_error: 'Sessions per day is required.',
    invalid_type_error: 'Sessions per day is required.',
  }).int().min(1).max(20),
  restIntervalSeconds: z.number({
    required_error: 'Rest interval is required; enter 0 only if justified.',
    invalid_type_error: 'Rest interval is required; enter 0 only if justified.',
  }).finite().min(0).max(86_400),
  restIntervalRationale: z.string().trim().max(600),
  baselinePlan: requiredText('Baseline observation plan', 800),
  controlPlan: requiredText('Control condition', 800),
  observerPlan: requiredText('Observer and monitoring plan', 800),
  stopCriteria: requiredText('Stop criteria', 800),
  localReviewReference: requiredText('Local permit/ethics review reference or exemption basis', 400),
  localRequirementsReviewed: z.literal(true, { errorMap: () => ({ message: 'Confirm that local animal ethics and wildlife-permit requirements were checked.' }) }),
  locationPrivacyReviewed: z.literal(true, { errorMap: () => ({ message: 'Confirm that site privacy and sensitive-species location handling were reviewed.' }) }),
}).superRefine((study, context) => {
  if (study.restIntervalSeconds === 0 && study.restIntervalRationale.length < 8) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['restIntervalRationale'],
      message: 'Explain why the protocol specifies no rest between trials.',
    });
  }
});

export type PlaybackStudyDraft = {
  protocolName: string;
  targetTaxon: string;
  habitat: '' | 'field' | 'forest' | 'grassland' | 'wetland' | 'freshwater' | 'marine' | 'captive' | 'laboratory' | 'other';
  stimulusDescription: string;
  sourceRightsReviewed: boolean;
  playbackLevelDbSPL: number | undefined;
  ambientLevelDbA: number | undefined;
  measurementDistanceMeters: number | undefined;
  calibrationReference: string;
  trialDurationSeconds: number | undefined;
  trialsPerSession: number | undefined;
  sessionsPerDay: number | undefined;
  restIntervalSeconds: number | undefined;
  restIntervalRationale: string;
  baselinePlan: string;
  controlPlan: string;
  observerPlan: string;
  stopCriteria: string;
  localReviewReference: string;
  localRequirementsReviewed: boolean;
  locationPrivacyReviewed: boolean;
};
export type PlaybackStudy = z.output<typeof playbackStudySchema>;

export type PlaybackStudyAssessment = {
  readyForQualifiedReview: boolean;
  issues: string[];
  playbackSecondsPerDay: number | null;
  scheduledWindowSecondsPerDay: number | null;
  study?: PlaybackStudy;
};

export function assessPlaybackStudy(value: unknown): PlaybackStudyAssessment {
  const parsed = playbackStudySchema.safeParse(value);
  if (!parsed.success) {
    return {
      readyForQualifiedReview: false,
      issues: [...new Set(parsed.error.issues.map(issue => issue.message))],
      playbackSecondsPerDay: null,
      scheduledWindowSecondsPerDay: null,
    };
  }

  const playbackSecondsPerDay = parsed.data.trialDurationSeconds
    * parsed.data.trialsPerSession
    * parsed.data.sessionsPerDay;
  const scheduledWindowSecondsPerDay = (
    parsed.data.trialDurationSeconds * parsed.data.trialsPerSession
    + parsed.data.restIntervalSeconds * Math.max(0, parsed.data.trialsPerSession - 1)
  ) * parsed.data.sessionsPerDay;

  return {
    readyForQualifiedReview: true,
    issues: [],
    playbackSecondsPerDay,
    scheduledWindowSecondsPerDay,
    study: parsed.data,
  };
}
