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
