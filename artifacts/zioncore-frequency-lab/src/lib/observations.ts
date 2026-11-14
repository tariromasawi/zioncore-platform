import { validateObservation } from '@/lib/observation-validation';
import type { InstrumentProvenance } from '@/lib/instrument-provenance';

export type Observation = {
  id: string;
  createdAt: string;
  sampleRate: number;
  fftSize: number;
  frequencyResolutionHz: number;
  dominantFrequencyHz: number | null;
  topPeaksHz: number[];
  rmsLevel: number;
  durationSeconds: number;
  mode: string;
  instrumentProvenance?: InstrumentProvenance;
  notes?: string;
};

// Interpretation snapshots are separate records linked by observationId;
// they must not be folded back into or rewrite the frozen signal measurement.
export type SavedInterpretation = {
  scientificInterpretation: string;
  confidence: 'low' | 'moderate' | 'high';
  uncertainty: string;
  possibleSources: string[];
  evidenceUsed?: string[];
  limitations?: string[];
  faithReflection: string | null;
  model: string;
  provenance?: SavedInterpretationProvenance;
};

export type SavedInterpretationProvenance = {
  source: 'ai-generated';
  observationId: string;
  methodId: string;
  methodVersion: string;
  promptVersion: string;
  provider: string;
  modelId: string;
  generatedAt: string;
  clientRoundTripMs?: number;
};

export const OBSERVATION_STORAGE_KEY = 'zioncore.frequency-lab.observations.v1';

export function getObservationStorageKey(userId?: string) {
  if (!userId) return OBSERVATION_STORAGE_KEY;
  if (userId.length > 128) throw new Error('The account archive scope is invalid.');
  return `${OBSERVATION_STORAGE_KEY}.account.${encodeURIComponent(userId)}`;
}

type ArchiveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ArchiveOptions = {
  storage?: ArchiveStorage;
  userId?: string;
  runExclusive?: <T>(commit: () => T) => Promise<T>;
};
export type ObservationArchive = {
  items: Observation[];
  status: 'ready' | 'damaged' | 'unavailable';
  issue: string;
  raw?: string;
  unreadableCount?: number;
};

class ObservationStorageError extends Error {}

export function readObservationArchive(
  storage?: Pick<Storage, 'getItem'>,
  userId?: string,
): ObservationArchive {
  let value: string | null;
  try {
    value = (storage ?? localStorage).getItem(getObservationStorageKey(userId));
  } catch {
    return { items: [], status: 'unavailable', issue: 'Browser history cannot be read. Check browser storage permissions. No existing records have been replaced.' };
  }
  if (value === null) return { items: [], status: 'ready', issue: '' };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error('Invalid archive shape.');
    const ids = new Set<string>();
    let damaged = false;
    let unreadableCount = 0;
    const items = parsed.flatMap(item => {
      const result = validateObservation(item);
      if (!result.success || ids.has(result.data.id)) {
        damaged = true;
        unreadableCount++;
        return [];
      }
      ids.add(result.data.id);
      return [result.data];
    });
    return damaged
      ? {
        items,
        status: 'damaged',
        issue: 'Some browser records are unreadable. Readable records remain available, but new local saves are paused to protect the original archive. Download a private recovery copy before making changes.',
        raw: value,
        unreadableCount,
      }
      : { items, status: 'ready', issue: '' };
  } catch {
    return {
      items: [],
      status: 'damaged',
      issue: 'Browser history is unreadable, not necessarily empty. New local saves are paused to protect the original archive. Download a private recovery copy before making changes.',
      raw: value,
      unreadableCount: 1,
    };
  }
}

export function readObservations(userId?: string): Observation[] {
  return readObservationArchive(undefined, userId).items;
}

async function withArchiveLock<T>(commit: () => T, options: ArchiveOptions): Promise<T> {
  if (options.runExclusive) return options.runExclusive(commit);
  const storageKey = getObservationStorageKey(options.userId);
  // Node also exposes navigator.locks; only use origin-scoped browser locks
  // here. Test stores can inject their own shared mutex.
  if (typeof window !== 'undefined' && navigator.locks) {
    return navigator.locks.request(storageKey, () => commit());
  }
  // Older browsers still re-read immediately before a synchronous write, but
  // cannot provide the Web Locks cross-tab serialization guarantee.
  return commit();
}

function commitObservations(items: Observation[], storage: ArchiveStorage, userId?: string): void {
  if (!items.every(item => validateObservation(item).success)
    || new Set(items.map(item => item.id)).size !== items.length) {
    throw new ObservationStorageError('The observation data could not be validated. Existing browser history has not been changed.');
  }
  try {
    storage.setItem(getObservationStorageKey(userId), JSON.stringify(items));
  } catch (cause) {
    throw new ObservationStorageError(localObservationErrorMessage(cause));
  }
}

