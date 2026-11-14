import { z } from 'zod';

export const RESEARCH_MISSION_STORAGE_KEY = 'zioncore.research-missions.v1';
export const RESEARCH_MISSION_SCHEMA_VERSION = 1 as const;
export const RESEARCH_MISSION_MAX_COUNT = 50;
export const RESEARCH_MISSION_MAX_STEPS = 12;
export const RESEARCH_MISSION_MAX_OBSERVATIONS = 30;
export const RESEARCH_MISSION_MAX_CLOUD_REQUESTS = 10;
export const RESEARCH_MISSION_MAX_COST_USD = 1;
export const MISSION_ANONYMOUS_SCOPE = 'anonymous-browser';

export const PERSISTENT_MISSION_DOMAINS = [
  'celestial-exploration',
  'environmental-interaction',
  'unknown-intelligence',
  'bioacoustic-analysis',
  'astronomical-data-review',
  'acoustic-protocol-research',
] as const;

export const RESEARCH_MISSION_STATUSES = [
  'planned',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

const missionStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(600),
  status: z.enum(['pending', 'completed']),
}).strict();

export const researchMissionSchema = z.object({
  schemaVersion: z.literal(RESEARCH_MISSION_SCHEMA_VERSION),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  domainId: z.enum(PERSISTENT_MISSION_DOMAINS),
  objective: z.string().trim().min(1).max(1200),
  status: z.enum(RESEARCH_MISSION_STATUSES),
  steps: z.array(missionStepSchema).min(1).max(RESEARCH_MISSION_MAX_STEPS),
  budget: z.object({
    maxObservationWindows: z.number().int().min(1).max(RESEARCH_MISSION_MAX_OBSERVATIONS),
    maxCloudAiRequests: z.number().int().min(0).max(RESEARCH_MISSION_MAX_CLOUD_REQUESTS),
    plannedCostCeilingUsd: z.number().finite().min(0).max(RESEARCH_MISSION_MAX_COST_USD),
  }).strict(),
  consent: z.object({
    localProcessing: z.boolean(),
    cloudAiRequests: z.boolean(),
    recordedAt: z.string().datetime({ offset: true }),
  }).strict(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((mission, context) => {
  const stepIds = new Set<string>();
  mission.steps.forEach((step, index) => {
    if (stepIds.has(step.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['steps', index, 'id'],
        message: 'Mission step identifiers must be unique.',
      });
    }
    stepIds.add(step.id);
  });
  if (mission.consent.cloudAiRequests
    && (mission.budget.maxCloudAiRequests < 1 || mission.budget.plannedCostCeilingUsd <= 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['consent', 'cloudAiRequests'],
      message: 'A planned cloud-consent choice needs a positive request and cost ceiling.',
    });
  }
});

const researchMissionListSchema = z.array(researchMissionSchema)
  .max(RESEARCH_MISSION_MAX_COUNT)
  .superRefine((missions, context) => {
    const ids = new Set<string>();
    missions.forEach((mission, index) => {
      if (ids.has(mission.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Mission identifiers must be unique in this archive.',
        });
      }
      ids.add(mission.id);
    });
  });

export type ResearchMission = z.infer<typeof researchMissionSchema>;
export type ResearchMissionStep = z.infer<typeof missionStepSchema>;
export type ResearchMissionDomain = (typeof PERSISTENT_MISSION_DOMAINS)[number];

export function getResearchMissionStorageKey(scopeRef: string) {
  if (typeof scopeRef !== 'string' || scopeRef.length < 1 || scopeRef.length > 128) {
    throw new Error('A valid local visitor or account scope is required for mission storage.');
  }
  return `${RESEARCH_MISSION_STORAGE_KEY}.${encodeURIComponent(scopeRef)}`;
}

export function createResearchMission(now = new Date().toISOString()): ResearchMission {
  return researchMissionSchema.parse({
    schemaVersion: RESEARCH_MISSION_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    title: 'Untitled research mission',
    domainId: 'environmental-interaction',
    objective: 'Document a repeatable observation and compare it with a defined baseline.',
    status: 'planned',
    steps: [
      {
        id: crypto.randomUUID(),
        title: 'Define the question and baseline',
        description: 'Write what will be observed and how the baseline will be recorded.',
        status: 'pending',
      },
      {
        id: crypto.randomUUID(),
        title: 'Run the planned observation',
        description: 'Use only an instrument and method that are actually available and authorized.',
        status: 'pending',
      },
      {
        id: crypto.randomUUID(),
        title: 'Compare and export the record',
        description: 'Record measured outcomes separately from interpretations and hypotheses.',
        status: 'pending',
      },
    ],
    budget: {
      maxObservationWindows: 5,
      maxCloudAiRequests: 0,
      plannedCostCeilingUsd: 0,
    },
    consent: {
      localProcessing: false,
      cloudAiRequests: false,
      recordedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });
}

export function validateResearchMission(value: unknown) {
  return researchMissionSchema.safeParse(value);
}

export function readResearchMissions(scopeRef: string): ResearchMission[] {
  const key = getResearchMissionStorageKey(scopeRef);
  if (typeof localStorage === 'undefined') return [];
  const saved = localStorage.getItem(key);
  if (!saved) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error('Saved missions could not be read. The stored copy was left unchanged.');
  }
  const result = researchMissionListSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Saved missions failed validation. The stored copy was left unchanged.');
  }
  return result.data;
}

export function writeResearchMissions(scopeRef: string, missions: ResearchMission[]) {
  if (typeof localStorage === 'undefined') throw new Error('Browser storage is unavailable.');
  const key = getResearchMissionStorageKey(scopeRef);
  const result = researchMissionListSchema.safeParse(missions);
  if (!result.success) throw new Error('Mission data failed validation and was not saved.');
  try {
    localStorage.setItem(key, JSON.stringify(result.data));
  } catch {
    throw new Error('Missions could not be saved in this browser. Check available storage and try again.');
  }
}

export function upsertResearchMission(missions: ResearchMission[], mission: ResearchMission) {
  const validated = researchMissionSchema.parse(mission);
  const existing = missions.findIndex(item => item.id === validated.id);
  const next = existing < 0
    ? [validated, ...missions]
    : missions.map(item => item.id === validated.id ? validated : item);
  return researchMissionListSchema.parse(next);
}
