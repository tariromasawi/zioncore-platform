import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, BookmarkPlus, Download, FileCode2, FileJson, FileText, FolderOpen,
  Leaf, Lock, Save, Share2, Sparkles, Trash2, Waves, X,
} from 'lucide-react';
import type { Explanation } from '@/lib/ai-analysis';
import {
  createSignalCard,
  DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS,
  deleteSignalCard,
  downloadSignalCard,
  readSignalCards,
  saveSignalCard,
  SIGNAL_CARD_TEMPLATES,
  signalCardStorageKey,
  signalCardToText,
  type SignalCard,
  type SignalCardCapture,
  type SignalCardExportOptions,
} from '@/lib/signal-cards';
import './signal-card-studio.css';

type Props = { userId: string | null; explanation: Explanation | null; capture: SignalCardCapture | null };
type Template = SignalCard['template'];
type Pending = { title: string; body: string; confirmLabel: string; danger?: boolean; run(): void };

const TITLE_MAX = 120;
const SUMMARY_MAX = 1800;
const NOTES_MAX = 3000;

const templateIcons: Record<Template, typeof Leaf> = { nature: Leaf, tonal: Waves, faith: Sparkles };

const exportFields: { key: keyof SignalCardExportOptions; label: string; hint: string }[] = [
  { key: 'includeContext', label: 'Listening context', hint: 'The note you wrote before the reading.' },
  { key: 'includeNotes', label: 'Personal notes', hint: 'Your private notes on this card.' },
  { key: 'includeReflection', label: 'Spiritual reflection', hint: 'The personalised faith reading, if any.' },
  { key: 'includeReport', label: 'Original report', hint: 'All analysis sections. Spiritual reflection is selected separately.' },
];

function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function editableSignature(card: SignalCard | null) {
  return card ? JSON.stringify([card.title, card.summary, card.notes, card.template]) : '';
}

