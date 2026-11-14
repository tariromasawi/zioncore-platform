# ZionCore System Architecture and Dependency Map

**Stage:** Finalisation 03 — System Architecture Inspection
**Evidence date:** 2026-11-10
**Scope:** Current workspace source, artifact configuration, shared API contracts, Firebase rules/index configuration, and earlier production-operation records. This is a source-level audit; it does not represent a new production sign-in, charge, provider request, or Firebase mutation.

## 1. Runtime topology and source authority

```text
Visitor / customer / owner browser
  └─ ZionCore web artifact (React + Vite, route entry: src/main.tsx → src/App.tsx)
       ├─ browser-local audio capture, analysis, message encoding, and local research
       ├─ Firebase Authentication and direct, user-owned Firestore observations
       └─ /api/* ── Replit API artifact (Express, port 8080)
            ├─ verified Firebase ID-token identity and owner authorization
            ├─ Firestore Admin: wallets, reservations, jobs, billing records
            ├─ Gemini / OpenAI interpretation providers
            ├─ Stripe Checkout, portal, and signed webhook fulfillment
            └─ Replit App Storage through the local identity-pool sidecar
```

| Layer | Current source and interface | Evidence and boundary |
|---|---|---|
| Public web | `artifacts/zioncore-frequency-lab`; production artifact serves the static build at `/`. | The current workspace and artifact definition identify the source tree. Deployment metadata does not identify the exact deployed Git SHA. |
| Web entry and routes | `src/main.tsx` → `src/App.tsx`; `wouter` routes `/`, `/discover`, `/cards`, `/history`, `/history/:id`, `/messages`, `/devices`, `/premium`, `/admin`, `/owner`, `/dashboard`, `/wallet`. | `/admin` and `/owner` use the owner route. `/dashboard` and `/wallet` both use the wallet route; a distinct customer dashboard is not currently mounted. |
| API | `artifacts/api-server/src/index.ts` → `app.ts` → `routes/index.ts`; deployment listens on port 8080 and owns `/api`. | The Express app parses the Stripe webhook body before JSON middleware. Startup health is `/api/healthz`. |
| Shared contracts | `lib/api-spec/openapi.yaml` generates `lib/api-client-react`; server and direct AI clients also use `lib/api-zod`. | Wallet, billing, owner, AI, health, and public resonance paths are represented in the OpenAPI file. The browser calls the AI recovery endpoint directly, but that endpoint is absent from the OpenAPI path list. |
| Firebase client | `src/lib/firebase.ts` locks the browser configuration to project `ethereal-throne-b20e6`; `firebase-auth.ts` configures local persistence and Google/Apple redirect plus email/password sign-in. | Firebase initialization is configuration-gated. App Check initialization and token attachment are best-effort. This is source evidence, not proof that the production providers or domain configuration are correct. |
| Firebase server | `api-server/src/lib/firebase-admin.ts` requires `FIREBASE_SERVICE_ACCOUNT_JSON` and rejects a credential for any project other than `ethereal-throne-b20e6`. `firebase-identity.ts` verifies ID tokens. | Firestore Admin IAM and browser Firestore Security Rules are separate authorization paths and must be tested separately. |
| Firestore configuration | Root `firebase.json` references `firestore.indexes.json` only. The rules source is `artifacts/zioncore-frequency-lab/firestore.rules`. | The local rules file is not mapped in `firebase.json`; this establishes a CLI deployment/configuration drift risk, but does not prove which rules are currently active in production. The index file contains the `ai_interpretation_jobs.expiresAt` collection-group ascending override. |
| Production deployment | `https://zioncore.replit.app`; web and API are separate artifacts in this monorepo. | Current deployment metadata reports a successful build, but not the deployed SHA. The worktree is dirty, so it cannot be assumed to match the live deployment. No publish was performed for this audit. |

## 2. Customer-facing data and trust flows

### A. Public, local signal exploration

`/` and the local tools accept a browser microphone stream or supported audio file. Browser code performs deterministic signal measurements and renders the waveform/spectrum/spectrogram and related views. Local observations and research cards can remain in the browser profile and be exported. Message encoding and decoding run locally; playback or a downloaded WAV is user-initiated. Ordinary browser speakers do not provide radio transmission or proof that another device or organism understood a signal.

**Trust boundary:** measured sample rate, peaks, levels, and decoded protocol payloads are separate from AI explanations, symbolic/spiritual reflection, and experimental communication hypotheses.

### B. Authentication and customer identity

