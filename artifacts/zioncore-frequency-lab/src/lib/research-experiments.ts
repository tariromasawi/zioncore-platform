import {
  universalExperimentSchema,
  type UniversalExperiment,
  type UniversalSignal,
} from '@workspace/frequency-ai-contract';
import type { DiscoveryComparison, DiscoveryLens } from './discovery-engine';
import type { Observation } from './observations';

export const RESEARCH_EXPERIMENT_STORAGE_KEY = 'zioncore.frequency-lab.research-experiments.v1';
export const MAX_LOCAL_RESEARCH_EXPERIMENTS = 100;

type ExperimentStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ResearchExperimentStorageOptions = {
  storage?: ExperimentStorage;
  runExclusive?: <T>(commit: () => T) => Promise<T>;
};

export type ResearchExperimentArchive = {
  items: UniversalExperiment[];
  status: 'ready' | 'damaged' | 'unavailable';
  issue: string;
  raw?: string;
};

export class ResearchExperimentStorageError extends Error {}

const lensDomain: Record<DiscoveryLens, string> = {
  human: 'acoustic-patterns',
  animal: 'bioacoustic-exploration',
  environment: 'environmental-acoustics',
  spiritual: 'spiritual-reflection',
  celestial: 'celestial-inquiry',
  unknown: 'acoustic-patterns',
};

export function getIntelligenceDomainIdForLens(lens: DiscoveryLens): string {
  return lensDomain[lens];
}

function normalizeSignal(observation: DiscoveryComparison['first']): UniversalSignal {
  const isMicrophone = observation.mode === 'microphone';
  return {
    id: observation.id,
    modality: 'acoustic',
    source: {
      kind: isMicrophone ? 'microphone' : 'audio-file',
      label: isMicrophone ? 'Saved browser microphone capture' : 'Saved audio-file observation',
      deviceModel: null,
    },
    sampleRateHz: observation.sampleRate,
    channelCount: null,
    measurements: [
      { name: 'dominant-frequency', value: observation.dominantFrequencyHz, unit: 'Hz', uncertainty: observation.frequencyResolutionHz },
      { name: 'frequency-resolution', value: observation.frequencyResolutionHz, unit: 'Hz', uncertainty: null },
      { name: 'relative-rms', value: observation.rmsLevel, unit: 'relative-amplitude', uncertainty: null },
      { name: 'capture-duration', value: observation.durationSeconds, unit: 'seconds', uncertainty: null },
      { name: 'top-peak-count', value: observation.topPeaksHz.length, unit: 'count', uncertainty: null },
      ...observation.topPeaksHz.slice(0, 24).map((value, index) => ({
        name: `top-peak-${index + 1}`,
        value,
        unit: 'Hz',
        uncertainty: observation.frequencyResolutionHz,
      })),
    ],
    capturedAt: observation.createdAt,
    timebase: {
      startAt: observation.createdAt,
      durationSeconds: observation.durationSeconds,
      sampleClockHz: observation.sampleRate,
    },
    spatialContext: null,
    calibration: {
      status: 'unknown',
      method: null,
      reference: null,
      uncertaintyUnit: 'Hz',
    },
    provenance: {
      sourceRecordId: observation.id,
      origin: isMicrophone ? 'microphone' : 'audio-file',
      transformations: ['Metadata-only normalization; source audio was not copied.'],
    },
  };
}

export function createObservationComparisonExperiment(input: {
  id: string;
  createdAt: string;
  participantRef?: 'current-local-participant';
  hypothesis: string;
  first: Observation;
  second: Observation;
  comparison: DiscoveryComparison;
}): UniversalExperiment {
  const hypothesis = input.hypothesis.trim();
  if (hypothesis.length < 3) {
    throw new ResearchExperimentStorageError('Add a short hypothesis before saving the experiment.');
  }
  const sameMode = input.first.mode === input.second.mode;
  const instrumentCategory = !sameMode
    ? 'other'
    : input.first.mode === 'microphone'
      ? 'browser-audio'
      : 'recording-file';
  const comparison = input.comparison;

  return universalExperimentSchema.parse({
    schemaVersion: 1,
    id: input.id,
    createdAt: input.createdAt,
    participant: {
      scope: 'browser-profile',
      reference: input.participantRef ?? 'current-local-participant',
    },
    domainId: getIntelligenceDomainIdForLens(comparison.lens),
    instrument: {
      category: instrumentCategory,
      model: null,
      identification: 'generic',
    },
    source: {
      kind: 'saved-observations',
      label: 'Two user-selected browser observations',
      observationIds: [input.first.id, input.second.id],
    },
    signals: [
      normalizeSignal(comparison.first),
      normalizeSignal(comparison.second),
    ],
    hypothesis: {
      statement: hypothesis,
      status: 'unverified',
    },
    methods: ['spectral-peak-comparison', 'recording-settings-check'],
    interpretation: [{
      layer: 'measurement',
      content: comparison.summary,
      evidenceRefs: [input.first.id, input.second.id],
    }],
    transmission: {
      status: 'not-used',
      protocol: null,
      evidenceRef: null,
    },
    results: [
      { name: 'comparison-finding', value: comparison.finding, status: 'derived' },
      {
        name: 'dominant-frequency-shift',
        value: comparison.dominantShiftHz == null ? 'unavailable' : `${comparison.dominantShiftHz} Hz`,
        status: comparison.dominantShiftHz == null ? 'unavailable' : 'measured',
      },
      { name: 'matched-peak-count', value: String(comparison.matchedPeaksHz.length), status: 'derived' },
      { name: 'capture-settings-comparable', value: String(comparison.setupComparable), status: 'derived' },
    ],
    provenance: {
      application: 'ZionCore',
      algorithmVersion: 'local-peak-compare-v1',
      storage: 'browser-local',
      rawAudioIncluded: false,
      sourceObservationNotesIncluded: false,
    },
  });
}

