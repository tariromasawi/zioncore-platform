# Discovery-led report reconstruction

- Reconstructed the existing report around eight substantive chapters, a distinctive title and next-discovery actions. Added measured-feature adaptive quiet/tonal/harmonic/changing/layered/open-pattern themes and context-specific personal guidance.
- Reworded the shared local readings, research hypotheses and user-feeling narrative. Moved retained measurements, coverage and methodology into one expandable section rather than repeating caveats through the story.
- Updated shared paid-reading and optional browser-AI prompt style without changing response schemas, providers, budgets, factual validation, billing, authentication or customer records. Existing completed paid results are preserved.
- Delivered a self-contained editorial audit of 37 wording/experience issues with a replacement example: `docs/zioncore-report-reconstruction.html`.
- Verification: workspace typecheck; 225 frontend + 102 API unit checks; focused follow-up 16 checks; web/API production builds passed. Existing large-chunk/dependency annotation warnings remain.
- Actual Chromium local-file journey: generated quiet WAV produced an eight-chapter, 1,134-word narrative; family and project intentions changed substantive guidance; full v2 report exported. A generated 440Hz recording selected a different theme.
- Measurement details expanded/closed correctly. At 390px mobile viewport, page width was 390px and report client/scroll height both 6,417px. Zero chargeable POSTs/runtime exceptions observed. This verifies browser software with deterministic files, not physical microphones or Safari.
- Both workflows restarted cleanly. No publication, paid-provider generation or financial transaction performed. Production outcomes and genuine Nano inference are not claimed.

# Previous comprehensive free report and browser-AI setup

- Expanded the existing green Measured card into a full-width, naturally growing report. Original observations retained; scope, acoustic explanations, four interpretation perspectives, personal reflection, open hypotheses, actions and optional upgrade links added.
- Export includes the complete free report and any explicitly generated, separately labelled on-device AI snapshot.
- Added browser-AI activation guidance/recheck, schema-constrained local generation and separate bounded download/inference phases. No ability to change a user's browser settings is claimed.
- Verified typecheck/build; 222 checks passed in the full unit run, then all three dossier tests passed after an SSR-only test-harness correction. Actual Chromium local WAV → personal context → complete JSON export passed with zero paid POSTs/runtime exceptions.
- Checked 390px mobile layout: document width 390px, report content height equals client height (7,318px). No clipping/overflow observed. Physical iPhone Safari and actual Nano inference remain unverified.
- No backend, financial, authentication, customer-data or production configuration changes. Publication remains the owner's action.

# Discovery product completion

- Implemented the requested visible 19-tool homepage workbench, layered local readings, user-reported resonance theme, investigation plans, baseline comparison, local notebook/revisions/export and private response-draft handoff. Existing instruments and artwork preserved.
- Added explicit on-device Gemini Nano adapter (browser support/download consent, cancellation, timeout, validation, cleanup; no cloud fallback) and optional NOAA space-weather context with provenance.
- Added public approved pricing metadata; development returns 100/200 credits without identity/wallet access. Account-bound signed quotes still return 401 without authentication.
- Verified 220 frontend + 102 API unit tests, both typechecks/builds, runtime pricing/quote HTTP responses, a real NOAA response, and responsive preview screenshots. Existing initial-bundle ceiling remains unchanged.
- Not verified: successful on-device model inference (browser disabled), physical microphone capability, a complete interactive import/save/export browser pass, authenticated paid fulfilment or production publication.
- Production check: existing live build differs from the prepared entry, and the new pricing route returns 404 on the live domain. API + web publication remains required; no production change was performed by this work.
- Connected the guided personalised response to real protected Premium membership plus an account-scoped completed paid reading, then local encoder handoff. Its 18 focused regression tests passed after the 220-test suite. Standalone free encoding, existing service rules, catalogue and ledgers remain unchanged. Full report: `docs/ZIONCORE-FREE-LISTENING-FEATURES.md`.

# Signup and billing accessibility correction

