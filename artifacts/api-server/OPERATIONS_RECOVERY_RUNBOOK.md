# ZionCore recovery and customer-support runbook

**Reviewed against source:** 2026-11-12

**Production source baseline:** `ca6ff0b252155295315beae1f65fc8e71029ebc1`

**Reported successful production build:** `00c62f95-66ca-47e6-b11b-64a35fc14df0`

This is an operational guide, not evidence that backups, alert delivery, support
staffing, or production recovery access have been configured. The Firebase
project, deployed Firestore backup settings, and Stripe live records were not
inspected while preparing it.

## 1. Recovery boundaries

Keep these data and rollback systems separate:

| Area | Source of truth | Recovery boundary |
| --- | --- | --- |
| Application code | Git source and Replit project history | A code rollback does not restore external customer or billing data. |
| Replit-managed data | The specific Replit database, if used by a service | Replit database recovery applies only to that database. ZionCore's customer history and wallet use Firebase; do not assume Replit database recovery covers them. |
| Cloud observations and account records | Firebase project `ethereal-throne-b20e6` | Firebase backup/PITR configuration and restore permissions have not been verified. |
| Checkout, subscriptions, refunds, and disputes | Stripe | Stripe is authoritative for payment status. Do not reconstruct Stripe state by editing Firestore. |
| Observation history export | The currently selected history scope (local browser or signed-in cloud account) | History JSON/CSV exports only the visible saved observations; it does not back up original recordings or full interpretation reports. |
| Browser observation restore | The customer's browser storage | The backup import merges into local browser history only; it does not restore Firebase cloud history. |
| Credentials | Replit Secrets / approved integration authorization | Never include secret values in source backups, logs, incident tickets, or customer replies. |

The confirmed production source commit is a recovery reference, not permission to
replace the active workspace or deploy it. Preserve both the production source
and any newer working source. Use a separate branch/worktree for recovery and
reconciliation.

## 2. Backup preparation and verification

### Source and release records

1. Before substantial code or configuration work, create a Replit checkpoint
   from the Editor's checkpoint/history interface and verify the Git branch and
   commit. Keep a separate branch for the proposed fix.
2. Record the production build ID, source commit, artifact, and time in UTC.
   Do not infer the deployed commit from the current workspace `HEAD`.
3. Preserve deployment logs and the last-known-good build reference before
   requesting a rollback. A Replit checkpoint, Git revert, or app deployment
   rollback does not undo Stripe transactions or restore Firebase customer data.
4. Do not discard a branch/worktree or run a destructive Git operation as a
   substitute for making a recovery copy.

### Browser observation exports

The History page's JSON/CSV export downloads the currently visible saved
observations from either local browser history or the signed-in cloud history.
It does not include original recordings or full interpretation reports. The
separate Observation Backup/Restore import is local-only: it accepts a ZionCore
JSON observation array or text recovery copy, with a 5 MiB and 10,000-record
import limit. It previews duplicates and conflicts, leaves existing entries
untouched, and requires confirmation before writing.

For a customer reporting missing local history:

1. Ask them to export the affected history scope before attempting repair.
2. Preserve the original export; review its preview and counts before import.
3. Do not import it into Firebase or another account. This tool restores only
   to the browser archive.
4. If their browser archive is damaged, download the damaged archive recovery
   copy before confirming replacement. Do not tell the customer that this
   recovers audio or cloud history.

### Firebase cloud data

The app targets Firebase project `ethereal-throne-b20e6`. The local rules file
is for emulator testing and integration; it must not be deployed as a
project-wide replacement without inspecting and merging the deployed rules.
The current workspace did not verify production backups or point-in-time
recovery.

Before representing cloud records as recoverable:

1. An authorized owner must verify the Firestore database ID, backup/PITR
   coverage, retention window, export destination, restore permissions, and
   most recent successful backup in the Google Cloud/Firebase consoles.
2. Keep Firebase Auth identity recovery separate from Firestore document
   recovery; a Firestore export is not a backup of Authentication users.