export function readResearchExperimentArchive(
  storage?: Pick<Storage, 'getItem'>,
): ResearchExperimentArchive {
  let raw: string | null;
  try {
    raw = (storage ?? localStorage).getItem(RESEARCH_EXPERIMENT_STORAGE_KEY);
  } catch {
    return {
      items: [],
      status: 'unavailable',
      issue: 'Local experiment storage is unavailable. Existing records have not been replaced.',
    };
  }
  if (raw === null) return { items: [], status: 'ready', issue: '' };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid experiment archive shape.');
    const ids = new Set<string>();
    const items: UniversalExperiment[] = [];
    let damaged = false;
    for (const candidate of parsed) {
      const result = universalExperimentSchema.safeParse(candidate);
      if (!result.success || ids.has(result.data.id)) {
        damaged = true;
        continue;
      }
      ids.add(result.data.id);
      items.push(result.data);
    }
    return damaged
      ? {
        items,
        status: 'damaged',
        issue: 'Some local experiment records are unreadable. Existing bytes are preserved and new changes are paused.',
        raw,
      }
      : { items, status: 'ready', issue: '' };
  } catch {
    return {
      items: [],
      status: 'damaged',
      issue: 'The local experiment archive is unreadable. Its original bytes are preserved; no replacement was attempted.',
      raw,
    };
  }
}

async function withExperimentLock<T>(
  commit: () => T,
  options: ResearchExperimentStorageOptions,
): Promise<T> {
  if (options.runExclusive) return options.runExclusive(commit);
  // Use origin-scoped Web Locks only in a real browser, never a Node navigator global.
  if (typeof window !== 'undefined' && navigator.locks) {
    return navigator.locks.request(RESEARCH_EXPERIMENT_STORAGE_KEY, () => commit());
  }
  return commit();
}

function writeArchive(items: UniversalExperiment[], storage: ExperimentStorage) {
  try {
    storage.setItem(RESEARCH_EXPERIMENT_STORAGE_KEY, JSON.stringify(items));
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'name' in cause && cause.name === 'QuotaExceededError') {
      throw new ResearchExperimentStorageError('Browser storage is full. This experiment was not saved; existing research records remain unchanged.');
    }
    throw new ResearchExperimentStorageError('This experiment could not be saved in browser storage. Existing research records remain unchanged.');
  }
}

export async function appendResearchExperiment(
  experiment: UniversalExperiment,
  options: ResearchExperimentStorageOptions = {},
): Promise<UniversalExperiment[]> {
  return withExperimentLock(() => {
    const storage = options.storage ?? localStorage;
    const archive = readResearchExperimentArchive(storage);
    if (archive.status !== 'ready') throw new ResearchExperimentStorageError(archive.issue);
    if (!universalExperimentSchema.safeParse(experiment).success) {
      throw new ResearchExperimentStorageError('The experiment record failed validation. Existing records remain unchanged.');
    }
    if (archive.items.some(item => item.id === experiment.id)) {
      throw new ResearchExperimentStorageError('This experiment identity is already saved. Existing records remain unchanged.');
    }
    if (archive.items.length >= MAX_LOCAL_RESEARCH_EXPERIMENTS) {
      throw new ResearchExperimentStorageError('The local research archive has reached its limit. Export or remove a record before adding another.');
    }
    const next = [experiment, ...archive.items];
    writeArchive(next, storage);
    return next;
  }, options);
}

export async function removeResearchExperiment(
  id: string,
  options: ResearchExperimentStorageOptions = {},
): Promise<UniversalExperiment[]> {
  return withExperimentLock(() => {
    const storage = options.storage ?? localStorage;
    const archive = readResearchExperimentArchive(storage);
    if (archive.status !== 'ready') throw new ResearchExperimentStorageError(archive.issue);
    if (!archive.items.some(item => item.id === id)) {
      throw new ResearchExperimentStorageError('The selected experiment is no longer in this archive. Refresh before retrying.');
    }
    const next = archive.items.filter(item => item.id !== id);
    writeArchive(next, storage);
    return next;
  }, options);
}