function formatHz(value: number | null) {
  if (value == null) return 'None';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

export default function SignalCardStudio({ userId, explanation, capture }: Props) {
  const [cards, setCards] = useState<SignalCard[]>([]);
  const [listError, setListError] = useState('');
  const [draft, setDraft] = useState<SignalCard | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [exportOptions, setExportOptions] = useState<SignalCardExportOptions>({ ...DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS });
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const userRef = useRef(userId);
  userRef.current = userId;

  const loadList = useCallback((uid: string) => {
    try {
      setCards(readSignalCards(uid));
      setListError('');
    } catch (cause) {
      setCards([]);
      setListError(errorText(cause, 'Saved Signal Cards could not be read.'));
    }
  }, []);

  // Account boundary: wipe everything, then load only this account's cards.
  useEffect(() => {
    setCards([]); setListError(''); setDraft(null); setSavedSignature(null);
    setStatus(''); setError(''); setPending(null); setShareMessage(''); setShareError('');
    setExportOptions({ ...DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS });
    if (userId) loadList(userId);
  }, [userId, loadList]);

  // Cross-tab freshness for the saved list only; the editor is never overwritten.
  useEffect(() => {
    if (!userId) return;
    let key: string;
    try { key = signalCardStorageKey(userId); } catch { return; }
    const onStorage = (event: StorageEvent) => {
      if (userRef.current !== userId) return;
      if (event.key === null || event.key === key) loadList(userId);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId, loadList]);

  useEffect(() => {
    if (!pending) return;
    const previousFocus = document.activeElement;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPending(null);
      }
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        const first = controls?.[0];
        const last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [pending]);

  const draftId = draft?.id ?? null;
  useEffect(() => {
    setExportOptions({ ...DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS });
    setShareMessage(''); setShareError('');
  }, [draftId]);

  const dirty = Boolean(draft) && editableSignature(draft) !== savedSignature;
  const isSavedCard = Boolean(draft && cards.some(card => card.id === draft.id));
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const guard = (run: () => void) => {
    if (!dirty) { run(); return; }
    setPending({
      title: 'Discard unsaved edits?',
      body: 'This card has changes that are not saved in this browser. Discarding cannot be undone.',
      confirmLabel: 'Discard edits',
      danger: true,
      run,
    });
  };

  const openCard = (card: SignalCard, message: string) => {
    setDraft(card);
    setSavedSignature(editableSignature(card));
    setError('');
    setStatus(message);
  };

  const sourceId = capture?.id ?? null;
  const existingForSource = sourceId ? cards.find(card => card.id === sourceId) ?? null : null;
  const canCreate = Boolean(userId && explanation && capture);

  const createDraft = () => {
    if (!explanation || !capture || !userId) return;
    guard(() => {
      if (existingForSource) {
        openCard(existingForSource, 'This reading already has a saved card. Opened it for editing instead of replacing it.');
        return;
      }
      try {
        const card = createSignalCard(explanation, capture);
        setDraft(card);
        setSavedSignature(null);
        setError('');
        setStatus('Draft created. It is not saved until you press Save card.');
      } catch (cause) {
        setError(errorText(cause, 'A card could not be created from this reading.'));
      }
    });
  };

  const update = (patch: Partial<Pick<SignalCard, 'title' | 'summary' | 'notes' | 'template'>>) => {
    setDraft(current => (current ? { ...current, ...patch } : current));
    setStatus('');
  };

  const titleInvalid = Boolean(draft && !draft.title.trim());
  const summaryInvalid = Boolean(draft && !draft.summary.trim());

  const save = () => {
    if (!draft || !userId) return;
    if (titleInvalid || summaryInvalid) {
      setError('Add a title and summary before saving.');
      return;
    }
    try {
      const next = saveSignalCard(userId, draft);
      const stored = next.find(card => card.id === draft.id) ?? draft;
      setCards(next);
      setListError('');
      setDraft(stored);
      setSavedSignature(editableSignature(stored));
      setError('');
      setStatus(`Saved privately in this browser at ${new Date().toLocaleTimeString()}.`);
    } catch (cause) {
      setStatus('');
      setError(`Not saved. ${errorText(cause, 'Browser storage rejected this card.')}`);
    }
  };

  const requestDelete = (card: SignalCard) => {
    setPending({
      title: 'Delete this card?',
      body: `"${card.title}" will be removed from this browser. Download it first if you want to keep a copy.`,
      confirmLabel: 'Delete card',
      danger: true,
      run: () => {
        if (!userId) return;
        try {
          const next = deleteSignalCard(userId, card.id);
          setCards(next);
          setListError('');
          if (draft?.id === card.id) { setDraft(null); setSavedSignature(null); }
          setError('');
          setStatus('Card deleted from this browser.');
        } catch (cause) {
          setError(`Not deleted. ${errorText(cause, 'Browser storage could not be updated.')}`);
        }
      },
    });
  };

  const preview = useMemo(() => {
    if (!draft) return { text: '', error: '' };
    try { return { text: signalCardToText(draft, exportOptions), error: '' }; }
    catch (cause) { return { text: '', error: errorText(cause, 'Preview unavailable.') }; }
  }, [draft, exportOptions]);

  const download = (format: 'html' | 'txt' | 'json') => {
    if (!draft) return;
    setShareError('');
    try {
      downloadSignalCard(draft, format, exportOptions);
      setShareMessage(`Downloaded ${format.toUpperCase()} with the fields shown in the preview.`);
    } catch (cause) {
      setShareMessage('');
      setShareError(errorText(cause, 'The download could not be prepared.'));
    }
  };

  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const share = async () => {
    if (!draft) return;
    setShareMessage(''); setShareError('');
    if (!canNativeShare) {
      download('txt');
      return;
    }
    try {
      await navigator.share({ title: draft.title, text: signalCardToText(draft, exportOptions) });
      setShareMessage('Shared through your device share sheet.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setShareMessage('Sharing cancelled. Nothing was sent.');
      } else {
        setShareError(`Sharing failed. ${errorText(cause, 'Your device could not share this card.')}`);
      }
    }
  };

  if (!userId) {
    return (
      <section className="panel scs" aria-labelledby="scs-title" data-testid="panel-signal-card-studio">
        <header className="scs-head">
          <div><span className="scs-kicker">Keepsake</span><h2 id="scs-title">Signal Card studio</h2></div>
        </header>
        <div className="scs-empty" data-testid="status-signal-cards-signed-out">
          <Lock size={18} aria-hidden="true" />
          <p>Sign in to turn completed readings into private cards. Cards are kept per account, in this browser only—not encrypted or cloud-synced.</p>
        </div>
      </section>
    );
  }

  const measurement = draft?.capture.measurement ?? null;
  const TemplateIcon = draft ? templateIcons[draft.template] : Waves;

  return (
    <section className="panel scs" aria-labelledby="scs-title" data-testid="panel-signal-card-studio">
      <header className="scs-head">
        <div>
          <span className="scs-kicker">Keepsake</span>
          <h2 id="scs-title">Signal Card studio</h2>
          <p>Turn a finished reading into a card you can edit, keep and share on your own terms.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary scs-create"
          onClick={createDraft}
          disabled={!canCreate}
          data-testid="button-create-signal-card"
        >
          {existingForSource ? <FolderOpen size={15} aria-hidden="true" /> : <BookmarkPlus size={15} aria-hidden="true" />}
          {existingForSource ? 'Open saved card for this reading' : 'Create card from this reading'}
        </button>
      </header>

      <ul className="scs-scope" aria-label="Storage and cost facts" data-testid="text-signal-card-scope">
        <li><Lock size={12} aria-hidden="true" /> Kept on this browser, organised by account. Not cloud-synced or encrypted. Other people with access to this browser profile may be able to read its storage.</li>
        <li>Editing, exporting and sharing use no credits and never re-run the reading.</li>
        <li>No original audio is stored.</li>
      </ul>

      {!canCreate && !draft && (
        <p className="scs-hint" data-testid="status-signal-card-needs-reading">
          Complete a ZionCore reading in the listening lab to create a card. Saved cards below can be reopened any time.
        </p>
      )}

      <div className="scs-live" aria-live="polite">
        {status && <p className="scs-status" data-testid="status-signal-card">{status}</p>}
      </div>
      {error && (
        <div className="scs-alert" role="alert" data-testid="status-signal-card-error">
          <AlertCircle size={15} aria-hidden="true" /><span>{error}</span>
        </div>
      )}

      {draft && (
        <div className="scs-workspace">
          <div className="scs-editor">
            <fieldset className="scs-templates">
              <legend>Layout</legend>
              <div className="scs-template-row">
                {SIGNAL_CARD_TEMPLATES.map(template => {
                  const Icon = templateIcons[template.id];
                  return (
                    <label key={template.id} className={`scs-template ${draft.template === template.id ? 'is-on' : ''}`}>
                      <input
                        type="radio"
                        name="scs-template"
                        value={template.id}
                        checked={draft.template === template.id}
                        onChange={() => update({ template: template.id })}
                        data-testid={`radio-signal-card-template-${template.id}`}
                      />
                      <Icon size={15} aria-hidden="true" />
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="scs-field">
              <label htmlFor="scs-title-input">Title</label>
              <input
                id="scs-title-input"
                className="text-control"
                value={draft.title}
                maxLength={TITLE_MAX}
                onChange={event => update({ title: event.target.value })}
                aria-invalid={titleInvalid}
                aria-describedby="scs-title-count"
                data-testid="input-signal-card-title"
              />
              <span id="scs-title-count" className="scs-count">{draft.title.length}/{TITLE_MAX}</span>
            </div>
            <div className="scs-field">
              <label htmlFor="scs-summary-input">Summary</label>
              <textarea
                id="scs-summary-input"
                className="text-control"
                rows={5}
                value={draft.summary}
                maxLength={SUMMARY_MAX}
                onChange={event => update({ summary: event.target.value })}
                aria-invalid={summaryInvalid}
                aria-describedby="scs-summary-count"
                data-testid="input-signal-card-summary"
              />
              <span id="scs-summary-count" className="scs-count">{draft.summary.length}/{SUMMARY_MAX}</span>
            </div>
            <div className="scs-field">
              <label htmlFor="scs-notes-input">Personal notes <span>private</span></label>
              <textarea
                id="scs-notes-input"
                className="text-control"
                rows={4}
                value={draft.notes}
                maxLength={NOTES_MAX}
                placeholder="Where you were, what you noticed, what you want to remember."
                onChange={event => update({ notes: event.target.value })}
                aria-describedby="scs-notes-count"
                data-testid="input-signal-card-notes"
              />
              <span id="scs-notes-count" className="scs-count">{draft.notes.length}/{NOTES_MAX}</span>
            </div>

            <div className="scs-save-row">
              <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty} data-testid="button-save-signal-card">
                <Save size={15} aria-hidden="true" /> {dirty ? 'Save card' : 'Saved'}
              </button>
              <button
                type="button"
                className="btn btn-subtle"
                onClick={() => guard(() => { setDraft(null); setSavedSignature(null); setStatus(''); setError(''); })}
                data-testid="button-close-signal-card"
              >
                <X size={14} aria-hidden="true" /> Close
              </button>
              <span className={`scs-dirty ${dirty ? 'on' : ''}`} data-testid="status-signal-card-dirty">
                {dirty ? (isSavedCard ? 'Unsaved edits' : 'Draft, not saved') : 'All changes saved'}
              </span>
            </div>
            <p className="scs-hint">The original report and captured measurements stay exactly as generated. Save before leaving this page; unsaved edits are not retained.</p>
          </div>

          <article className={`scs-card tpl-${draft.template}`} aria-label="Card preview" data-testid="card-signal-preview">
            <div className="scs-card-top">
              <span className="scs-card-badge"><TemplateIcon size={13} aria-hidden="true" />{SIGNAL_CARD_TEMPLATES.find(t => t.id === draft.template)?.name}</span>
              <span className="scs-card-date">{formatDate(draft.capture.createdAt)}</span>
            </div>
            <div className="scs-card-hz">
              <span>Dominant</span>
              <strong data-testid="text-signal-card-dominant">{formatHz(measurement?.dominantFrequencyHz ?? null)}</strong>
            </div>
            <h3 data-testid="text-signal-card-title">{draft.title || 'Untitled card'}</h3>
            {draft.capture.spectrumImage && (
              <img className="scs-card-spectrum" src={draft.capture.spectrumImage} alt="Captured spectrum snapshot" data-testid="img-signal-card-spectrum" />
            )}
            <p className="scs-card-summary">{draft.summary}</p>
            {exportOptions.includeContext && draft.capture.listeningContext.trim() && (
              <section className="scs-card-personal" data-testid="preview-signal-card-context">
                <span>Chosen listening context</span>
                <p>{draft.capture.listeningContext}</p>
              </section>
            )}
            {exportOptions.includeReflection && draft.report.faithReflection && (
              <section className="scs-card-personal" data-testid="preview-signal-card-reflection">
                <span>Chosen spiritual reflection</span>
                <p>{draft.report.faithReflection}</p>
              </section>
            )}
            {measurement ? (
              <dl className="scs-facts" data-testid="list-signal-card-measurement">
                <div><dt>Source</dt><dd>{measurement.captureSource === 'microphone' ? 'Microphone' : 'Audio file'}</dd></div>
                <div><dt>Peaks</dt><dd>{measurement.topPeaksHz.length ? measurement.topPeaksHz.map(p => formatHz(p)).join(' / ') : 'None'}</dd></div>
                <div><dt>Duration</dt><dd>{measurement.durationSeconds.toFixed(1)} s</dd></div>
                <div><dt>RMS</dt><dd>{measurement.rmsLevel.toFixed(4)}</dd></div>
                <div><dt>Sample rate</dt><dd>{measurement.sampleRate} Hz</dd></div>
                <div><dt>FFT</dt><dd>{measurement.fftSize} / {measurement.frequencyResolutionHz.toFixed(2)} Hz</dd></div>
              </dl>
            ) : (
              <p className="scs-hint">No measurement was attached to this capture.</p>
            )}
            <footer className="scs-card-foot">
              <span>{draft.report.signalFamily} · {draft.report.confidence} pattern confidence</span>
              <span>ZIONCORE</span>
            </footer>
          </article>

          <section className="scs-export" aria-labelledby="scs-export-title" data-testid="panel-signal-card-export">
            <h3 id="scs-export-title">Export &amp; share</h3>
            <p className="scs-warn" role="note">
              The title, edited summary, measurement facts, provider details, and any captured spectrum image are included by default. The four optional sections below start excluded. Personalised text can itself hold private details: review it before sharing.
            </p>
            <div className="scs-options">
              {exportFields.map(field => (
                <label key={field.key} className="scs-option">
                  <input
                    type="checkbox"
                    checked={exportOptions[field.key]}
                    onChange={event => setExportOptions(o => ({ ...o, [field.key]: event.target.checked }))}
                    data-testid={`checkbox-export-${field.key}`}
                  />
                  <span><strong>{field.label}</strong><small>{field.hint}</small></span>
                </label>
              ))}
            </div>
            <label className="scs-preview-label" htmlFor="scs-preview">Exact shared text</label>
            <p className="scs-hint">Native sharing sends this text only. HTML and JSON downloads also include the captured spectrum image, when available. Printable HTML can be saved as a PDF through your browser.</p>
            {preview.error ? (
              <p className="scs-alert" role="alert">{preview.error}</p>
            ) : (
              <pre id="scs-preview" className="scs-preview" tabIndex={0} data-testid="text-signal-card-export-preview">{preview.text}</pre>
            )}
            <div className="scs-export-actions">
              <button type="button" className="btn btn-subtle" onClick={() => download('html')} data-testid="button-export-html"><FileCode2 size={14} aria-hidden="true" /> Printable HTML</button>
              <button type="button" className="btn btn-subtle" onClick={() => download('txt')} data-testid="button-export-txt"><FileText size={14} aria-hidden="true" /> Text</button>
              <button type="button" className="btn btn-subtle" onClick={() => download('json')} data-testid="button-export-json"><FileJson size={14} aria-hidden="true" /> JSON</button>
              <button type="button" className="btn btn-primary scs-share" onClick={() => void share()} data-testid="button-share-signal-card">
                {canNativeShare ? <Share2 size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
                {canNativeShare ? 'Share' : 'Share unavailable: download text'}
              </button>
            </div>
            <div aria-live="polite">
              {shareMessage && <p className="scs-status" data-testid="status-signal-card-share">{shareMessage}</p>}
            </div>
            {shareError && <p className="scs-alert" role="alert" data-testid="status-signal-card-share-error">{shareError}</p>}
          </section>
        </div>
      )}

      <section className="scs-library" aria-labelledby="scs-library-title">
        <div className="scs-library-head">
          <h3 id="scs-library-title">Saved cards</h3>
          <span data-testid="text-signal-card-count">{cards.length}/20</span>
        </div>
        {listError ? (
          <div className="scs-alert" role="alert" data-testid="status-signal-card-list-error">
            <AlertCircle size={15} aria-hidden="true" /><span>{listError}</span>
            <button type="button" className="btn btn-subtle" onClick={() => loadList(userId)} data-testid="button-retry-signal-cards">Try again</button>
          </div>
        ) : cards.length === 0 ? (
          <p className="scs-hint" data-testid="status-signal-cards-empty">No saved cards yet. The first one you save will live here.</p>
        ) : (
          <ul className="scs-list">
            {cards.map(card => {
              const Icon = templateIcons[card.template];
              const active = draft?.id === card.id;
              return (
                <li key={card.id} className={`scs-item tpl-${card.template} ${active ? 'is-active' : ''}`} data-testid={`card-saved-signal-${card.id}`}>
                  <button
                    type="button"
                    className="scs-item-open"
                    onClick={() => { if (!active) guard(() => openCard(card, `Opened "${card.title}".`)); }}
                    aria-current={active ? 'true' : undefined}
                    data-testid={`button-open-signal-card-${card.id}`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span className="scs-item-title">{card.title}</span>
                    <span className="scs-item-meta">{formatHz(card.capture.measurement?.dominantFrequencyHz ?? null)} · {formatDate(card.updatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    className="scs-item-delete"
                    onClick={() => requestDelete(card)}
                    aria-label={`Delete ${card.title}`}
                    data-testid={`button-delete-signal-card-${card.id}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pending && (
        <div className="modal-backdrop" onClick={() => setPending(null)}>
          <div
            ref={dialogRef}
            className="modal scs-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="scs-confirm-title"
            aria-describedby="scs-confirm-body"
            onClick={event => event.stopPropagation()}
            data-testid="dialog-signal-card-confirm"
          >
            <h2 id="scs-confirm-title">{pending.title}</h2>
            <p id="scs-confirm-body">{pending.body}</p>
            <div className="modal-actions">
              <button ref={confirmRef} type="button" className="btn btn-subtle" onClick={() => setPending(null)} data-testid="button-cancel-signal-card-confirm">Keep</button>
              <button
                type="button"
                className={pending.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => { const run = pending.run; setPending(null); run(); }}
                data-testid="button-confirm-signal-card"
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
