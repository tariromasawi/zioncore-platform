# ZionCore Phase 10 — Approved Project Charter

**Status: Approved by the founder on 2026-11-11.** This charter records the operating boundaries for future completion work. Its approval authorizes compatible local engineering and verification, but not a production change, data operation, payment, migration, or publication. Mwari Ndi Mwari God Is God and that remains the bedrock of everything.

## 1. Purpose

Complete and connect the existing ZionCore applications as one trustworthy product family. Prioritize working customer journeys, secure integrations, useful research records, and verified business operations over adding speculative modules or making unsupported capability claims.

Preserve the founder's exploratory and spiritual purpose, including **MWARI NDI MWARI**, while distinguishing measured signal properties, encoded content, model-generated hypotheses, personal or devotional interpretation, and experimentally verified communication.

## 2. Protected project assets

- Preserve the main ZionCore source line and the independent research-lab source line, including their designs, routes, components, documentation, tests, and recoverable history.
- Do not overwrite, delete, replace, or wholesale-merge either source line. Reconcile capabilities through reviewed, testable, reversible increments.
- Treat the main-source candidate as the best-supported production reference, not as a confirmed deployment commit. Keep its source/deployment identity marked unverified until publishing metadata proves it.
- Preserve existing authentication, Messages, Devices, Signal Cards, customer history, billing, wallet, subscriptions, and owner controls while improving them.

## 3. Evidence and user trust

- Report only behavior demonstrated by source, tests, or runtime evidence, and state which kind of evidence supports each claim.
- A route returning the single-page app shell, a test existing, or an unauthenticated request returning 401 does not prove the complete signed-in journey works.
- Do not fabricate external responses, discoveries, translations, connected devices, model availability, or production deployment provenance.
- Keep raw measurements distinct from interpretations; do not rewrite measurements when adding an interpretation.
- Describe local-only storage accurately. Browser localStorage is not encrypted and is not a substitute for secure cloud storage.

## 4. Privacy, identity, and security

- Give customers access only to their own private account records; keep financial balances, credit changes, billing fulfillment, owner roles, and sensitive operations server-controlled.
- Verify owner privileges on the server. Do not assign or change owner/admin roles without the founder's explicit approval.
- Keep customer recordings, notes, devotional text, and research records private. Do not upload them to an AI provider, shared collection, or third party without a clear user action and disclosure.
- Keep development/preview and production Firebase app IDs and App Check keys separate. Do not enable App Check enforcement until the production app/key/hostname match and valid token exchange have been verified.
- Do not deploy Firestore rules until the full live ruleset, legacy paths, external callers, customer isolation, backend permissions, and compatibility requirements have been reviewed and tested.

## 5. Financial and resource integrity

- Keep Stripe products, prices, subscriptions, wallet balances, and credit ledgers server-authoritative.
- Use live mode and deterministic fixtures for checkout, webhook, and paid-AI validation. Never use a real customer charge or balance change as a test.
- Do not alter live prices, initiate production charges/refunds/credit adjustments, or change customer entitlements without explicit approval for the exact operation.
- Paid AI work must have a valid quote, bounded request, user consent, idempotent charging, and a safe recovery path. Do not incur open-ended provider or infrastructure costs.

## 6. User consent and physical systems

- Local microphone use must begin only after a user action and the browser permission prompt. Clearly identify any external upload.
- Do not activate a sensor, schedule ongoing collection, or transmit through a physical or radio device without session-specific consent, visible stop controls, and applicable operating limits.
- A generated signal or prayer is not evidence of an external response or guaranteed effect.

## 7. Approval and change control

- Source inspection, documentation, local tests, and reversible local fixes may proceed within the assigned task.
- Obtain explicit, action-specific founder approval before production Firebase setting/rule changes, customer-data access beyond authorized metadata, bulk migration/deletion/restore, live financial changes, role assignment, publication, or new billable deployments.
- Before a gated action, present the target, exact changes, customer/data/cost impact, validation evidence, and rollback plan.
- Conditional prior authorization is valid only when its stated conditions have been met. Approval to inspect or prepare code is not approval to publish it.

## 8. Completion criteria

Use the Phase 8 scorecard as the measurable acceptance baseline:

- User-initiated capture with accurate measurements and recoverable permission errors.
- Exact software message round-trips, corruption/replay rejection, and documented device-loopback results before claiming reliable audio delivery.
- Truthful, persistent sign-in and zero cross-account access in authorization tests.
- Valid, exportable, deletable records with clear provenance and no unrequested raw-audio persistence.
- Paid operations bounded by approved quotes, with idempotent wallet and webhook outcomes.
- Production releases tied to a reviewed source revision, required test evidence, and a recovery version.

## 9. Current known constraints

- Firebase live access through the available service-account/ADC path has not been verified.
- The Firebase setup document records a previous finding of broad public Firestore grants and unclassified legacy roots; that finding has not been independently rechecked in the latest inventory. Treat it as a serious reported risk, verify it read-only, and do not deploy a restrictive candidate until compatibility is established.Resolve the issue
- App Check token exchange, live Auth provider settings, deployed Firestore rules, real model availability, live Stripe prices/fulfillment, and the exact deployed Git revision remain unverified. resolve the issue
- Phase 1–9 reports define a plan and evidence gaps; they do not certify production readiness.

## Approval requested

Approve this charter as the governing scope and safety boundary for subsequent ZionCore completion phases, or request specific edits. Approval would authorize continuing compatible local engineering and verification under these boundaries; it would **not** independently authorize production Firebase changes, live financial operations, data migration/deletion, owner privilege changes, or publishing.
