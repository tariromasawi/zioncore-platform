# ZionCore completion map

**Reviewed:** 2026-11-10
**Purpose:** Record the recoverable workspace baseline, distinguish implemented code from live production evidence, and order completion work without replacing existing systems.

See [ZionCore Vision-to-Implementation Matrix](ZIONCORE_VISION_IMPLEMENTATION_MATRIX.md) for the detailed trace from original product instructions to current and historical code.
See [ZionCore System Dependency Map](ZIONCORE_SYSTEM_DEPENDENCY_MAP.md) for entry-to-result data flows and root-cause-ranked repairs.
See [ZionCore Access and Production Alignment](ZIONCORE_ACCESS_AND_PRODUCTION_ALIGNMENT.md) for verified workspace, Firebase, environment, AI, Stripe, and deployment access findings.

## Recoverable baseline

- **Workspace:** pnpm monorepo in `/home/runner/workspace`; the worktree was clean before this inventory was added.
- **Current branch:** `main`
- **Current workspace commit:** `5b14ee79c35a5d0e8721cdfe2d9866dfe91ce81c` — `Implement lab engine updates and expand research grid documentation`
- **Other local refs:** `main-repl/main` at `55b2076`; `replit-agent` and `replit/agent-ledger` at `3338ef2`; `gitsafe-backup/main` points to the current `main` commit. No tags were found.
- **Production web:** `https://zioncore.replit.app`; Replit reports a public Autoscale deployment with a successful build. Deployment metadata reports no source commit or additional production URL.
- **Production API provenance:** API paths respond on the ZionCore production host, but no deployed Git revision or authoritative API source was found. The workspace API artifact is not a verified source for those live routes.
- **No source recovery yet:** Available branches, refs, and history contain no recoverable Messages, billing, wallet, or owner-route implementation. Do not reconstruct those routes from bundled JavaScript.

## Workspace architecture and capability inventory

| Area | What exists in the workspace | Verification / status |
|---|---|---|
| Customer web app — `artifacts/zioncore-frequency-lab` | React/Vite app with `/`, `/history`, `/history/:id`, `/history/device`, `/history/device/:id`, and `/exploration`; live browser-microphone spectrum analysis; account-scoped device history; Firebase account access; analysis panel; research experiment UI. Detail records can be exported or deleted; CSV includes saved interpretation fields. | Stage 5 typecheck, 32 unit tests, production-mode Vite build, and mobile preview passed. Firestore emulator rules tests passed in the earlier rules pass. Screenshots cover only unauthenticated preview states, not a physical iPhone or signed-in customer path. |
| Research Grid | Versioned `zc-cig-experiment/v1` experiment contract; domain/method and signal-adapter registries; normalized acoustic observations with provenance; cost/consent-aware research-agent router. | Current executable research handler is deterministic local acoustic statistics. Other listed modalities are extension points, not connected sensors, datasets, or agents. Details: `artifacts/zioncore-frequency-lab/RESEARCH_GRID.md`. |
| Instrument interface | Instrument registry and browser microphone adapter; synthetic signal adapter is development-only. | Browser microphone is the only connected physical instrument, and is uncalibrated. No specialist sensors, receiver hardware, or physical transmitter is connected. |
| Local and cloud history | Account-local observations use UID-specific browser storage; the legacy signed-out browser archive is preserved separately. Firebase Auth and a Firestore observation client target `users/{uid}/frequency_observations`. | Local storage is not encrypted. Browser Firestore calls require an explicit `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` opt-in and are paused by default. The current production rules remain public and compatibility is unverified; do not store sensitive records in Firestore or browser storage. |
| Authentication | Email/password and Google redirect sign-in/linking; auth-state listener; password reset. Google linking is designed to preserve the signed-in UID. | Google is enabled in Firebase. The existing owner account remains password-only until the owner links Google. No owner session was used to verify the flow. Apple credentials are absent, so Apple sign-in is not ready. |
| AI interpretation | Opt-in Gemini request receives bounded measurement summaries, not raw audio, spectrum bins, or observation notes. | The last live model request returned `RESOURCE_EXHAUSTED` because Gemini prepayment credits were depleted. AI output is unavailable until an owner-approved quota/billing action. |
| API server — `artifacts/api-server` | Express 5 app with CORS, JSON parsing, shared health route, and `/api/healthz`. | Source registration contains only `GET /api/healthz`. It does not contain the live production billing, wallet, owner, messaging, or webhook handlers. |
| API/database scaffolding | OpenAPI-derived client/Zod packages and Drizzle/Postgres workspace packages. | Current API specification describes health only; the Drizzle schema is a placeholder with no application tables. No application database contract or migrations were found. |
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
| Billing checkout and portal | Browser bundle references these paths; HEAD returned 404. | They may be POST-only. No POST was sent because it could create a checkout session. |
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
- The current workspace API source registers only `GET /api/healthz`; it has no Plans page, Checkout, wallet, subscription-entitlement, or webhook implementation. The production Plans/Checkout source was not recovered, so those routes cannot be safely repaired or verified from this fork.

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

## Change and data safety

- No production web publish, Firestore rules deployment, Stripe write, test charge, or customer-data read was performed during this inventory.
- The only production Firebase setting change previously made was disabling Firebase AI Logic App Check enforcement under the owner's instruction.
- Keep the current source and deployment references as the baseline. Do not treat production-only bundle routes as recovered source or replace the API with duplicate handlers.
- Task 2, “Finish connecting Firebase so cloud history and AI work,” remains in progress until production App Check, rules compatibility, signed-in owner access, and AI/quota behavior are verified.
