import { validateObservation } from './observation-validation';
import {
  localObservationErrorMessage, readObservationArchive, restoreObservationArchive,
  type ArchiveOptions, type Observation, type ObservationArchive,
} from './observations';

export const MAX_OBSERVATION_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_OBSERVATION_BACKUP_RECORDS = 10_000;

export interface ObservationBackup {
  observations: Observation[];
  invalidCount: number;
  fileDuplicateCount: number;
}

export interface ObservationRestorePreview {
  recordsToAdd: Observation[];
  invalidCount: number;
  fileDuplicateCount: number;
  existingDuplicateCount: number;
  existingConflictCount: number;
  destinationDamaged: boolean;
  destinationReadableCount: number;
  destinationUnreadableCount: number;
  snapshot: string;
}

class BackupError extends Error {}

export function parseObservationBackup(text: string): ObservationBackup {
  if (text.length > MAX_OBSERVATION_BACKUP_BYTES
    || new TextEncoder().encode(text).byteLength > MAX_OBSERVATION_BACKUP_BYTES) {
    throw new BackupError('This backup exceeds the 5 MiB import limit. Use a smaller observation JSON export.');
  }
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new BackupError('This file is not readable observation JSON. The original file and browser history have not been changed.'); }
  if (!Array.isArray(value)) throw new BackupError('Choose a JSON observation array exported by ZionCore, not a CSV or unrelated file.');
  if (value.length > MAX_OBSERVATION_BACKUP_RECORDS) throw new BackupError('This backup contains too many records. Import at most 10,000 records at a time.');
  const records = new Map<string, Observation>();
  let invalidCount = 0;
  let fileDuplicateCount = 0;
  for (const entry of value) {
    const result = validateObservation(entry);
    if (!result.success) { invalidCount++; continue; }
    const existing = records.get(result.data.id);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(result.data)) {
        throw new BackupError('This backup contains different observations with the same identity. Resolve that conflict in a copy of the file before importing.');
      }
      fileDuplicateCount++;
    } else {
      records.set(result.data.id, result.data);
    }
  }
  return { observations: [...records.values()], invalidCount, fileDuplicateCount };
}

export function prepareObservationRestore(
  backup: ObservationBackup, archive: ObservationArchive = readObservationArchive(),
): ObservationRestorePreview {
  if (archive.status === 'unavailable') {
    throw new BackupError('Browser storage is unavailable. No backup entries were written.');
  }
  if (archive.status === 'damaged' && archive.raw === undefined) {
    throw new BackupError('The existing browser archive cannot be safely merged. Keep its recovery copy and resolve that archive or use another browser before importing. No data was replaced.');
  }
  const existing = new Map(archive.items.map(item => [item.id, item]));
  const recordsToAdd: Observation[] = [];
  let existingDuplicateCount = 0;
  let existingConflictCount = 0;
  for (const item of backup.observations) {
    const match = existing.get(item.id);
    if (!match) recordsToAdd.push(item);
    else if (JSON.stringify(match) === JSON.stringify(item)) existingDuplicateCount++;
    else existingConflictCount++;
  }
  return {
    recordsToAdd, invalidCount: backup.invalidCount, fileDuplicateCount: backup.fileDuplicateCount,
    existingDuplicateCount,
    existingConflictCount,
    destinationDamaged: archive.status === 'damaged',
    destinationReadableCount: archive.items.length,
    destinationUnreadableCount: archive.unreadableCount ?? 0,
    snapshot: archive.status === 'damaged' ? archive.raw! : JSON.stringify(archive.items),
  };
}

export async function restoreObservationBackup(
  preview: ObservationRestorePreview,
  acknowledgeSkipped: boolean,
  options: ArchiveOptions = {},
  confirmDamagedReplacement = false,
): Promise<Observation[]> {
  if ((preview.invalidCount > 0 || preview.existingConflictCount > 0) && !acknowledgeSkipped) {
    throw new BackupError('Confirm that invalid or conflicting backup entries will not be restored before importing the validated records.');
  }
  if (preview.destinationDamaged && !confirmDamagedReplacement) {
    throw new BackupError('Download the original damaged archive and explicitly confirm its replacement before repairing it.');
  }
  return restoreObservationArchive(
    preview.recordsToAdd,
    preview.snapshot,
    options,
    preview.destinationDamaged && confirmDamagedReplacement,
  );
}

export function observationBackupErrorMessage(cause: unknown): string {
  return cause instanceof BackupError ? cause.message : localObservationErrorMessage(cause);
}
