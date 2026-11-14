# ZionCore completion map

**Reviewed:** 2026-11-12
**Purpose:** Record the recoverable workspace baseline, distinguish implemented code from live production evidence, and order completion work without replacing existing systems.

See [ZionCore Vision-to-Implementation Matrix](ZIONCORE_VISION_IMPLEMENTATION_MATRIX.md) for the detailed trace from original product instructions to current and historical code.
See [ZionCore System Dependency Map](ZIONCORE_SYSTEM_DEPENDENCY_MAP.md) for entry-to-result data flows and root-cause-ranked repairs.
See [ZionCore Access and Production Alignment](ZIONCORE_ACCESS_AND_PRODUCTION_ALIGNMENT.md) for verified workspace, Firebase, environment, AI, Stripe, and deployment access findings.

## Recoverable baseline

- **Workspace:** pnpm monorepo in `/home/runner/workspace`; the worktree was clean before this inventory was added.
- **Current branch:** `main`
- **Current active checkout:** branch `main` at `3c83aa51e729f0847efc154b0fc3a758c9e622e4`; it has uncommitted Phase 77–83 work and must be preserved.
- **Recovered production source:** the user-verified production commit `ca6ff0b252155295315beae1f65fc8e71029ebc1` is present in the history of `zioncore-main-source-candidate` and `main-repl/main`, both at `d4be0c7`. The active `main` checkout does not contain that commit.
- **Production web:** `https://zioncore.replit.app`; Replit reports a public Autoscale deployment with a successful build. Deployment metadata reports no source commit or additional production URL.
- **Production API provenance:** per the supplied successful-build log, production was built from `ca6ff0b252155295315beae1f65fc8e71029ebc1`. That commit contains the billing, wallet, webhook, and owner API source. The active `main` branch's API artifact remains health-only; do not confuse it with the recovered production source.

## Workspace architecture and capability inventory

| Area | What exists in the workspace | Verification / status |
|---|---|---|
| Customer web app — `artifacts/zioncore-frequency-lab` | React/Vite app with `/`, `/history`, `/history/:id`, `/history/device`, `/history/device/:id`, and `/exploration`; live browser-microphone spectrum analysis; account-scoped device history; Firebase account access; analysis panel; research experiment UI. Detail records can be exported or deleted; CSV includes saved interpretation fields. | Stage 5 typecheck, 32 unit tests, production-mode Vite build, and mobile preview passed. Firestore emulator rules tests passed in the earlier rules pass. Screenshots cover only unauthenticated preview states, not a physical iPhone or signed-in customer path. |
| Research Grid | Versioned `zc-cig-experiment/v1` experiment contract; domain/method and signal-adapter registries; normalized acoustic observations with provenance; cost/consent-aware research-agent router. | Current executable research handler is deterministic local acoustic statistics. Other listed modalities are extension points, not connected sensors, datasets, or agents. Details: `artifacts/zioncore-frequency-lab/RESEARCH_GRID.md`. |
| Instrument interface | Instrument registry and browser microphone adapter; synthetic signal adapter is development-only. | Browser microphone is the only connected physical instrument, and is uncalibrated. No specialist sensors, receiver hardware, or physical transmitter is connected. |
| Local and cloud history | Account-local observations use UID-specific browser storage; the legacy signed-out browser archive is preserved separately. Firebase Auth and a Firestore observation client target `users/{uid}/frequency_observations`. | Local storage is not encrypted. Browser Firestore calls require an explicit `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` opt-in and are paused by default. The current production rules remain public and compatibility is unverified; do not store sensitive records in Firestore or browser storage. |
| Authentication | Email/password and Google redirect sign-in/linking; auth-state listener; password reset. Google linking is designed to preserve the signed-in UID. | Google is enabled in Firebase. The existing owner account remains password-only until the owner links Google. No owner session was used to verify the flow. Apple credentials are absent, so Apple sign-in is not ready. |
| AI interpretation | Opt-in Gemini request receives bounded measurement summaries, not raw audio, spectrum bins, or observation notes. | The last live model request returned `RESOURCE_EXHAUSTED` because Gemini prepayment credits were depleted. AI output is unavailable until an owner-approved quota/billing action. |
| API server — `artifacts/api-server` | Active `main` contains an Express 5 health-only API. The verified production source is on `zioncore-main-source-candidate` / `main-repl/main`. | Active `main` does not contain the recovered production billing, wallet, owner, messaging, and webhook handlers. Preserve and reconcile the separate source ref; do not replace it with recreated handlers. |
| API/database scaffolding | Active `main` has health-only OpenAPI/Zod contracts and Drizzle/Postgres workspace packages. The production source ref has billing, wallet, owner, webhook, and AI API contracts. | The active branch's Drizzle schema is a placeholder; production source uses Firebase Admin for billing and wallet paths. No database migration or source merge was performed. |
| Canvas — `artifacts/mockup-sandbox` | Component-preview design artifact and generated component gallery. | Design tooling only; not a customer-facing ZionCore service. |

