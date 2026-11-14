import React from 'react';
import { Link } from 'wouter';
import InterpretationComparisonPanel from '@/components/interpretation-comparison-panel';
import {
  buildInterpretationComparisonReport,
  type InterpretationComparisonReport,
} from '@/lib/interpretation-comparison';
import {
  Activity,
  ArrowRight,
  AudioLines,
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  downloadFile,
  formatFrequency,
  type Observation,
  type SavedInterpretation,
} from '@/lib/observations';
import type { ResearchSession } from '@/lib/celestial-experiment';

type CustomerProfile = {
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providers: string[];
};

type CustomerDashboardProps = {
  profile: CustomerProfile | null;
  observations: Observation[];
  researchSessions: ResearchSession[];
  loading: boolean;
  authError: string;
  dataError: string;
  observationError?: string;
  researchSessionsError?: string;
  onExport?: () => void | Promise<void>;
  exporting?: boolean;
  exportError?: string;
  exportStatus?: string;
};

type ObservationWithInterpretation = Observation & { interpretation?: SavedInterpretation };

function withSavedInterpretation(item: Observation): ObservationWithInterpretation {
  return item as ObservationWithInterpretation;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-3)}` : value;
}

function DashboardStyles() {
  return (
    <style>{`
      .zc-dash-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:28px}
      .zc-dash-stamp{width:112px;height:112px;flex:0 0 auto;border:1px solid #d7d1c3;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#54706b;background:#eeeadf}
      .zc-dash-stamp span{font:8px var(--app-font-mono);letter-spacing:.12em;color:#77857f}
      .zc-dash-stamp i{display:block;width:22px;height:1px;background:#d6a34a}
      .zc-dash-gate{max-width:580px;margin-top:28px}
      .zc-dash-cta{margin-top:4px;text-decoration:none}
      .zc-dash-summary{margin-top:32px;background:#e9e6db;border:1px solid #d8d2c5;border-radius:5px;padding:22px 25px}
      .zc-dash-summary-main{display:flex;align-items:center;gap:15px;min-width:0}
      .zc-dash-avatar{width:48px;height:48px;border-radius:50%;background:#25454a;color:#f2bd62;display:grid;place-items:center;flex:0 0 auto}
      .zc-dash-identity{display:grid;gap:4px;min-width:0}
      .zc-dash-identity strong{font:25px/1.1 var(--app-font-serif);color:#29474a;font-weight:400}
      .zc-dash-email{color:#7a8780;font:10px var(--app-font-mono);overflow-wrap:anywhere}
      .zc-dash-verified{display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:7px 9px;border:1px solid #d3cdbc;background:#f5f2e9;border-radius:2px;color:#78867e;font:9px var(--app-font-mono);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
      .zc-dash-verified.is-verified{color:#48715f;border-color:#c9d5c7;background:#edf1e8}
      .zc-dash-verified.is-unverified{color:#927342;border-color:#dfd1b4;background:#f4eddf}
      .zc-dash-summary-meta{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:20px 0 0;padding-top:16px;border-top:1px solid #d8d2c5}
      .zc-dash-provider-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .zc-dash-provider{padding:5px 8px;border:1px solid #d7d1c3;background:#f5f2e9;color:#536966;border-radius:2px;font:9px var(--app-font-mono)}
      .zc-dash-record-count{display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:baseline;text-align:right}
      .zc-dash-record-count .zc-field-label{grid-column:span 2}
      .zc-dash-record-count strong{font:24px var(--app-font-mono);color:#29474a}
      .zc-dash-record-count>span:last-child{font-size:10px;color:#84908a}
      .zc-dash-access-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
       .zc-dash-export-card{grid-column:1/-1}
       .zc-dash-export-copy{color:#71807e;font-size:11px;line-height:1.6;margin:0 0 13px}
       .zc-dash-export-button{width:100%}
       .zc-dash-export-button:disabled{cursor:not-allowed;opacity:.55;transform:none}
      .zc-dash-access-card .section-body{padding:16px 20px}
      .zc-dash-access-card .empty-inline{margin:8px 0 0}
      .zc-dash-connection{color:#74827c;font:10px var(--app-font-mono);text-transform:uppercase;letter-spacing:.09em}
      .zc-dash-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:39px 0 15px}
      .zc-dash-section-heading h2{font:31px/1.05 var(--app-font-serif);font-weight:400;color:#29474a;margin:7px 0 0}
      .zc-dash-section-note{color:#89948e;font:9px var(--app-font-mono);letter-spacing:.04em}
      .zc-dash-work-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch}
      .zc-dash-work-panel{display:flex;flex-direction:column;min-width:0}
      .zc-dash-list{padding:0 18px;flex:1}
      .zc-dash-list-item{display:flex;align-items:center;gap:12px;padding:16px 3px;border-bottom:1px solid #e8e3d8;min-width:0}
      .zc-dash-list-item:last-child{border-bottom:0}
      .zc-dash-list-mark{width:33px;height:33px;flex:0 0 auto;display:grid;place-items:center;background:#e8e4d8;color:#58736e;border-radius:50%}
      .zc-dash-list-mark.session{background:#eee6d7;color:#9a7841}
      .zc-dash-list-copy{display:grid;gap:4px;min-width:0;flex:1}
      .zc-dash-list-copy strong{color:#345052;font:15px var(--app-font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:capitalize}
      .zc-dash-list-copy span{color:#627471;font-size:10px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .zc-dash-list-copy small{display:flex;align-items:center;gap:4px;color:#929b94;font:9px var(--app-font-mono)}
      .zc-dash-id{color:#a0a79e;font:8px var(--app-font-mono);white-space:nowrap}
      .zc-dash-empty{padding:29px 18px}
      .zc-dash-empty .empty-glyph{width:43px;height:43px;margin-bottom:12px}
      .zc-dash-empty h2{font-size:22px}
      .zc-dash-empty p{font-size:11px;margin-bottom:0}
      .zc-dash-panel-footer{padding:12px 20px;border-top:1px solid #e4dfd4}
      .zc-dash-text-link{display:inline-flex;align-items:center;gap:7px;color:#42615e;text-decoration:none;font-size:10px;font-weight:700}
      .zc-dash-text-link:hover{color:#a27735}
      .zc-dash-privacy{margin-top:18px;margin-bottom:0}
       .zc-dash-read-warning{display:flex;align-items:flex-start;gap:10px;padding:24px 21px;color:#8c6a36;font-size:11px;line-height:1.65}
       .zc-dash-read-warning svg{flex:0 0 auto;margin-top:1px}
      .zc-dash-skeleton-title{height:44px;width:min(360px,75%);margin:18px 0 14px;background:#e4dfd4;border-radius:3px;animation:zc-skeleton 1.5s ease-in-out infinite}
      .zc-dash-skeleton-line{height:12px;width:min(530px,90%);background:#e4dfd4;border-radius:3px;animation:zc-skeleton 1.5s ease-in-out infinite}
      .zc-dash-skeleton-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-top:32px}
      .zc-dash-skeleton-card{height:190px;border:1px solid #e1dccf;background:#eeeadf;border-radius:4px;animation:zc-skeleton 1.5s ease-in-out infinite}
      @media(max-width:760px){.zc-dash-work-grid,.zc-dash-access-grid{grid-template-columns:1fr}.zc-dash-heading{align-items:flex-start}.zc-dash-stamp{width:82px;height:82px}.zc-dash-skeleton-grid{grid-template-columns:1fr}}
      @media(max-width:480px){.zc-dash-heading{gap:8px}.zc-dash-stamp{width:58px;height:58px}.zc-dash-stamp span,.zc-dash-stamp i{display:none}.zc-dash-summary{padding:18px 16px}.zc-dash-summary-main{flex-wrap:wrap}.zc-dash-verified{margin-left:63px}.zc-dash-summary-meta{align-items:flex-start}.zc-dash-record-count{display:flex;flex-direction:column;align-items:flex-end}.zc-dash-record-count .zc-field-label{white-space:nowrap}.zc-dash-section-heading{align-items:flex-start;flex-direction:column}.zc-dash-list{padding:0 12px}.zc-dash-id{display:none}.zc-dash-list-item{gap:9px}}
    `}</style>
  );
}

function DashboardSkeleton({
  authenticated,
  onExport,
  exporting = false,
  exportError = '',
  exportStatus = '',
}: {
  authenticated: boolean;
  onExport?: () => void | Promise<void>;
  exporting: boolean;
  exportError: string;
  exportStatus: string;
}) {
  return (
    <main id="main-content" className="page-wrap" aria-busy="true" data-testid="dashboard-loading">
      <DashboardStyles />
      <div className="eyebrow">Personal research account</div>
      <div className="zc-dash-skeleton-title" />
      <div className="zc-dash-skeleton-line" />
      <div className="zc-dash-skeleton-grid">
        <div className="zc-dash-skeleton-card" />
        <div className="zc-dash-skeleton-card" />
      </div>
      {authenticated && (
        <section className="panel zc-dash-gate" aria-label="Account data export">
          <div className="section-body">
            <p className="zc-dash-export-copy">
              Export available account data. Disconnected cloud and billing data is excluded.
            </p>
            <button
              className="btn btn-subtle zc-dash-export-button"
              type="button"
              onClick={() => { if (onExport) void onExport(); }}
              disabled
              data-testid="button-export-account-data"
            >
              <Download size={14} aria-hidden="true" />
              {exporting ? 'Preparing JSON export…' : 'Export available data (JSON)'}
            </button>
            {exportError && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-export-account-error">{exportError}</p>}
            {exportStatus && <p className="zc-callout" role="status" data-testid="status-export-account">{exportStatus}</p>}
          </div>
        </section>
      )}
      <span className="sr-only">Loading your account overview…</span>
    </main>
  );
}

export default function CustomerDashboard({
  profile,
  observations,
  researchSessions,
  loading,
  authError,
  dataError,
  observationError = dataError,
  researchSessionsError = dataError,
  onExport,
  exporting = false,
  exportError = '',
  exportStatus = '',
}: CustomerDashboardProps) {
  const [comparisonReport, setComparisonReport] = React.useState<InterpretationComparisonReport | null>(null);
  const [comparisonError, setComparisonError] = React.useState('');
  const observationsWithInterpretations = observations.map(withSavedInterpretation);
  const comparisonRecordsSignature = JSON.stringify(observationsWithInterpretations.map(item => [
    item.id,
    item.createdAt,
    item.dominantFrequencyHz,
    item.interpretation?.scientificInterpretation,
    item.interpretation?.possibleSources,
    item.interpretation?.provenance,
  ]));

  React.useEffect(() => {
    setComparisonReport(null);
    setComparisonError('');
  }, [comparisonRecordsSignature]);

  const comparableObservations = observationError
    ? []
    : observationsWithInterpretations.filter(item =>
      Boolean(item.interpretation?.provenance) &&
      item.interpretation?.provenance?.observationId === item.id,
    );
  const comparisonOptions = comparableObservations.map(item => ({
    observationId: item.id,
    label: `${formatFrequency(item.dominantFrequencyHz)} · ${formatDate(item.createdAt)}`,
    modelId: item.interpretation?.provenance?.modelId ?? 'Model unavailable',
    confidence: item.interpretation?.confidence ?? 'low',
    possibleSources: item.interpretation?.possibleSources ?? [],
  }));

  const buildComparison = (observationIds: string[]) => {
    try {
      const selected = observationIds.map(id => comparableObservations.find(item => item.id === id));
      if (selected.some(item => !item)) throw new Error('One or more selected records are no longer available.');
      setComparisonReport(buildInterpretationComparisonReport(selected as ObservationWithInterpretation[]));
      setComparisonError('');
    } catch (cause) {
      setComparisonReport(null);
      setComparisonError(cause instanceof Error ? cause.message : 'The comparison report could not be created.');
    }
  };

  const exportComparison = () => {
    if (!comparisonReport) return;
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    downloadFile(
      `zioncore-interpretation-comparison-${timestamp}.json`,
      JSON.stringify(comparisonReport, null, 2),
      'application/json',
    );
  };

  if (loading) {
    return (
      <DashboardSkeleton
        authenticated={Boolean(profile)}
        onExport={onExport}
        exporting={exporting}
        exportError={exportError}
        exportStatus={exportStatus}
      />
    );
  }

  if (!profile) {
    return (
      <main id="main-content" className="page-wrap" data-testid="dashboard-unauthenticated">
        <DashboardStyles />
        <div className="eyebrow">Personal research account</div>
        <h1 className="page-title">Your work, held<br />in one place.</h1>
        <p className="lead">
          Sign in to see your saved acoustic observations and research sessions. Until then,
          account records stay hidden on this page.
        </p>
        {authError && (
          <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-dashboard-auth-error">
            <CircleHelp size={15} aria-hidden="true" />
            <span>{authError}</span>
          </div>
        )}
        <section className="panel zc-dash-gate" aria-labelledby="dashboard-sign-in-title">
          <div className="panel-head">
            <span id="dashboard-sign-in-title" className="panel-title">Account access</span>
            <ShieldCheck size={16} aria-hidden="true" />
          </div>
          <div className="section-body">
            <p className="empty-inline" style={{ marginTop: 0 }}>
              Sign-in is managed in the account access panel. Open History to sign in, then return
              here for your private overview.
            </p>
            <Link href="/history" className="btn btn-primary zc-dash-cta" data-testid="link-dashboard-sign-in">
              Open sign-in <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
        <p className="footnote" data-testid="text-dashboard-anonymous-privacy">
          Credits and membership are not connected in this workspace. No balance or access
          entitlement is available to display.
        </p>
      </main>
    );
  }

  const recentObservations = [...observations]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);
  const recentSessions = [...researchSessions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);
  const providerNames = profile.providers.length ? profile.providers : ['Sign-in provider unavailable'];
  const displayName = profile.displayName?.trim() || profile.email || 'Researcher';
  const totalWork = observations.length + researchSessions.length;

  return (
    <main id="main-content" className="page-wrap" data-testid="dashboard-authenticated">
      <DashboardStyles />
      <div className="eyebrow">Personal research account / overview</div>
      <div className="zc-dash-heading">
        <div>
          <h1 className="page-title">A record of<br />what you explored.</h1>
          <p className="lead">
            Saved work from your research space, gathered in one quiet overview.
            Measurements describe acoustic observations; they are not external messages.
          </p>
        </div>
        <div className="zc-dash-stamp" aria-hidden="true">
          <AudioLines size={25} strokeWidth={1.4} />
          <span>ZC / ACCOUNT</span>
          <i />
        </div>
      </div>

      {authError && (
        <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-dashboard-auth-error">
          <CircleHelp size={15} aria-hidden="true" />
          <span>{authError}</span>
        </div>
      )}
      {dataError && (
        <div className="zc-callout" role="status" data-testid="status-dashboard-saved-work-warning">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>Saved work could not be fully loaded. The records and totals below may be incomplete. {dataError}</span>
        </div>
      )}

      <section className="zc-dash-summary" aria-label="Research overview">
        <div className="zc-dash-summary-main">
          <div className="zc-dash-avatar" aria-hidden="true">
            <UserRound size={24} strokeWidth={1.5} />
          </div>
          <div className="zc-dash-identity">
            <span className="zc-field-label">Research account</span>
            <strong data-testid="text-dashboard-display-name">{displayName}</strong>
            <span className="zc-dash-email" data-testid="text-dashboard-email">
              {profile.email || 'Email address unavailable'}
            </span>
          </div>
          <div
            className={`zc-dash-verified ${profile.emailVerified ? 'is-verified' : 'is-unverified'}`}
            data-testid="status-dashboard-email-verification"
          >
            <BadgeCheck size={15} aria-hidden="true" />
            {profile.emailVerified ? 'Email verified' : 'Email not verified'}
          </div>
        </div>
        <div className="zc-dash-summary-meta">
          <div>
            <span className="zc-field-label">Connected sign-in</span>
            <div className="zc-dash-provider-list" data-testid="list-dashboard-providers">
              {providerNames.map((provider, index) => (
                <span className="zc-dash-provider" key={`${provider}-${index}`} data-testid={`tag-dashboard-provider-${index}`}>
                  {provider}
                </span>
              ))}
            </div>
          </div>
          <div className="zc-dash-record-count">
            <span className="zc-field-label">Saved records</span>
            <strong data-testid="value-dashboard-record-count">{dataError ? '—' : totalWork}</strong>
            <span>observations + sessions</span>
          </div>
        </div>
      </section>

      <section className="zc-dash-access-grid" aria-label="Account services">
        <article className="panel zc-dash-access-card" data-testid="card-dashboard-credits">
          <div className="panel-head">
            <span className="panel-title">AI credits</span>
            <CreditCard size={16} aria-hidden="true" />
          </div>
          <div className="section-body">
            <span className="zc-dash-connection">Not connected</span>
            <p className="empty-inline">
              Credit balance and usage are unavailable here. This workspace has no credits service.
            </p>
          </div>
        </article>
        <article className="panel zc-dash-access-card" data-testid="card-dashboard-membership">
          <div className="panel-head">
            <span className="panel-title">Membership</span>
            <ShieldCheck size={16} aria-hidden="true" />
          </div>
          <div className="section-body">
            <span className="zc-dash-connection">Not connected</span>
            <p className="empty-inline">
              Membership status and benefits are unavailable. No entitlement is being inferred.
            </p>
          </div>
        </article>
        <article className="panel zc-dash-access-card zc-dash-export-card" data-testid="card-dashboard-export">
          <div className="panel-head">
            <span className="panel-title">Account data export</span>
            <Download size={16} aria-hidden="true" />
          </div>
          <div className="section-body">
            <p className="zc-dash-export-copy">
              Export available account data as JSON. Disconnected cloud and billing data is excluded;
              this is not a complete whole-account export while those sources are unavailable.
            </p>
            <button
              className="btn btn-subtle zc-dash-export-button"
              type="button"
              onClick={() => { if (onExport) void onExport(); }}
              disabled={loading || Boolean(dataError) || exporting || !onExport}
              data-testid="button-export-account-data"
            >
              <Download size={14} aria-hidden="true" />
              {exporting ? 'Preparing JSON export…' : 'Export available data (JSON)'}
            </button>
            {exportError && (
              <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-export-account-error">
                <CircleHelp size={15} aria-hidden="true" />
                <span>{exportError}</span>
              </div>
            )}
            {exportStatus && (
              <div className="zc-callout" role="status" data-testid="status-export-account">
                <span>{exportStatus}</span>
              </div>
            )}
          </div>
        </article>
      </section>

      <div className="zc-dash-section-heading">
        <div>
          <div className="eyebrow">Saved locally / account scope</div>
          <h2>Your recent work</h2>
        </div>
        <span className="zc-dash-section-note" data-testid="text-dashboard-data-scope">
          Visible only while signed in
        </span>
      </div>

      <section className="zc-dash-work-grid" aria-label="Recent saved work">
        <article className="panel zc-dash-work-panel" aria-labelledby="dashboard-observations-title">
          <div className="panel-head">
            <span className="panel-title" id="dashboard-observations-title">Acoustic observations</span>
            <Activity size={16} aria-hidden="true" />
          </div>
          {recentObservations.length ? (
            <div className="zc-dash-list" data-testid="list-dashboard-observations">
              {recentObservations.map((item) => (
                <div className="zc-dash-list-item" key={item.id} data-testid={`row-dashboard-observation-${item.id}`}>
                  <div className="zc-dash-list-mark"><AudioLines size={15} aria-hidden="true" /></div>
                  <div className="zc-dash-list-copy">
                    <strong>{formatFrequency(item.dominantFrequencyHz)}</strong>
                    <span>{item.notes?.trim() || 'Acoustic observation'}</span>
                    <small>{formatDate(item.createdAt)} · {item.fftSize.toLocaleString()}-point FFT</small>
                  </div>
                  <span className="zc-dash-id" title={item.id}>{shortId(item.id)}</span>
                </div>
              ))}
            </div>
          ) : (
            observationError ? (
              <div className="zc-dash-read-warning" role="status" data-testid="status-dashboard-observation-read-warning">
                <AlertTriangle size={17} aria-hidden="true" />
                <span>Observation records are unavailable until the saved-work read succeeds.</span>
              </div>
            ) : (
              <div className="empty-state zc-dash-empty" data-testid="empty-dashboard-observations">
                <div className="empty-glyph"><AudioLines size={20} aria-hidden="true" /></div>
                <h2>No observations saved yet</h2>
                <p>When you save an acoustic measurement, it will appear here as a record of your own research.</p>
              </div>
            )
          )}
          <div className="zc-dash-panel-footer">
            <Link href="/history" className="zc-dash-text-link" data-testid="link-dashboard-history">
              Open full history <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article className="panel zc-dash-work-panel" aria-labelledby="dashboard-sessions-title">
          <div className="panel-head">
            <span className="panel-title" id="dashboard-sessions-title">Research sessions</span>
            <BookOpen size={16} aria-hidden="true" />
          </div>
          {recentSessions.length ? (
            <div className="zc-dash-list" data-testid="list-dashboard-sessions">
              {recentSessions.map((session) => (
                <div className="zc-dash-list-item" key={session.id} data-testid={`row-dashboard-session-${session.id}`}>
                  <div className="zc-dash-list-mark session"><BookOpen size={15} aria-hidden="true" /></div>
                  <div className="zc-dash-list-copy">
                    <strong>{session.domain.replaceAll('-', ' ')}</strong>
                    <span>
                      {session.observations.length} acoustic {session.observations.length === 1 ? 'observation' : 'observations'}
                      {session.hypothesis ? ` · hypothesis ${session.hypothesis.status.replaceAll('-', ' ')}` : ' · no hypothesis recorded'}
                    </span>
                    <small><Clock3 size={11} aria-hidden="true" /> Updated {formatDate(session.updatedAt)}</small>
                  </div>
                  <span className="zc-dash-id" title={session.id}>{shortId(session.id)}</span>
                </div>
              ))}
            </div>
          ) : (
            researchSessionsError ? (
              <div className="zc-dash-read-warning" role="status" data-testid="status-dashboard-session-read-warning">
                <AlertTriangle size={17} aria-hidden="true" />
                <span>Research session records are unavailable until the saved-work read succeeds.</span>
              </div>
            ) : (
              <div className="empty-state zc-dash-empty" data-testid="empty-dashboard-sessions">
                <div className="empty-glyph"><BookOpen size={20} aria-hidden="true" /></div>
                <h2>No research sessions yet</h2>
                <p>Saved experiments and their notes will be summarized here. They remain research records, not evidence of outside communication.</p>
              </div>
            )
          )}
          <div className="zc-dash-panel-footer">
            <Link href="/exploration" className="zc-dash-text-link" data-testid="link-dashboard-exploration">
              Open exploration archive <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>

      <InterpretationComparisonPanel
        options={comparisonOptions}
        report={comparisonReport}
        error={observationError ? 'Saved observations could not be verified, so comparison is unavailable.' : comparisonError}
        onBuild={buildComparison}
        onExport={exportComparison}
      />

      <div className="zc-callout zc-dash-privacy" role="note" data-testid="text-dashboard-privacy">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>
          This overview uses only the authenticated profile and research data supplied to it.
          Acoustic measurements describe what a local instrument observed; they do not establish
          messages, intent, or a source beyond the recorded measurement.
        </span>
      </div>
    </main>
  );
}