- Added offer-specific accessible names (including paused offers), explicit new-tab descriptions, persistent progress status, password instructions and named busy forms.
- Reused existing authenticated checkout and portal functions; no payment, membership, Firebase or pricing configuration was changed.
- Chromium 157.0.8103.38 keyboard pass verified account mode controls, native empty-form validation, focus, navigation and narrow-layout behavior.
- Full frontend suite: 206 passed before final formatter extraction; final focused accessibility suite: 5 passed. Typecheck and final build passed.
- **Acceptance still incomplete:** physical Safari, VoiceOver/NVDA, spoken announcements and signed-in checkout/portal journeys were unavailable. Preview checkout remained paused.
- Full evidence and remaining real-device procedure: `docs/ZIONCORE-ACCOUNT-BILLING-ACCESSIBILITY.md`.

# ZionCore completion ledger

**Snapshot:** 2026-11-10
**Purpose:** Preserve a recoverable source/deployment baseline and guide completion of existing product capabilities. This is an inventory, not a production-readiness certification.

## 1. Recoverable baseline

- **Workspace:** `/home/runner/workspace`
- **Git branch:** `main`
- **HEAD:** `fc469ba23fb54b3c3f165b40089a0f264db320d5`
- **HEAD commit:** `2026-11-09` — “Implement research experiments and integrate cosmic intelligence grid contract”
- **Remotes:** `gitsafe-backup`, `subrepl-shared`; no `origin` remote is configured.
- **Worktree:** dirty at this snapshot. Do not treat the HEAD commit as containing the following changes. Replit’s checkpoint system is the recovery path for the current workspace state; no commit, reset, or deployment was performed for this inventory.
  - Modified: `.agents/memory/MEMORY.md`
  - Modified: `artifacts/zioncore-frequency-lab/src/App.tsx`
  - Modified: `artifacts/zioncore-frequency-lab/src/components/wallet-page.tsx`
  - Modified: `artifacts/zioncore-frequency-lab/src/lib/audio-capture-capabilities.test.ts`
  - Modified: `artifacts/zioncore-frequency-lab/src/lib/audio-capture-capabilities.ts`
  - Modified: `artifacts/zioncore-frequency-lab/src/lib/audio-file-analysis.test.ts`
  - Modified: `artifacts/zioncore-frequency-lab/src/lib/audio-file-analysis.ts`
  - Modified: `artifacts/zioncore-frequency-lab/src/lib/customer-service-recommendations.ts`
  - Untracked: `.agents/memory/media-recorder-mp4-chunking.md`
  - Untracked: `artifacts/zioncore-frequency-lab/src/hooks/use-local-audio-recorder.ts`
  - Untracked: `artifacts/zioncore-frequency-lab/src/lib/audio-recorder.test.ts`
  - Untracked: `artifacts/zioncore-frequency-lab/src/lib/audio-recorder.ts`

The project task panel reports the recent browser-audio task as merged, while Git still reports the files above as uncommitted. Use the live worktree and checkpoint history as the source for recovery until this discrepancy is reconciled.

## 2. Deployment source and configuration

Replit deployment metadata reports an active, public **Autoscale** deployment at **https://zioncore.replit.app** with a successful build. The production artifact definitions identify the workspace source:

| Service | Source and production behavior |
|---|---|
| Web | `artifacts/zioncore-frequency-lab/.replit-artifact/artifact.toml`; builds with `pnpm --filter @workspace/zioncore-frequency-lab run build`, serves `artifacts/zioncore-frequency-lab/dist/public` as static content, and owns `/`. |
| API | `artifacts/api-server/.replit-artifact/artifact.toml`; builds with `pnpm --filter @workspace/api-server run build`, runs `artifacts/api-server/dist/index.mjs` on port 8080, and owns `/api`; configured startup health path is `/api/healthz`. |
| Design preview | `artifacts/mockup-sandbox/.replit-artifact/artifact.toml`; development preview at `/__mockup`, not the customer production application. |

The web and API artifact configuration is in this monorepo. **The available deployment metadata does not identify the deployed Git SHA**, so the active production build cannot yet be tied conclusively to `fc469ba…` or to the dirty working-tree changes above. The public URL and successful-build flag do not prove the live customer journeys or API integrations work.

## 3. Architecture and operating dependencies

