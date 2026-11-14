# Firebase setup notes

This code targets the existing Firebase project `ethereal-throne-b20e6`. It does
not create a project or deploy production rules.

## Inspected Firebase configuration

The live project was inspected using the existing service account through ADC.

- Email/Password authentication is enabled. Google OAuth is enabled with
  provider credentials configured; the existing owner account is still linked
  only to password sign-in until its owner completes the Google link flow.
- Apple is marked enabled in the project, but its provider configuration has no
  client ID or client secret, so Apple sign-in is not ready.
- The production hostname and the current Replit preview hostname are both
  authorized for Firebase Auth redirects. The preview hostname was added
  without removing any existing domains.
- The project has separate development and production web app registrations,
  and the Replit `development` and `production` app IDs match them. Firebase
  has separate registered reCAPTCHA Enterprise keys, but the latest Replit
  secret inventory reports the App Check key in Shared scope and cannot prove
  that distinct environment-scoped values are present. Do not treat secret
  separation as verified until checked without exposing values.
- The registered development App Check key is restricted to the Replit preview
  hostname. An earlier mobile-sized browser test reported a successful token
  exchange; the latest headless test returned 403 and does not reconfirm normal
  mobile-browser behavior.
- The production App Check key is restricted to `zioncore.replit.app`. No
  production app was published or deployed during this work.
- The web client supports Google sign-in and linking. Linking while signed in
  preserves the current Firebase UID and its existing custom claims. The
  project does not expose owner dashboard routes in the current API source.
- A synthetic AI request reached `gemini-3.5-flash-lite`, but returned
  `RESOURCE_EXHAUSTED` because Gemini Developer API prepayment credits are
  depleted. Do not add credits, link billing, or change the model without
  approval.

## Latest read-only recheck — 2026-11-10

- ADC access using the existing service-account secret reached
  `ethereal-throne-b20e6`. Both development and production app IDs match
  registered Firebase web apps. Each environment's App Check site key matches
  that app's `RecaptchaEnterpriseConfig`; the development key allows only the
  current Replit preview hostname, and the production key allows only
  `zioncore.replit.app`.
- The published homepage bundle does **not** match that safe environment
  split: it contains the development Firebase App ID together with the
  production App Check key. The published homepage did not issue an App Check
  token-exchange request during a 15-second load. The last observed exchange
  failure remains HTTP 403 `PERMISSION_DENIED` — `App attestation failed`.
  Therefore, production token exchange is not confirmed; do not enforce
  Firestore or Authentication App Check yet.
- The published navigation includes Messages and Devices pages that are absent
  from the current workspace UI. This further confirms the production build
  cannot be treated as the current workspace build or used to infer all
  production Firestore callers.
- Current App Check service modes are Firebase AI Logic (`firebaseml.googleapis.com`)
  `UNENFORCED`, Firestore `UNENFORCED`, and Authentication `UNENFORCED`. Firebase
  AI Logic was changed from `ENFORCED` to `UNENFORCED` under the owner's
  instruction to keep enforcement off until token exchange is verified; a
  read-back confirmed the new mode. This removes an abuse-control layer for AI
  calls and may increase usage risk. No Firestore or Authentication enforcement
  mode was changed.
- The live Firestore release still contains a project-wide public
  `allow read, write` rule and six public legacy-root rules. The local candidate
  denies those roots and every other unclassified path. The emulator rules
  suite passes, including owner-path access, unauthenticated/cross-account
  denial, and rejection of unclassified paths. This does not prove compatibility
  with the unclassified production roots or external callers.
- No Firestore rules or production app bundle were changed. The production
  bundle must be rebuilt with the production Firebase App ID and provider
  configuration, then its token exchange must be verified before enforcement
  is re-enabled. Publishing remains subject to the owner's approval.
- Browser Firestore access now stays disabled unless
  `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` is explicitly set for that
  environment. Keep it false until the merged rules have been reviewed,
  deployed, and verified against real app paths, and App Check token exchange
  has succeeded. This client-side gate does not change Firebase rules.

## Latest read-only App Check validation — 2026-11-11

