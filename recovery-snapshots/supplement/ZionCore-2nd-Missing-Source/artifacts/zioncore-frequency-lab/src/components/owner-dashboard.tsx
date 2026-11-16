import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote, ChevronRight, CircleHelp,
  Clock3, Cloud, ExternalLink, Fingerprint, Gauge, LockKeyhole, RefreshCw,
  Server, ShieldCheck, Signal, Users, Webhook,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  useGetAdminDashboardSummary,
  getGetAdminDashboardSummaryQueryKey,
  useGetOwnerFirebaseDiagnostics,
  getGetOwnerFirebaseDiagnosticsQueryKey,
} from '@workspace/api-client-react';
import type {
  AdminDashboardSummary as AdminDashboardSummaryData,
  OwnerFirebaseDiagnostics,
} from '@workspace/api-client-react';
import { getFirebaseIdentityHeaders } from '@/lib/firebase';
import './owner-dashboard.css';

type ViewState = 'auth-loading' | 'signed-out' | 'headers-loading' | 'ready';

function dateLabel(value: string | Date | null | undefined) {
  if (!value) return 'Not reported';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Timestamp unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function amountFromMinor(minor: number, currency: string) {
  try {
    const code = currency.toUpperCase();
    const exponent = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(minor / (10 ** exponent));
  } catch {
    return `${currency.toUpperCase()} ${minor}`;
  }
}

function amountFromMicroUsd(microUsd: number | null) {
  if (microUsd === null || !Number.isSafeInteger(microUsd) || microUsd < 0) return 'Incomplete';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(microUsd / 1_000_000);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Not reported';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(amount)} ${units[unit]}`;
}

function formatUptime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Not reported';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
}

function statusTone(value: string | boolean | null | undefined): 'good' | 'warn' | 'bad' | 'neutral' {
  if (value === true) return 'good';
  if (value === false || value == null) return 'warn';
  const normalized = String(value).toLowerCase();
  if (/active|connected|verified|enabled|valid|healthy|ready|live/.test(normalized)) return 'good';
  if (/error|failed|unavailable|invalid|disabled|missing|forbidden|denied|index_not_ready/.test(normalized)) return 'bad';
  if (/partial|unknown|not_enabled|test|pending|building|lower/.test(normalized)) return 'warn';
  return 'neutral';
}

function StatusPill({ value, label }: { value: string | boolean | null | undefined; label?: string }) {
  const text = label ?? (typeof value === 'boolean' ? (value ? 'Configured' : 'Not configured') : value || 'Not reported');
  return <span className={`zc-admin-pill is-${statusTone(value)}`}><i aria-hidden="true" />{text}</span>;
}