- pnpm/TypeScript workspace containing the ZionCore web app, API server, mockup preview, shared API contracts, and frequency-AI contract libraries.
- The web app uses React/Vite and `wouter` routes. Local audio analysis and signal generation run in the browser; authenticated cloud and paid operations call the API under `/api`.
- The API is an Express service. It mounts health, wallet, billing, AI interpretation/audio interpretation, resonance asset, and owner routes. Stripe webhooks are handled at `/api/stripe/webhook`.
- Firebase Authentication provides browser identity; the server verifies Firebase ID tokens. Firebase Admin is configured in code for project `ethereal-throne-b20e6` and validates the configured service-account project before initializing. Firestore stores server-owned wallet, transaction, reservation, billing, and AI-job records; the browser’s local observation archive remains available independently.
- App Storage uses the Replit identity-pool sidecar. Object operations and production backups were not exercised during this inventory.
- Gemini uses `@google/genai` when `GOOGLE_GENAI_API_KEY` is configured, with the Replit Gemini integration path and OpenAI routing also present in the provider layer.

## 4. Capability inventory

Status labels distinguish code/test evidence from real production or physical-device verification.

| Capability and entry point | Implementation and dependencies | Status, gap, and next correction |
|---|---|---|
| **Free signal lab — `/`** | Browser microphone capture, audio-file decode, deterministic spectrum/peak analysis, waveform/spectrogram views, and local export. Core processing is local and does not require a paid AI provider. | **Locally tested; physical/browser coverage incomplete.** Recent workspace checks passed for typecheck, 194 unit tests, and the production web build. Chromium used generated/test inputs, not a physical microphone. iPhone Safari and other desktop-browser/device checks remain pending. |
| **Acoustic messages — `/messages`** | Versioned local acoustic encoding/decoding, including the existing BFSK path, with browser playback and capture/analysis utilities. | **Software path implemented and fixture-tested; real receiver interoperability unverified.** It emits acoustic audio only; it does not make an ordinary phone a radio transmitter or demonstrate communication with animals, celestial entities, or other unknown receivers. |
| **Interpretation and paid audio analysis — lab analysis panel** | Quote, submit, and recovery routes use Firebase identity, server-side credit reservation/job handling, provider routing, cost estimates, output validation, and settlement/recovery code. Gemini/OpenAI paths are present. | **Implemented; live provider and paid end-to-end fulfillment unverified.** No production Gemini request or paid customer job was run in this inventory. Verify provider response, full quote/reserve/process/settle/result path before claiming service completion. |
| **Research history and Signal Cards — `/history`, `/history/:id`, `/cards`** | Local observation storage, strict validation, export/restore, and editable/exportable cards; optional authenticated Firestore history is available in the architecture. | **Local path available; production cloud path unverified.** Firebase permissions/query status must be checked using the authorized owner path; do not infer cloud persistence from local tests. |
| **Authentication and account identity — shared account controls** | Firebase Google, Apple, and email/password flows, auth-state handling, App Check configuration, and server ID-token middleware exist. | **Known customer-visible concern.** The owner reported Google returning to a “Join for free” state without clear signed-in navigation; Apple completion and persistent production session are not verified. Determine the actual root cause and verify account/profile creation, session persistence, and secure owner recognition. |
| **Customer dashboard — `/dashboard`, `/wallet`, `/premium`** | `/dashboard` currently resolves to the same wallet route as `/wallet`; wallet and premium components connect to account, credits, plans, and billing controls. | **Routes exist; a distinct, complete personalized customer command center is not established by the route map.** Confirm signed-in account details, history, service access, balances, entitlements, and support controls in the actual customer session. |
| **Credits, checkout, and membership — `/wallet`, `/premium`** | Billing catalog, authenticated Checkout/Portal endpoints, Stripe webhook signature handling, Firestore-backed wallet ledger/reservations, and membership fulfillment are implemented. Production nonsecret flags report `checkoutMode=live`, live-checkout approval and automatic-tax flags enabled, and paid-usage/Premium flags enabled. Live Stripe secret entries exist; values were not accessed. | **Live configuration is present; live transactions and fulfillment are unverified.** The server also validates live-key format and catalog metadata. No charge, webhook fulfillment, wallet settlement, cancellation, or renewal was tested. A 2026-11-07 audit recorded the live catalog as available, an unsigned webhook rejected with 400, and unauthenticated Checkout rejected with 401; it did not verify the webhook-secret mapping or complete a purchase. Treat Checkout as potentially capable of real charges; never test with a real purchase without explicit one-off approval. Current approved packs are 250/500/1,050/2,750/5,750 credits for £2.50/£5/£10/£25/£50; 50/200/1,000 are legacy grant mappings, not current offer keys. |
| **Owner operations — `/admin`, `/owner`** | Owner UI and server routes for summary and Firebase diagnostics exist; those APIs use server-side Firebase owner enforcement. | **Implemented in source; production owner access and data not verified.** No owner session was available to exercise the route, and the designated accounts/UIDs were not revalidated. Never grant admin by client-supplied email or bypass owner authentication. |
| **Firebase, Firestore, and App Check** | Production Firebase public config is present and its project ID matches the intended project; Firebase Admin and App Check secret entries are configured. Rules permit a user to read/list/delete their own observations and create validated observations; client updates are denied. Membership is read-only for the owner; wallet, transactions, reservations, and AI jobs deny client reads/writes. | **Configuration and rule source inspected; active production identity, permissions, and queries not re-run today.** The 2026-11-08 completion audit recorded a READY expiry index but a Firestore `PERMISSION_DENIED` cleanup query; the operations guide records a successful read/query/index and isolated temporary-document test on 2026-11-09, while Firebase task #2 remains in progress. Reconcile these dated records with a fresh authorized diagnostic before relying on cloud history. Local `firestore.indexes.json` contains the `ai_interpretation_jobs.expiresAt` field override, including a collection-group ascending index; the owner previously reported it READY. No index was created or changed here. |
| **Devices and hardware adapters — `/devices`** | Capability detection, adapter framework, importers, device profiles, and fallbacks to recordings/local bridge are present. | **Software pathways present; no physical receiver or sensor was available for verification.** Keep hardware claims limited to documented imports and browser capabilities until real devices are tested. |
| **Bioacoustic, environmental, spiritual, celestial, and cosmic exploration** | Shared signal analysis, research/experiment components, reflective interpretation layers, evidence panels, and public SEO landing routes provide foundations. | **Exploration and analysis tools exist; domain conclusions are not generally validated classifiers.** Animal/species identification needs labeled lawful reference data and measured evaluation. Cosmic data sonification is not an original audible recording; spiritual reflection must remain a distinct, user-chosen interpretation layer. |
| **Discover, SEO, and analytics — `/discover` and static routes** | Searchable guide content, SEO route metadata/rewrites, and optional privacy-safe analytics wrapper exist. | **Source implementation present; published metadata, indexing, analytics collection, and signup attribution were not verified in production.** Analytics requires the configured production publishing path and must remain free of personal/audio/signal content. |

