# ZionCore Phase 14 — App Check validation

**Date:** 2026-11-11  
**Scope:** Read-only Firebase App Check verification. No enforcement, rules, or
production settings were changed.

## Findings

| Check | Result |
| --- | --- |
| Development Firebase web app | Registered App Check configuration returned HTTP 200; reCAPTCHA Enterprise is score-based and allows only the current Replit preview hostname. |
| Production Firebase web app | Registered App Check configuration returned HTTP 200; reCAPTCHA Enterprise is score-based and allows only `zioncore.replit.app`. |
| App Check enforcement | Firebase AI Logic, Firestore, and Authentication are all `UNENFORCED`. This was read, not changed. |
| Secret-scope match | Not verified. The current secret inventory reports `VITE_FIREBASE_APPCHECK_SITE_KEY` in Shared scope, and supported inspection does not reveal secret values. It therefore cannot prove that Development and Production have distinct values or that either matches its Firebase registration. |
| Published production App ID | Mismatch. A fresh inspection of the live JavaScript found the Development App ID `1:635097760381:web:4d796bbbdb94f181e56714`, and did not find the Production App ID `1:635097760381:web:c718ecaac8b0b21de56714`. |
| Production-host token exchange | Not successful in the headless-browser test. The live production page sent its exchange POST for the Development App ID and Firebase returned **HTTP 403 `PERMISSION_DENIED` — `App attestation failed.`** |
| Preview token exchange | Not confirmed. A headless browser on the authorized preview hostname received the same HTTP 403 response. Headless reCAPTCHA scoring does not establish whether a normal mobile browser succeeds. |

Both exchange tests used headless Chromium. The HTTP 200 response seen on the
exchange URL was an `OPTIONS` CORS preflight, not a token exchange. The actual
`POST` failed. This is the current observed response; it is not the previously
suspected HTTP 400. A non-headless mobile/browser token exchange remains
unverified.

## Blocker and safe next step

The production bundle is using the Development Firebase App ID. Build the
production frontend with the Production App ID and the production-scoped
reCAPTCHA Enterprise key, then verify a successful exchange **POST** from
`zioncore.replit.app` before enabling App Check enforcement. Confirm
Development/Production secret scopes before removing the Shared key, so a
working environment is not accidentally left without a site key.

No secret values were read or included. No Firebase rules, enforcement modes,
customer records, or production deployments were changed.
