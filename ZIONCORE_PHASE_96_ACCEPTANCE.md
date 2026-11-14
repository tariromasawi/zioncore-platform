# ZionCore Phase 96 — End-to-end acceptance

**Checked:** 12 November 2026  
**Branch:** `agent/phase-92-integration`  
**Result:** Local acceptance passed; production acceptance remains gated.

## Local verification

The repository release gate completed successfully:

| Check | Result |
| --- | --- |
| Workspace TypeScript checks | Pass |
| Main-app unit tests | 225 passed |
| API unit tests | 102 passed |
| Tooling tests | 10 passed |
| Firebase Auth emulator | Client 2 passed; API 1 passed |
| Firestore rules emulator | 11 passed |
| Wallet, Stripe fulfillment, and recovery tests | 19 passed |
| API production build | Pass |
| Main web production build | Pass |

The separate ZionCore 2nd implementation also passed 34 unit tests, 7 Firestore emulator rules tests, and a production build with its required `PORT` and `BASE_PATH` inputs. Built-preview route checks returned HTTP 200 for the main app’s `/`, `/messages`, `/devices`, `/premium`, `/history`, `/dashboard`, and `/owner` routes and for `/zioncore-2nd/`.

Coverage includes local message encoding/decoding, account sign-in and sign-out against the Auth emulator, private-path rules in the Firestore emulator, wallet and subscription fulfillment logic, checkout-mode safeguards, and owner-access/dashboard services. Route checks confirm SPA entry points load; they are not interactive browser tests.

## Production journeys not verified

- Real Google sign-in, Apple sign-in, and customer account persistence were not exercised. Emulator tests do not prove the live identity-provider flow; Apple provider configuration still requires credentials.
- Customer history was not read through the browser SDK. The successful Phase 95 Admin read bypasses Firestore Security Rules and does not prove customer isolation.
- Production Firestore rules remain globally permissive and unchanged. Do not enable browser history writes until a compatibility-reviewed secure ruleset is approved and deployed.
- App Check still has no confirmed production token: the published bundle uses the Development App ID with the Production key, and the correctly paired headless exchange returned retryable HTTP 401. Enforcement remains off.
- No live Stripe checkout session, payment, or subscription was created. Unit and emulator tests do not verify live catalogue configuration or post-payment behavior.
- No production deployment, Firebase rule, credential, customer record, or billing configuration was changed.

## Corrections made for the acceptance gate

The checks first exposed a missing required Genesis section field and four failing AI prompt contract tests. The source seed itself was retained. Runtime prompt assembly now uses a compact identity summary instead of injecting the oversized declaration into each request, keeps faith reflection opt-in, and avoids asking the model to invent prophecy or source claims. The final frontend suite passed all 225 tests, and the repository release gate passed.

## Gate to continue

After owner approval, build the production app with its registered Production App ID, verify App Check token exchange in a normal browser before enabling enforcement, and complete customer-facing private-history tests only after secure production rules are approved. Live payment verification requires an explicitly approved Stripe test-mode flow; no real charge was attempted.