## 5. Seven-stage product cycle

| Founding stage | Current capability | Completion evidence still needed |
|---|---|---|
| **Receive** | Browser microphone and supported audio imports; device adapters describe additional sources. | Real microphone/browser interruption tests and physical receiver checks. |
| **Decode** | Deterministic frequency analysis and local acoustic message decoding. | Real cross-device/noisy-room recovery and unsupported-format behavior on target browsers. |
| **Interpret** | Local measurements plus authenticated AI analysis routes and uncertainty-normalization code. | Real minimal Gemini request and one authorized paid job through delivery/settlement. |
| **Learn** | User-owned history, research experiments, and opt-in review concepts. | No automatic learning from customer data; complete owner-reviewed knowledge updates only after Firebase paths are verified. |
| **Encode** | Local versioned acoustic message generation and WAV/audio export. | Browser/device interoperability and safe output behavior in real environments. |
| **Transmit** | User-controlled audio playback/download. | No RF transmission is implemented by ordinary browser audio; physical output verification remains pending. |
| **Observe** | Follow-up recordings, analysis, comparisons, and saved research records. | Repeatable controlled experiments are not evidence of intentional response without independent validation. |

## 6. Production configuration and evidence boundaries

- Production deployment metadata: active public Autoscale deployment, successful build, URL `https://zioncore.replit.app`.
- Firebase production configuration entries are present, including the public client config, App Check site key, and Admin service-account secret. Values and private key material were not accessed or disclosed.
- Stripe live mode and its approval/tax/usage feature flags are set; live Stripe secret entries exist. This is configuration evidence, **not** proof of Checkout, webhook delivery, pricing correctness, or credit fulfillment.
- Gemini credential entries exist. This is configuration evidence, **not** proof of model authentication, availability, or a successful response.
- `docs/production-operations.md` says Firestore point-in-time recovery was disabled, no backup schedules were returned, and App Storage has no built-in automated backup. This was not rechecked in the current inventory; define a protected backup destination, retention policy, access policy, and budget before representing backups as complete.
- Existing local checks and successful deployment-build metadata do not substitute for live authentication, database, AI, payment, or physical-hardware verification.