- Firebase App Check returned HTTP 200 for both registered web-app
  `RecaptchaEnterpriseConfig` resources. The development reCAPTCHA Enterprise
  key allows only the current Replit preview hostname; the production key allows
  only `zioncore.replit.app`. Both are score-based keys.
- Firebase's current App Check enforcement modes are `UNENFORCED` for Firebase
  AI Logic, Firestore, and Authentication. No enforcement settings were changed.
- The current Replit secret inventory reports
  `VITE_FIREBASE_APPCHECK_SITE_KEY` in Shared scope. Secret values were not
  accessed, so this check cannot prove that separate Development and Production
  values are present or that either value matches its registered App Check key.
  Treat the earlier claim of verified scope separation as unconfirmed until the
  Replit secret scopes are checked without exposing their values.
- A fresh read of the published JavaScript confirmed it contains the
  **development** Firebase App ID and not the production App ID. On the
  production hostname, a headless-browser App Check exchange POST targeted that
  development App ID and returned HTTP 403 `PERMISSION_DENIED` with
  `App attestation failed.` The HTTP 200 observed for `OPTIONS` was only the CORS
  preflight, not a successful token exchange.
- A headless preview-browser exchange POST also returned HTTP 403 with the same
  response. Headless reCAPTCHA scoring is not a substitute for a real mobile
  browser test, so these results do not establish whether an ordinary browser
  can exchange a token.
- Keep enforcement disabled. The verified production-build mismatch must be
  corrected in a production build using the production Firebase App ID and
  registered production key; then verify a successful production-host token
  exchange before enabling enforcement. No source build, rules, Firebase
  settings, customer data, or production deployment were changed in this check.

## App Check failure-path tests — 2026-11-11

- Against the registered development App Check exchange endpoint, a request
  with no reCAPTCHA token returned HTTP 400 `INVALID_ARGUMENT`:
  `The recaptcha_enterprise_token cannot be empty.`
- A request with an invalid test token returned HTTP 403 `PERMISSION_DENIED`:
  `App attestation failed.`
- These exercise token-exchange validation only. No Firestore or AI request was
  sent: all three Firebase service enforcement modes remain `UNENFORCED`, and
  those services would not prove missing/invalid-token rejection in this state.
- No valid token was available for this phase. The observed headless browser
  exchange failed, and the published production bundle still uses the
  development App ID. A successful token exchange and accepted-token customer
  request remain unverified.
- Client error messages now distinguish App Check attestation errors from
  ordinary account/permission denials. The unit suite passes 36 tests and
  TypeScript typechecking passes.

## Production Firestore path inventory — 2026-11-11

- The only Firestore database in `ethereal-throne-b20e6` is `(default)` in
  `us-central1`. The deployed release is `cloud.firestore`, attached to ruleset
  `4f21202a-b142-43b0-9038-892d46299682`, last updated
  `2026-11-06T07:14:27.999395Z`.
- The active rules include `match /{document=**}` with unconditional
  `allow read, write, list, get, delete, create: if true;`. This makes every
  Firestore document publicly readable and writable by unauthenticated clients.
  The six additional unconditional legacy-root grants listed below are
  redundant subsets, not protections. Firestore rules grants are additive.
- The only Firestore client path found in workspace source is
  `users/{uid}/frequency_observations/{observationId}`. In deployed rules it is
  publicly readable and writable through the wildcard. The local candidate
  instead grants owner-only get/list/delete, validates owner creates, permits
  only bounded interpretation updates, and denies unmatched paths.
- The deployed rules also explicitly grant public read/write access under
  `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`,
  `soul_signatures`, and `petitions`. No workspace client or API source
  references these paths.
- A metadata-only listing found no top-level collection IDs. No document IDs,
  contents, or customer records were read. This empty listing does not identify
  external clients or establish that no subcollection-only paths exist.
- No Firestore Admin SDK calls appear in current API source; `firebase-admin`
  appears only in the build's external-package list. The deployed API's
  authoritative source/revision remains unmatched, so its server-side Firestore
  access cannot be ruled out.
- Do not deploy the local candidate yet. It would revoke client access to the
  six legacy roots and all unmatched paths. Their purposes and production
  dependencies, plus the deployed API source, remain unresolved.

