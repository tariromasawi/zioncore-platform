# ZionCore 2nd independence and recovery audit

**Checked:** 16 November 2026
**Status:** Recovery branch is buildable; original-source parity and independent
production readiness are not established.

## Source provenance and preservation

- Current private repository: `https://github.com/tariromasawi/zioncore-platform`
- Current recovery branch: `zioncore-2nd/recovery-phase3`
- Earlier recovery baseline: `df0a612a6752a87a3b1114dd16267fa2acbdcb56`
- Latest verified source commit: `e2e0901fa02b8caf60f99e66dad997845d4f7900`
- Tracked source files at that commit: 843
- The main ZionCore production application and its deployment were not changed.
- The original standalone ZionCore 2nd Replit project, its Git history, and its
  checkpoints were not accessible from this workspace. The supplied task
  preview URL is not proof of access to the original source project. This
  branch therefore remains a preserved recovery snapshot, not verified source
  parity.
- The approved nine-phase specification was not found as a complete source
  document in the accessible repository. Do not substitute the Genesis
  100-phase programme or claim acceptance against missing phase criteria.
- The immutable Genesis Seed is present at
  `governance/genesis/GENESIS_SEED.original.txt`; its SHA-256 is
  `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`.

## Frontend and backend inventory

| Area | Verified source and behavior | Independence status |
| --- | --- | --- |
| Frequency Lab experience | `artifacts/zioncore-frequency-lab`; 21 registered routes include Live Lab, Dashboard, History, Exploration, Missions, Astronomy, Bioacoustics, Access, Devotional, Signal Cards, Messages, Voice V2, Devices, Premium, Owner, and Wallet. | Registered as the web artifact at `/`; depends on the shared API service and workspace libraries. |
| Secondary `zioncore-2nd` package | `artifacts/zioncore-2nd`; 7 routes: `/`, `/history`, `/history/device`, `/history/device/:id`, `/history/:id`, `/exploration`, and `/genesis`. | Not registered as a Replit artifact; imports `@workspace/api-zod`, calls relative `/api/ai/interpretation*` endpoints, and has no separate API service. It is not evidence of the complete original standalone experience. |
| API service | `artifacts/api-server`; mounted at `/api`. Includes health, wallet, billing catalog/checkout/portal, Stripe webhook, AI interpretation/audio, resonance assets, owner summary, and Firebase diagnostics. | Real backend source, but shared by the current workspace and not separately isolated for ZionCore 2nd. |
| Shared backend libraries | Root `lib/` contains API contracts, database utilities, Firebase/AI contracts, provider adapters, and the Genesis prompt builder. | Required workspace dependencies are present; a standalone repository boundary has not been approved or created. |
| Billing and wallets | Authenticated checkout, portal, wallet, and transaction routes exist. Webhook processing and ledger emulator tests exist. | Live Stripe catalogue, checkout, and fulfilment were not exercised in production. |
| Authentication | Firebase email/password and Google flows are implemented. | Emulator tests pass. Production sign-in persistence and Apple sign-in are not verified; Firebase has Apple enabled but lacks its client ID and secret. |
| Storage | Current observation workflow stores local/device history and can optionally use Firestore. No Firebase Storage adapter was found in this workflow. | No Storage resource or independent Storage configuration was created. |

The API also has an exact-origin CORS allowlist in this branch. It defaults to
no cross-origin browser permission and rejects wildcard or malformed origins.
The policy has dedicated unit tests. This is a source change only; it has not
been deployed.

## Genesis Seed integration

The API's AI interpretation and audio routes call
`buildAnalysisPrompt()` from `lib/frequency-ai-contract`. That builder loads
`buildGenesisSeedContext()` and uses selected, bounded source-linked guidance.
The full original is preserved separately and is not copied wholesale into each
provider request. This keeps the seed in the backend reasoning path without
turning it into unrelated frontend controls or exposing its full text in every
customer response.

## Firebase production recheck

Read-only calls confirmed the service-account project ID is
`ethereal-throne-b20e6`. The workspace has no ADC configuration:
`GoogleAuth` returned `Could not load the default credentials.` The existing
service-account secret was then used in memory through a Google Auth JWT
fallback; no credential file was written and no Firebase CLI login was used.
A read of an intentionally nonexistent Firestore document returned
`404 NOT_FOUND`, not `PERMISSION_DENIED`, and returned no document data.

The live Firebase configuration currently reports:

- Email/password and Google sign-in enabled.
- Apple sign-in enabled in Firebase, but its client ID and secret are absent.
- Production and task-preview hostnames authorized.
- Development and Production App IDs are distinct and match their respective
  registered Firebase web apps in Replit's environment settings.
