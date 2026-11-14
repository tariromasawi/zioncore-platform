# Firebase production review — 12 November 2026

This is a read-only review of Firebase project `ethereal-throne-b20e6`, prepared on `agent/phase-92-integration`. No Firestore rules, App Check enforcement settings, authentication settings, production data, or deployments were changed.

## Access and authentication

The existing `FIREBASE_SERVICE_ACCOUNT_JSON` credential was used in memory with Google Application Default Credentials; its value was not printed or written to a persistent file. Read-only Firebase APIs responded successfully. The Firebase CLI itself still returned `Failed to authenticate, have you run firebase login?`; direct Firebase Management, Identity Toolkit, App Check, and Rules API requests succeeded through ADC, so no interactive CLI login was requested.

| Setting | Live result |
| --- | --- |
| Email/password | Enabled |
| Google provider | Enabled; client configuration present |
| Apple provider | Enabled, but client ID and client secret are not configured |
| Authorized domains | Includes `zioncore.replit.app` and the current Replit preview hostname |
| Development Firebase App ID | `1:635097760381:web:4d796bbbdb94f181e56714` |
| Production Firebase App ID configured in Production environment | `1:635097760381:web:c718ecaac8b0b21de56714` |

## App Check

Firebase has separate Enterprise keys registered:

- The key configured on the development App ID is restricted to the Replit preview hostname. The current Shared-scope `VITE_FIREBASE_APPCHECK_SITE_KEY` matches this development key.
- The key configured on the production App ID is restricted to `zioncore.replit.app`.
- The live production JavaScript contains the **development App ID** together with the **production App Check key**, even though the Production environment currently reports the production App ID. This is a live build/configuration mismatch.
- The earlier live-bundle pairing (Development App ID plus Production key) returned HTTP `403`, `PERMISSION_DENIED`, **“App attestation failed.”** On 12 November, a fresh test with the correct Production App ID and key from headless Chromium returned HTTP `401`, `UNAUTHENTICATED`, **“The reCAPTCHA Enterprise token indicates a failed attestation attempt, but is retryable by calling execute() via JavaScript.”** No token was issued. Headless verification does not establish whether an ordinary user browser will pass; a valid production exchange is not confirmed.
- App Check enforcement is `UNENFORCED` for Firestore, Identity Toolkit, and Firebase ML. It was left unchanged.
- `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED` is absent from both Development and Production, so the second app's browser-side cloud-history gate remains disabled.

Do not enforce App Check or remove the Shared key yet. The live production pairing needs correction and token exchange must be verified from a normal browser. The Shared key is currently the development/preview key; removing it without first adding a dedicated Development value would break preview attestation.

## Deployed Firestore rules

The active Firestore release points to ruleset `4f21202a-b142-43b0-9038-892d46299682`. Its deployed rules include a project-wide `allow read, write ... if true`, plus public grants for `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`, `soul_signatures`, and `petitions`. The root grant makes every Firestore path publicly readable and writable; the named grants are redundant.

The inspected application and API source does not reference those six legacy roots. Server Firestore access uses Firebase Admin SDK, which is authorized through IAM and bypasses client Security Rules. Unknown and legacy roots can therefore default to client-denied without changing trusted server access.

### Source-backed client/server access map

| Actual path | Customer client permissions proposed for the merged rules | Owner/admin client permissions | Trusted-server responsibility |
| --- | --- | --- | --- |
| `users/{uid}/frequency_observations/{observationId}` | Own read/list/create/delete; update only a validated interpretation and server timestamp | No direct browser-admin grant | Preserve measured records and process results |
| `users/{uid}/membership/current` | Own document get only | No direct browser-admin grant | Stripe webhook maintains entitlements |
| `users/{uid}/wallet/current` | None | None | API creates/reads wallet and performs atomic credit operations |
| `users/{uid}/credit_transactions/{id}` | None | None | API appends authoritative ledger records |
| `users/{uid}/credit_reservations/{id}` | None | None | API reserves and settles credits |
| `users/{uid}/billing/stripe` and `/events/{id}` | None | None | Billing routes and signed Stripe webhook |
| `users/{uid}/test_billing/**` | None | None | Test-only billing namespace |
| `users/{uid}/ai_interpretation_jobs/{id}` | None | None | API owns job state and processing |
| `stripe_customer_map/{mode}_{customerId}` | None | None | Stripe fulfillment lookup |
| `users/{uid}` and all unclassified paths | None until explicitly mapped | No blanket grant | Explicitly authorized migration/service access only |
| Legacy roots listed above | None | No browser grant | No current source-code client dependency found |