## Production evidence observed

### Firebase and App Check

- Firebase project `ethereal-throne-b20e6` has distinct development and production web-app registrations. Registered App Check keys match their respective scoped client configurations and hostname restrictions.
- The published bundle combines the **development Firebase App ID with the production App Check key**. The homepage made no token-exchange request during the observation window. The last recorded exchange failure was HTTP `403 PERMISSION_DENIED` — `App attestation failed`. Production token exchange is therefore unconfirmed.
- A development token exchange previously succeeded in a 402px Chromium preview. This is not a production verification or an iPhone Safari test.
- Firebase AI Logic, Firestore, and Authentication App Check enforcement are currently `UNENFORCED`. AI Logic enforcement was disabled earlier under the owner's instruction to wait for valid token exchange. No Firestore rules were deployed.
- Replit secret metadata reports `VITE_FIREBASE_APPCHECK_SITE_KEY` in shared, development, and production scopes. The `.replit` user environment contains separate development and production Firebase configuration and an empty shared block. Remove any leftover shared-scope secret so fallback configuration cannot blur the environment split; keep the development and production entries.

### Firestore

- The deployed rules currently include project-wide public read/write access and six public legacy roots: `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`, `soul_signatures`, and `petitions`.
- A metadata-only root collection listing returned no collection IDs. No document contents were read. The six names do not appear in workspace callers or the published browser bundle, but external clients remain unknown.
- The local candidate rules permit only validated owner observations and deny all other client paths. Emulator tests passed, but compatibility with the deployed product and any external callers is not established. **Do not deploy until callers and data contracts are reconciled.**

### Production API and billing

Read-only checks and browser-bundle inspection on the production host observed:

| Route or service | Evidence | Limit |
|---|---|---|
| `GET /api/healthz` | HTTP 200 | Confirms a health handler responds, not which source revision serves it. |
| `GET /api/billing/catalog` | HTTP 200; `checkoutEnabled` and `portalEnabled` are true; six offers are returned. | Does not prove that a payment can complete. |
| Owner diagnostics and summary | Unauthenticated checks returned HTTP 401. | No signed-in owner path was tested. |
| Wallet and wallet transactions | Unauthenticated HEAD checks returned HTTP 401. | No balance or ledger records were read; authorized paths are unverified. |
| Billing checkout and portal | Recovered source confirms `POST /api/billing/checkout` and `POST /api/billing/portal`; HEAD returned 404. | HEAD 404 is expected for POST-only handlers. No authenticated POST was sent because it would create a Checkout or portal session. |
| Stripe webhook | Two enabled production endpoints point to `/api/stripe/webhook`; an unsigned `{}` POST returned HTTP 400, `Missing Stripe signature.` | Signed event processing, replay safety, and idempotency were not verified. |