- The Development App Check site key matches the registered preview app.
- The published `zioncore.replit.app` bundle uses the preview Firebase App ID
  with the production reCAPTCHA Enterprise key. The production key is
  restricted to `zioncore.replit.app`, so the deployed app/key pairing is
  inconsistent.
- App Check enforcement is `UNENFORCED` for Firestore, Identity Toolkit, and
  Firebase ML. A valid browser token exchange has not been confirmed.
- The active Firestore ruleset is recorded in `artifacts/zioncore-frequency-lab/FIREBASE_SETUP.md`.
  It has public reads for `SovereignPatents` and `advancements`; other paths use
  a privileged recursive rule. Direct browser rules do not grant customers
  access to `users/{uid}/frequency_observations`. The recursive privileged rule
  can overlap sensitive financial paths, conflicting with the requirement that
  financial writes remain server-only. Do not deploy a candidate until the
  complete legacy path map and compatibility review are complete.

Firebase Admin SDK initialization with the existing credential succeeded, and
a read of an intentionally absent document returned no data. The SDK emitted a
nonfatal credentials deprecation warning. The separate ADC-default attempt
failed with `Could not load the default credentials`; no Firebase CLI login was
attempted.

No customer document was read. No production rules, IAM, App Check enforcement,
Stripe settings, or deployment were changed.

The 402×874 preview viewport rendered the Live Lab and spectrum panel without
browser errors. This was a browser viewport check, not a physical iPhone Safari
test, and did not exercise microphone permission, sign-in, or token exchange.
AI provider availability and live quota were not retested; the previous
controlled provider request returned `RESOURCE_EXHAUSTED`, so no additional
billable request was made.

## Build, tests, security, and automation

- A clean clone of the pushed branch installed with
  `pnpm install --frozen-lockfile`, passed workspace typecheck and production
  build, ran all 611 tests successfully, and remained clean after validation.
- Current post-change test suite: **611 tests passed, 0 failed** across API
  unit tests (108), ZionCore 2nd artifact unit tests (34), Frequency Lab unit
  tests (425), Firebase Auth client/server emulator tests (3), the two
  Firestore rules emulators (7 + 14), and wallet/Stripe emulator tests (20).
  These are development/emulator results, not production integration results.
- A GitHub Actions validation workflow has been added at
  `.github/workflows/zioncore-2nd-validation.yml`. It runs on relevant pull
  requests and manual dispatch; it performs install, typecheck, build, tests,
  and production dependency audit. It contains no deployment job and has not
  yet run on GitHub.
- The workspace-wide Replit dependency/SAST scan included generated snapshots
  and historical worktrees, so its aggregate findings are not branch-specific.
  The branch-level production audit found zero high/critical findings and two
  moderate transitive advisories (`glob` and `minimatch`) in the API dependency
  graph. No major override was applied without compatibility validation.
- The Replit SAST scan also flagged the previously permissive CORS middleware;
  this recovery branch replaces it with the tested allowlist policy. The
  workspace scan's Firebase browser configuration findings concern public
  client configuration values, not Admin credentials.
- The branch secret scan found no private keys, GitHub/Slack tokens, or
  non-fixture Stripe credentials. Stripe-shaped strings are explicit
  placeholders/fixtures in test files; the only tracked environment files are
  `.env.example` templates.

## Release blockers and approvals

1. Provide editor access to the original ZionCore 2nd Replit project or expose
   its source/checkpoints in this workspace. Without that, original-source
   parity cannot be established.
2. Approve the exact authoritative GitHub destination. The current private
   `zioncore-platform` repository is preserved; no new repository was created.
   The preferred `tariromasawi/zioncore-2nd` repository still requires explicit
   approval before creation.
3. Decide whether to retain the existing Firebase project or authorize a new
   ZionCore 2nd Firebase project. No new project has been created.
4. Approve a production release separately. The current deployed App Check
   mismatch cannot be corrected in production without a new build/deployment.
5. Review a complete production Firestore path map and proposed merged rules.
   The active recursive rule and customer-history gap must be resolved before
   changing client access or enforcing App Check.
6. Configure Apple's missing provider credentials if Apple sign-in is required.
7. Perform real browser token-exchange, customer sign-in, Checkout, and webhook
   verification only in the authorized environment after the matching build
   and safe test configuration are available.

Until these blockers are cleared, ZionCore 2nd is not an independently deployed
production application and the original nine phases are not complete.
