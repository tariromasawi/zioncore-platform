# ZionCore Phase 15 — App Check failure-path tests

**Date:** 2026-11-11  
**Scope:** Read-only Firebase token-exchange probes plus local client error
handling tests. No customer data, Firestore writes, AI requests, or enforcement
changes.

## Token-exchange results

Requests used the registered Development web app and Firebase's App Check token
exchange endpoint:

| Case | Result |
| --- | --- |
| Missing reCAPTCHA token | HTTP 400 `INVALID_ARGUMENT` — `The recaptcha_enterprise_token cannot be empty.` |
| Invalid reCAPTCHA token | HTTP 403 `PERMISSION_DENIED` — `App attestation failed.` |
| Valid token | **Not verified.** The headless browser's exchange POST returned HTTP 403; no valid token was obtained. |

Firebase AI Logic, Firestore, and Authentication are currently all
`UNENFORCED`. Therefore these probes validate the App Check exchange endpoint,
not enforcement behavior on those services. No request was sent to Firestore or
AI. A valid token and an accepted-token customer request remain unverified;
the production bundle's Development-App-ID mismatch must be corrected before
production verification.

## Client feedback and checks

The lab now distinguishes an App Check attestation failure from a general
permission denial. Its messages direct users to check the environment's Firebase
App ID, reCAPTCHA key, and hostname without falsely claiming enforcement is
enabled. Cloud-history failures also state that local observations remain
unchanged.

- Unit tests: **36 passed**
- TypeScript typecheck: **passed**
- Preview restarted and loaded at mobile viewport.

No secrets or token values were read or included. No production build, Firebase
settings, rules, enforcement modes, or customer data were changed.