## Firestore rule-diff review — 2026-11-11

- The active production release is still the November 6 ruleset described
  above. The complete live rules file was fetched again and compared with the
  local candidate; the two rulesets are not equivalent.
- The candidate removes the unconditional public grant for every Firestore
  document and all six explicit public legacy-root grants. It adds no public
  or cross-account permission.
- For `users/{uid}/frequency_observations/{observationId}`, public CRUD in
  production would become owner-only get/list/delete, validated owner create,
  and owner update restricted to a validated interpretation and request-time
  timestamp.
- The current production wildcard overlaps every explicit legacy rule.
  Firebase evaluates overlapping `allow` expressions as OR; a matching `true`
  grant is sufficient. The local candidate has no recursive wildcard or
  overlapping legacy grants that could broaden its owner-only access.
- The rules diff contains no permission expansion, but its broad revocations
  could break unknown legacy or deployed API clients. Keep the candidate
  undeployed until those consumers are identified and compatibility is tested.

## Customer isolation tests — 2026-11-11

- The Firestore emulator suite passes 7/7 tests against the local candidate.
  The cross-account test now covers get, collection list, create, update, and
  delete; the owner's record remains after a denied cross-account delete.
- These tests use only the demo emulator. They do not test production data.
  Production is not isolated: its project-wide unconditional wildcard allows
  unauthenticated reads and writes to every path. No production rules were
  deployed.

## Financial record rules review — 2026-11-11

- The active production wildcard permits public client reads and writes to
  every Firestore path. It does not establish that wallets or billing records
  are stored in Firestore, but any such records there would have no rules-level
  protection.
- No wallet, credit, purchase, subscription, entitlement, ledger, or audit
  collection appears in workspace Firestore client code or API source. The
  workspace PostgreSQL schema source has no table definitions, and the API's
  `firebase-admin` package is externalized but not imported by its source.
- Previously observed deployed API logs include wallet and billing endpoints
  absent from the current workspace routes. Their authoritative code and
  persistence location remain unknown. The legacy root `DivineTreasury` is
  also unreferenced and cannot safely be assumed to be a wallet.
- The local Firestore candidate denies client access to all unclassified paths,
  including possible financial paths, but no trusted server-side financial
  implementation was found in workspace source. This does not prove that
  financial records are server-controlled.
- Do not deploy the candidate or claim financial protection until the deployed
  billing/API source and any legacy financial paths are identified and reviewed.

## Production security deployment gate — 2026-11-11

- **Gate not passed; no production change is approved or requested in this
  phase.** The Firestore candidate passes local emulator tests but its
  compatibility with the unclassified legacy roots and deployed API callers is
  unknown.
- Production App Check remains `UNENFORCED` for AI Logic, Firestore, and
  Authentication. A valid production-host token exchange is unverified, and
  the published bundle still uses the Development Firebase App ID.
- Financial persistence and server-side billing implementation are not present
  in the workspace source; the deployed billing/wallet routes are not matched
  to an authoritative source.
- The approved charter requires separate, specific approval for each
  consequential production operation. Charter approval and conditional
  instructions do not authorize deployment while the security prerequisites
  remain unresolved.
- Before requesting approval, reconcile production source and paths, verify a
  production App Check token exchange, prepare the exact proposed change and
  rollback, and rerun compatibility checks. No Firestore rules, enforcement
  modes, customer data, or production build were changed.

## Cloud AI sign-in and quota gate — 2026-11-12

- The client now requires a Firebase-signed-in user, current Firebase ID token,
  and App Check token before the Firebase AI Logic model call. A 15-second
  cooldown and single in-flight request guard prevent accidental rapid repeats.
  Firebase/provider quota errors remain authoritative and are shown as
  recoverable responses.
- Firebase AI Logic offers a server-side, project-wide authenticated-users
  enforcement mode. Google documents the required `firebasevertexai.configs.update`
  permission and warns that enforcement blocks requests from every app version
  in the Firebase project that does not send Firebase Authentication
  credentials. The owner must inspect every live app client, then use Firebase
  Console → AI Services → AI Logic → Settings → Authenticated-users mode to
  enforce it. Audit all active clients before enabling it.
