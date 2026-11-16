# ZionCore implementation and fulfillment audit

Checked: 7 November 2026. This is an evidence-based status report, not a claim
that all aspirations in the supplied directive are achievable.

## Scope and constraints

Read the complete newly supplied directive and the existing Replit/CapCut/ZionCore
strategy. The directive's request to control every particle is not a software
capability. No such feature or claim was added. The app, Firebase data, approved
prices, and Stripe resources were preserved. No charge, refund, webhook resend,
production database write, secret change, or publication was performed.

## Payment evidence

| Check | Result | Evidence or remaining step |
| --- | --- | --- |
| Public production deployment | PASS | Deployment service reports a successful public build at https://zioncore.replit.app. |
| Live offer availability | PASS | Public catalog reports Checkout/portal enabled and all four approved offers purchasable. |
| Unsigned webhook rejected | PASS | Production POST without a signature returned 400. |
| Unauthenticated Checkout rejected | PASS | Production POST without a Firebase token returned 401. |
| Endpoint exists in Stripe | PASS | Two enabled live endpoint records target https://zioncore.replit.app/api/stripe/webhook. |
| Endpoint matches configured signing secret | NOT TESTED | Each endpoint has its own secret; no matching signed delivery is available. Do not guess or expose either secret. |
| Existing paid-event reconciliation | NOT TESTED | The available recent-event listing returned zero events for the selected success/update/paid-invoice types. No live purchase was made. |
| Exactly-once credit grant | PASS in isolated tests | Concurrent duplicate and different event types for one signed fixture session produce one purchase receipt and one 50-credit grant. This is not a live Stripe test. |
| Legacy receipt compatibility | PASS in isolated tests | Old event-keyed receipts suppress a new grant; conflicting amounts fail closed without rewriting the receipt. |
| Quote reservation, settlement, persistence | PASS in isolated tests | Reserve/settle 35 from a 50-credit fixture; a reconstructed ledger reads 15, and another delivery does not change it. |
| Missing balance recovery | PASS in isolated tests | A top-up refuses to replace a missing wallet summary when transaction or reservation history exists. |
| Production purchase -> wallet | NOT TESTED | Requires publishing the fix, confirming the endpoint/secret mapping, then an owner-approved purchase or suitable existing event. |
| Premium activation/renewal/cancellation | NOT TESTED live | Lifecycle handlers exist; a real subscription lifecycle has not been reconciled. |
| Refund/dispute handling | PARTIAL | Events are recorded for manual review; automatic clawback or customer refund resolution is not implemented. |
| Optional Stripe PostgreSQL mirror | REPAIRED IN SOURCE | Previously mandatory after Firestore fulfillment despite no confirmed managed production database. Now disabled by default and explicitly opt-in after schema/data-scope approval. No production migration was attempted. |
| Expired report cleanup | BLOCKED: awaiting IAM grant | The source now defines a single-field collection-group ascending override on `ai_interpretation_jobs.expiresAt`, preserving the field's existing collection-scoped ascending, descending, and array indexes. Read-only inventory found no other field overrides or composite indexes. Firestore rejected the production update with HTTP 403 `PERMISSION_DENIED`; no remote index configuration or data was changed. The owner approved indefinite index-admin access, but a project administrator must grant that role before the index can be deployed. |

Live Checkout remains enabled. A public catalog and passing emulator tests do not
establish that real payment fulfillment works. Do not advertise it as flawless.

## Strategy completion