Firebase Authentication owns the browser identity. The app subscribes to `onAuthStateChanged`, requests a Firebase ID token, and attaches it as a bearer token to protected API requests. `getFirebaseIdentityHeaders` also attempts to attach an App Check token when the web App Check instance initialized and token retrieval succeeds. The API verifies the ID token and derives the UID from it; the client cannot choose a wallet owner.

The API has no customer profile CRUD route in the registered route set. The UI can display Firebase-provided name/email, but a separately managed customer profile, profile-editing flow, and password-recovery flow were not found in the inspected account/auth implementation.

### C. Cloud observation history

The optional cloud-observation path is direct browser-to-Firestore, not an API-server proxy:

```text
authenticated Firebase user
  → cloud-observations.ts
  → users/{verified-auth-uid}/frequency_observations/{observationId}
  → firestore.rules ownership and measurement validation
```

The client validates observations before saving. Rules allow the authenticated owner to read/list/delete their own observation documents and create only documents that meet the strict measurement schema; updates are denied. Wallets, transactions, reservations, and AI jobs are client-denied and remain server-owned. A failure in Admin IAM does not by itself explain a client Security Rules denial, and the reverse is also true.

One source-level edge case is confirmed: `saveCloudObservation` writes to the deterministic observation ID with `setDoc`, while the rules deny all updates. Saving an observation whose cloud document already exists will therefore be treated as an update and rejected; retrying an upload is not idempotent at this boundary.

### D. Paid interpretation and audio review

The ordinary interpretation flow is:

```text
analysis panel
  → authenticated quote request
  → user reviews and approves signed, versioned quote
  → authenticated submit with quote token, price/version, and idempotency key
  → API validates measurement and quote
  → job claim and credit reservation
  → AI provider call and output normalization/schema validation
  → result/job record
  → credit settlement; failure path attempts release/recovery
  → result returned to the web app
```

The inspected submit handler reserves credits before calling the interpretation providers and settles only after a validated result. Audio review has a separate duration/size-based quote and explicit external-audio consent; the backend checks the quote and reserves the credits before sending audio to its provider path. These code paths are implemented, but source inspection and mocked/unit tests do not prove production provider access, Firestore permission, paid job fulfillment, or recovery on the live deployment.

### E. Credits, checkout, and membership

```text
wallet / offer UI
  → generated authenticated API client
  → GET /api/billing/catalog (Stripe-backed catalog)
  → POST /api/billing/checkout (server-selected catalog price and trusted return origin)
  → hosted Stripe Checkout
  → POST /api/stripe/webhook (raw body + Stripe signature verification)
  → idempotent wallet credit or membership update in Firestore
  → wallet/membership UI refresh
```

The checkout handler binds the request to the verified Firebase UID and an allowlisted catalog entry. The webhook is mounted before JSON parsing and verifies the Stripe signature. Handlers cover completed/async-successful checkout, subscription lifecycle, paid invoices, refunds, and disputes. The source has safeguards for fulfillment; this audit did not make a purchase or verify a live webhook delivery, wallet credit, renewal, cancellation, refund, or dispute.

### F. Owner operations

`/admin` and `/owner` load the same owner dashboard. Its summary and Firebase diagnostics APIs use the owner middleware, which requires a verified Firebase identity and server-derived owner authorization. Owner status is not trusted from a client-supplied email or role field. Production owner sign-in, effective custom claims/identity, and diagnostics results still require a live owner session.

### G. Public resonance media and App Storage

The resonance audio/visual routes expose a fixed asset catalogue and resolve files through `PUBLIC_OBJECT_SEARCH_PATHS` using the Replit identity-pool sidecar client. This is separate from Firebase customer history. The code path exists; current production object availability, sidecar authorization, backup policy, and asset-by-asset playback were not verified by this architecture pass.

## 3. Founding cycle mapped to current implementation

| Stage | Existing implementation | Completion boundary |
|---|---|---|
| **Receive** | Browser microphone, imported audio, and supported data-file importers. | Actual bandwidth/sample rate depends on the browser, microphone, driver, and source file. Physical ultrasonic and specialist receiver capture remain unverified. |
| **Decode** | Deterministic signal analysis and versioned acoustic message decoders. | A recovered protocol payload is verifiable against its framing/checksum; this does not establish a wider receiver or biological understanding. |
| **Interpret** | Local measurements plus authenticated, credit-funded AI interpretation and opt-in audio review. | Live provider response, paid end-to-end job, and user-facing error/recovery remain production checks. |
| **Learn** | Local hypothesis/research records and export; the Discovery Studio is connected to this local research path. | No user observation automatically trains a model or updates production knowledge. Cosmic grid contract exports are not mounted in a customer route. |
| **Encode** | Local versioned acoustic message encoders and waveform tools. | Software round-trip fixtures do not prove interoperability across physical speakers/microphones. |
| **Transmit** | Explicit browser audio playback and downloadable signal files. | No browser RF transmitter or continuous/automatic broadcast is implemented. |
| **Observe** | Follow-up microphone/file observations, local comparison, and saved records. | Correlation is not proof of response; cross-device, ecological, animal, and celestial claims need controlled evidence. |

