# ZionCore Phase 5 — Production Service Inventory

**Scope:** Read-only source, configuration-presence, integration-status, and endpoint inventory as of 2026-11-11. This is not proof that every external service is operational.

## Service map by source line

| Service | Main-source candidate (`d4be0c7`) | Research-lab task source (`7be5bc1`) | Live evidence / limitation |
|---|---|---|---|
| Firebase Authentication | Email/password, Google, and Apple provider code. | Email/password and Google provider code. | Client source is present. Firebase project providers, authorized domains, and actual sign-in are not confirmed; no Firebase integration connection is available here. |
| App Check | Web client initializes reCAPTCHA Enterprise when a site key is present; token retrieval is best-effort for API headers. | Web client requires App Check plus an explicit client-access approval flag before marking cloud history/AI ready. | Site-key secret presence appears in both Development and Production environment views, but those views include Shared values. Distinct scoped keys and successful token exchange are not verified. No enforcement setting was changed. |
| Firestore | Client cloud observations; repository rules also define membership, wallet, credit transactions/reservations, and AI jobs. Financial/job records are denied to direct client reads and writes in the checked-in candidate rules. | Client cloud observations; checked-in rules cover the user observation path. | The live project rules were not inspected. Checked-in rules must not be represented as deployed rules. |
| Firebase Admin | Server source parses `FIREBASE_SERVICE_ACCOUNT_JSON` and initializes Admin SDK for `ethereal-throne-b20e6`. | No Firebase Admin routes/services beyond the health server. | The secret is present, but no live Firebase control-plane access or IAM permission was verified. |
| Stripe | Server catalog, checkout, customer portal, signed webhook, wallet fulfillment, and membership handling. | No Stripe routes or billing implementation in this task API. | Stripe MCP connection is `ready`. The public catalog endpoint returned 200. Active price IDs, checkout completion, webhook delivery, and entitlement fulfillment were not tested. |
| AI | Server-side Gemini with OpenAI fallback, usage accounting, and bounded interpretation/audio routes. | Browser Firebase AI Logic using `GoogleAIBackend` and model `gemini-3.5-flash-lite`; authenticated request and App Check readiness are required. | Provider-secret names are present, but no live model call, quota, or billing test was made. Model availability is unconfirmed. |
| Object storage | API uses Replit's Google Cloud Storage-compatible App Storage client for curated resonance audio/visual assets. | No App Storage client or upload route. Observations and research sessions use browser storage; cloud observations use Firestore. | Bucket-ID secret is present in environment views. Object access and user-upload storage were not tested; customer recordings are not shown as uploaded by the task source. |
| Scheduled work | Production-only server timer removes expired AI interpretation retry jobs every 15 minutes, with an initial run at startup. | No scheduled server job found. | Source-only confirmation; production execution was not independently observed. |
| Deployment | Candidate config declares a static web build plus a separate API service on `/api`; API health path is `/api/healthz`. | Same artifact pattern, but its API router only registers health. | Current Replit deployment metadata reports public Autoscale and successful build at `https://zioncore.replit.app`. Exact source commit remains unverified. The task preview is a `.spock.replit.dev` preview, not a stable second production URL. |

### Environment-secret visibility

Presence-only checks found the Firebase service-account, App Check, Gemini/OpenAI, Storage bucket, and Stripe test/live secret names in the Development and Production views. The secret values were not read. Because each view includes Shared secrets, this does **not** establish that Development and Production have separate values; in particular, the production/preview App Check-key split and live/test Stripe-key split still need scope-level confirmation.

## Main candidate API surface

The candidate API is mounted under `/api`. The list below is from checked-in route registration; authorization labels are from source middleware.

| Method and path | Access boundary | Production probe |
|---|---|---|
| `GET /api/healthz` | Public health | 200 |
| `GET /api/billing/catalog` | Public catalog | 200 |
| `POST /api/billing/checkout` | Firebase-authenticated customer | Not invoked; creates a checkout session |
| `POST /api/billing/portal` | Firebase-authenticated customer | Not invoked |
| `GET /api/wallet` | Firebase-authenticated customer | 401 without credentials |
| `GET /api/wallet/transactions` | Firebase-authenticated customer | 401 without credentials |
| `GET /api/ai/interpretation/pricing` | Public pricing information | 200 |
| `GET /api/ai/interpretation/quote` | Firebase-authenticated customer | Not probed |
| `POST /api/ai/interpretation/recover` | Firebase-authenticated customer | Not invoked |
| `POST /api/ai/interpretation` | Firebase-authenticated customer | Not invoked; can consume paid AI service |
| `GET /api/ai/interpretation/audio-quote` | Firebase-authenticated customer | 401 without credentials |
| `POST /api/ai/interpretation/audio` | Firebase-authenticated customer | Not invoked; can consume paid AI service |
| `GET /api/owner/summary` | Verified Firebase owner | 401 without owner credentials |
| `GET /api/owner/firebase-diagnostics` | Verified Firebase owner | 401 without owner credentials |
| `GET /api/resonance-audio/:assetId` | Public curated asset route | Not probed |
| `GET /api/resonance-visuals/:assetId` | Public curated asset route | Not probed |
| `POST /api/stripe/webhook` | Stripe signature verification | Not invoked; GET returning 404 is expected for this POST-only route |

The task-source API registers only `GET /api/healthz`. Its preview returned 200 for that path and 404 for the candidate's billing, wallet, owner, and AI pricing paths. Thus, those services are not connected to the task preview API.

## Important distinction: source vs production

- The live catalog, public AI pricing, and health routes respond. Unauthenticated customer wallet and owner diagnostics requests are rejected, which is consistent with the source access controls.
- A 200 on a single-page-app URL may be a fallback HTML response; it does not establish that a page or API feature works.
- The source candidate is the best-supported description of the main app, but the deployment's exact source revision is unknown.
- No production Firestore/App Check settings, Stripe product records, model inference, Storage object, or scheduled-job execution were read or changed in this inventory.

## Phase 5 blockers and follow-up

1. **Firebase:** The service-account secret exists, but authorized live project access is not yet verified. Inspect deployed Auth providers, App Check registration/enforcement state, Firestore rules, and token exchange before enabling cloud history or AI.
2. **Environment separation:** Confirm separate preview and production App Check configuration and appropriate test/live Stripe scopes without printing values.
3. **Billing and AI:** Read active Stripe products/prices and perform non-charging/test-mode flow checks before asserting checkout or model availability.
4. **Storage and jobs:** Confirm App Storage access and observe production cleanup health before relying on either.
5. **Deployment source:** Obtain owner-visible build history that maps the serving deployment to a commit.

No credentials were exposed, no external service was modified, no payment or AI operation was initiated, and no production deployment was made.