3. For a restore, preserve a fresh pre-restore export and restore into a
   separate target where supported. Validate schema, rules, indexes, and
   application compatibility before any production cutover.
4. Production restore, rule changes, bulk account changes, or customer-data
   migration require the owner's specific approval. Never weaken App Check or
   rules to make recovery appear successful.

Reference: [Cloud Firestore backups](https://cloud.google.com/firestore/docs/backups),
[restore data](https://cloud.google.com/firestore/docs/restore-data), and
[point-in-time recovery](https://cloud.google.com/firestore/docs/point-in-time-recovery).
These references describe Google Cloud Firestore procedures; they do not prove
that ZionCore's production project has them enabled.

### Stripe

Stripe records and payment status remain in the authorized Stripe account.
Review test and live mode separately. Do not edit Stripe prices, refunds,
subscriptions, or customer records in response to an incident without the
required owner approval.

## 3. Incident triage

For every incident, record the UTC time, environment, production build ID,
route/status, request ID if available, symptom, customer impact, and actions.
Redact authorization headers, session data, secret values, raw recordings,
private notes, full payment data, and unnecessary account identifiers.

| Signal | Safe first checks | Do not do |
| --- | --- | --- |
| Web/API availability | Check `GET /api/healthz` and service logs. This endpoint only confirms that the API process answered; it does not verify Firebase, Stripe, or AI provider health. | Do not treat an HTTP 200 health response as proof of customer-data or payment availability. |
| Firebase sign-in, cloud history, or App Check | Check the production web-app configuration, authorized domains, App Check app/key/hostname pairing, and the read-only owner Firebase diagnostics. Confirm the authenticated identity and Firebase project match. | Do not paste credentials into chat, enable a different project, enforce an unverified key, or deploy unmerged Firestore rules. |
| AI interpretation or audio review | Check quote availability, wallet reservation/settlement state, provider logs, and the same request's recovery state. The authenticated recovery endpoint is `POST /api/ai/interpretation/recover`; it requires the original request's idempotency key. | If a response is uncertain, do not start a second paid request or invent a new key. Use the same request's recovery path. |
| Checkout or missing credits | Confirm Stripe mode and Checkout/payment status in Stripe, then check webhook delivery and the server's Firestore fulfillment logs. | Do not grant credits manually or ask the customer to repeat checkout while payment status is uncertain. |
| Refund or dispute | Follow Section 4. Record whether Stripe shows pending, succeeded, failed, or disputed. | Do not equate a webhook receipt with a completed refund or alter wallet documents directly. |
| Suspected data exposure or unauthorized access | Preserve minimal redacted logs, notify the authorized owner, and pause only the affected operation through an approved control. Review identity, access, and affected paths. | Do not delete evidence, broaden access, disable security protections, or publish a fix before review. |

The owner console is a read-only operational summary. Its Firebase diagnostic
checks report status and permissions, not customer document contents. Neither is
a replacement for provider dashboards or confirmed restore tests.

## 4. Refund, subscription, and credit incidents

### Refunds

The app does not expose a customer refund endpoint or a server-side wallet
refund/adjustment operation. Refunds must be reviewed by the authorized owner
and, if approved, issued through the correct Stripe account and mode. Verify the
payment and refund status in Stripe; a refund can remain pending or fail.

When the `charge.refunded` webhook resolves the Stripe customer to a ZionCore
account, the handler writes a `manual_review_required` record at
`users/{uid}/billing/stripe/events/{eventId}`. It does **not** automatically
remove purchased credits. The credit ledger currently supports purchases,
promotional grants, reservations, settlements, and releases—not refund
reversals. Therefore:

1. Do not directly edit wallet balances or ledger documents in Firestore.
2. Do not promise that a refund automatically removes unused or already-spent
   credits.
3. Have the owner reconcile the Stripe refund, credit purchase, and wallet
   ledger, then approve any separately implemented adjustment process.
4. Verify the final refund status in Stripe. If it fails or is disputed, follow
   Stripe's current status and dispute workflow rather than issuing a duplicate
   refund.

Stripe reference: [Refund and cancel payments](https://docs.stripe.com/refunds).

### Subscriptions

Customers can open Stripe Billing Portal through the authenticated app flow
when a Stripe customer record is linked. Portal cancellation is not the same as
a refund. Verify the subscription status in Stripe and the resulting entitlement
state before telling a customer that Premium access has ended or been restored.

### Webhook and wallet recovery

The application registers `POST /api/stripe/webhook` before JSON parsing,
requires the Stripe signature, and returns a failure when fulfillment fails so
Stripe can retry. Paid credit-pack grants use a ledger idempotency key based on
the Checkout Session, which prevents duplicate grants for that purchase.
Refund review records are keyed by Stripe event ID.

Do not generalize those specific idempotency protections to every event type.
When a purchase or webhook is uncertain, verify Stripe's payment status and
server fulfillment logs before taking action; never create a second checkout
or hand-edit the wallet to force agreement.

## 5. Code rollback and production restore

### Application code

1. Preserve the failing build ID, source commit, and redacted logs.
2. Compare the failure against the last verified production source.
3. Prefer a targeted revert or reviewed fix on an isolated branch. Do not reset
   the whole workspace, because it may contain unrelated work.
4. Test web and API compatibility together, including auth, wallet, webhook,
   and recovery behavior relevant to the change.
5. Ask the owner before publishing or rolling back production.
6. After an approved rollback, verify the production URL, `/api/healthz`,
   authentication, and affected user journey. A code rollback does not restore
   Firebase or reverse Stripe activity.

Replit references: [Checkpoints and rollbacks](https://docs.replit.com/features/version-control/checkpoints-and-rollbacks),
[data recovery](https://docs.replit.com/features/data-and-storage/data-recovery),
and [Git disaster recovery](https://docs.replit.com/features/version-control/disaster-recovery).
Replit checkpoint/database recovery applies to Replit-managed state; use
Firebase's own recovery process for Firebase data.

### Firebase restore

Treat a production restore as a customer-data operation. Obtain owner approval
for the exact project, database, point in time, target, affected paths, and
rollback plan. Preserve a current export first; restore and verify in a separate
target where supported; compare counts and application behavior; then obtain
separate cutover approval. If a safe restore target or valid backup cannot be
confirmed, stop and report the blocker rather than experimenting on production.

## 6. Customer-support handling

The reviewed source does not define an official customer-support address,
ticket queue, or response-time commitment. Do not invent one or promise an SLA.
The owner must designate the support channel before publishing it to customers.

When a channel is designated:

1. Acknowledge the report and ask only for the approximate UTC time, affected
   feature, and a non-sensitive transaction/request reference if available.
2. Never request a password, one-time code, API key, session token, full card
   details, or an audio file unless a separate, consented research workflow
   requires it.
3. For a billing report, ask the customer not to repeat checkout while status is
   uncertain. Verify the transaction in Stripe before proposing a resolution.
4. For an AI response issue, use the same request's recovery process; explain
   that its reservation/charge status must be verified before a new request.
5. Record the final resolution without copying private audio or credentials into
   operational logs.

## 7. Recovery readiness checklist

- [ ] Production commit and build ID are recorded and recoverable.
- [ ] A Replit checkpoint exists before consequential code/configuration changes.
- [ ] Firebase Firestore database ID, backups/PITR, retention, and restore
      permissions have been verified by an authorized owner.
- [ ] Firebase Authentication identity recovery is documented separately from
      Firestore data restore.
- [ ] Customer browser exports are accurately described as local observation
      metadata/notes only.
- [ ] Stripe test/live modes, webhook delivery checks, refund approval path,
      and wallet reconciliation owner are documented.
- [ ] An official customer-support channel and owner are designated.
- [ ] A restore rehearsal has been completed in a non-production target.
- [ ] Production rollback, data restore, rule changes, and financial
      adjustments have separate owner approvals.

Until the unchecked items are verified, describe recovery as **documented but
not production-tested**.
