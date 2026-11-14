# Firebase setup notes

This code targets the existing Firebase project `ethereal-throne-b20e6`. It does
not create a project, enable services, change console settings, or deploy rules.

## Verified live configuration (read-only, 14 November 2026)

- The project uses the existing Firebase project `ethereal-throne-b20e6`.
- Email/password and Google Authentication are enabled. Apple is enabled in
  Firebase but its client ID and secret are not configured.
- `zioncore.replit.app` and the current task preview hostname are authorized.
- Development and Production have distinct Firebase web App IDs and distinct,
  hostname-restricted reCAPTCHA Enterprise site keys. Both environment scopes
  target `ethereal-throne-b20e6`; values are intentionally not recorded here.
- The Shared scope still contains a duplicate
  `VITE_FIREBASE_APPCHECK_SITE_KEY`. Do not remove any key until the separate
  Development and Production values are confirmed; the supported secret
  controls do not allow this agent to delete Shared secrets.
- The published JavaScript bundle previously inspected used the Development
  App ID with the Production key, despite the Production environment holding
  the Production App ID. The web source now initializes its own named Firebase
  app and rejects a same-project app with a different web App ID; it no longer
  reuses the main site's default Firebase app. This source change is not
  published.
- A properly paired headless token exchange returned a retryable attestation
  failure. A valid token from a normal browser is still unverified.
- App Check enforcement remains disabled for Firestore, Identity Toolkit, and
  Firebase ML. Do not enable enforcement until the corrected production build
  obtains a valid token in a normal browser.
- The deployed Firestore rules were confirmed to contain a project-wide public
  read/write grant. Do not deploy a replacement until the complete path map,
  merged candidate, and owner approval are in place.

Firebase Admin read-only checks use the existing server-side service-account
credential. Never place it in the browser, print it, or store it in a file.

## Web app and AI setup

Set the public Firebase web configuration and the environment-specific
reCAPTCHA Enterprise site key through Replit environment settings. Keep
Development and Production values separate. The environment key
`VITE_FIRESTORE_CLIENT_ACCESS_APPROVED` must remain `false` until the candidate
rules are reviewed and the production App Check token exchange is verified.
Never use a service-account key or Admin SDK credential in the browser.

The main ZionCore app sends derived measurements to the authenticated API
server for AI analysis; it does not call Firebase AI Logic directly. Raw audio
is sent only through the separately consented, bounded audio-review flow.

The model call is opt-in and requires at least three seconds of live capture. It
sends the validated sample rate, FFT size, resolution, dominant frequency,
spectral peaks, relative RMS, spectral shape, harmonicity, and recent temporal
movement. It never sends audio, full spectrum bins, or observation notes.

## Firestore rules safety

`firestore.rules` is the isolated Phase 101 merged candidate for this shared
Firebase project. It supports both observation clients, read-only access to a
customer's own current membership record, and server-only billing, wallet, and
AI-job data. Unknown and legacy roots default to denied client access.
**This candidate has not been deployed.** Firestore rules are project-wide;
publishing them replaces the complete active ruleset. Keep the broad deployed
grant in mind when reviewing the exact diff, preserve Firebase Admin access
through IAM, and obtain owner approval before deployment.

To run the local rules tests, use the artifact's `test:rules` command. It uses
the demo project ID `demo-zioncore-frequency-lab` and the local Firestore
emulator; it does not contact the real Firebase project.
