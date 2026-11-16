# ZionCore Phase 9 — Approval Gates

**Purpose:** Separate work the engineer can safely complete from changes that need explicit founder approval. This policy preserves both source lines and existing customer, research, identity, and financial data.

## Action and approval matrix

| Action | May proceed without a new approval | Requires explicit approval | Minimum evidence before action |
|---|---|---|---|
| Read source, tests, documentation, Git refs, and public route responses | Yes, within the assigned project scope. Do not expose secrets or read customer record contents. | Private customer-data inspection or wider account-level access not already authorized. | State the scope; use read-only access and minimum necessary metadata. |
| Local documentation, tests, and reversible source fixes | Yes, when compatible with existing behavior and the assigned task. Preserve both source lanes and do not overwrite unrelated work. | Broad refactors, source-lane merges, replacing a feature, changing data formats, or a change that could remove existing customer behavior. | Review the affected files and tests; keep a recoverable baseline and a narrow diff. |
| Firebase Authentication and App Check settings | Inspect configuration through approved read-only access. Keep secrets server-side. | Enabling/disabling a provider, changing authorized domains or identity claims, registering production apps/keys, enabling enforcement, or changing environment secrets. | Verify target project, Firebase App ID, hostname, correct environment-specific key, token exchange, failure behavior, and recovery path. Never enable enforcement before a valid token exchange is confirmed. |
| Production Firestore rules | Review source rules and run emulator tests. A previous user directive conditionally authorized deploying a ruleset only after security and compatibility review. | Any production rules write/deploy; any permission expansion; any change to legacy collection access. | Map all deployed paths and callers, compare full live/proposed rules, test customer isolation and service compatibility, show the exact diff, provide rollback, and obtain approval for that specific deployment. Conditional authority does not waive these prerequisites. |
| Production data reads or migrations | Read-only schema/path metadata when authorized; local migration dry runs against fixtures or emulators. | Reading customer content, bulk export, migration, restore, account merge, retention change, or deletion. | Specify records, users, environment, purpose, counts, backup, rollback, and exact impact. Ask separately for irreversible actions. |
| Billing, credits, subscriptions, and Stripe | Read public catalogue data; run unit tests and Stripe test-mode flows that cannot affect real customers or balances. | Changing live products/prices, starting a real charge, issuing a refund or credit adjustment, changing entitlements, or modifying production webhook configuration. | Confirm live/test mode, exact amount/customer scope, idempotency, event handling, expected ledger effect, and reconciliation/rollback plan. A previous offer list is not authorization to mutate Stripe prices. |
| AI providers and paid processing | Inspect code/config presence without revealing values; run deterministic fixtures and mocked provider tests. | Sending private customer text/audio externally, initiating paid production inference, changing provider/model routing in production, or increasing budgets. | Explicit user action for the data being sent, a clear disclosure, valid quote and cost limit, bounded payload, and failure/refund behavior. |
| Owner roles and administrative access | Test authorization with emulator fixtures; inspect route middleware. | Assigning or changing owner/admin claims, impersonating a customer, granting access to sensitive production data, or invoking privileged production operations. | Verified owner identity, least-privilege scope, exact operation, audit trail, and explicit approval. |
| Publish, deployment, DNS, or production routing | Build and validate locally; prepare a release candidate. | Publishing any build, changing a live domain/route, replacing the deployed app/API, or creating a separate billable deployment. | Exact target URL and source revision, reviewed release diff, required tests, Firebase/API alignment, rollback version, expected costs, and explicit go-ahead for that release. |
| Microphone, uploads, hardware, broadcasts, scheduled collection | Implement and test a local/virtual path without activating a device. | Any non-local upload, recurring capture, physical-device activation, external transmission, or schedule that can incur cost or collect data. | Clear purpose, target device/channel, duration, data sent/stored, legal/operating limits, stop control, cost ceiling, and user consent for that session. |

## Approval must be specific

For a gated action, present the founder with:

1. **What will change** — exact project, environment, routes, records, settings, prices, or users affected.
2. **Why it is needed** — the verified customer or security outcome.
3. **Risk and cost** — data exposure, service interruption, charge, recurring expense, or irreversibility.
4. **Evidence** — reviewed diff, test results, compatibility checks, and any remaining uncertainty.
5. **Recovery** — checkpoint/backup, rollback step, and who or what is affected if it fails.
6. **A direct approval request** — one clear yes/no decision for the named action.

Approval for inspection or local implementation does not imply approval to modify production. Old or broad instructions do not substitute for approval of a newly proposed destructive, financial, or publishing action. Where the founder has already given conditional authorization, proceed only when every stated condition is verified.

## Current project-specific gates

- **Firebase access:** The current task authorizes inspection of project `ethereal-throne-b20e6`, but authorized live access through the available service-account/ADC path has not been verified. Do not ask for or print credentials; continue source and emulator work independently.
- **App Check:** Keep enforcement unchanged until the production app ID/key/hostname match and successful token exchange are confirmed. Development/preview and production keys must remain separate.
- **Firestore rules:** `artifacts/zioncore-frequency-lab/FIREBASE_SETUP.md` records that the live release had a project-wide public read/write grant and six public legacy-root grants. That finding was not independently rechecked in Phases 5–9. The document also says those roots and their external callers are unclassified. Treat this as a serious reported exposure; verify the live rules through authorized read-only access before any write. The local candidate that denies unclassified paths is **not approved for deployment** until legacy compatibility is resolved.
- **Stripe:** Use test mode for validation. Do not change live prices, charge customers, grant or remove credits, or alter subscriptions in this phase.
- **Source/deployment:** Keep the main and lab refs separate. The exact source commit deployed at `zioncore.replit.app` remains unverified. No publication or separate paid deployment is authorized by this phase.
- **Data handling:** Research sessions are browser-local and unencrypted in the task source. Do not move them to cloud storage, export customer data, or perform bulk deletion without a separate privacy/rules review and approval.

## Scope decision for Phase 9

Documentation, local tests, source inspection, and reversible local fixes may continue within Task #2. Production Firebase settings/rules, customer-data operations, live financial changes, owner privilege assignment, and publication remain gated. No gated operation was performed while preparing this policy.