- Firebase documents a default 100 Generate-content requests/minute/user quota,
  plus provider/model quotas. The active project quota values are not verified.
  Changing quota requires `serviceusage.quotas.update`; reduce the default only
  after reviewing legitimate traffic and every app sharing this project. The
  owner can inspect it in Google Cloud Console → APIs & Services → Firebase AI
  Logic API → Quotas & System Limits, under `Generate content requests`.
- The app fails closed for cloud AI unless the matching build environment sets
  `VITE_FIREBASE_AI_PROJECT_SECURITY_CONFIRMED=true`. This flag is only an
  application readiness gate; it does not set or verify Firebase enforcement.
- No Firebase project settings or production deployment were changed. The
  project-wide authenticated-users mode, live quota configuration, and current
  App Check enforcement/token exchange remain unverified. Keep the flag false
  until those settings are inspected and verified.
- Official references:
  [authenticated-users mode](https://firebase.google.com/docs/ai-logic/auth-mode?api=dev)
  and [AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas?api=dev).

## Deletion and retention review — 2026-11-11

- Local observation deletion is scoped to the active browser or account-device
  archive and to the record IDs captured when the confirmation opens. Account
  or archive changes cancel a pending clear. Invalid or duplicate local records
  cause deletion to fail closed rather than rewriting unverified data.
- The current candidate Firestore rules deny browser-client deletion of cloud
  observations. The cloud deletion helper also refuses to delete until an
  authenticated server endpoint can authorize and record an audit event.
- The current API source has no such endpoint. Therefore cloud deletion is
  unavailable, and no durable server-side deletion audit is claimed.
- The demo Firestore emulator suite passes 9/9 tests, including denial of a
  client's own cloud delete. These tests do not deploy rules or alter production.
- Local retention and current export scope are documented in `DATA_RETENTION.md`.
  Production cloud retention and backup behavior remain unverified.

## Local WAV import compatibility — 2026-11-11

- The research lab now accepts explicitly selected RIFF/WAVE files only:
  uncompressed integer PCM (8/16/24/32-bit) and IEEE-float PCM (32-bit),
  mono/stereo, 8–96 kHz, at most 24 MiB and 60 seconds.
- The importer checks WAV chunks and metadata before allocating bounded sample
  buffers, averages stereo to mono, and samples at most eight FFT windows.
  Source audio remains in browser memory only.
- Saved records label imported measurements as `audio-file`. The local
  candidate rules and validators accept that value alongside `microphone`.
  No production rules or storage configuration were changed.

## Before changing Firebase settings

1. Check which Firebase web app ID is active in the target Replit environment.
2. Keep development and production Firebase app IDs and App Check site keys
   separate. Never use the production key for the temporary Replit preview.
3. Check current App Check enforcement modes and verify a successful token
   exchange before enabling enforcement for any service. The latest read-only
   check found Firebase AI Logic, Firestore, and Authentication all
   `UNENFORCED`.
4. Set public web configuration in the matching Replit `development` or
   `production` environment using the names in `.env.example`. Never use a
   service-account key or Admin SDK credential in the browser.

The model call is opt-in. It sends only sample rate, FFT size, frequency
resolution, dominant frequency, spectral peaks, relative RMS, and duration.
It never sends audio, spectrum bins, or observation notes.

## Firestore rules safety

`firestore.rules` is a local candidate for
`users/{uid}/frequency_observations/{observationId}`. It removes the
project-wide allow-all grant and all six public legacy grants, then adds
owner-only observation access. It denies every other path, rejects observation
measurement edits, and validates stored fields, ranges, each of the six
microphone peak slots, and optional bounded AI interpretations stored
separately from measured values. An owner may attach or revise an interpretation
without changing the measurement. The browser also validates values before
writes.

The live rules also grant unauthenticated read/write access to all descendants
of `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`,
`soul_signatures`, and `petitions`. No code in this workspace references those
collections, and no customer documents were read. Their purpose and any
external production dependencies remain unverified. The local candidate denies
client access to those roots until their data and required permissions can be
classified.

A metadata-only listing of root collection IDs returned an empty list. No
document IDs, document contents, or subcollections were requested. Recent API
logs show `/api/billing/catalog` and `/api/owner/firebase-diagnostics`, but the
current API source and generated bundle still expose only health routes. The
owner-provided record for successful production build
`00c62f95-66ca-47e6-b11b-64a35fc14df0` (created 2026-11-10 14:11:34 UTC) records
Git commit `ca6ff0b252155295315beae1f65fc8e71029ebc1`. That commit exists in the
local Git history and is an ancestor of `main-repl/main`, whose current ref is
`d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d`. The active workspace checkout is
instead `main` at `c23f9102221496f7baeae726fa85dba7dd7b5c03`, on a diverged line
with merge base `ef668aeef91103df5d6ceaa10aa463cc379a96e5`; the separately
reported workspace SHA `fe54e2e0fde1e9267d9ec6960ad2775558d09867` is not present
in this checkout's Git object database. Use the recorded build commit when
comparing production source; the current workspace must not be treated as a
direct descendant of that source. This identifies the source of that build but
does not reconcile the runtime/API route mismatch or any external Firestore
clients, so legacy compatibility and billing/admin requirements remain
unverified.

The Firebase client source at that production commit initializes App Check
optionally and treats it as non-blocking for Firebase Authentication. The
current workspace source instead gates cloud history on both initialized App
Check and an explicit Firestore-client-access approval flag. That source change
is not evidence of a successful production token exchange or a live deployment;
keep enforcement and cloud-client access paused until the actual production
bundle's App ID/key pairing and token-exchange `POST` have been verified.

To run the local rules tests, use the artifact's `test:rules` command. It uses
the demo project ID `demo-zioncore-frequency-lab` and the local Firestore
emulator; it does not contact the real Firebase project.

New observation records can optionally include bounded instrument provenance
(adapter/source, acquisition method, units, calibration metadata, and package
version). The field is optional so existing cloud observations remain readable.
Its candidate-rule shape is covered by the emulator suite; this does not change
or deploy the active production rules.

The active live rules make every Firestore path publicly readable and writable.
The local candidate does not expand access, but would block client access to
the six legacy roots and every other path except a user's own validated
observations. Because those legacy roots and any external production clients
are unclassified, the candidate is not verified as compatible and must not be
deployed yet. Firebase Admin SDK calls bypass Firestore rules, but any backend
authorization still needs to be verified separately. No production rules were
deployed.

## Local Authentication Emulator

The Authentication Emulator is configured on `127.0.0.1:9099` for isolated
email/password lifecycle testing. Start it with:

```sh
pnpm --filter @workspace/zioncore-frequency-lab exec firebase emulators:start --project demo-zioncore-frequency-lab --only auth --config firebase.emulator.json
```

For the local web client, use demo-only Firebase values and set
`VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099`. The client accepts a
`demo-*` project only when a localhost Auth Emulator URL is active in a
development build. Emulator mode explicitly disables cloud Firestore and AI
readiness, even if other environment flags are set. Do not set this variable in
production; never use a live Firebase project ID for emulator tests. Verification
and password-reset emails are captured by the local emulator, not delivered to
real inboxes. This emulator is not evidence that live Firebase providers,
domains, App Check, or production email delivery are working.

## Read-only Firebase ADC inspection — 2026-11-11

The existing service-account credential was used through Application Default
Credentials for read-only Firebase Management, Identity Toolkit, App Check,
Firestore Rules, and Firestore database requests. No credential values or
customer documents were displayed or read, and no Firebase settings changed.

- Authentication is configured for email/password and Google. Apple is marked
  enabled in Identity Toolkit, but its provider configuration has no client ID
  or client secret; Apple sign-in is not ready to verify end to end.
- The authorised domains include `zioncore.replit.app` and the current Replit
  preview hostname, alongside Firebase's default domains.
- The development Firebase web app is
  `1:635097760381:web:4d796bbbdb94f181e56714`. Its registered App Check
  reCAPTCHA Enterprise key is restricted to the Replit preview hostname.
- The production Firebase web app is
  `1:635097760381:web:c718ecaac8b0b21de56714`. Its registered App Check key is
  restricted to `zioncore.replit.app`.
- The Replit Development and Production `VITE_FIREBASE_APP_ID` and
  `VITE_FIREBASE_PROJECT_ID` environment values match their respective Firebase
  app registrations. `VITE_FIREBASE_APPCHECK_SITE_KEY` is present in Shared
  scope. Replit's secret-status view includes Shared secrets in Development and
  Production results and reports presence only, so it cannot establish whether
  independent Development and Production values also exist. Do not remove the
  Shared entry until the project Secrets tool and Publishing tool's Production
  app secrets section confirm the correct environment-specific keys are present.
  Secret values were not read.
- App Check remains `UNENFORCED` for Firebase AI Logic, Firestore, and
  Authentication. A valid production token exchange has not been verified; the
  last published-bundle check found the Development App ID in production and a
  `403 PERMISSION_DENIED` response (`App attestation failed`). Do not enable
  enforcement until the production build and key are corrected and a real
  production-host token exchange succeeds.
- The active Firestore release remains ruleset
  `4f21202a-b142-43b0-9038-892d46299682`, last updated
  `2026-11-06T07:14:27.999395Z`. Its global public-read/write wildcard and six
  public legacy roots remain. The local owner-scoped candidate differs and
  denies unclassified paths; do not deploy it until the legacy collections and
  production API consumers are mapped and compatibility is reviewed.
- The project has one native Firestore database, `(default)`, in `us-central1`.
  No customer records were queried.

## Fresh read-only project check — 2026-11-12

- `gcloud` Application Default Credentials are not configured in this workspace.
  The Firebase CLI attempt with the existing service-account JSON exposed only
  the error `Failed to authenticate, have you run firebase login?`; no
  interactive login was attempted. Read-only Google API requests did succeed
  using the existing project service account through the Google Auth library,
  without displaying or saving its credential.
- Firebase Management returned the two registered web app IDs recorded above.
  Identity Toolkit confirmed Email/Password and the production and current
  Replit preview domains. Its project config exposed no Google/Apple provider
  fields; the OAuth IdP list was empty, and direct `google.com` and `apple.com`
  OAuth IdP resource lookups returned `404 CONFIGURATION_NOT_FOUND`. These
  endpoints do not conclusively establish the state of Firebase's built-in
  Google/Apple providers; provider readiness remains unverified through this
  read-only surface.
- Firebase App Check returned HTTP 200 for both registered web-app
  `RecaptchaEnterpriseConfig` resources. Their reCAPTCHA Enterprise keys are
  restricted to exactly the preview host and `zioncore.replit.app`,
  respectively. The current development build contains the Development App ID
  and Development key.
- A fresh read of `https://zioncore.replit.app/` and its published JavaScript
  found the **Development Firebase App ID with the Production App Check key**.
  The production key's hostname restriction is correct, but this App ID/key
  pairing is not. A real-browser token exchange was not performed; the last
  recorded exchange error remains HTTP 403 `PERMISSION_DENIED` (`App attestation
  failed`), not a new result from this check.
- App Check is still `UNENFORCED` for Firebase AI Logic, Firestore, and
  Authentication. No enforcement setting was changed.
- Firestore still publishes ruleset
  `4f21202a-b142-43b0-9038-892d46299682`, updated
  `2026-11-06T07:14:27.999395Z`. A fresh ruleset read confirmed the project-wide
  public `match /{document=**}` grant plus six public legacy roots
  (`DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`,
  `soul_signatures`, `petitions`), seven public `if true` grants total. No
  customer documents were read.
- Secret-status views include Shared secrets in both Development and
  Production results and do not reveal which matching key is independently
  scoped. The Shared App Check key was not removed. The live production bundle
  confirms a production key but a Development app ID; correct the production
  Firebase App ID in the Production build environment, then verify token
  exchange in a real browser before considering any enforcement change.
- No Firebase settings, Firestore rules, customer data, AI quota, or production
  build were changed. The prior AI request returned `RESOURCE_EXHAUSTED`;
  project quota and provider billing remain unverified, so no new billable AI
  request was made. Mobile viewport appearance is available in the preview, but
  real mobile permission, sign-in, and token exchange behavior remains
  unverified.