The live Stripe catalog contained 17 active products and 20 active prices. The six offers exposed by the production catalog are 250 credits/£2.50, 500/£5, 1,050/£10, 2,750/£25, 5,750/£50, and Pro at £1/month. The £1 is the listed base price; final tax-inclusive checkout total was not verified. Separate active GBP prices for 50, 200, and 1,000 credits exist in Stripe but are not exposed by the production catalog. No products or prices were changed.

### Plans page recheck — 2026-11-10

- The production homepage's **Plans** navigation goes to `/wallet`. That route currently renders the ZionCore recovery screen (“This view could not be displayed”); `/plans` returns 404.
- `GET /api/billing/catalog` still returns HTTP 200 and reports checkout/portal enabled, but its six offers do **not** match the requested 50/200/1,000-credit packs. No checkout session was created and no customer or payment data was read.
- Read-only inspection of active prices in the connected live Stripe account confirmed:

| Offer | Active price ID | Active product | Amount |
|---|---|---|---:|
| 50 credits | `price_1UYodfCzY6aOUtjFmWpfAzXd` | ZionCore Starter Credits (50) | £2.50 |
| 200 credits | `price_1UYodgCzY6aOUtjFznBLOxAW` | ZionCore Lab Credits (200) | £8 |
| 1,000 credits | `price_1UYodhCzY6aOUtjFyrQLVfzN` | ZionCore Throne Credits (1000) | £32 |
| Premium | `price_1UYodWCzY6aOUtjF10D3bYGd` | ZionCore Pro UK | £1/month |

- These prices and products are active. The existing public catalog also has separate active packs (including 250 credits at £2.50); no price or product was changed or deactivated.
- The active workspace API registers only `GET /api/healthz`; the production Plans/Checkout source has since been recovered on the retained source-candidate branch. It has not been reconciled into active `main`, and no Checkout session was created.

An aggregate active-subscriber metric response was withheld by the safety filter. This is not evidence of zero subscribers. No individual subscription records were read, and no count should be displayed as zero until an authorized aggregate source returns it.

## Completion map

| Priority | Work to finish | Exit evidence |
|---|---|---|
| 1 — Source provenance | Obtain or recover the actual deployed web/API source and revision; compare it with `main` before reconciling. Preserve the current Git baseline. | Verified production build maps to a source commit; billing, wallet, owner, Messages, and webhook handlers have authoritative source and tests. |
| 2 — Production App Check | Remove the shared-scope site-key fallback; build with the production app ID/key; obtain explicit publish approval; verify production token exchange. | Published bundle contains the production app ID/key pair, token exchange succeeds on `zioncore.replit.app`, and enforcement is enabled only after confirmation. |
| 3 — Firestore security | Classify every deployed collection and external caller; map customer/owner/server permissions; then review and deploy a compatible least-privilege ruleset. | Emulator plus production authorization checks show owner access works, cross-account/unauthenticated access is denied, and required production workflows remain functional. |
| 4 — Authentication and dashboards | Verify email/Google persistence and same-UID Google linking with an owner-controlled session; recover or restore the actual owner/customer dashboard source. Configure Apple only when its credentials are available through the secure secrets flow. | Signed-in customer and owner journeys work; owner operations are backend-authorized; unauthorized calls remain denied. |
| 5 — AI and metrics | Resolve Gemini quota only with owner approval. Repair the aggregate metrics path without reading individual customer records; distinguish unavailable data from a verified zero. | A bounded AI request succeeds; the metric displays a verified count or a precise insufficient-data state. |
| 6 — Billing integrity | Reconcile catalog offers with Stripe prices; verify checkout, portal, wallet ledger, webhook delivery, replay protection, and idempotency using test-mode or approved non-charging tests. Do not alter live prices without approval. | Catalog/checkout/ledger/webhook tests agree; duplicate webhook delivery cannot duplicate credits or entitlements; final customer totals are confirmed. |
| 7 — Device verification | Test microphone permissions, recording, navigation, and persistence on a real iPhone with Safari. | Device/browser results recorded separately from desktop or Chromium viewport simulation. |
| 8 — Research and hardware expansion | Preserve the current research-grid contracts; connect new protocols, datasets, and sensors only when their adapters and measurements are implemented and verified. | Each new instrument/data source has provenance, calibrated units where available, consent controls, tests, and a usable customer workflow. |

