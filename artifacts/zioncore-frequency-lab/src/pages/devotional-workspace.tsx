import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { BookOpen, Download, Heart, ShieldCheck, Trash2 } from 'lucide-react';
import {
  DEVOTIONAL_INTENTIONS,
  DEVOTIONAL_RECORD_TYPES,
  createDevotionalExport,
  createDevotionalRecord,
  devotionalDraftSchema,
  type DevotionalDraft,
  type DevotionalRecord,
} from '@/lib/private-devotional';
import { downloadFile } from '@/lib/observations';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import './devotional-workspace.css';

const intentionLabels: Record<(typeof DEVOTIONAL_INTENTIONS)[number], string> = {
  wellbeing: 'Wellbeing',
  wisdom: 'Wisdom',
  protection: 'Protection',
  prosperity: 'Prosperity',
  unity: 'Unity',
  compassion: 'Compassion',
  'successful-endeavours': 'Successful endeavours',
  'spiritual-growth': 'Spiritual growth',
  remembrance: 'Remembrance',
  gratitude: 'Gratitude',
  other: 'Other',
};

const recordTypeLabels: Record<(typeof DEVOTIONAL_RECORD_TYPES)[number], string> = {
  'prayer-intention': 'Prayer intention',
  'private-journal': 'Private journal',
  'family-blessing': 'Family blessing',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function DevotionalWorkspacePage() {
  const [records, setRecords] = useState<DevotionalRecord[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const form = useForm<DevotionalDraft>({
    resolver: zodResolver(devotionalDraftSchema),
    defaultValues: {
      title: '',
      recordType: 'prayer-intention',
      intention: 'wellbeing',
      personOrFamilyLabel: '',
      content: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    document.title = 'Private Devotional Workspace | ZionCore';
    return () => {
      document.title = 'ZionCore Frequency Lab';
    };
  }, []);

  const addRecord = (values: DevotionalDraft) => {
    try {
      const record = createDevotionalRecord(values);
      setRecords(previous => [record, ...previous]);
      form.reset();
      setError('');
      setStatus('Added to this private browser session. Export it before leaving this page.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The entry could not be validated.');
      setStatus('');
    }
  };

  const exportRecords = () => {
    try {
      const archive = createDevotionalExport(records);
      downloadFile(
        `zioncore-devotional-session-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(archive, null, 2),
        'application/json',
      );
      setError('');
      setStatus('Export created on this device. The downloaded file is not encrypted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The export could not be created.');
      setStatus('');
    }
  };

  const removeRecord = (record: DevotionalRecord) => {
    if (!window.confirm(`Remove “${record.title}” from this browser session?`)) return;
    setRecords(previous => previous.filter(item => item.id !== record.id));
    setStatus('Entry removed from this page session.');
  };

  const clearRecords = () => {
    if (!window.confirm('Clear every devotional entry from this page session? This cannot be undone.')) return;
    setRecords([]);
    setStatus('All entries were cleared from this page session.');
  };

  return (
    <main id="main-content" className="page-wrap devotional-page" tabIndex={-1}>
      <header className="devotional-hero">
        <div className="eyebrow">Personal practice / account session</div>
        <div className="devotional-title-row">
          <div>
            <h1 className="page-title">Private devotional workspace</h1>
            <p className="lead">
              Write prayer intentions, reflections, or family blessings for your own use. Entries are authored by you;
              ZionCore does not generate a spiritual response or promise an outcome.
            </p>
          </div>
          <span className="devotional-mark" aria-hidden="true"><Heart size={24} /></span>
        </div>
      </header>

      <aside className="panel devotional-privacy" role="note" data-testid="notice-devotional-privacy">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Private to this signed-in page session</strong>
          <p>
            Entries remain in this tab’s memory only. They are not saved to Firebase, sent to AI, or added to a shared
            collection. Leaving this page or refreshing clears them. Export is optional and creates a readable,
            unencrypted file; keep that file somewhere private. This app does not provide encrypted storage.
          </p>
        </div>
      </aside>

      <div className="devotional-grid">
        <section className="panel devotional-compose" aria-labelledby="devotional-compose-title">
          <div className="panel-head">
            <span className="panel-title" id="devotional-compose-title">Create a private entry</span>
            <BookOpen size={16} aria-hidden="true" />
          </div>
          <div className="section-body">
            <Form {...form}>
              <form className="devotional-form" onSubmit={form.handleSubmit(addRecord)} data-testid="form-devotional-entry">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><input className="select-control" maxLength={120} placeholder="A short title" {...field} data-testid="input-devotional-title" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="devotional-form-row">
                  <FormField
                    control={form.control}
                    name="recordType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entry type</FormLabel>
                        <FormControl>
                          <select className="select-control" {...field} data-testid="select-devotional-type">
                            {DEVOTIONAL_RECORD_TYPES.map(type => <option key={type} value={type}>{recordTypeLabels[type]}</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="intention"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intention</FormLabel>
                        <FormControl>
                          <select className="select-control" {...field} data-testid="select-devotional-intention">
                            {DEVOTIONAL_INTENTIONS.map(intention => <option key={intention} value={intention}>{intentionLabels[intention]}</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="personOrFamilyLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Person or family label <span className="devotional-optional">Optional</span></FormLabel>
                      <FormControl><input className="select-control" maxLength={120} placeholder="Use a name or private label if helpful" {...field} data-testid="input-devotional-person" /></FormControl>
                      <FormDescription>Only include information you are comfortable keeping in this browser session.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prayer, reflection, or blessing</FormLabel>
                      <FormControl><textarea className="select-control devotional-textarea" rows={6} maxLength={4000} placeholder="Write in your own words…" {...field} data-testid="textarea-devotional-content" /></FormControl>
                      <div className="devotional-character-count">{field.value.length} / 4,000 characters</div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button className="btn btn-primary devotional-submit" type="submit" disabled={!form.formState.isValid} data-testid="button-devotional-add">
                  <Heart size={15} aria-hidden="true" /> Add to this session
                </button>
              </form>
            </Form>
          </div>
        </section>

        <section className="panel devotional-records" aria-labelledby="devotional-records-title">
          <div className="panel-head devotional-records-head">
            <span className="panel-title" id="devotional-records-title">This session <span className="devotional-count">{records.length}</span></span>
            <div className="devotional-record-actions">
              <button className="btn btn-subtle" type="button" onClick={exportRecords} disabled={!records.length} data-testid="button-devotional-export">
                <Download size={14} aria-hidden="true" /> Export JSON
              </button>
              <button className="btn btn-subtle devotional-clear" type="button" onClick={clearRecords} disabled={!records.length} data-testid="button-devotional-clear">
                Clear all
              </button>
            </div>
          </div>
          {error && <p className="devotional-message is-error" role="alert" data-testid="status-devotional-error">{error}</p>}
          {status && <p className="devotional-message" role="status" data-testid="status-devotional">{status}</p>}
          {records.length ? (
            <div className="devotional-record-list">
              {records.map(record => (
                <article className="devotional-record" key={record.id} data-testid="card-devotional-record">
                  <div className="devotional-record-top">
                    <div>
                      <span className="devotional-record-type">{recordTypeLabels[record.recordType]} · {intentionLabels[record.intention]}</span>
                      <h2>{record.title}</h2>
                    </div>
                    <button className="devotional-remove" type="button" onClick={() => removeRecord(record)} aria-label={`Remove ${record.title}`} data-testid="button-devotional-remove">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {record.personOrFamilyLabel && <p className="devotional-person">{record.personOrFamilyLabel}</p>}
                  <p className="devotional-record-content">{record.content}</p>
                  <time dateTime={record.createdAt}>{formatDate(record.createdAt)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="devotional-empty" data-testid="empty-devotional-records">
              <span className="empty-glyph"><BookOpen size={20} /></span>
              <h2>No entries in this session</h2>
              <p>Create an entry on the left. It stays only while this page remains open, unless you export it.</p>
            </div>
          )}
        </section>
      </div>
      <p className="devotional-footer-note">
        <ShieldCheck size={13} aria-hidden="true" /> No entries are included in shared ZionCore research or analytics.
      </p>
    </main>
  );
}
