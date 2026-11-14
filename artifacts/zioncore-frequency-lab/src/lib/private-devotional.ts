import { z } from 'zod';

export const DEVOTIONAL_INTENTIONS = [
  'wellbeing',
  'wisdom',
  'protection',
  'prosperity',
  'unity',
  'compassion',
  'successful-endeavours',
  'spiritual-growth',
  'remembrance',
  'gratitude',
  'other',
] as const;

export const DEVOTIONAL_RECORD_TYPES = [
  'prayer-intention',
  'private-journal',
  'family-blessing',
] as const;

export const devotionalDraftSchema = z.object({
  title: z.string().trim().min(1, 'Add a short title.').max(120),
  recordType: z.enum(DEVOTIONAL_RECORD_TYPES),
  intention: z.enum(DEVOTIONAL_INTENTIONS),
  personOrFamilyLabel: z.string().trim().max(120),
  content: z.string().trim().min(1, 'Write a prayer, reflection, or blessing.').max(4_000),
}).strict();

const devotionalRecordSchema = devotionalDraftSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
}).strict();

const devotionalExportSchema = z.object({
  schema: z.literal('zioncore.private-devotional-export/v1'),
  exportedAt: z.string().datetime(),
  storage: z.literal('temporary-in-memory-session'),
  userInitiated: z.literal(true),
  sharedCollectionIncluded: z.literal(false),
  records: z.array(devotionalRecordSchema).max(200),
}).strict();

export type DevotionalDraft = z.infer<typeof devotionalDraftSchema>;
export type DevotionalRecord = z.infer<typeof devotionalRecordSchema>;
export type DevotionalExport = z.infer<typeof devotionalExportSchema>;

export function createDevotionalRecord(
  input: unknown,
  options: { id?: string; now?: Date } = {},
): DevotionalRecord {
  const draft = devotionalDraftSchema.parse(input);
  return devotionalRecordSchema.parse({
    ...draft,
    personOrFamilyLabel: draft.personOrFamilyLabel || '',
    id: options.id ?? crypto.randomUUID(),
    createdAt: (options.now ?? new Date()).toISOString(),
  });
}

export function createDevotionalExport(
  records: DevotionalRecord[],
  now = new Date(),
): DevotionalExport {
  return devotionalExportSchema.parse({
    schema: 'zioncore.private-devotional-export/v1',
    exportedAt: now.toISOString(),
    storage: 'temporary-in-memory-session',
    userInitiated: true,
    sharedCollectionIncluded: false,
    records,
  });
}
