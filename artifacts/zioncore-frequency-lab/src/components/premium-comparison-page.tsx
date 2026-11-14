import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowRight, Crown, LockKeyhole, RefreshCw, Waves } from 'lucide-react';
import { Link } from 'wouter';
import { listCloudObservations } from '@/lib/cloud-observations';
import { readMembership } from '@/lib/membership';
import { isPremiumEntitled, type MembershipSnapshot } from '@/lib/membership-model';
import type { Observation } from '@/lib/observations';
import './premium-comparison-page.css';

type PageState = 'checking' | 'signed-out' | 'locked' | 'loading' | 'ready' | 'empty' | 'error';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Date unavailable';
}

function frequency(value: number | null) {
  return value == null ? 'No stable peak recorded' : `${value.toFixed(2)} Hz`;
}

function SessionPanel({ label, observation }: { label: string; observation: Observation }) {
  return (
    <article className="zc-premium-session">
      <div className="zc-premium-session-top">
        <span>{label}</span>
        <time dateTime={observation.createdAt}>{formatDate(observation.createdAt)}</time>
      </div>
      <h3>{frequency(observation.dominantFrequencyHz)}</h3>
      <dl>
        <div><dt>Strongest peaks</dt><dd>{observation.topPeaksHz.length ? observation.topPeaksHz.slice(0, 4).map(value => `${value.toFixed(1)} Hz`).join(' · ') : 'No peaks saved'}</dd></div>
        <div><dt>Relative level</dt><dd>{(observation.rmsLevel * 100).toFixed(1)}%</dd></div>
        <div><dt>Capture length</dt><dd>{observation.durationSeconds.toFixed(1)} s</dd></div>
        <div><dt>Input</dt><dd>{observation.mode === 'microphone' ? 'Microphone' : 'Audio file'}</dd></div>
      </dl>
      {observation.notes && <p className="zc-premium-session-note">{observation.notes}</p>}
    </article>
  );
}

export function PremiumComparisonPage({
  user,
  authLoading,
}: {
  user: User | null;
  authLoading: boolean;
}) {
  const [pageState, setPageState] = useState<PageState>('checking');
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    if (authLoading) {
      setPageState('checking');
      return () => { active = false; };
    }
    if (!user) {
      setMembership(null);
      setObservations([]);
      setPageState('signed-out');
      return () => { active = false; };
    }

    setError('');
    setPageState('checking');
    void (async () => {
      const record = await readMembership(user.uid);
      if (!active) return;
      setMembership(record);
      if (!isPremiumEntitled(record)) {
        setPageState('locked');
        return;
      }
      setPageState('loading');
      const saved = await listCloudObservations();
      if (!active) return;
      setObservations(saved);
      setFirstId(saved[0]?.id ?? '');
      setSecondId(saved[1]?.id ?? '');
      setPageState(saved.length >= 2 ? 'ready' : 'empty');
    })().catch(() => {
      if (!active) return;
      setError('ZionCore could not verify your membership or load your saved observations. Retry to check again.');
      setPageState('error');
    });

    return () => { active = false; };
  }, [user?.uid, authLoading, retry]);

  const first = useMemo(
    () => observations.find(item => item.id === firstId) ?? null,
    [observations, firstId],
  );
  const second = useMemo(
    () => observations.find(item => item.id === secondId) ?? null,
    [observations, secondId],
  );
  const frequencyDelta = first?.dominantFrequencyHz != null && second?.dominantFrequencyHz != null
    ? second.dominantFrequencyHz - first.dominantFrequencyHz
    : null;

  return (
    <section className="zc-premium-page" data-testid="page-premium-comparison">
      <div className="zc-premium-kicker"><Crown size={14} aria-hidden="true" /> PREMIUM MEMBER TOOL</div>
      <h1>Compare your resonance sessions.</h1>
      <p className="zc-premium-intro">Turn saved listening sessions into a personal comparison lab. Review dominant peaks, relative level, and capture conditions side by side.</p>
      <div className="zc-premium-value">
        <Waves size={16} aria-hidden="true" />
        <span>Included with Premium. Runs on your saved measurements—no extra AI request or interpretation credits.</span>
      </div>

      {pageState === 'checking' || pageState === 'loading' ? (
        <div className="zc-premium-state" role="status">Checking your membership and private archive…</div>
      ) : pageState === 'signed-out' ? (
        <div className="zc-premium-state">
          <LockKeyhole size={18} aria-hidden="true" />
          <p>Sign in to check membership and open your private comparison workspace.</p>
          <Link href="/history" className="btn btn-primary">Sign in <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      ) : pageState === 'locked' ? (
        <div className="zc-premium-state">
          <LockKeyhole size={18} aria-hidden="true" />
          <p>This comparison workspace opens with an active, server-verified Premium membership.</p>
          <Link href="/wallet" className="btn btn-primary">View current Premium offer <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      ) : pageState === 'error' ? (
        <div className="zc-premium-state zc-premium-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-subtle" onClick={() => setRetry(value => value + 1)}>
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : pageState === 'empty' ? (
        <div className="zc-premium-state">
          <Waves size={18} aria-hidden="true" />
          <p>Save at least two observations to compare the patterns you have recorded over time.</p>
          <Link href="/" className="btn btn-primary">Start a listening session <ArrowRight size={14} aria-hidden="true" /></Link>
          <small>Only observations you choose to save are included. Original audio is not needed for this comparison.</small>
        </div>
      ) : (
        <>
          <div className="zc-premium-selectors">
            <label>
              <span>First session</span>
              <select value={firstId} onChange={event => setFirstId(event.target.value)}>
                {observations.map(item => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {frequency(item.dominantFrequencyHz)}</option>)}
              </select>
            </label>
            <span className="zc-premium-versus" aria-hidden="true">VS</span>
            <label>
              <span>Second session</span>
              <select value={secondId} onChange={event => setSecondId(event.target.value)}>
                {observations.map(item => <option key={item.id} value={item.id}>{formatDate(item.createdAt)} · {frequency(item.dominantFrequencyHz)}</option>)}
              </select>
            </label>
          </div>
          {first && second ? (
            <>
              <div className="zc-premium-comparison-grid">
                <SessionPanel label="First observation" observation={first} />
                <SessionPanel label="Second observation" observation={second} />
              </div>
              <div className="zc-premium-delta" role="status">
                <strong>Dominant-peak change</strong>
                <span>{frequencyDelta == null
                  ? 'Both sessions need a recorded dominant peak for this comparison.'
                  : `${frequencyDelta > 0 ? '+' : ''}${frequencyDelta.toFixed(2)} Hz between these saved captures.`}</span>
              </div>
              <p className="zc-premium-footnote">These values describe the saved acoustic measurements and recording conditions. Personal meaning and spiritual reflection remain yours to interpret.</p>
            </>
          ) : (
            <div className="zc-premium-state" role="status">Choose two different sessions to compare them.</div>
          )}
          <Link href="/wallet" className="zc-premium-manage">Manage membership and credits <ArrowRight size={13} aria-hidden="true" /></Link>
        </>
      )}
      {membership && isPremiumEntitled(membership) && <span className="sr-only" data-testid="premium-entitlement-active">Premium active</span>}
    </section>
  );
}