Owner routes use verified Firebase identity and the `zioncoreOwner` custom claim through server middleware. Customer and owner database operations remain on the authenticated API/Admin SDK boundary; Security Rules are not used to grant browser-admin access.

The current source rules already cover owner-isolated observations, membership read-only access, and financial/job records as server-only. The second app adds a bounded interpretation field and a limited interpretation-only update. A production candidate must combine those observation contracts, allow both microphone and imported-audio measurements, retain the membership and server-only rules, and remove every broad public grant.

## Verification and remaining work

- The main app's Firestore emulator rules suite passed **11/11** tests.
- The second app's Firestore emulator rules suite passed **7/7** tests, including unauthenticated/cross-account denial and denial of unclassified legacy roots.
- Firebase App Check and Firebase service status reads succeeded through ADC. No customer documents were queried.
- Firebase Admin was also initialized with the existing service-account credential; the current runtime project and service-account domain matched `ethereal-throne-b20e6`. A read of a non-customer probe document and a bounded query of its empty collection both succeeded. IAM permission testing confirmed effective entity `get` and `list` permissions as well as existing `create`, `update`, and `delete` permissions; no IAM permissions or documents were changed.
- AI integration secret presence is confirmed in Development and Production. Source uses a bounded Gemini-primary/OpenAI-fallback route and unit tests cover provider fallback for HTTP 429. No live model inference was sent, so model availability and live quota behavior remain unverified.
- Production Firestore rules remain unchanged because the later instruction explicitly prohibited modifying them before reconciliation. App Check enforcement remains off. No production publication occurred.

### Specific blockers

1. The live production bundle's App ID/key pairing is wrong. A correctly paired automated exchange returned HTTP 401 for failed headless attestation. Keep enforcement off until the bundle is corrected with approval and a normal-browser exchange succeeds.
2. The second app's cloud-history approval flag is not configured.
3. Apple sign-in lacks its provider client credentials.
4. AI secrets are present, but no authorized live model health check or inference result was obtained.
5. Production rules are still globally public. The source-backed rule matrix and emulator coverage are ready for owner review, but the production rules were not changed.

## Current read-only recheck — 2026-11-14

No Firebase project setting, production document, Firestore rule, App Check enforcement mode, or deployment was changed.

### Credential and data-access checks

- The existing server-side service-account credential initialized Firebase Admin for `ethereal-throne-b20e6`; its account domain matched that project.
- A read of a dedicated non-customer diagnostic document succeeded and returned `exists: false`. A bounded query of the same diagnostic collection succeeded with zero rows. No writes or customer-document reads were performed.
- The live Firebase Authentication configuration returned HTTP 200. Email/password is enabled, `zioncore.replit.app` and the preview host are authorized, and Google and Apple providers are marked enabled.
- Google has provider client configuration. Apple is enabled but its Apple-specific provider configuration has no client ID or private-key/secret material, so Apple sign-in remains unready.

### App Check registrations and production bundle