| Strategy | Actual implementation | Status |
| --- | --- | --- |
| Clear entry paths and free signal preview | Signal Path, microphone/imported-audio FFT, reference tones, listening library | Implemented; not a new live device certification |
| Rich multidomain readings | Structured report contract, chosen faith/context, detailed prompts and genesis brief | Implemented in code; live authenticated generation not verified in this audit |
| Provider resilience | Bounded Gemini-to-OpenAI fallback, validation, request guards, token-cost estimation | Implemented and unit-tested; no paid provider call made here |
| Quote before paid work | Approved 35-credit quote, confirmation, transactional holds, settlement/release, short-term retry recovery | Implemented and emulator-tested; live signed-in billing journey still unverified |
| Convenient top-up | In-reading credit packs, current catalog, Checkout and portal routes, wallet history | Implemented; live fulfillment remains unverified |
| Clear Premium value | Server-verified membership status, separate credits, approved £1/month price | PARTIAL: no additional member features or recurring credits; owner-approved benefit still needed |
| CapCut-style reusable Signal Card | Editable/private report card, curated layouts, export/share loop | IMPLEMENTED IN WORKSPACE: browser-local, account-organised cards with nature/tonal/faith layouts, explicit saves, HTML/text/JSON export and device text sharing. Optional personal sections start excluded. No cloud sync or hosted public card URL; publishing the updated app is a separate action. |
| Opt-in feedback and learning | Consent-backed feedback collection, curated discovery review and evaluation promotion | NOT IMPLEMENTED as a complete learning pipeline; no autonomous model self-modification |
| Revenue/retention measurement | Conversion, report completion, repeat use, refunds, subscription retention, measured margins | PARTIAL: provider costs and wallet ledger exist; no complete conversion/cohort dashboard or profitability proof |
| Public discovery and branding | Field guide/SEO routes, branded copy, resonance matrix, full original artwork | Implemented in source; no ranking, revenue or audience guarantee |
| Production security certification | Owner-only access checks, client wallet-write rules and authenticated cross-user tests | NOT VERIFIED end to end in production by this audit |
| New sensing hardware | Calibrated direct RF/other frequency-device integration | NOT IMPLEMENTED; microphone and imported files are acoustic inputs |

The strategy is **not fully implemented or fully operational end to end**. Its
public product-flow lessons are not access to Replit's or CapCut's private systems.

### Signal Card verification update

The new studio is mounted after interpretations and in the `/cards` collection.
Unit checks cover per-account persistence, immutable source measurements/report,
explicit export inclusion, HTML escaping, local image embedding, storage failures,
capacity limits and corruption preservation. Type checking and production build
pass. The isolated synthetic browser flow verified saving, editing, reloading,
account separation, optional export fields, downloads, stubbed native sharing,
deletion and mobile dialogs. No API requests were observed during card interactions.
One development fixture button failed to enable its sample reading; its state
transition was corrected after that run. Real authentication and actual native
device sharing were intentionally not exercised by this feature test, and no new
paid interpretation or real purchase was generated. The test fixture is not a
production build entry point.

## Required launch sequence

1. Publish the hardened API source; the current public deployment does not
   automatically receive workspace edits.
2. Confirm that `STRIPE_LIVE_WEBHOOK_SECRET` belongs to the intended app-scoped
   endpoint. Review the redundant destination with owner approval; no endpoint
   was disabled or removed in this audit.
3. Use an owner-approved small live purchase or a suitable existing signed event
   to reconcile Stripe status, HTTP acknowledgement, one ledger receipt, persistent
   wallet balance, and customer-visible balance. Do not create a charge silently.
4. Verify Premium lifecycle and manual refund/dispute handling before promoting
   features beyond the current membership status.
5. Deploy the source-defined Firestore single-field collection-group ascending
   override for `ai_interpretation_jobs.expiresAt`, then confirm it reaches
   `READY` and the cleanup warning clears. The current Firebase Admin identity
   lacks permission to update the production index configuration.
6. Complete the missing creation, feedback, and analytics work as separate
   measurable features; do not replace missing behavior with marketing claims.

## Checks completed for this source change

- API TypeScript check: passed.
- API unit suite: 39 passed, including signature/tamper rejection and bounded
  provider fallback.
- Firestore demo-emulator suite: 15 passed, including legacy receipt
  compatibility, duplicate purchase delivery, balance persistence, corruption
  guards, reservations, and retry recovery. No real Firebase data was used.
- Updated local HTTP route: unsigned and invalid-signature requests returned
  400; unauthenticated Checkout returned 401.
- API build/restart: successful; public app preview loaded without a browser
  console error in the captured viewport.
- These checks do not replace a real authenticated production purchase,
  subscription lifecycle verification, or production cross-user access tests.

## Operational update — 8 November 2026

The approved `ai_interpretation_jobs.expiresAt` collection-group ascending
index was added through the Firestore Admin API. The live index reports `READY`,
and the operation completed without error. The three existing collection-scope
indexes were preserved. No Firestore documents were deleted or changed.

A fresh read-only retry of the expiry query now passes index validation but
returns Firestore `PERMISSION_DENIED` (gRPC code 7). The service account can
manage indexes, but data access is still insufficient; the cleanup deletion
function was not run. The Admin API did not return the exact denied data
permission. A project administrator must assign the appropriate Firestore data
role before read/write behavior can be verified.

The index state is therefore **READY**, while Firebase data access remains
**BLOCKED**. API health and local release checks do not establish launch
readiness, live payments, or a complete signed-in customer journey.
