import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { CheckCircle2, FileUp, Info, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  MAX_OBSERVATION_BACKUP_BYTES, observationBackupErrorMessage, parseObservationBackup,
  prepareObservationRestore, restoreObservationBackup,
  type ObservationBackup, type ObservationRestorePreview,
} from '@/lib/observation-backup';
import {
  downloadFile, OBSERVATION_STORAGE_KEY, readLocalRecoveryCopy, type Observation,
} from '@/lib/observations';

type Phase = 'idle' | 'reading' | 'preview' | 'stale' | 'restoring';

export default function ObservationBackupRestore({ onRestored }: { onRestored: (items: Observation[]) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [backup, setBackup] = useState<ObservationBackup | null>(null);
  const [preview, setPreview] = useState<ObservationRestorePreview | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [recoveryCopyDownloaded, setRecoveryCopyDownloaded] = useState(false);
  const [confirmDamagedReplacement, setConfirmDamagedReplacement] = useState(false);
  const token = useRef(0);
  const mounted = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const onRestoredRef = useRef(onRestored);
  onRestoredRef.current = onRestored;
  const backupRef = useRef<ObservationBackup | null>(null);
  backupRef.current = backup;

  useEffect(() => {
    mounted.current = true;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== OBSERVATION_STORAGE_KEY && event.key !== null) return;
      if (!backupRef.current) return;
      setPreview(null); setConfirmed(false); setAcknowledged(false);
      setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false);
      setPhase(current => (current === 'restoring' ? current : 'stale'));
    };
    window.addEventListener('storage', onStorage);
    return () => { mounted.current = false; token.current++; window.removeEventListener('storage', onStorage); };
  }, []);

  const resetInput = () => { if (inputRef.current) inputRef.current.value = ''; };

  const clear = () => {
    token.current++;
    setPhase('idle'); setFileName(''); setBackup(null); setPreview(null);
    setError(''); setConfirmed(false); setAcknowledged(false);
    setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false);
    resetInput();
  };

  const buildPreview = (source: ObservationBackup) => {
    try {
      setPreview(prepareObservationRestore(source));
      setPhase('preview');
    } catch (cause) {
      setPreview(null); setPhase('idle'); setError(observationBackupErrorMessage(cause));
    }
    setConfirmed(false); setAcknowledged(false);
    setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false);
  };

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    resetInput();
    if (!file) return;
    const mine = ++token.current;
    setError(''); setSuccess(''); setBackup(null); setPreview(null);
    setConfirmed(false); setAcknowledged(false);
    setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false);
    setFileName(file.name);
    if (file.size > MAX_OBSERVATION_BACKUP_BYTES) {
      setPhase('idle');
      setError('This backup exceeds the 5 MiB import limit. Use a smaller observation JSON export. Nothing was read or changed.');
      return;
    }
    setPhase('reading');
    try {
      const text = await file.text();
      if (!mounted.current || mine !== token.current) return;
      const parsed = parseObservationBackup(text);
      setBackup(parsed);
      buildPreview(parsed);
    } catch (cause) {
      if (!mounted.current || mine !== token.current) return;
      setPhase('idle'); setError(observationBackupErrorMessage(cause));
    }
  };

  const review = () => { if (backup) { setError(''); buildPreview(backup); } };

  const restore = async () => {
    if (!preview) return;
    const mine = ++token.current;
    setPhase('restoring'); setError('');
    try {
      const next = await restoreObservationBackup(
        preview,
        acknowledged,
        {},
        recoveryCopyDownloaded && confirmDamagedReplacement,
      );
      if (!mounted.current) return;
      const added = preview.recordsToAdd.length;
      onRestoredRef.current(next);
      if (mine !== token.current) return;
      setSuccess(`${added} ${added === 1 ? 'observation was' : 'observations were'} added to this browser archive. Existing records were left untouched.`);
      setBackup(null); setPreview(null); setFileName(''); setConfirmed(false); setAcknowledged(false);
      setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false); setPhase('idle');
    } catch (cause) {
      if (!mounted.current) return;
      setError(observationBackupErrorMessage(cause));
      setPreview(null); setConfirmed(false); setAcknowledged(false);
      setRecoveryCopyDownloaded(false); setConfirmDamagedReplacement(false);
      setPhase(backupRef.current ? 'stale' : 'idle');
    }
  };

  const skipped = !!preview && (preview.invalidCount > 0 || preview.existingConflictCount > 0);
  const newCount = preview?.recordsToAdd.length ?? 0;
  const damagedConfirmationReady = !preview?.destinationDamaged
    || (recoveryCopyDownloaded && confirmDamagedReplacement);
  const hasSafeWork = newCount > 0
    || (preview?.destinationDamaged === true && preview.destinationReadableCount > 0);
  const canImport = phase === 'preview' && hasSafeWork && (newCount === 0 || confirmed)
    && (!skipped || acknowledged) && damagedConfirmationReady;
  const busy = phase === 'reading' || phase === 'restoring';

  const counts: [string, string, number | undefined][] = preview ? [
    ['new', 'New to add', preview.recordsToAdd.length],
    ['existing-duplicates', 'Already here', preview.existingDuplicateCount],
    ['file-duplicates', 'Repeated in file', preview.fileDuplicateCount],
    ['conflicts', 'Conflicts kept as-is', preview.existingConflictCount],
    ['invalid', 'Unreadable entries', preview.invalidCount],
  ] : [];

  return <section className="panel zc-restore" aria-labelledby="restore-title" data-testid="section-backup-restore">
    <div className="zc-restore-head">
      <span className="zc-restore-kicker">Restore / merge only</span>
      <h2 id="restore-title">Return saved observations to this browser.</h2>
      <p>Choose a ZionCore JSON export or a .txt recovery copy. The file is read on this device only; it never touches cloud history and never buys or spends credits. Backups hold observation metadata and notes, not original audio or full reports. Existing observations are never replaced.</p>
    </div>

    <label className={`zc-restore-drop${busy ? ' is-busy' : ''}`} data-testid="label-backup-file">
      <FileUp size={16} />
      <span>{phase === 'reading' ? 'Reading backup on this device…' : 'Select backup file (JSON or .txt, up to 5 MiB)'}</span>
      <input ref={inputRef} type="file" accept=".json,.txt,application/json,text/plain" onChange={event => void choose(event)} disabled={phase === 'restoring'} data-testid="input-backup-file" />
    </label>

    {fileName && <p className="zc-restore-file" data-testid="text-backup-filename">Selected: <span>{fileName}</span></p>}

    {phase === 'reading' && <div className="zc-restore-skeleton" role="status" aria-label="Reading backup" data-testid="status-backup-reading"><i /><i /><i /></div>}

    {error && <div className="zc-callout zc-callout-alert zc-restore-msg" role="alert" data-testid="status-backup-error"><Info size={14} /><span>{error} Your existing history has not been changed.</span></div>}

    {success && <div className="zc-callout zc-restore-msg zc-restore-success" role="status" data-testid="status-backup-success"><CheckCircle2 size={14} /><span>{success}</span></div>}

    {phase === 'stale' && <div className="zc-callout zc-restore-msg" role="status" data-testid="status-backup-stale"><RefreshCw size={14} /><span>Browser history changed elsewhere since this preview. Nothing was written. Review the selected backup again against the current archive before importing.</span></div>}
    {phase === 'stale' && <div className="zc-restore-actions"><button type="button" className="btn btn-subtle" onClick={review} data-testid="button-review-backup-again"><RefreshCw size={14} />Review again</button><button type="button" className="btn btn-subtle" onClick={clear} data-testid="button-cancel-backup"><X size={14} />Clear selection</button></div>}

    {preview && (phase === 'preview' || phase === 'restoring') && <div className="zc-restore-preview" data-testid="panel-backup-preview">
      <dl className="zc-restore-counts">
        {counts.map(([id, label, value]) => <div key={id} className={id === 'new' ? 'is-primary' : ''}><dt>{label}</dt><dd data-testid={`text-backup-count-${id}`}>{value}</dd></div>)}
      </dl>
      {newCount === 0 && (!preview.destinationDamaged || preview.destinationReadableCount === 0)
        ? <div className="zc-callout zc-restore-msg" role="status" data-testid="status-backup-nothing-new"><Info size={14} /><span>{preview.destinationDamaged ? 'This damaged archive has no readable observations and the selected backup contains no new valid entries. Nothing can be safely restored, so the archive remains unchanged.' : 'Every readable entry in this backup is already in this browser, or cannot be safely merged. There is nothing new to import, so import is disabled.'}</span></div>
        : <>
        {preview.destinationDamaged && <div className="zc-callout zc-callout-alert zc-restore-msg" data-testid="panel-damaged-archive-repair">
          <Info size={14} />
          <div>
            <strong>The current browser archive is damaged.</strong>
            <p>{preview.destinationUnreadableCount} unreadable or duplicate {preview.destinationUnreadableCount === 1 ? 'entry or archive segment was' : 'entries or archive segments were'} detected. {preview.destinationReadableCount} readable existing {preview.destinationReadableCount === 1 ? 'observation will' : 'observations will'} be kept. Repair replaces the damaged archive bytes with the safe merge below; nothing is written until you download the original and confirm.</p>
            <button type="button" className="btn btn-subtle" disabled={phase === 'restoring'} data-testid="button-download-damaged-archive" onClick={() => {
              setRecoveryCopyDownloaded(false);
              try {
                downloadFile('zioncore-damaged-history-recovery.txt', readLocalRecoveryCopy(), 'text/plain;charset=utf-8');
                setRecoveryCopyDownloaded(true);
              } catch {
                setError('Could not download the exact current archive bytes. The damaged archive has not been changed.');
              }
            }}>Download exact damaged archive</button>
            {recoveryCopyDownloaded && <p role="status" data-testid="status-damaged-archive-downloaded">Recovery-copy download initiated. Keep that file private.</p>}
            <label className="zc-restore-check is-alert">
              <input type="checkbox" checked={confirmDamagedReplacement} onChange={event => setConfirmDamagedReplacement(event.target.checked)} disabled={phase === 'restoring' || !recoveryCopyDownloaded} data-testid="checkbox-confirm-damaged-replacement" />
              <span>I saved the original recovery copy and explicitly authorize replacing the damaged archive with this safe merge. Unreadable data can only be recovered from that copy.</span>
            </label>
          </div>
        </div>}
        {newCount > 0
          ? <label className="zc-restore-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={phase === 'restoring'} data-testid="checkbox-confirm-backup-restore" /><span>Add {newCount} new {newCount === 1 ? 'observation' : 'observations'} to this browser archive. Existing entries stay exactly as they are.</span></label>
          : <p className="zc-restore-msg" role="status">No new observations are needed; repair will keep the readable current records and remove only damaged archive entries after the separate confirmation above.</p>}
        {skipped && <label className="zc-restore-check is-alert"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={phase === 'restoring'} data-testid="checkbox-acknowledge-backup-skipped" /><span>I understand {preview.invalidCount} unreadable and {preview.existingConflictCount} conflicting {preview.invalidCount + preview.existingConflictCount === 1 ? 'entry' : 'entries'} will not be restored.</span></label>}
      </>}
      <div className="zc-restore-actions">
        <button type="button" className="btn btn-primary" disabled={!canImport} onClick={() => void restore()} data-testid="button-confirm-backup-restore"><ShieldCheck size={14} />{phase === 'restoring' ? 'Merging…' : 'Import new observations'}</button>
        <button type="button" className="btn btn-subtle" onClick={clear} disabled={phase === 'restoring'} data-testid="button-cancel-backup"><X size={14} />Cancel</button>
      </div>
    </div>}

    {phase === 'idle' && !fileName && !success && !error && <p className="zc-restore-empty" data-testid="text-backup-empty">No backup selected. Nothing is written until you review the counts and confirm.</p>}
  </section>;
}