## Product catalog reconciliation — 2026-11-12

This is a source-to-offer mapping, not a fresh Stripe check. The price IDs and live catalog details below are from the read-only Stripe inspection recorded on **2026-11-10**. Phase 82 must refresh them before any customer-facing price display or purchase work.

### Intended offers mapped to known Stripe prices

| Intended offer | Stripe product / active price as last verified | Intended entitlement after verified payment | Workspace functionality | Safe draft description (not approved or published) |
|---|---|---|---|
| 50 credits — £2.50 | ZionCore Starter Credits (50) · `price_1UYodfCzY6aOUtjFmWpfAzXd` | Add 50 credits only after a signed, verified, idempotent payment event. | No wallet, ledger, Checkout, or credit-consuming paid service is connected in this workspace. No approved product description was found. | “A pack of 50 ZionCore credits. Eligible services, usage, and expiry terms must be confirmed before purchase.” |
| 200 credits — £8 | ZionCore Lab Credits (200) · `price_1UYodgCzY6aOUtjFznBLOxAW` | Add 200 credits only after a signed, verified, idempotent payment event. | No wallet, ledger, Checkout, or credit-consuming paid service is connected in this workspace. No approved product description was found. | “A pack of 200 ZionCore credits. Eligible services, usage, and expiry terms must be confirmed before purchase.” |
| 1,000 credits — £32 | ZionCore Throne Credits (1000) · `price_1UYodhCzY6aOUtjFyrQLVfzN` | Add 1,000 credits only after a signed, verified, idempotent payment event. | No wallet, ledger, Checkout, or credit-consuming paid service is connected in this workspace. No approved product description was found. | “A pack of 1,000 ZionCore credits. Eligible services, usage, and expiry terms must be confirmed before purchase.” |
| Premium — £1/month | ZionCore Pro UK · `price_1UYodWCzY6aOUtjF10D3bYGd` | Maintain Premium only from verified subscription lifecycle events and server-owned entitlement state. | No subscription or entitlement service is connected here, and no verified Premium benefits were found. Do not promise particular benefits from this source. | “ZionCore Pro monthly membership. Included features must be verified before promotion.” |

The production catalog snapshot on 2026-11-10 exposed a different six-offer set: 250 credits/£2.50, 500/£5, 1,050/£10, 2,750/£25, 5,750/£50, and Pro at £1/month. The intended 50/200/1,000-credit prices existed separately but were not exposed by that catalog. The duplicate £2.50 price must not be described as the same offer: it buys 250 rather than 50 credits.

### Current workspace capability boundary

- `artifacts/api-server/src/routes/index.ts` registers only the health route. No workspace route implements billing catalog, Checkout, portal, wallet, ledger, subscription fulfillment, or webhook handling.
- The lab’s customer dashboard says credits and membership are not connected; account export explicitly excludes them. The Access page says Stripe, credits, and Premium gates are outside this lab artifact.
- Free browser-local measurement, WAV analysis, synthesis/playback, supported packet demonstrations, and local export are not credit-gated in this artifact. The AI path is separately paused pending Firebase project safeguards; it is not a verified paid credit service.
- The observed production catalog’s `checkoutEnabled` and `portalEnabled` flags do not prove that Checkout, webhook fulfillment, wallet balances, or subscription entitlements work.

**Phase 81 result:** the offers, known price IDs, intended settlement rules, copy gaps, and source gaps are mapped. No product or price was created, changed, or deactivated; no Stripe objects or customer records were read in this phase. Fresh price verification belongs to Phase 82, and no offer should be published from this stale snapshot.

### Phase 82 live-mode verification — 2026-11-12

The connected Stripe account list returned one account in **Live mode** and no Test-mode account. A read-only `GET /v1/prices` for active GBP prices returned 16 records with no additional page. The four approved offers below were active, and each linked product was active. **Only these four approved offers are listed here; the other active prices are not approved for display by this check.**