## 7. Completion map

1. **Resolve account identity and dashboard clarity:** reproduce Google/Apple/email sign-in with the owner’s real session; verify signed-in navigation and clarify that `/dashboard` currently aliases the wallet route.
2. **Reconcile Firebase status:** run the owner-protected production diagnostics, establish active server identity, permissions, database, query/index status, and customer-owned history behavior. Resolve the discrepancy between the 2026-11-09 operations note and the still-open Firebase task. Do not alter production indexes or customer data without authorization.
3. **Verify commerce safely:** inspect the live catalog read-only against the approved schedule, then verify quote/reservation/provider/settlement/recovery and subscription lifecycle. A real charge requires separate, explicit approval.
4. **Verify AI service:** issue the minimum authorized Gemini request and record model/auth/result without exposing credentials; test the actual paid job boundary separately from local analysis.
5. **Close hardware/browser evidence gaps:** complete the already-tracked iPhone 13 Pro, other desktop browser, and compatible-ultrasound checks. Mark untested physical devices as unverified.
6. **Make releases traceable:** expose a nonsecret build identifier for the web and API so a successful production deployment can be tied to a repository revision; the current deployment metadata does not provide that mapping.

## 8. Work performed for this stage

Created this ledger from the current Git state, artifact definitions, route registrations, Firestore rules/index configuration, production deployment metadata, nonsecret production flag status, and existing production operations notes. No source modules, Firebase data, Stripe products, customer records, secrets, permissions, indexes, or production deployment were changed.

## Stage 2 — Vision and invention recovery

- **Source material reviewed:** Founding product brief, acoustic protocol, completion and bioacoustic audits, production operations notes, strategy and release documentation, relevant persistent engineering decisions, source route registrations, and available Git history.
- **Vision matrix:** `docs/ZIONCORE-VISION-IMPLEMENTATION-MATRIX.md` maps the product lanes and supporting customer capabilities to their source files, entry points, dependencies, evidence boundaries, deployment status, and completion path.
- **Changes:** The homepage cycle and shared AI Genesis seed now use the same seven stages. The Discovery Studio now connects the existing research-experiment archive with explicit, local-only hypothesis saving and export. No automatic learning or cloud publication was added.
- **Verification:** Web unit tests **198/198 PASS**; API unit tests **101/101 PASS**; Genesis cycle contract test **1/1 PASS**; workspace typecheck **PASS**; ZionCore web build with root-domain `BASE_PATH=/` **PASS**; API build **PASS**; `git diff --check` **PASS**; development API health through the Replit proxy **HTTP 200**. The public `/discover` and homepage first view rendered; the Discover page showed its correct empty state because the screenshot browser has no saved captures. The full-page screenshot exceeded the tool’s 8,000-pixel edge limit, so only viewport captures were visually reviewed.
- **Build note:** The aggregate monorepo `pnpm run build` was attempted but stopped at the unrelated mockup-sandbox build because that separate artifact requires its own `BASE_PATH`. The affected ZionCore web artifact and API were built directly with their required configuration. The web build reports an existing large-chunk warning: the largest entry bundle is about 645 kB minified and initial JavaScript is about 195 kB gzip. This is a performance follow-up, not a build failure.
- **Production:** No publish, production database operation, charge, or credential change was made. The work is workspace-only. Live owner authentication, Firebase reconciliation, provider requests, real Stripe fulfillment, and physical device checks remain unverified; see the matrix.

## Stage 3 — System architecture inspection

- **Dependency map and repair queue:** `docs/ZIONCORE-SYSTEM-ARCHITECTURE.md` records the web/API/Firebase/Stripe/AI/App Storage topology, customer data flows, the seven-stage invention cycle, source-backed root causes, and prioritized corrections.
- **Confirmed source gaps:** `/dashboard` currently aliases the wallet page; provider redirect completion can leave a restored user on the sign-in route when both the redirect result and session marker are unavailable; email password recovery and a separate customer profile API were not found; the Firestore rules file is not mapped in root `firebase.json`; the web calls `/ai/interpretation/recover` although that route is absent from the OpenAPI path list; and a repeated cloud-observation save uses `setDoc` where rules deny updates.
- **Security and data boundaries:** Client Firestore observation access is protected by per-user Security Rules; wallets, reservations, jobs, and billing are server-owned. Firebase Admin IAM and client Security Rules require separate diagnostics. The server accepts a missing App Check token while the OpenAPI contract declares Firebase App Check for protected routes, so the stated policy and runtime behavior need alignment.
- **Production status:** No authentication, Firebase, Stripe, AI-provider, App Storage, or physical-device operation was performed in this stage. The previously recorded disagreement about production Firestore access remains unresolved, and the deployed Git SHA is still unavailable.

