import { z } from 'zod';

export const LOCATION_PRIVACY_MAX_CONSENT_MS = 60 * 60 * 1000;
export const LOCATION_GRID_DEGREES = {
  ordinary: 1,
  sensitiveEcology: 2,
} as const;

const timestampSchema = z.string().datetime({ offset: true });

export const locationSharingConsentSchema = z.object({
  explicitlyGranted: z.literal(true),
  scope: z.enum(['private-session', 'shared-research']),
  purpose: z.string().trim().min(1).max(160),
  grantedAt: timestampSchema,
  expiresAt: timestampSchema,
}).strict().superRefine((consent, context) => {
  const grantedAt = Date.parse(consent.grantedAt);
  const expiresAt = Date.parse(consent.expiresAt);
  if (expiresAt <= grantedAt || expiresAt - grantedAt > LOCATION_PRIVACY_MAX_CONSENT_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'Location-sharing consent must be time-bounded to one hour or less.',
    });
  }
});

export const locationCoordinateInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  source: z.enum(['user-entered', 'catalog-metadata']),
}).strict();

export type LocationSharingConsent = z.infer<typeof locationSharingConsentSchema>;
export type LocationCoordinateInput = z.infer<typeof locationCoordinateInputSchema>;
export type LocationSensitivity = 'ordinary' | 'sensitive-ecology';

export type ResearchLocationPrivacyResult =
  | {
    status: 'omitted';
    reason: 'no-explicit-consent' | 'consent-expired' | 'sensitive-ecology-shared-location';
  }
  | {
    status: 'coarsened';
    scope: LocationSharingConsent['scope'];
    source: LocationCoordinateInput['source'];
    sensitivity: LocationSensitivity;
    latitudeCellCenter: number;
    longitudeCellCenter: number;
    resolutionDegrees: number;
    expiresAt: string;
  };

function centerOfGridCell(value: number, min: number, max: number, step: number) {
  const cellIndex = Math.floor((value - min) / step);
  const center = min + cellIndex * step + step / 2;
  return Math.max(min, Math.min(max, center));
}

/**
 * Never returns source coordinates. Location is omitted without an explicit,
 * short-lived grant. Sensitive ecology locations are never emitted to shared
 * research, even when consent is present.
 */
export function prepareResearchLocation(
  input: unknown,
  consentInput: unknown,
  sensitivity: LocationSensitivity,
  nowMs = Date.now(),
): ResearchLocationPrivacyResult {
  if (sensitivity !== 'ordinary' && sensitivity !== 'sensitive-ecology') {
    throw new Error('A recognized location-sensitivity classification is required.');
  }
  const consentResult = locationSharingConsentSchema.safeParse(consentInput);
  if (!consentResult.success) {
    return { status: 'omitted', reason: 'no-explicit-consent' };
  }
  const consent = consentResult.data;
  const grantedAtMs = Date.parse(consent.grantedAt);
  const expiresAtMs = Date.parse(consent.expiresAt);
  if (!Number.isFinite(nowMs) || nowMs < grantedAtMs || nowMs >= expiresAtMs) {
    return { status: 'omitted', reason: 'consent-expired' };
  }
  if (sensitivity === 'sensitive-ecology' && consent.scope === 'shared-research') {
    return { status: 'omitted', reason: 'sensitive-ecology-shared-location' };
  }

  const coordinates = locationCoordinateInputSchema.parse(input);
  const resolutionDegrees = sensitivity === 'sensitive-ecology'
    ? LOCATION_GRID_DEGREES.sensitiveEcology
    : LOCATION_GRID_DEGREES.ordinary;

  return {
    status: 'coarsened',
    scope: consent.scope,
    source: coordinates.source,
    sensitivity,
    latitudeCellCenter: centerOfGridCell(coordinates.latitude, -90, 90, resolutionDegrees),
    longitudeCellCenter: centerOfGridCell(coordinates.longitude, -180, 180, resolutionDegrees),
    resolutionDegrees,
    expiresAt: consent.expiresAt,
  };
}
