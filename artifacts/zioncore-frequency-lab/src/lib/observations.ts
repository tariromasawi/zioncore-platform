import { validateObservation } from '@/lib/observation-validation';

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
  notes?: string;
};

export const OBSERVATION_STORAGE_KEY = 'zioncore.frequency-lab.observations.v1';

type ArchiveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ArchiveOptions = {
  storage?: ArchiveStorage;
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

export function readObservationArchive(storage?: Pick<Storage, 'getItem'>): ObservationArchive {
  let value: string | null;
  try {
    value = (storage ?? localStorage).getItem(OBSERVATION_STORAGE_KEY);
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

export function readObservations(): Observation[] {
  return readObservationArchive().items;
}

async function withArchiveLock<T>(commit: () => T, options: ArchiveOptions): Promise<T> {
  if (options.runExclusive) return options.runExclusive(commit);
  // Node also exposes navigator.locks; only use origin-scoped browser locks
  // here. Test stores can inject their own shared mutex.
  if (typeof window !== 'undefined' && navigator.locks) {
    return navigator.locks.request(OBSERVATION_STORAGE_KEY, () => commit());
  }
  // Older browsers still re-read immediately before a synchronous write, but
  // cannot provide the Web Locks cross-tab serialization guarantee.
  return commit();
}

function commitObservations(items: Observation[], storage: ArchiveStorage): void {
  if (!items.every(item => validateObservation(item).success)
    || new Set(items.map(item => item.id)).size !== items.length) {
    throw new ObservationStorageError('The observation data could not be validated. Existing browser history has not been changed.');
  }
  try {
    storage.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(items));
  } catch (cause) {
    throw new ObservationStorageError(localObservationErrorMessage(cause));
  }
}

/** Explicit archive replacement, used by the confirmed clear-history action. */
export async function writeObservations(items: Observation[], options: ArchiveOptions = {}): Promise<void> {
  await withArchiveLock(() => commitObservations(items, options.storage ?? localStorage), options);
}

export async function appendObservation(item: Observation, options: ArchiveOptions = {}): Promise<Observation[]> {
  return withArchiveLock(() => {
    const storage = options.storage ?? localStorage;
    const archive = readObservationArchive(storage);
    if (archive.status !== 'ready') throw new ObservationStorageError(archive.issue);
    if (archive.items.some(existing => existing.id === item.id)) {
      throw new ObservationStorageError('An observation with this identity already exists. Existing browser history has not been changed.');
    }
    const next = [item, ...archive.items];
    commitObservations(next, storage);
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
    const archive = readObservationArchive(storage);
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
    commitObservations(next, storage);
    return next;
  }, options);
}

export function localObservationErrorMessage(cause: unknown): string {
  if (cause instanceof ObservationStorageError) return cause.message;
  if (cause && typeof cause === 'object' && 'name' in cause && cause.name === 'QuotaExceededError') {
    return 'Browser storage is full. This observation was not saved. Export existing history before freeing space, or use private cloud saving when available.';
  }
  return 'This observation could not be saved to this browser. Check browser storage permissions and available space. No successful save has been confirmed.';
}

export function readLocalRecoveryCopy(storage?: Pick<Storage, 'getItem'>): string {
  const raw = (storage ?? localStorage).getItem(OBSERVATION_STORAGE_KEY);
  if (raw === null) throw new ObservationStorageError('There is no browser archive available to download.');
  return raw;
}

export function formatFrequency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
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

export function toCsv(items: Observation[]) {
  const columns: (keyof Observation)[] = [
    'id', 'createdAt', 'sampleRate', 'fftSize', 'frequencyResolutionHz',
    'dominantFrequencyHz', 'topPeaksHz', 'rmsLevel', 'durationSeconds', 'mode', 'notes',
  ];
  const cell = (value: unknown) => `"${String(Array.isArray(value) ? value.join(';') : value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...items.map(item => columns.map(key => cell(item[key])).join(','))].join('\n');
}