/** Explicit archive replacement, used by the confirmed clear-history action. */
export async function writeObservations(items: Observation[], options: ArchiveOptions = {}): Promise<void> {
  await withArchiveLock(
    () => commitObservations(items, options.storage ?? localStorage, options.userId),
    options,
  );
}

export async function appendObservation(item: Observation, options: ArchiveOptions = {}): Promise<Observation[]> {
  return withArchiveLock(() => {
    const storage = options.storage ?? localStorage;
    const archive = readObservationArchive(storage, options.userId);
    if (archive.status !== 'ready') throw new ObservationStorageError(archive.issue);
    if (archive.items.some(existing => existing.id === item.id)) {
      throw new ObservationStorageError('An observation with this identity already exists. Existing browser history has not been changed.');
    }
    const next = [item, ...archive.items];
    commitObservations(next, storage, options.userId);
    return next;
  }, options);
}

/** Restore is a merge only: never overwrite a damaged or changed archive. */
export async function restoreObservationArchive(
  incoming: Observation[],
  expectedSnapshot: string,
  options: ArchiveOptions = {},
  confirmDamagedReplacement = false,
): Promise<Observation[]> {
  return withArchiveLock(() => {
    const storage = options.storage ?? localStorage;
    const archive = readObservationArchive(storage, options.userId);
    if (archive.status === 'unavailable') throw new ObservationStorageError(archive.issue);
    if (archive.status === 'damaged') {
      if (!confirmDamagedReplacement || archive.raw === undefined) {
        throw new ObservationStorageError('The browser archive is damaged. Download its byte-for-byte recovery copy and explicitly confirm replacement before repairing it.');
      }
      if (archive.raw !== expectedSnapshot) {
        throw new ObservationStorageError('Browser history changed after the recovery preview. Download the current recovery copy and review the backup again before replacing it.');
      }
    } else if (JSON.stringify(archive.items) !== expectedSnapshot) {
      throw new ObservationStorageError('Browser history changed after the preview. Review the backup again before importing.');
    }
    const existingIds = new Set(archive.items.map(item => item.id));
    if (
      (!incoming.length && archive.status !== 'damaged')
      || incoming.some(item => existingIds.has(item.id))
    ) {
      throw new ObservationStorageError('No safe new observations are ready to merge. Review the backup again.');
    }
    const next = [...incoming, ...archive.items];
    if (!next.length) {
      throw new ObservationStorageError('No validated observations are available to repair the damaged archive. The original bytes have not been changed.');
    }
    commitObservations(next, storage, options.userId);
    return next;
  }, options);
}

export function readVerifiedObservations(userId?: string): Observation[] {
  const archive = readObservationArchive(undefined, userId);
  if (archive.status !== 'ready') {
    const reason = archive.status === 'damaged'
      ? 'The archive contains an invalid record or unreadable data.'
      : archive.issue;
    throw new Error(`${reason} Stored records were left unchanged.`);
  }
  return archive.items;
}

export function readObservationsForExport(userId?: string): Observation[] {
  try {
    return readVerifiedObservations(userId);
  } catch (cause) {
    throw new Error(`${cause instanceof Error ? cause.message : 'Saved observations could not be read.'} No export was created.`);
  }
}

export function deleteObservationsFromStorage(ids: string[], userId?: string): Observation[] {
  if (
    !Array.isArray(ids)
    || ids.length > 10_000
    || !ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
    || new Set(ids).size !== ids.length
  ) {
    throw new Error('The selected record IDs are invalid or duplicated. No records were deleted.');
  }
  const archive = readObservationArchive(undefined, userId);
  if (archive.status !== 'ready') {
    const reason = archive.status === 'damaged'
      ? 'History contains an invalid record or duplicate record IDs.'
      : archive.issue;
    throw new Error(`${reason} No records were deleted.`);
  }
  const selectedIds = new Set(ids);
  const remaining = archive.items.filter(item => !selectedIds.has(item.id));
  if (remaining.length === archive.items.length) return remaining;
  try {
    localStorage.setItem(getObservationStorageKey(userId), JSON.stringify(remaining));
    return remaining;
  } catch (cause) {
    throw new Error(`${localObservationErrorMessage(cause)} No records were deleted.`);
  }
}

export function localObservationErrorMessage(cause: unknown): string {
  if (cause instanceof ObservationStorageError) return cause.message;
  if (cause && typeof cause === 'object' && 'name' in cause && cause.name === 'QuotaExceededError') {
    return 'Browser storage is full. This observation was not saved. Export existing history before freeing space, or use private cloud saving when available.';
  }
  return 'This observation could not be saved to this browser. Check browser storage permissions and available space. No successful save has been confirmed.';
}

export function readLocalRecoveryCopy(storage?: Pick<Storage, 'getItem'>, userId?: string): string {
  const raw = (storage ?? localStorage).getItem(getObservationStorageKey(userId));
  if (raw === null) throw new ObservationStorageError('There is no browser archive available to download.');
  return raw;
}