## Stage 6 — Public website completion

- **Public routes:** Production HTTP checks returned 200 for the homepage, Discover, History, Signal Cards, Messages, Devices, Wallet/Plans, Premium, the dashboard alias, and all six sitemap landing pages. Internal links from the public landing pages resolved to valid routes.
- **Desktop review:** The homepage clearly offers a free local capture and links to paid interpretation, plans, the field guide, history, signal cards, acoustic messages, and device guidance. Discover, Devices, Messages, History, and Premium rendered their intended public experience. The constellation images loaded in the workspace preview; the corresponding production image endpoints returned 200.
- **Mobile correction:** Changed the existing navigation layout to wrap the core tools into a readable three-column grid on narrow screens. Removed duplicate Sign in/Join and Plans links from the grid because the dedicated mobile account row already exposes them. Screenshots at 320 px and 402 px showed no clipped tool link; mobile Wallet, Discover, Messages, and two SEO landing pages also rendered in the workspace preview.
- **Verification:** Web typecheck passed; web unit tests **198/198 PASS**; production web build passed; `git diff --check` passed. The build reports existing Zod/Rollup comment warnings and a >500 kB minified chunk warning; the configured initial-JavaScript budget still passes.
- **Production blocker:** The published `/wallet` route still renders the generic display-error screen, despite returning HTTP 200. The same route renders correctly from the current workspace at desktop and mobile sizes. The deployed asset hashes differ from the fresh workspace build, so release drift is likely, but the production browser exception itself could not be captured. No deployment was performed because production publication remains subject to separate owner authorization.
- **Runtime evidence:** The development API returned HTTP 200 for `/api/healthz` and the inspected resonance-visual requests. API-root `/` returned 404 as expected for a service mounted only under `/api`; this does not test the production website.
- **Changes and verification:** Documentation only; no source modules, production settings, customer records, credentials, IAM, rules, indexes, or deployment were changed. No trailing whitespace found in the two stage documents; `git diff --check` passed.

## Stage 4 — Engineering access and production alignment

- **Detailed record:** `docs/ZIONCORE-STAGE-04-ACCESS-AUDIT.md` contains the sanitized access inventory, production HTTP results, Firebase IAM/query/index diagnostics, the isolated write/read/delete check, Gemini request evidence, source-control status, and remaining owner-session dependency.
- **Production verified:** Web and API health returned 200; the approved Firebase project ID is present in the published web bundle; the production Stripe catalog is live and matches the approved price schedule with checkout and portal enabled; one production App Storage visual returned 200; owner and AI endpoints reject unauthenticated requests with 401; unsigned Stripe webhook requests return 400.
- **Firebase verified:** The existing service-account identity matched the intended project. Effective Firestore entity get/list/create/update/delete and index-list checks passed; the cleanup query passed; the expiry index was READY; one isolated diagnostic document was created, read, deleted, and verified absent. This used the real project from a workspace process, not the deployed API runtime.
- **AI verified:** One minimal request to Google Gemini through `@google/genai` succeeded using `GOOGLE_GENAI_API_KEY` in the workspace process. Production key presence is confirmed, but production-runtime AI execution and OpenAI execution remain unverified.
- **Correction:** Root `firebase.json` now maps the existing Firestore rules file as well as the existing indexes file. The configuration parses and both paths exist. No Firebase rules or index deployment occurred.
- **Access limits:** `gitsafe-backup` read access matches the current `main` commit; `subrepl-shared` could not be verified because its SSH host key is not trusted here. The deployed Git SHA remains unavailable. Production owner diagnostics still require an owner session at `/admin` → **Firebase check** → **Run check**.
- **Safety:** No secrets were displayed, no IAM or production rules were changed, no payment was made, and no customer/ledger data was modified. `git diff --check`, Firebase JSON/path validation, and the documented live diagnostics passed.
