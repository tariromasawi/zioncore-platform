# Firebase setup notes

This code targets the existing Firebase project `ethereal-throne-b20e6`. It does
not create a project, enable services, change console settings, or deploy rules.

## Verified live configuration (read-only, 16 November 2026)

- The existing Firebase project is `ethereal-throne-b20e6`. The service-account
  credential's project ID matched this project.
- Email/password and Google Authentication are enabled. Apple is enabled as an
  identity provider, but its client ID and secret are not configured.
- `zioncore.replit.app` and the current task preview hostname are authorized.
- The Development App ID matches the registered preview web app, and the
  Development App Check key matches that app's preview registration. The
  Production environment App ID matches the registered production web app:
  `1:635097760381:web:c718ecaac8b0b21de56714`. The production site's currently
  deployed JavaScript instead uses the preview app
  `1:635097760381:web:4d796bbbdb94f181e56714`, while its reCAPTCHA Enterprise
  key is registered to the production web app and restricted to
  `zioncore.replit.app`. Therefore the deployed App ID/key pair does not match.
  No production deployment was made during this check.
- The preview App Check registration uses a separate reCAPTCHA Enterprise key
  restricted to the task preview hostname. Site-key values are intentionally
  not recorded here.
- The Shared-scope `VITE_FIREBASE_APPCHECK_SITE_KEY` still exists. It was not
  deleted or changed: the available secret controls expose presence, not secret
  values, and do not provide a secret-deletion operation. The effective
  Development value was compared in memory with the preview registration and
  matched; the production bundle's embedded key matches the production
  registration. No key value is recorded here.
- App Check enforcement is `UNENFORCED` for Firestore, Identity Toolkit, and
  Firebase ML. Keep enforcement disabled until a valid token is obtained from
  the correctly paired production web app in a normal browser.
- A valid App Check token exchange has **not** been confirmed. The development
  preview page loaded without a browser-console error, but that capture did not
  request a token or call a protected API; it is not evidence of attestation.
- A Firestore REST read of an intentionally nonexistent document returned
  `404 NOT_FOUND` (not `PERMISSION_DENIED`); no document data was returned.
  The service account was used in memory and no credential file was written.
- The active Firestore release is `cloud.firestore`, ruleset
  `978e0632-d337-4c37-a467-2c656d537e09`, source SHA-256
  `e146215c755d3e2e6d59e7be027734b6c40c4891d6cd5eaeaa45a69aba14c9a6`.
  It does **not** contain a project-wide public read/write grant. It permits
  public reads only for `SovereignPatents` and `advancements`; writes there are
  restricted. Other paths use a recursive privileged-role rule, not per-user
  ownership rules, so normal customers cannot read or write their own cloud
  history or profiles under this ruleset. The prior note claiming a global
  public read/write grant was incorrect for the currently active ruleset.
- A read-only Firestore REST read succeeded with the existing service-account
  JSON held in memory through the documented Google Auth JWT fallback.
  Application Default Credentials were not configured in this workspace:
  Google Auth returned `Could not load the default credentials.` No Firebase CLI
  login was attempted. The API's Firebase Admin SDK also initialized with the
  existing credential and completed a read of a deliberately absent document;
  the result contained no data. The SDK emitted a nonfatal credentials
  deprecation warning.

The source still initializes a named Firebase app and rejects an App ID
mismatch. The production deployment is older than this source/environment
configuration and must be rebuilt only after the owner approves a production
release. No rules, IAM, or App Check enforcement settings were changed.

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

`firestore.rules` is a local candidate for this shared Firebase project. It
supports both observation clients, read-only access to a customer's own current
membership record, and server-only billing, wallet, and AI-job data. Unknown
and legacy roots default to denied client access. **This candidate has not been
deployed.** Firestore rules are project-wide; publishing them replaces the
complete active ruleset. The active rules include a recursive privileged-role
grant, which can overlap financial paths; because matching Firestore allows are
additive, simply appending the candidate's explicit denials would not remove that
permission. A complete legacy-path audit and a reviewed narrowing of the
privileged rule are required before a safe merge or deployment.

To run the local rules tests, use the artifact's `test:rules` command. It uses
the demo project ID `demo-zioncore-frequency-lab` and the local Firestore
emulator; it does not contact the real Firebase project.