| Approved offer | Live Stripe price ID | Product ID | Price status and type | Current Stripe product description |
|---|---|---|---|---|
| 50 credits — £2.50 | `price_1UYodfCzY6aOUtjFmWpfAzXd` | `prod_VZyaP100IrT1KZ` | Active, one-time, GBP 250 minor units | “50 prepaid credits for premium AI features. One-time.” This is Stripe metadata, not proof that those paid features are currently available. |
| 200 credits — £8 | `price_1UYodgCzY6aOUtjFznBLOxAW` | `prod_VZyaiTR6aydX3p` | Active, one-time, GBP 800 minor units | “200 prepaid credits — best value. One-time.” This is Stripe metadata, not an independently verified value claim. |
| 1,000 credits — £32 | `price_1UYodhCzY6aOUtjFyrQLVfzN` | `prod_VZyaMlXB3IWgDH` | Active, one-time, GBP 3,200 minor units | “1000 prepaid credits for power users. One-time.” This is Stripe metadata, not proof that paid usage is connected. |
| Premium — £1/month | `price_1UYodWCzY6aOUtjF10D3bYGd` | `prod_VZyaffDLP8Olau` | Active, recurring monthly, GBP 100 minor units | “ZionCore Frequency Intelligence Pro — £1/month. MWARI NDI MWARI.” Subscription benefits and entitlement fulfillment remain unverified. |

The public production `GET /api/billing/catalog` was also rechecked read-only. It still reports `checkoutEnabled: true` and `portalEnabled: true`, but returns six different offers (250, 500, 1,050, 2,750, and 5,750-credit packs plus Pro). It does not expose the approved 50-, 200-, or 1,000-credit offers. The response is not evidence of successful checkout or fulfillment.

**Phase 82 result:** the four intended Stripe prices and products are confirmed active in Live mode. No Test-mode account was available for comparison. The production catalog is not aligned with the approved offers. Its authoritative source exists on `zioncore-main-source-candidate` at the verified production commit, but is not present in the active `main` checkout. No API, Stripe object, checkout, or customer data was changed. Reconcile the source branch before altering the production offer allowlist.

### Phase 83 checkout source review — 2026-11-12

The verified production commit contains `artifacts/api-server/src/routes/billing.ts`. `POST /api/billing/checkout` requires Firebase ID-token verification, accepts a schema-validated offer key rather than a client-supplied Stripe price ID, validates the return origin against the production ZionCore origin or explicitly configured development hosts, reloads the offer and price from the server-side Stripe catalog, checks mode and purchasability gates, and assigns the Firebase UID to Checkout metadata and client reference. It uses a per-user/offer idempotency key and returns only the hosted Checkout URL. No Checkout session was created and no payment was attempted.

The source has tests for Firebase identity and checkout-mode/offer gates; the origin allowlist test passes when run directly, but it is not included in the production `test:unit` command. No route-level test of successful session creation and Stripe parameters exists in the commit. The OpenAPI contract lists Firebase App Check as required, but the identity middleware treats App Check as optional (it verifies a supplied token, not a missing one); this contract/runtime mismatch needs resolution before claiming App Check protection for Checkout. Importantly, the catalog code exposes the 250/500/1,050/2,750/5,750 packs plus Premium; its legacy 50/200/1,000 packs are not in the customer-purchasable allowlist. Thus the route implements authenticated Checkout for its current catalog, but does not make the four approved Phase 82 offers purchasable.

**Phase 83 result:** the original Checkout handler was recovered and reviewed, so no duplicate route was created. The handler is in the verified source-candidate branch, not the active checkout; live authenticated session creation and route-level integration coverage remain unverified. Do not change the allowlist or merge/publish the source without reviewing compatibility with existing offers and the active branch.

### Phase 84 webhook source review — 2026-11-12

