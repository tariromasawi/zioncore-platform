# ZionCore Stage 4 — Access and Production Alignment

**Evidence date:** 2026-11-10
**Scope:** Workspace Git access, Replit deployment metadata, production secret-presence metadata, production read-only HTTP checks, the existing Firebase diagnostics function, one authorized isolated Firestore create/read/delete probe, and one minimal Google Gen AI request. Secret values were never printed or stored.

## Access inventory

| Subsystem | Current result | Evidence boundary |
|---|---|---|
| Replit deployment | Active public Autoscale deployment at `https://zioncore.replit.app`; deployment service reports a successful current build. | Deployment metadata does not report the deployed Git SHA, so the active build cannot be matched to the current dirty workspace. No publish was performed. |
| Workspace Git | Branch `main`, HEAD `fc469ba23fb54b3c3f165b40089a0f264db320d5`; working tree is dirty. `gitsafe-backup` is readable and its `main` points to the same commit. | `subrepl-shared` could not be verified because SSH host-key trust is unavailable in this workspace. No host key was accepted and no push was attempted. Two GitHub integration choices are marked authorized-but-not-attached; they were not needed for read access to the existing backup remote. |
| Replit connectors | Stripe MCP is ready for agent-side use; the Stripe API connector and two GitHub API choices are authorized but not attached. No Firebase or Gemini connector was returned by integration search. | The application does not depend on MCP. The production catalog request verified the app-side Stripe path; the app’s Gemini path uses its own configured Google key, while Replit Gemini/OpenAI integration variables are also present. |
| Firebase production secret presence | Production secret metadata reports `FIREBASE_SERVICE_ACCOUNT_JSON` and `VITE_FIREBASE_APPCHECK_SITE_KEY` present. | Values were withheld. Presence alone does not prove that the deployed API process loaded the same value. |
| AI secret presence | Production secret metadata reports `GOOGLE_GENAI_API_KEY`, both Gemini integration variables, and both OpenAI integration variables present. | Values were withheld. Production provider execution is separately distinguished below. |
| Stripe and billing secret presence | Production secret metadata reports the live/test secret and webhook-secret entries present. | Values were withheld. The app’s own production catalog endpoint, not the agent MCP account, was used for the application-level check. |
| Object storage and session secrets | Production secret metadata reports `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, and `SESSION_SECRET` present. | Values were withheld. |
| Firebase Admin identity | Existing workspace process credential resolves to `zioncore-firebase-cli@ethereal-throne-b20e6.iam.gserviceaccount.com`, project `ethereal-throne-b20e6`, default database `(default)`. | This was the real Firebase project and intended service-account principal, exercised from a workspace process (`NODE_ENV` was `other`), not from the deployed API runtime. |
| Firebase effective access | `testIamPermissions`: entity get/list/create/update/delete and index-list all returned granted. The cleanup query returned `pass`; the `expiresAt` collection-group index returned `ready`. | Read-only checks against the real Firebase project. No customer records were returned or changed. |
| Firebase controlled write probe | A uniquely named document in `zioncore_diagnostics` was created, read back, deleted, and verified absent. | One non-customer document only; no customer records, balances, jobs, or financial ledgers were touched. This was explicitly authorized in the prior Firebase directive. |
| Google Gen AI | One real minimal request using `@google/genai` and `GOOGLE_GENAI_API_KEY` succeeded on `gemini-3-flash-preview`; response matched `OK` (8 prompt tokens, 1 output token). | Executed from the workspace process, not through the deployed interpretation API. It proves the key/model worked there; it does not independently prove the deployed API runtime can make a request. |
| OpenAI | Production secret metadata is present and the API source includes its provider/fallback path. | No OpenAI request was made in this audit. |

## Production HTTP evidence

| Request | Result | What it proves |
|---|---|---|
| `GET /` | 200 | The deployed web origin returned its page. |
| `GET /api/healthz` | 200, `{"status":"ok"}` | The deployed API health route is reachable. |
| `GET /api/billing/catalog` | 200; `checkoutEnabled=true`, `portalEnabled=true`; every returned offer is purchasable. | The production application’s own Stripe client read the current live catalog. The catalog matches the approved schedule: 250/£2.50, 500/£5, 1,050/£10, 2,750/£25, 5,750/£50, and Premium £1/month. The server code selects live prices and checks the live checkout/tax approval gates. No checkout session or charge was created. |
| `GET /api/owner/summary` without a token | 401 | Owner data is not public. |
| `GET /api/owner/firebase-diagnostics` without a token | 401 | Firebase diagnostics are owner-authenticated. |
| `GET /api/ai/interpretation/quote` without a token | 401 | Private AI quote service requires Firebase identity. |
| `POST /api/stripe/webhook` without a signature | 400, “Missing Stripe signature.” | The deployed route rejects unsigned webhook calls. This is not a successful webhook-delivery test. |
| `GET /api/resonance-visuals/dove-circuit` | 200, JPEG, 544,899 bytes | One production visual was successfully served through the app’s object-storage path. It does not prove every asset or backup is healthy. |
| Production web bundle | HTTP 200; the approved Firebase project ID was found in its JavaScript bundle. | Confirms the published web client is configured for `ethereal-throne-b20e6`; no public API key or credential value was printed. |

## Workspace correction applied

Root `firebase.json` now references both:

- `artifacts/zioncore-frequency-lab/firestore.rules`
- `firestore.indexes.json`

The JSON parses and both referenced files exist. This repairs the repository’s Firebase CLI rules-path omission. **It is workspace-only:** no rules, indexes, IAM, or other Firebase production settings were deployed or changed.

## Remaining production checks and owner action

1. The production owner endpoints correctly returned 401 without a Firebase user token. To verify the deployed API runtime (rather than the workspace process), sign in at `https://zioncore.replit.app/admin` using an approved owner account and choose **Firebase check → Run check**. Share the sanitized result; do not share an ID token or credentials. The result should identify runtime as `production`.
2. The production Google and Apple sign-in journey, the customer-owned browser Firestore Rules path, and live customer profile/navigation behavior still require an authenticated real-user browser session. Admin SDK access does not test browser Security Rules.
3. The Gemini request tested the workspace environment. The production secret is present, but a deployed-runtime provider request remains unverified until it runs through the production service under its normal authenticated flow.
4. Stripe live catalog access and checkout configuration are verified. A real Checkout payment, signed webhook fulfillment, wallet grant, subscription entitlement/renewal/cancellation, and paid AI job were not performed; no charge was made.
5. Git read access is confirmed through `gitsafe-backup`. Push access was not tested. The internal `subrepl-shared` remote remains unverified until its SSH host key is trusted through the supported Replit setup.
6. Production Firestore Security Rules were not fetched from the Firebase Rules service. The newly mapped repository rules file should be compared with the deployed rules before any rules deployment.

## Safety record

- No credentials, tokens, private keys, secret values, customer records, or payment details were printed or saved.
- No IAM roles, Firebase rules/indexes, Stripe products/prices, customer balances, or production deployment were changed.
- The only production data mutation was the approved single-document diagnostic create/read/delete test in `zioncore_diagnostics`; the document was verified absent afterward.
- No live charge or subscription was created.
