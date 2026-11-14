# ZionCore Phase 95 — Firebase host and App Check recheck

**Checked:** 12 November 2026  
**Branch:** `agent/phase-92-integration`

## Production hosts

| Host/path | Current result |
| --- | --- |
| `https://zioncore.replit.app/` | Main production app |
| `https://zioncore.replit.app/zioncore-2nd/` | Same host, but currently falls through to the main app |
| Separate ZionCore 2nd production hostname | None created |

The second app does not create a distinct production hostname. If it is later routed at `/zioncore-2nd/`, the existing production host and its Firebase host configuration will apply.

## Current build versus environment

- The production environment reports Firebase App ID `1:635097760381:web:c718ecaac8b0b21de56714`.
- The live production JavaScript fetched during this phase still contains the Development App ID `1:635097760381:web:4d796bbbdb94f181e56714`.
- Comparing the published bundle to both registered reCAPTCHA site keys confirms it embeds the Production key, not the Development key.
- The root page and the proposed second-app path both serve that same main-app bundle.

## Firebase-domain evidence and freshness limitation

The existing Firebase Admin service-account path in the API server was used without displaying or writing its credential. Firebase Admin initialized against `ethereal-throne-b20e6`; the service-account identity matched that project's domain. Fresh Firebase API reads returned:

- Auth authorized domains include `zioncore.replit.app` and the task preview hostname, plus Firebase defaults and localhost.
- The Development App ID has a registered reCAPTCHA Enterprise site key allowed only on the task preview hostname.
- The Production App ID has a registered site key allowed on `zioncore.replit.app`.
- Firestore, Identity Toolkit, and Firebase ML App Check enforcement are all `UNENFORCED`.
- Effective IAM permission testing returned `datastore.entities.get`, `.list`, `.create`, `.update`, and `.delete` for the service account.

The ordinary `gcloud` ADC and OAuth login commands were not available in this shell. The Firebase Admin SDK's existing service-account credential nevertheless provided the authorized access path requested; no interactive login or new service account was needed.

## Live production Firestore reads

Two read-only checks were sent to the production `(default)` database through Firebase Admin: a document `get` against a non-customer probe path returned successfully with `exists: false`, and a bounded query against its empty collection returned successfully with zero results. No customer document was read, and no document, IAM binding, rule, index, or billing setting was changed.

## Token exchange and result

The Production key and App ID were freshly re-read, then the registered Production pair was tested from the `zioncore.replit.app` origin in headless Chromium. The POST returned HTTP `401`, `UNAUTHENTICATED`, with **“The reCAPTCHA Enterprise token indicates a failed attestation attempt, but is retryable by calling execute() via JavaScript.”** No App Check token was returned. This differs from the earlier `403 PERMISSION_DENIED` test using the live bundle's mismatched App ID/key pair. The current published bundle still contains the Development App ID, so the correct pair has not been tested by the live application itself.

## Phase result

Phase 95 is **PARTIAL**. The production hostname, authorized domains, registered key restrictions, enforcement status, service-account identity, and effective Firestore IAM permissions were freshly verified. A real Firestore read and empty query succeeded. A valid App Check token remains unverified because automated browser attestation failed and the published bundle uses the wrong App ID.

No Firebase settings, App Check enforcement, production build, or Firestore rules were changed.

**Next step:** rebuild only after owner approval so the production web app uses its registered Production App ID, then verify token exchange in a normal browser. Keep enforcement disabled until that exchange succeeds.
