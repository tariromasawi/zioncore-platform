# Firebase setup notes

This code targets the existing Firebase project `ethereal-throne-b20e6`. It does
not create a project or deploy production rules.

## Inspected Firebase configuration

The live project was inspected using the existing service account through ADC.

- Email/Password authentication is enabled. Google OAuth is enabled with
  provider credentials configured; the existing owner account is still linked
  only to password sign-in until its owner completes the Google link flow.
- Apple is marked enabled in the project, but its provider configuration has no
  client ID or client secret, so Apple sign-in is not ready.
- The production hostname and the current Replit preview hostname are both
  authorized for Firebase Auth redirects. The preview hostname was added
  without removing any existing domains.
- The project has separate development and production web app registrations.
  Replit's `development` and `production` environments now use their matching
  Firebase app IDs and distinct reCAPTCHA Enterprise keys. Do not put either
  App Check site key in the shared environment.
- The development App Check key is restricted to the Replit preview hostname
  and its token exchange succeeded in a 402px mobile-sized browser.
- The production App Check key is restricted to `zioncore.replit.app`. No
  production app was published or deployed during this work.
- The web client supports Google sign-in and linking. Linking while signed in
  preserves the current Firebase UID and its existing custom claims. The
  project does not expose owner dashboard routes in the current API source.
- A synthetic AI request reached `gemini-3.5-flash-lite`, but returned
  `RESOURCE_EXHAUSTED` because Gemini Developer API prepayment credits are
  depleted. Do not add credits, link billing, or change the model without
  approval.

## Latest read-only recheck — 2026-11-10

- ADC access using the existing service-account secret reached
  `ethereal-throne-b20e6`. Both development and production app IDs match
  registered Firebase web apps. Each environment's App Check site key matches
  that app's `RecaptchaEnterpriseConfig`; the development key allows only the
  current Replit preview hostname, and the production key allows only
  `zioncore.replit.app`.
- The published homepage bundle does **not** match that safe environment
  split: it contains the development Firebase App ID together with the
  production App Check key. The published homepage did not issue an App Check
  token-exchange request during a 15-second load. The last observed exchange
  failure remains HTTP 403 `PERMISSION_DENIED` — `App attestation failed`.
  Therefore, production token exchange is not confirmed; do not enforce
  Firestore or Authentication App Check yet.
- The published navigation includes Messages and Devices pages that are absent
  from the current workspace UI. This further confirms the production build
  cannot be treated as the current workspace build or used to infer all
  production Firestore callers.
- Current App Check service modes are Firebase AI Logic (`firebaseml.googleapis.com`)
  `UNENFORCED`, Firestore `UNENFORCED`, and Authentication `UNENFORCED`. Firebase
  AI Logic was changed from `ENFORCED` to `UNENFORCED` under the owner's
  instruction to keep enforcement off until token exchange is verified; a
  read-back confirmed the new mode. This removes an abuse-control layer for AI
  calls and may increase usage risk. No Firestore or Authentication enforcement
  mode was changed.
- The live Firestore release still contains a project-wide public
  `allow read, write` rule and six public legacy-root rules. The local candidate
  denies those roots and every other unclassified path. The emulator rules
  suite passes, including owner-path access, unauthenticated/cross-account
  denial, and rejection of unclassified paths. This does not prove compatibility
  with the unclassified production roots or external callers.
- No Firestore rules or production app bundle were changed. The production
  bundle must be rebuilt with the production Firebase App ID and provider
  configuration, then its token exchange must be verified before enforcement
  is re-enabled. Publishing remains subject to the owner's approval.
- Browser Firestore access now stays disabled unless
  `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` is explicitly set for that
  environment. Keep it false until the merged rules have been reviewed,
  deployed, and verified against real app paths, and App Check token exchange
  has succeeded. This client-side gate does not change Firebase rules.

## Before changing Firebase settings

1. Check which Firebase web app ID is active in the target Replit environment.
2. Keep development and production Firebase app IDs and App Check site keys
   separate. Never use the production key for the temporary Replit preview.
3. Check App Check token exchange before enabling enforcement for Firestore or
   Authentication. Firebase AI Logic currently has App Check enforcement.
4. Set public web configuration in the matching Replit `development` or
   `production` environment using the names in `.env.example`. Never use a
   service-account key or Admin SDK credential in the browser.

The model call is opt-in. It sends only sample rate, FFT size, frequency
resolution, dominant frequency, spectral peaks, relative RMS, and duration.
It never sends audio, spectrum bins, or observation notes.

## Firestore rules safety

`firestore.rules` is a local candidate for
`users/{uid}/frequency_observations/{observationId}`. It removes the
project-wide allow-all grant and all six public legacy grants, then adds
owner-only observation access. It denies every other path, rejects observation
measurement edits, and validates stored fields, ranges, each of the six
microphone peak slots, and optional bounded AI interpretations stored
separately from measured values. An owner may attach or revise an interpretation
without changing the measurement. The browser also validates values before
writes.

The live rules also grant unauthenticated read/write access to all descendants
of `DivineTreasury`, `ZionLattice`, `SovereignPatents`, `advancements`,
`soul_signatures`, and `petitions`. No code in this workspace references those
collections, and no customer documents were read. Their purpose and any
external production dependencies remain unverified. The local candidate denies
client access to those roots until their data and required permissions can be
classified.

A metadata-only listing of root collection IDs returned an empty list. No
document IDs, document contents, or subcollections were requested. Recent API
logs show `/api/billing/catalog` and `/api/owner/firebase-diagnostics`, but the
current API source, generated bundle, and available repository refs/history
expose only health routes. The serving production revision has no reported Git
SHA to map it to source. Until that runtime/source mismatch and any external
Firestore clients are reconciled, the legacy compatibility and billing/admin
requirements cannot be verified.

To run the local rules tests, use the artifact's `test:rules` command. It uses
the demo project ID `demo-zioncore-frequency-lab` and the local Firestore
emulator; it does not contact the real Firebase project.

The active live rules make every Firestore path publicly readable and writable.
The local candidate does not expand access, but would block client access to
the six legacy roots and every other path except a user's own validated
observations. Because those legacy roots and any external production clients
are unclassified, the candidate is not verified as compatible and must not be
deployed yet. Firebase Admin SDK calls bypass Firestore rules, but any backend
authorization still needs to be verified separately. No production rules were
deployed.
