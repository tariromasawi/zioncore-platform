import { z } from 'zod';

export const membershipRecordSchema = z.object({
  tier: z.enum(['free', 'premium']),
  status: z.enum([
    'free',
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'expired',
  ]),
  source: z.enum(['system', 'stripe']),
  accessUntil: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  updatedAt: z.string().datetime().nullable(),
}).strict().superRefine((record, context) => {
  if (record.tier === 'premium' && record.source !== 'stripe') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['source'],
      message: 'Premium membership must come from a verified billing source.',
    });
  }
  if (record.tier === 'premium' && record.accessUntil == null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['accessUntil'],
      message: 'Premium membership must have a server-set access end date.',
    });
  }
});

export type MembershipSnapshot = z.infer<typeof membershipRecordSchema>;

export const FREE_MEMBERSHIP: MembershipSnapshot = {
  tier: 'free',
  status: 'free',
  source: 'system',
  accessUntil: null,
  cancelAtPeriodEnd: false,
  updatedAt: null,
};

function normalizeDate(value: unknown): unknown {
  if (value == null) return null;

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) date = parsed;
  } else if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      if (parsed instanceof Date && Number.isFinite(parsed.getTime())) date = parsed;
    } catch {
      return value;
    }
  }

  return date ? date.toISOString() : value;
}

export function parseMembershipRecord(value: unknown): MembershipSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return membershipRecordSchema.parse(value);
  }

  const record = value as Record<string, unknown>;
  return membershipRecordSchema.parse({
    ...record,
    accessUntil: normalizeDate(record.accessUntil),
    updatedAt: normalizeDate(record.updatedAt),
  });
}

/**
 * Presentation helper only. Any future Premium operation must also verify
 * entitlement on a trusted server before it performs work or changes data.
 */
export function isPremiumEntitled(
  membership: MembershipSnapshot,
  now = Date.now(),
): boolean {
  if (
    membership.tier !== 'premium' ||
    membership.source !== 'stripe' ||
    membership.status !== 'active' ||
    membership.accessUntil == null
  ) {
    return false;
  }

  const accessUntil = Date.parse(membership.accessUntil);
  return Number.isFinite(accessUntil) && accessUntil > now;
}

/** UI label only; protected features still require a server-verified entitlement. */
export function membershipDisplayLabel(
  membership: MembershipSnapshot,
  now = Date.now(),
): string {
  if (isPremiumEntitled(membership, now)) return 'Premium';
  if (membership.source !== 'stripe') return 'Free';
  switch (membership.status) {
    case 'past_due':
    case 'unpaid':
      return 'Payment due';
    case 'incomplete':
      return 'Setup pending';
    case 'trialing':
      return 'Trial pending';
    case 'canceled':
    case 'expired':
      return 'Ended';
    case 'active':
      return 'Expired';
    default:
      return membership.tier === 'premium' ? 'Inactive' : 'Free';
  }
}

/** Shows a management link for a verified Stripe-linked record, not a paid entitlement. */
export function canManageStripeBilling(membership: MembershipSnapshot): boolean {
  return membership.source === 'stripe' && membership.updatedAt !== null;
}