export function formatFrequency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
}

export function upsertObservation(items: Observation[], observation: Observation) {
  const existingIndex = items.findIndex(item => item.id === observation.id);
  if (existingIndex < 0) return [observation, ...items];
  return items.map(item => item.id === observation.id ? observation : item);
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(items: Observation[], interpretations: SavedInterpretation[] = []) {
  const measurementIds = new Set(items.map(item => item.id));
  const interpretationByObservationId = new Map<string, SavedInterpretation>();
  for (const interpretation of interpretations) {
    const observationId = interpretation.provenance?.observationId;
    if (!observationId || !measurementIds.has(observationId) || interpretationByObservationId.has(observationId)) {
      throw new Error('Each exported interpretation must be uniquely linked to one included observation.');
    }
    interpretationByObservationId.set(observationId, interpretation);
  }
  const columns = [
    'id', 'createdAt', 'sampleRate', 'fftSize', 'frequencyResolutionHz',
    'dominantFrequencyHz', 'topPeaksHz', 'rmsLevel', 'durationSeconds', 'mode', 'notes',
    'instrumentId', 'instrumentName', 'acquisitionMethod', 'physicalDeviceIdentity',
    'inputChannels', 'frequencyUnit', 'frequencyResolutionUnit', 'amplitudeUnit',
    'durationUnit', 'calibrationStatus', 'calibrationCheckedAt', 'calibrationReference',
    'softwareVersion',
    'interpretationScientificInterpretation', 'interpretationConfidence',
    'interpretationUncertainty', 'interpretationPossibleSources',
    'interpretationEvidenceUsed', 'interpretationLimitations',
    'interpretationFaithReflection', 'interpretationModel',
    'interpretationSource', 'interpretationObservationId', 'interpretationMethodId',
    'interpretationMethodVersion', 'interpretationPromptVersion',
    'interpretationProvider', 'interpretationModelId', 'interpretationGeneratedAt',
    'interpretationClientRoundTripMs',
  ] as const;
  const cell = (value: unknown) => `"${String(Array.isArray(value) ? value.join(';') : value ?? '').replaceAll('"', '""')}"`;
  const valueFor = (item: Observation, key: typeof columns[number]) => {
    const instrument = item.instrumentProvenance;
    switch (key) {
      case 'instrumentId': return instrument?.instrumentId;
      case 'instrumentName': return instrument?.instrumentName;
      case 'acquisitionMethod': return instrument?.acquisitionMethod;
      case 'physicalDeviceIdentity': return instrument?.physicalDeviceIdentity;
      case 'inputChannels': return instrument?.inputChannels;
      case 'frequencyUnit': return instrument?.units.frequency;
      case 'frequencyResolutionUnit': return instrument?.units.frequencyResolution;
      case 'amplitudeUnit': return instrument?.units.amplitude;
      case 'durationUnit': return instrument?.units.duration;
      case 'calibrationStatus': return instrument?.calibration.status;
      case 'calibrationCheckedAt': return instrument?.calibration.checkedAt;
      case 'calibrationReference': return instrument?.calibration.reference;
      case 'softwareVersion': return instrument?.softwareVersion;
    }
    if (key.startsWith('interpretation')) {
      const interpretation = interpretationByObservationId.get(item.id);
      const provenance = interpretation?.provenance;
      if (!interpretation) return '';
      switch (key) {
        case 'interpretationScientificInterpretation': return interpretation.scientificInterpretation;
        case 'interpretationConfidence': return interpretation.confidence;
        case 'interpretationUncertainty': return interpretation.uncertainty;
        case 'interpretationPossibleSources': return interpretation.possibleSources;
        case 'interpretationEvidenceUsed': return interpretation.evidenceUsed;
        case 'interpretationLimitations': return interpretation.limitations;
        case 'interpretationFaithReflection': return interpretation.faithReflection;
        case 'interpretationModel': return interpretation.model;
        case 'interpretationSource': return provenance?.source;
        case 'interpretationObservationId': return provenance?.observationId;
        case 'interpretationMethodId': return provenance?.methodId;
        case 'interpretationMethodVersion': return provenance?.methodVersion;
        case 'interpretationPromptVersion': return provenance?.promptVersion;
        case 'interpretationProvider': return provenance?.provider;
        case 'interpretationModelId': return provenance?.modelId;
        case 'interpretationGeneratedAt': return provenance?.generatedAt;
        case 'interpretationClientRoundTripMs': return provenance?.clientRoundTripMs;
      }
    }
    return item[key as keyof Observation];
  };
  return [
    columns.join(','),
    ...items.map(item => columns.map(key => cell(valueFor(item, key))).join(',')),
  ].join('\n');
}