function Metric({ label, value, detail, icon: Icon, tone = 'default' }: {
  label: string; value: string; detail: string; icon: typeof Activity; tone?: 'default' | 'accent';
}) {
  return (
    <article className={`zc-admin-metric ${tone === 'accent' ? 'is-accent' : ''}`}>
      <div className="zc-admin-metric-top"><span>{label}</span><Icon size={17} strokeWidth={1.7} aria-hidden="true" /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SectionHead({ number, eyebrow, title, description, icon: Icon }: {
  number: string; eyebrow: string; title: string; description: string; icon: typeof Activity;
}) {
  return (
    <div className="zc-admin-section-head">
      <span className="zc-admin-section-index">{number}</span>
      <div className="zc-admin-section-title">
        <div className="zc-admin-eyebrow"><Icon size={13} aria-hidden="true" />{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Readout({ label, value, detail, status }: {
  label: string; value: string; detail?: string; status?: string | boolean | null;
}) {
  return (
    <div className="zc-admin-readout">
      <div className="zc-admin-readout-main">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
      {status !== undefined && <StatusPill value={status} />}
    </div>
  );
}

function permissionReadout(value: boolean | null) {
  if (value === true) return { value: 'Granted', status: 'ready' };
  if (value === false) return { value: 'Missing', status: 'permission_denied' };
  return { value: 'Not verified', status: 'unavailable' };
}

function diagnosticQueryLabel(status: OwnerFirebaseDiagnostics['cleanupQuery']['status']) {
  switch (status) {
    case 'pass': return 'Passed';
    case 'permission_denied': return 'Permission denied';
    case 'index_not_ready': return 'Index required or building';
    default: return 'Unavailable';
  }
}

function diagnosticIndexLabel(status: OwnerFirebaseDiagnostics['expiresAtIndex']['status']) {
  switch (status) {
    case 'ready': return 'Ready';
    case 'building': return 'Building';
    case 'missing': return 'Missing';
    default: return 'Unavailable';
  }
}

function LoadingPanel() {
  return (
    <section className="zc-admin-loading" aria-label="Loading administrator snapshot" aria-busy="true">
      <div className="zc-admin-skeleton zc-skeleton-wide" />
      <div className="zc-admin-skeleton-grid">
        <div className="zc-admin-skeleton" /><div className="zc-admin-skeleton" /><div className="zc-admin-skeleton" />
      </div>
      <div className="zc-admin-skeleton zc-skeleton-table" />
      <p>Verifying identity and assembling the latest read-only snapshot…</p>
    </section>
  );
}

function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : null;
  const isForbidden = status === 403;
  return (
    <section className={`zc-admin-access-state ${isForbidden ? 'is-forbidden' : ''}`} role="alert">
      <div className="zc-admin-state-mark">{isForbidden ? <LockKeyhole size={21} /> : <CircleHelp size={21} />}</div>
      <div>
        <div className="zc-admin-eyebrow">{isForbidden ? 'ACCESS NOT GRANTED' : 'SNAPSHOT UNAVAILABLE'}</div>
        <h2>{isForbidden ? 'Administrator role not verified' : 'Could not load operations snapshot'}</h2>
        <p>{isForbidden
          ? 'This signed-in identity is not authorized for the ZionCore administrator console. If access was just granted, refresh the Firebase sign-in token and try again.'
          : (error instanceof Error ? error.message : 'The read-only summary request did not complete. No payments or operational changes were made.')}</p>
        <button type="button" className="zc-admin-button" onClick={retry} data-testid="button-admin-retry">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    </section>
  );
}

function Snapshot({ summary, firebaseDiagnostics, diagnosticsLoading, diagnosticsError, runDiagnostics }: {
  summary: AdminDashboardSummaryData;
  firebaseDiagnostics?: OwnerFirebaseDiagnostics;
  diagnosticsLoading: boolean;
  diagnosticsError: boolean;
  runDiagnostics: () => void;
}) {
  const { firebase, billing, providers, stripe, economics, webhooks, performance } = summary;
  const firebaseConsole = firebase.projectId
    ? `https://console.firebase.google.com/project/${encodeURIComponent(firebase.projectId)}/overview`
    : 'https://console.firebase.google.com/';
  const firebaseAccountsConsole = firebase.projectId
    ? `https://console.firebase.google.com/project/${encodeURIComponent(firebase.projectId)}/authentication/users`
    : firebaseConsole;
  const stripeConsole = 'https://dashboard.stripe.com/';
  const stripeWebhookConsole = 'https://dashboard.stripe.com/webhooks';
  const currencyTotals = stripe.currencyTotals ?? [];
  const endpoints = webhooks.endpoints ?? [];

  return (
    <>
      <section className="zc-admin-overview" id="overview">
        <div className="zc-admin-overview-heading">
          <div><span className="zc-admin-overline">OPERATIONS SNAPSHOT</span><h2>Current signal</h2></div>
          <div className="zc-admin-updated"><Clock3 size={14} aria-hidden="true" /><span>Generated</span><strong>{dateLabel(summary.generatedAt)}</strong></div>
        </div>
        <div className="zc-admin-metrics">
          <Metric label="Account directory" value={firebase.accountDirectoryStatus !== 'connected' ? '—' : firebase.accountCountIsLowerBound ? `${compactNumber(firebase.accountCount)}+` : compactNumber(firebase.accountCount)}
            detail={firebase.accountDirectoryStatus !== 'connected' ? 'Directory unavailable' : `${compactNumber(firebase.disabledAccountCount)} disabled · ${firebase.accountCountIsLowerBound ? 'lower bound' : 'reported total'}`} icon={Users} />
          <Metric label="Payments in window" value={currencyTotals.length ? compactNumber(currencyTotals.reduce((sum, item) => sum + item.paymentCount, 0)) : '—'}
            detail={`${stripe.periodDays} day Stripe window · ${stripe.mode} mode`} icon={Banknote} tone="accent" />
          <Metric label="Webhook endpoints" value={webhooks.status === 'unavailable' || webhooks.status === 'not_enabled' ? '—' : String(endpoints.length)}
            detail={webhooks.status === 'unavailable' || webhooks.status === 'not_enabled' ? webhooks.status.replaceAll('_', ' ') : `${endpoints.filter(endpoint => endpoint.enabled).length} enabled · configuration only`} icon={Webhook} />
          <Metric label="Process uptime" value={formatUptime(performance.uptimeSeconds)}
            detail={`Node ${performance.nodeVersion}`} icon={Activity} />
        </div>
      </section>

      <div className="zc-admin-sections">
        <section className="zc-admin-section" id="accounts">
          <SectionHead number="01" eyebrow="IDENTITY & DIRECTORY" title="Accounts" description="Firebase project identity and directory-level counts. No account-level records are exposed here." icon={Users} />
          <div className="zc-admin-panel zc-admin-data-panel">
            <Readout label="Firebase project" value={firebase.projectId ?? 'Project ID unavailable'} detail="Cloud project associated with this snapshot" status={firebase.projectId ? 'available' : null} />
            <Readout label="Identity verification" value={firebase.identityVerification} detail="Backend verification state" status={firebase.identityVerification} />
            <Readout label="Firestore status" value={firebase.firestoreStatus} status={firebase.firestoreStatus} />
            <Readout label="Account directory status" value={firebase.accountDirectoryStatus} status={firebase.accountDirectoryStatus} />
            <Readout label="Account count" value={`${new Intl.NumberFormat().format(firebase.accountCount)}${firebase.accountCountIsLowerBound ? '+' : ''}`}
              detail={firebase.accountCountIsLowerBound ? 'Lower bound; directory count may be incomplete' : 'Reported directory total'} status={firebase.accountCountIsLowerBound ? 'partial' : true} />
            <Readout label="Disabled accounts" value={new Intl.NumberFormat().format(firebase.disabledAccountCount)} detail="Count only; no account identifiers" />
            <div className="zc-admin-panel-footer"><a className="zc-admin-console-link" href={firebaseAccountsConsole} target="_blank" rel="noreferrer"><Cloud size={15} /> Manage Firebase Auth accounts <ExternalLink size={12} /></a></div>
          </div>
          <div className="zc-admin-panel zc-admin-data-panel zc-admin-firebase-diagnostics" id="firebase-diagnostics">
            <div className="zc-admin-diagnostics-heading">
              <div>
                <span className="zc-admin-overline">READ-ONLY FIRESTORE CHECK</span>
                <strong>Verify this server’s Firebase connection</strong>
                <p>Checks the server identity, effective access, a one-record query probe, and the expiry index. Document contents are never returned.</p>
              </div>
              <button
                type="button"
                className="zc-admin-button"
                onClick={runDiagnostics}
                disabled={diagnosticsLoading}
                data-testid="button-firebase-diagnostics"
              >
                <RefreshCw size={14} className={diagnosticsLoading ? 'is-spinning' : ''} />
                {diagnosticsLoading ? 'Checking' : 'Run check'}
              </button>
            </div>
            {diagnosticsLoading && <p className="zc-admin-diagnostics-message" role="status">Running read-only Firebase checks…</p>}
            {diagnosticsError && <p className="zc-admin-diagnostics-message is-error" role="alert">The diagnostic request failed. No data or settings were changed; retry after confirming administrator sign-in.</p>}
            {!diagnosticsLoading && !diagnosticsError && !firebaseDiagnostics && (
              <p className="zc-admin-diagnostics-message">No diagnostic has run yet. Run the check to verify this server’s Firebase connection.</p>
            )}
            {firebaseDiagnostics && (
              <>
                <div className="zc-admin-diagnostic-grid">
                  <Readout label="Credential source" value={firebaseDiagnostics.credential.source} detail="Secret name only; the key is never returned" />
                  <Readout label="Runtime environment" value={firebaseDiagnostics.runtimeEnvironment} detail="Shows whether this check ran in development or production" status={firebaseDiagnostics.runtimeEnvironment === 'production' ? 'ready' : 'unknown'} />
                  <Readout label="Service account" value={firebaseDiagnostics.credential.serviceAccountEmail ?? 'Not reported'} detail="Identity email only" status={firebaseDiagnostics.credential.status} />
                  <Readout label="Firebase project" value={firebaseDiagnostics.credential.projectId ?? 'Not reported'} status={firebaseDiagnostics.credential.projectId ? 'ready' : 'unavailable'} />
                  <Readout label="Firestore database" value={firebaseDiagnostics.credential.databaseId} />
                  <Readout label="Cleanup query" value={diagnosticQueryLabel(firebaseDiagnostics.cleanupQuery.status)} detail={`Checked ${dateLabel(firebaseDiagnostics.cleanupQuery.checkedAt)}`} status={firebaseDiagnostics.cleanupQuery.status} />
                  <Readout label="Expiry index" value={diagnosticIndexLabel(firebaseDiagnostics.expiresAtIndex.status)} detail={`Checked ${dateLabel(firebaseDiagnostics.expiresAtIndex.checkedAt)}`} status={firebaseDiagnostics.expiresAtIndex.status} />
                  <Readout label="Entity read" value={`${permissionReadout(firebaseDiagnostics.permissions.entitiesGet).value} · ${permissionReadout(firebaseDiagnostics.permissions.entitiesList).value}`} detail="Firestore get and list permissions" status={firebaseDiagnostics.permissions.status === 'checked' && firebaseDiagnostics.permissions.entitiesGet && firebaseDiagnostics.permissions.entitiesList ? 'ready' : firebaseDiagnostics.permissions.status === 'checked' ? 'permission_denied' : 'unavailable'} />
                  <Readout label="Entity create / update" value={`${permissionReadout(firebaseDiagnostics.permissions.entitiesCreate).value} · ${permissionReadout(firebaseDiagnostics.permissions.entitiesUpdate).value}`} detail="Required for server-side wallet writes" status={firebaseDiagnostics.permissions.status === 'checked' && firebaseDiagnostics.permissions.entitiesCreate && firebaseDiagnostics.permissions.entitiesUpdate ? 'ready' : firebaseDiagnostics.permissions.status === 'checked' ? 'permission_denied' : 'unavailable'} />
                  <Readout label="Entity delete" value={permissionReadout(firebaseDiagnostics.permissions.entitiesDelete).value} detail="Required by expired-job cleanup" status={permissionReadout(firebaseDiagnostics.permissions.entitiesDelete).status} />
                  <Readout label="Index inspection" value={permissionReadout(firebaseDiagnostics.permissions.indexesList).value} detail="Firestore index-list permission" status={permissionReadout(firebaseDiagnostics.permissions.indexesList).status} />
                </div>
                <div className="zc-admin-diagnostics-footnote">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>Read-only: no documents are changed, and only query status—not document data—is shown. Generated {dateLabel(firebaseDiagnostics.generatedAt)}.</span>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="zc-admin-section" id="payments">
          <SectionHead number="02" eyebrow="BILLING & REVENUE" title="Payments" description="Aggregate Stripe totals only. No customer records, payment intents, or secrets are shown." icon={Banknote} />
          <div className="zc-admin-panel zc-admin-data-panel">
            <div className="zc-admin-panel-meta">
              <StatusPill value={stripe.status} />
              <span>{stripe.mode} mode</span>
              <span>Trailing {stripe.periodDays} days</span>
              {stripe.truncated && <span className="zc-admin-truncated">Results truncated</span>}
            </div>
            {stripe.status !== 'connected' ? (
              <div className="zc-admin-inline-state"><CircleHelp size={16} /><p>Stripe aggregate data is {stripe.status.replaceAll('_', ' ')}. Values below are not assumed when the source is unavailable.</p></div>
            ) : currencyTotals.length === 0 ? (
              <div className="zc-admin-empty"><span className="zc-admin-empty-mark"><Banknote size={17} /></span><strong>No currency totals returned</strong><p>The snapshot contains no aggregate payment rows for this window.</p></div>
            ) : (
              <div className="zc-admin-table-wrap">
                <table className="zc-admin-table">
                  <thead><tr><th>Currency</th><th>Payments</th><th>Gross</th><th>Refunded</th><th>Net sales</th><th>Stripe net</th></tr></thead>
                  <tbody>{currencyTotals.map(row => (
                    <tr key={row.currency}>
                      <td><span className="zc-admin-currency">{row.currency.toUpperCase()}</span></td>
                      <td>{new Intl.NumberFormat().format(row.paymentCount)}</td>
                      <td>{amountFromMinor(row.grossMinor, row.currency)}</td>
                      <td><span className="zc-admin-money-down"><ArrowDownRight size={12} />{amountFromMinor(row.refundedMinor, row.currency)}</span><small>{row.refundCount} refunds</small></td>
                      <td>{amountFromMinor(row.netSalesMinor, row.currency)}</td>
                      <td><span className="zc-admin-money-up"><ArrowUpRight size={12} />{amountFromMinor(row.stripeNetMinor, row.currency)}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="zc-admin-panel-footer zc-admin-payment-foot">
              <span>Data window: trailing {stripe.periodDays} days · {stripe.mode} mode · minor units formatted per currency exponent.</span>
              <a className="zc-admin-console-link" href={stripeConsole} target="_blank" rel="noreferrer"><Banknote size={15} /> Open Stripe dashboard <ExternalLink size={12} /></a>
            </div>
          </div>
          <div className="zc-admin-billing-strip">
            <span><strong>Checkout</strong><StatusPill value={billing.checkoutEnabled} label={billing.checkoutEnabled ? 'Enabled' : 'Disabled'} /></span>
            <span><strong>Checkout mode</strong><StatusPill value={billing.checkoutMode} label={billing.checkoutMode} /></span>
          </div>
        </section>

        <section className="zc-admin-section" id="economics">
          <SectionHead number="03" eyebrow="SERVICE COST & USAGE" title="AI job economics" description="Aggregates settled service-credit value and provider usage cost recorded on completed jobs." icon={Banknote} />
          <div className="zc-admin-panel zc-admin-data-panel">
            <div className="zc-admin-metrics">
              <Metric label="Settled readings" value={economics.status === 'connected' ? compactNumber(economics.settledJobs) : '—'}
                detail={`${compactNumber(economics.auditedJobs)} with cost records`} icon={Activity} />
              <Metric label="Credits spent" value={economics.status === 'connected' ? compactNumber(economics.creditsSpent) : '—'}
                detail="Settled jobs in scanned records" icon={Banknote} tone="accent" />
              <Metric label="Credit service value" value={economics.status === 'connected' ? amountFromMinor(economics.grossServiceValueMinor, 'gbp') : '—'}
                detail="Gross GBP value of audited redemptions" icon={ArrowUpRight} />
              <Metric label="Estimated provider cost" value={economics.status === 'connected' ? amountFromMicroUsd(economics.estimatedProviderCostMicroUsd) : '—'}
                detail="USD estimate from reported provider tokens" icon={ArrowDownRight} />
            </div>
            <div className="zc-admin-caveat">
              <ShieldCheck size={15} />
              <p>
                {economics.status === 'unavailable'
                  ? 'Job cost data is unavailable for this snapshot.'
                  : `${economics.unauditedSettledJobs} settled jobs do not yet have a cost audit${economics.truncated ? '; the scan reached its 500-job cap' : ''}. Provider cost is estimated from token metadata; infrastructure, storage, payment fees, and tax allocation are not included, so this is not a VAT or net-profit report.`}
              </p>
            </div>
          </div>
        </section>

        <section className="zc-admin-section" id="webhooks">
          <SectionHead number="03" eyebrow="EVENT INTAKE" title="Webhook configuration" description="Configured endpoint inventory and app-side verification posture. This is not delivery-history proof." icon={Webhook} />
          <div className="zc-admin-panel zc-admin-data-panel">
            <div className="zc-admin-webhook-summary">
              <div><span>Configuration status</span><StatusPill value={webhooks.status} /></div>
              <div><span>Signature verification</span><StatusPill value={webhooks.signatureVerification} /></div>
              <div><span>Signing secret</span><StatusPill value={webhooks.signingSecretConfigured} label={webhooks.signingSecretConfigured ? 'Configured · hidden' : 'Not configured'} /></div>
              <div><span>Application route</span><code>{webhooks.appRoute}</code></div>
            </div>
            {endpoints.length === 0 ? (
              <div className="zc-admin-empty"><span className="zc-admin-empty-mark"><Webhook size={17} /></span><strong>No endpoints returned</strong><p>The current summary has no configured endpoint entries.</p></div>
            ) : (
              <div className="zc-admin-endpoint-list">
                {endpoints.map(endpoint => (
                  <article className="zc-admin-endpoint" key={endpoint.id}>
                    <div className="zc-admin-endpoint-icon"><Signal size={16} /></div>
                    <div className="zc-admin-endpoint-main">
                      <div className="zc-admin-endpoint-url">{endpoint.url}</div>
                      <div className="zc-admin-endpoint-meta"><code>{endpoint.id}</code><span>{endpoint.enabledEventCount} enabled events</span><span>Created {dateLabel(endpoint.createdAt)}</span></div>
                    </div>
                    <div className="zc-admin-endpoint-flags"><StatusPill value={endpoint.enabled} label={endpoint.enabled ? 'Enabled' : 'Disabled'} /><span className={`zc-admin-mode ${endpoint.livemode ? 'is-live' : ''}`}>{endpoint.livemode ? 'LIVE' : 'TEST'}</span></div>
                  </article>
                ))}
              </div>
            )}
            <div className="zc-admin-caveat"><ShieldCheck size={15} /><p>Endpoint configuration does not confirm successful delivery, recent activity, or event processing. No delivery history is included in this snapshot.{webhooks.inventoryTruncated ? ' Endpoint inventory reached its page limit.' : ''}</p><a className="zc-admin-console-link" href={stripeWebhookConsole} target="_blank" rel="noreferrer">Open Stripe webhook events <ExternalLink size={12} /></a></div>
          </div>
        </section>

        <section className="zc-admin-section" id="monitoring">
          <SectionHead number="04" eyebrow="SERVICE TELEMETRY" title="Monitoring" description="Current process diagnostics reported by the service at snapshot time." icon={Gauge} />
          <div className="zc-admin-panel zc-admin-performance">
            <div className="zc-admin-perf-lead"><span className="zc-admin-perf-orbit"><Activity size={18} /></span><div><span>PROCESS HEALTH</span><strong>Runtime diagnostics</strong></div><StatusPill value={performance.uptimeSeconds >= 0 ? true : null} label="Reporting" /></div>
            <div className="zc-admin-perf-grid">
              <div><span>Uptime</span><strong>{formatUptime(performance.uptimeSeconds)}</strong><small>Since current process start</small></div>
              <div><span>Resident memory</span><strong>{formatBytes(performance.rssBytes)}</strong><small>RSS</small></div>
              <div><span>Heap used</span><strong>{formatBytes(performance.heapUsedBytes)}</strong><small>Node.js heap</small></div>
              <div><span>Runtime</span><strong>{performance.nodeVersion}</strong><small>Node.js version</small></div>
            </div>
          </div>
        </section>

        <section className="zc-admin-section" id="checks">
          <SectionHead number="05" eyebrow="READ-ONLY SIGNALS" title="Configuration checks" description="The snapshot performs read-only Firebase and Stripe checks. It does not trigger ZionCore generation or payment." icon={Fingerprint} />
          <div className="zc-admin-panel zc-admin-checks">
            <div className="zc-admin-check-intro"><span className="zc-admin-check-symbol"><Fingerprint size={17} /></span><div><strong>Provider configuration</strong><p>{providers.configurationOnly ? 'Presence only. No generation request was made by this dashboard.' : 'Reported provider settings; this dashboard has not made a generation request.'}</p></div><span className="zc-admin-config-only">{providers.configurationOnly ? 'CONFIGURATION ONLY' : 'NO LIVE TEST'}</span></div>
            <div className="zc-admin-provider-grid">
              <div className="zc-admin-provider"><span className="zc-admin-provider-mark">G</span><div><strong>Gemini</strong><small>Credential configuration reported</small></div><StatusPill value={providers.geminiConfigured} label={providers.geminiConfigured ? 'Configured' : 'Not configured'} /></div>
              <div className="zc-admin-provider"><span className="zc-admin-provider-mark">O</span><div><strong>OpenAI</strong><small>Credential configuration reported</small></div><StatusPill value={providers.openaiConfigured} label={providers.openaiConfigured ? 'Configured' : 'Not configured'} /></div>
            </div>
            <div className="zc-admin-test-boundary"><span className="zc-admin-boundary-line" /><p><strong>Live generation test</strong><br />Not performed. A configured provider does not establish that a live request will succeed.</p><StatusPill value={null} label="Not tested" /></div>
          </div>
        </section>

        <section className="zc-admin-section" id="management">
          <SectionHead number="06" eyebrow="CONTROL PLANES" title="Management consoles" description="Open the provider's own console for operational changes. Changes are intentionally out of scope here." icon={Server} />
          <div className="zc-admin-console-grid">
            <a className="zc-admin-console-card" href={firebaseConsole} target="_blank" rel="noreferrer">
              <span className="zc-admin-console-icon"><Cloud size={19} /></span><span className="zc-admin-console-copy"><small>IDENTITY · DATABASE</small><strong>Firebase console</strong><em>{firebase.projectId ?? 'Project not reported'}</em></span><ChevronRight size={16} className="zc-admin-console-arrow" />
            </a>
            <a className="zc-admin-console-card" href={stripeConsole} target="_blank" rel="noreferrer">
              <span className="zc-admin-console-icon is-brass"><Banknote size={19} /></span><span className="zc-admin-console-copy"><small>PAYMENTS · WEBHOOKS</small><strong>Stripe dashboard</strong><em>{stripe.mode} mode · {stripe.status}</em></span><ChevronRight size={16} className="zc-admin-console-arrow" />
            </a>
          </div>
        </section>
      </div>
      <footer className="zc-admin-footer"><span><LockKeyhole size={13} /> PRIVATE ADMINISTRATOR VIEW</span><p>Read-only snapshot · no customer-level payment details · no secrets displayed · no charges or operational mutations.</p></footer>
    </>
  );
}

export function OwnerDashboard({ user, authLoading }: { user: User | null; authLoading: boolean }) {
  const [identityHeaders, setIdentityHeaders] = useState<Record<string, string> | null>(null);
  const [headerError, setHeaderError] = useState<unknown>(null);
  const [identityRetry, setIdentityRetry] = useState(0);
  const uid = user?.uid ?? '';

  useEffect(() => {
    let active = true;
    setIdentityHeaders(null);
    setHeaderError(null);
    if (!user || authLoading) return () => { active = false; };
    void getFirebaseIdentityHeaders(user).then(headers => {
      if (active) setIdentityHeaders(headers);
    }).catch(error => {
      if (active) setHeaderError(error);
    });
    return () => { active = false; };
  }, [user, uid, authLoading, identityRetry]);

  const queryKey = useMemo(() => [...getGetAdminDashboardSummaryQueryKey(), uid], [uid]);
  const queryEnabled = Boolean(user && !authLoading && identityHeaders && !headerError);
  const query = useGetAdminDashboardSummary({
    request: { headers: identityHeaders ?? undefined, cache: 'no-store' },
    query: { queryKey, enabled: queryEnabled, retry: false, refetchOnWindowFocus: false },
  });
  const diagnosticsQueryKey = useMemo(() => [...getGetOwnerFirebaseDiagnosticsQueryKey(), uid], [uid]);
  const diagnosticsQuery = useGetOwnerFirebaseDiagnostics({
    request: { headers: identityHeaders ?? undefined, cache: 'no-store' },
    query: { queryKey: diagnosticsQueryKey, enabled: false, retry: false, refetchOnWindowFocus: false },
  });
  const viewState: ViewState = authLoading ? 'auth-loading' : !user ? 'signed-out' : !identityHeaders && !headerError ? 'headers-loading' : 'ready';

  return (
    <main className="zc-admin-page" data-testid="page-owner-dashboard">
      <div className="zc-admin-ambient" aria-hidden="true"><span /><span /><span /></div>
      <div className="zc-admin-shell">
        <header className="zc-admin-header">
          <div className="zc-admin-brand">
            <div className="zc-admin-brand-mark"><Signal size={19} strokeWidth={1.6} /></div>
            <div><span>ZIONCORE</span><small>FREQUENCY INTELLIGENCE / CONTROL ROOM</small></div>
          </div>
          <div className="zc-admin-header-actions">
            <span className="zc-admin-restricted"><LockKeyhole size={12} /> RESTRICTED ACCESS</span>
            {viewState === 'ready' && query.data && <button type="button" className="zc-admin-button zc-admin-refresh" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="button-admin-refresh">
              <RefreshCw size={14} className={query.isFetching ? 'is-spinning' : ''} />{query.isFetching ? 'Refreshing' : 'Refresh snapshot'}
            </button>}
          </div>
        </header>

        <div className="zc-admin-hero">
          <div className="zc-admin-hero-copy">
            <div className="zc-admin-kicker"><span /> ADMINISTRATOR CONSOLE <span className="zc-admin-kicker-line" /></div>
            <h1>Operations,<br /><em>in clear signal.</em></h1>
            <p>One read-only view of identity, payments, event intake, and service health. Designed for the two designated ZionCore administrators.</p>
          </div>
          <div className="zc-admin-hero-emblem" aria-hidden="true">
            <div className="zc-admin-orbit orbit-a" /><div className="zc-admin-orbit orbit-b" />
            <div className="zc-admin-orbit-core"><Signal size={29} strokeWidth={1.3} /></div>
            <span className="zc-admin-orbit-label">ZC / 01</span>
          </div>
        </div>

        {viewState === 'auth-loading' || viewState === 'headers-loading' ? <LoadingPanel /> : viewState === 'signed-out' ? (
          <section className="zc-admin-access-state" role="status">
            <div className="zc-admin-state-mark"><LockKeyhole size={21} /></div>
            <div><div className="zc-admin-eyebrow">AUTHENTICATION REQUIRED</div><h2>Sign in to verify administrator access</h2><p>The operations snapshot is protected by Firebase identity verification. No summary is requested until a signed-in identity and authorization headers are ready.</p><Link href="/history" className="zc-admin-button">Go to sign in <ChevronRight size={14} /></Link></div>
          </section>
        ) : headerError ? <ErrorPanel error={headerError} retry={() => { setHeaderError(null); setIdentityHeaders(null); setIdentityRetry(value => value + 1); }} />
          : query.isLoading ? <LoadingPanel />
            : query.isError ? <ErrorPanel error={query.error} retry={() => void query.refetch()} />
              : query.data ? <Snapshot
                summary={query.data}
                firebaseDiagnostics={diagnosticsQuery.data}
                diagnosticsLoading={diagnosticsQuery.isFetching}
                diagnosticsError={diagnosticsQuery.isError}
                runDiagnostics={() => { void diagnosticsQuery.refetch(); }}
              />
                : <section className="zc-admin-empty zc-admin-empty-root"><span className="zc-admin-empty-mark"><Activity size={17} /></span><strong>No snapshot returned</strong><p>The read-only request completed without a summary payload.</p><button type="button" className="zc-admin-button" onClick={() => void query.refetch()}>Retry snapshot</button></section>}

        {query.data && (
          <nav className="zc-admin-anchor-nav" aria-label="Administrator console sections">
            <a href="#overview">Overview</a><a href="#accounts">Accounts</a><a href="#firebase-diagnostics">Firebase check</a><a href="#payments">Payments</a><a href="#economics">Job economics</a><a href="#webhooks">Webhooks</a><a href="#monitoring">Monitoring</a><a href="#checks">Checks</a><a href="#management">Management</a>
          </nav>
        )}
        <div className="zc-admin-endnote"><span>READ-ONLY OPERATIONS SURFACE</span><span>IDENTITY VERIFIED PER REQUEST</span></div>
      </div>
    </main>
  );
}

export default OwnerDashboard;