The recovered API verifies Stripe's signature against the raw request body before processing, rejects missing/invalid signatures, enforces configured live/test mode, and only grants credits after checking a paid ZionCore Checkout session against the server catalog and retrieved Stripe line item/price. The grant uses a Firestore transaction keyed by the Checkout session, so duplicate and asynchronous success events cannot credit the same purchase twice. Subscription updates have event-time ordering checks, and refunds/disputes are recorded for manual review rather than silently changing wallet balances. The browser return page states that entitlements update only after server verification and contains no credit-grant path.

The production endpoint returned HTTP 400 `Missing Stripe signature.` to an unsigned `{}` probe. This confirms the route is live and rejects missing signatures; it does not exercise a valid event. The source includes synthetic Stripe-signature tests and loopback-only Firestore emulator tests for duplicate grants, conflicting legacy receipts, wallet idempotency, and subscription status/order. These tests were inspected but not executed in this workspace; the production API dependencies are absent from the active checkout. The fulfillment emulator test exercises the signature/ledger grant seam but bypasses the production handler's Stripe catalog and line-item validation, and there is no valid live delivery evidence. The recovered source is still outside active `main`. The last production Firestore audit also found a recursive public client read/write rule, so customer wallet paths remain exposed to direct client mutation unless that ruleset is safely replaced. No Stripe events, charges, customer records, or production data were changed or read in this phase.

**Phase 84 result:** the source shows a thoughtful server-side verification and deduplication design, but actual production fulfillment is not verified and financial integrity is not ready to claim. Preserve the handler; reconcile it with active `main`, add an end-to-end emulator test covering price/catalog validation and the webhook route, and resolve the Firestore client-rule exposure before release.

### Phase 85 wallet-ledger source review — 2026-11-12

The recovered production ledger uses Firestore transactions to update the wallet summary and append typed purchase, promotional-grant, reservation, settlement, or release records atomically. Idempotency keys are hashed with the account UID; purchases are additionally deduplicated by Checkout session to support legacy event-keyed receipts. Reservations consume promotional credits first, prevent concurrent overspend, and can be settled within the reserved amount or released. `reconcileFailedReservation` checks uncertain reserve outcomes and avoids releasing credits after a successful result or lost lease. The test suite includes duplicate grants, test/live wallet isolation, missing or corrupt summaries, concurrent reservations, settlement limits, releases, and ambiguous-reservation recovery.

Two gaps prevent calling this authoritative in production: `readWallet` trusts a valid-shaped materialized balance without reconciling it against transaction totals, and the last verified production Firestore rules allowed public client writes to wallet and transaction paths. The source also remains outside active `main`. Tests were inspected but not run; no wallet records or balances were read or changed.

**Phase 85 result:** the recovered source contains a substantial server-side ledger and reservation-recovery implementation, but the production trust boundary and reconciliation path remain unresolved. Preserve the implementation; first secure the Firestore client rules and reconcile the source branch, then run the guarded emulator tests and add a ledger-to-summary consistency/recovery test before claiming authoritative balances.

### Phase 86 subscription source review — 2026-11-12

The recovered webhook updates Premium state on Checkout completion, subscription created/updated/deleted events, and `invoice.paid`. It checks the allowlisted Premium price and stores live/test membership separately. Event timestamps prevent older updates from replacing newer ones. The browser model checks `accessUntil` and fails closed for expired dates, but entitlement is only presentation-side: membership is read directly from Firestore, and no server-side Premium authorization middleware or route was found. The last verified public write rules therefore let clients alter their own membership record.

Lifecycle gaps remain: the server writes `tier: premium` for `trialing`, while the client entitlement helper allows only `active`; a refund is recorded for manual review without revoking membership; `invoice.payment_failed` is not handled directly; and no live event-delivery configuration or lifecycle sequence was verified. The recovered client membership-model tests passed 7/7; the backend Firestore membership test was inspected but not run. No subscription or customer records were read or changed.

**Phase 86 result:** source-level lifecycle handling exists, but activation-through-expiration behavior is not verified in production and the client-editable entitlement state is not a secure Premium control. Resolve the trial/refund/failure policies, protect membership writes, and enforce Premium on trusted server operations before treating this phase as complete.