## 4. Ranked repair and verification queue

Ranks distinguish confirmed source/configuration defects from evidence gaps. “Production verification required” is not a claim that the corresponding code is broken.

| Rank | Issue and customer impact | Root cause / evidence | Corrective action and acceptance evidence |
|---|---|---|---|
| **P0 — Identity journey** | A successful social sign-in may leave the user on the account-entry route; the customer then cannot tell whether they are signed in or reach a real dashboard. | `App.tsx` routes email success to `/dashboard`, while provider completion navigates only when `getRedirectResult` returns a result or the session-storage pending marker exists. `savePendingProviderRedirect` silently tolerates unavailable session storage, and the auth-state callback updates the user but does not itself route to the dashboard. This is a plausible code-level cause of the reported return-to-signup behavior; production browser evidence is still needed to confirm the exact incident. | Centralize the successful-auth transition without redirect loops; ensure a restored Firebase user is visibly recognized; route to a distinct customer dashboard; test Google, Apple, email, reload, restricted storage, denial, and sign-out using real supported browsers. Keep owner access server-verified. |
| **P0 — Dashboard and account completion** | Customers land on a wallet page instead of a command centre and lack expected account recovery/profile controls. | `/dashboard` and `/wallet` both mount `WalletRoute`. The inspected auth operations have email create/sign-in but no password-reset function; registered API routes have no profile CRUD route. | Give `/dashboard` a real overview linking to services, history, wallet, and membership; add tested password recovery and a privacy-conscious profile path; verify actual account records, balances, and entitlements after sign-in. |
| **P0 — Firebase production truth** | Cloud history or owner diagnostics may fail despite code-level Firebase wiring; incorrect rule or IAM fixes risk exposing data. | Root `firebase.json` wires indexes but not the existing rules file. Historical records disagree about production cleanup-query access. Browser Firestore rules and server Admin IAM are distinct paths. | First run fresh owner-authenticated checks. Test customer-owned observation read/write separately from the Admin cleanup query and report the active database/identity/error. Confirm the authoritative rules source; map it into Firebase CLI configuration only after review. Change no production rules, IAM, index, or customer data without the required authorization. |
| **P0 — Source-to-production traceability** | A workspace fix may not be the version the customer is viewing. | Deployment metadata has no deployed Git SHA, while the worktree is dirty. | Add a non-secret build/revision identifier to web and API health/status surfaces and verify it after an owner-approved publish. Keep rollback capability and do not publish as part of this audit. |
| **P0 — Real paid journey proof** | Customers may be unable to complete purchases or receive paid results even though handlers exist. | Stripe catalog/Checkout/webhook and AI quote/reserve/process/settle paths are implemented, but no live authorized purchase, webhook fulfillment, provider request, or paid job was executed in this audit. | After explicit approval for any real charge, verify the existing catalog, hosted Checkout, signature-verified webhook, idempotent wallet/membership fulfillment, then a minimal quoted/reserved AI job through result and settlement/recovery. Do not use a simulated payment as production proof. |
| **P1 — Firestore rule release wiring** | Future rules changes can silently drift or be impossible to deploy from the repository’s Firebase CLI configuration. | `firebase.json` includes only `"indexes": "firestore.indexes.json"`; it omits the existing `artifacts/zioncore-frequency-lab/firestore.rules` path. | Confirm whether that rules file is authoritative and add the rules path to local Firebase configuration in a reviewed change. Validate the rules locally and compare production rules before any deployment. |
| **P1 — AI recovery contract drift** | Interrupted text interpretations can recover in the current browser client, but API schema/docs-generated clients do not describe that operation. | `POST /ai/interpretation/recover` is implemented and called directly from `src/lib/ai-analysis.ts`, but it is absent from `lib/api-spec/openapi.yaml`. | Add the request/response and error contract to OpenAPI, regenerate the client or document why recovery remains a private manual-fetch endpoint, and test same-user/idempotent recovery and cross-user denial. |
| **P1 — App Check contract mismatch** | Operators and generated API clients can assume stronger API protection than the server currently enforces. | The web client attaches App Check best-effort. `firebase-identity.ts` accepts a missing token and verifies only a supplied token; its comment explicitly calls App Check optional. OpenAPI declares Firebase Bearer and App Check together for protected operations. | Decide which API classes require App Check. Align the OpenAPI security declaration with actual policy; if required, enforce it on those routes, preserve public health/catalog/media access as intended, and verify all production clients send valid tokens. Keep Firebase Auth mandatory for private routes. |
| **P1 — Cloud observation retry** | Re-saving or retrying an existing observation can fail even when the customer owns it. | `cloud-observations.ts` uses `setDoc` at the same ID; `firestore.rules` permits create but denies update. A repeated write is an update, not a create. | Make save idempotent without overwriting an existing record: detect an identical record and treat it as already saved, or return a clear conflict for a changed record. Test first save, identical retry, changed retry, and cross-user denial. |
| **P1 — Cloud observation and saved-result experience** | Customer cloud history depends on direct Firestore rules; paid AI job recovery records are not equivalent to a browseable customer history. | Observations save under the authenticated user path. The API exposes wallet, quote, submit, and recovery operations but no customer profile or general AI-job listing route in the registered route map. | Verify observation access under real user rules. Decide and implement a user-owned result/history API if customers need cross-device paid-result history; preserve local-only records and consent boundaries. |
| **P1 — Object storage and recovery** | Resonance assets or backups can fail independently of Firebase and payments. | Media routes require an object path in `PUBLIC_OBJECT_SEARCH_PATHS` and Replit sidecar access. Production asset reads and the previously documented lack of automated backup were not rechecked. | Check each referenced production object and stream lifecycle; confirm backup ownership, retention, restore test, access policy, and cost. Do not report backups complete until restore succeeds. |
| **P1 — Cross-browser and receiver evidence** | Browser feature support and hardware bandwidth affect real capture and playback. | Local tests and Chromium/headless results are not iPhone Safari or a physical-receiver test. | Finish the tracked iPhone 13 Pro and desktop-browser tests; record actual browser/device versions, MIME type, sample rate, errors, and detected peaks. Mark unavailable physical hardware as unverified. |
| **P2 — Disconnected research capability** | Users may be promised a cosmic research route that has no customer entry point. | The cosmic-intelligence-grid contract is exported in shared code but is not mounted in the app route tree. | Connect a scoped dataset-backed research workflow with provenance, licensing, and evidence boundaries, or label it as planned rather than active. |
| **P2 — Animal/environmental evidence** | A generic AI response could be mistaken for validated species or behavioral identification. | The product audit records no labeled, lawfully traceable evaluation corpus or precision/recall assessment. | Keep classifications as hypotheses until named classes, data provenance, false-positive fixtures, and representative evaluation results exist. |
| **P2 — Performance and measurement** | Large initial JavaScript and missing live funnel evidence may slow onboarding and obscure the best-performing customer entry points. | The prior web build reports a roughly 645 kB minified largest chunk and ~195 kB gzip initial JavaScript; guide analytics is optional and production collection is not verified. | Profile and split routes without changing functionality; retain privacy-safe, non-sensitive event dimensions and verify collection only after deployment with analytics enabled. |