- Firebase App Check reads returned HTTP 200 for both registered web apps. The development app’s reCAPTCHA Enterprise key is restricted to the task preview hostname; the production app’s key is restricted to `zioncore.replit.app`. Neither key allows all domains.
- The Firestore, Firebase Authentication, and Firebase AI Logic App Check services all currently report `UNENFORCED`.
- Replit’s Development and Production environments contain distinct Firebase app IDs and distinct App Check site-key values, both targeting `ethereal-throne-b20e6`. The Shared-scope `VITE_FIREBASE_APPCHECK_SITE_KEY` secret is still present.
- A fresh fetch of the currently published JavaScript bundle found the Production App Check site key but the Development Firebase App ID. The Production environment itself is configured with the Production App ID. The published build therefore still has a mismatched app/key pair.
- No valid Production App Check token has been verified. The last recorded correct-pair headless exchange on 12 November returned HTTP 401 `UNAUTHENTICATED`: “The reCAPTCHA Enterprise token indicates a failed attestation attempt, but is retryable by calling execute() via JavaScript.” That historical response was not repeated during this read-only recheck. A normal-browser exchange must be tested after an approved production rebuild uses the correct app ID.
- Keep enforcement disabled until that normal-browser token exchange succeeds. Do not remove any Development or Production key. The only duplicate is the Shared-scope secret; the supported secret tools expose presence but do not delete secrets. If removing it, use Replit **Tools → Secrets → Shared** and remove only `VITE_FIREBASE_APPCHECK_SITE_KEY`, after confirming both environment-specific values remain in place.

### Deployed Firestore rules

- The active Firestore release is still ruleset `4f21202a-b142-43b0-9038-892d46299682`.
- A fresh read of that ruleset confirms the broad wildcard grant `allow read, write: if true` and public grants for `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`, `soul_signatures`, and `petitions`.
- No production rules were modified. These grants remain an unresolved production security risk; do not replace them until the complete production-path compatibility review is approved.

### Verification limits and next actions

- Local verification on this branch passed: API unit tests **105/105**, frequency-lab unit tests **233/233**, and TypeScript checks for both packages.
- A real signed-in customer/owner browser journey and a live AI inference/quota test were not performed. No test account, customer record, or paid operation was created.
- Before release, rebuild from the approved source with the Production App ID, recheck the production bundle, verify App Check from a normal browser, and only then consider owner-approved enforcement. Separately complete the Firestore path review and obtain explicit approval before deploying merged rules.

## Source-side repair and environment-scope recheck — 14 November 2026

- Replit's environment inspector confirmed that Development and Production each have the approved Firebase project ID, their own Firebase web App ID, and their own App Check site key. The Development and Production App IDs differ, and their App Check keys differ. The Shared scope still contains `VITE_FIREBASE_APPCHECK_SITE_KEY`; its value was not displayed.
- The prior production JavaScript bundle still shows the Development App ID paired with the Production site key. No new production build or publication was performed.
- The current source now creates/uses the lab's named Firebase app instead of falling back to another artifact's `[DEFAULT]` app, and checks both project ID and web App ID before initializing Auth or App Check. This prevents an integrated main-site Firebase instance from silently supplying the wrong App ID to App Check.
- Cloud history now remains paused unless its reviewed-rules/App-Check gate is explicitly enabled. Client deletion is disabled until an authenticated server endpoint can write an audit event. This is a source safeguard only; it does not alter live Firebase rules or data.
- Latest lab verification on the isolated branch: **424/424 unit tests passed**, TypeScript typecheck passed, and a production-mode build passed with **199,373 gzip bytes** of initial JavaScript against the existing 200,000-byte budget. The build used `BASE_PATH=/` and did not consume or verify the Production environment's secrets.
- The Shared secret's duplicate status is established, but it was not deleted. Keep Production and Development keys unchanged; if removing the duplicate, the owner must remove only `VITE_FIREBASE_APPCHECK_SITE_KEY` under Replit **Tools → Secrets → Shared**.

### Remaining Firebase blockers

1. The published bundle and source are still out of sync until an owner-approved release; no production publication was authorized.
2. A valid App Check token has not been observed from an ordinary browser on `zioncore.replit.app`. The recorded HTTP `401 UNAUTHENTICATED` from headless execution remains the last actual exchange response; the provider advised retrying `execute()` in JavaScript.
3. The registered reCAPTCHA key's hostname restriction was read from Firebase's App Check configuration, but the ordinary-browser token exchange is still necessary to prove that the current production hostname/key/app-ID combination attests successfully.
4. Production Firestore still has globally permissive deployed rules. The candidate rules remain undeployed pending the full compatibility review and separate owner approval.
5. No live AI inference/quota check was performed. Do not turn on the Firebase client AI path; the authenticated, cost-quoted backend route is the supported direction.