### Phase 87 owner-access hardening — 2026-11-12

The verified source had only two owner API routes, and both used Firebase ID-token middleware plus an owner guard. However, the middleware set its owner flag from a verified email allowlist and ignored the signed `zioncoreOwner` custom claim; the browser navigation helper also ignored its claim argument. I changed the isolated branch `agent/phase-87-owner-claims`, based on the verified production commit, so server authorization requires the Firebase-verified UID, the signed owner claim, verified email, and the existing allowlist. The browser hides the admin link unless the claim is true. No claim-setting endpoint was added.

Six pure server/UI access tests pass, and the four changed pure access modules typecheck. Updated Firebase middleware integration tests were not run because Firebase Admin dependencies are absent from the active workspace. The claim state for both approved identities was not checked. No live owner identity was used, claims were not assigned, and the isolated branch was not merged or deployed.

**Phase 87 result:** owner access is hardened in an isolated, reviewable source branch; active `main` and production have not changed. Verify the existing owner token claim and run the full middleware/route tests before integrating. Do not assign or change claims without the owner's separate approval.

### Phase 88 owner metrics accuracy — 2026-11-12

Audited the production-source owner dashboard without querying live account or payment records. Its account totals use Firebase Authentication; Firestore supplies connection status and bounded AI job economics; Stripe supplies balance-transaction aggregates and webhook endpoint configuration; provider values report configuration only; process metrics come from the API runtime. The UI already distinguished most unavailable and partial sources.

Fixed one concrete mismatch in isolated branch `agent/phase-88-dashboard-metrics`, based on the verified production commit: a successful, complete Stripe scan with no payments now displays zero, unavailable/disabled sources remain unavailable, and truncated scans do not claim a confirmed zero. Observed totals from truncated scans are marked as lower bounds. Six focused tests pass, and focused TypeScript checking of the changed dashboard/helper passes. Full project typechecking remains inconclusive because the isolated worktree reused main's generated API dependency and produced unrelated version/type errors. No live data was queried; this branch has not been merged or deployed.

**Phase 88 result:** source-level metric reporting is clearer and better tested; live metric accuracy has not been confirmed in production.

### Phase 89 paid-processing safeguards — 2026-11-12

The recovered source already checks signed account-bound quotes and wallet balances, reserves credits before provider calls, settles only after a valid report, uses idempotent recovery, and applies bounded payloads plus per-user cooldown/concurrency guards. The standard route allows one request per UID per 15 seconds and four concurrent jobs per process; the opt-in audio route uses 30 seconds and two concurrent jobs. These guards are process-local, not durable cross-instance quotas.

Added a required checkbox bound to the active signed quote before paid interpretation or optional audio review can start. Added structured warnings when a request is blocked by workload limits and when completed provider usage lacks a cost estimate. Fourteen existing quote/pricing/guard tests and one new confirmation test pass; the confirmation helper typechecks. The full credit-ledger test could not run because Firebase Admin is missing from this workspace. Persistent shared quotas and delivered alerts still need a storage/alert destination and approved per-service limits; I did not invent a daily cap or create a new Firestore collection.

**Phase 89 result:** the explicit confirmation and alertable log signals are prepared in isolated branch `agent/phase-89-cost-guards`; active `main` and production are unchanged. Cross-instance quotas, external alert delivery, and full API verification remain unfinished.

## Change and data safety

- No production web publish, Firestore rules deployment, Stripe write, test charge, or customer-data read was performed during this inventory.
- The only production Firebase setting change previously made was disabling Firebase AI Logic App Check enforcement under the owner's instruction.
- Keep the current source and deployment references as the baseline. Do not treat production-only bundle routes as recovered source or replace the API with duplicate handlers.
- Task 2, “Finish connecting Firebase so cloud history and AI work,” remains in progress until production App Check, rules compatibility, signed-in owner access, and AI/quota behavior are verified.