## 5. Decisions and safety boundaries

- Do not treat a successful build, Firebase secret presence, provider configuration, Stripe catalog entry, or test double as live service proof.
- Do not conflate browser Firestore Security Rules with Firebase Admin IAM.
- Do not alter the production cleanup index: the current root index file already includes the intended field override, and production status needs fresh diagnostics.
- Do not initiate a real Stripe charge, change IAM/rules, publish, or delete customer data as part of this source inspection.
- Preserve raw recordings locally unless the user explicitly approves the disclosed provider path; paid external audio review must retain explicit consent and the approved quote/reservation boundary.
- Maintain the measurement / recovered payload / AI hypothesis / devotional reflection distinction in customer-facing output.

## 6. Stage 3 completion status

**Complete at the architecture-inspection level.** The route topology, major customer data flows, trust boundaries, source-backed root causes, production-evidence gaps, and ranked repair/verification queue are recorded here. This stage did not change application code or claim that production behavior is verified.

The next implementation work should begin with the P0 identity/dashboard and Firebase source-to-production reconciliation items, while preserving the release hold until the relevant owner-approved production checks succeed.

**Local runtime evidence:** The running development API returned HTTP 200 for `/api/healthz` and the inspected resonance-visual requests. A request to `/` on the API service returned 404, which is expected because that artifact mounts its API under `/api`; it is not evidence that the customer web root is broken. Two image requests were aborted during navigation and returned no status, consistent with browser cancellation.
