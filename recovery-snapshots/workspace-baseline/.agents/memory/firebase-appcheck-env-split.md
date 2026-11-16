---
name: Firebase App Check environment split
description: Keep ZionCore's Replit preview and production Firebase registrations isolated.
---

For ZionCore, keep the Replit development preview on its own Firebase web app and reCAPTCHA Enterprise key, restricted to the preview hostname. Production uses its separate Firebase web app and the production key restricted to `zioncore.replit.app`. Do not place App Check site keys in the shared Replit environment. Secret inventory that reports only presence cannot prove distinct scope values; do not remove a shared key until the environment-specific replacements are independently verified. Inspect the published bundle because its Firebase App ID can differ from the current Replit production setting.

**Why:** Live configuration showed that the development app initially had no App Check registration, while the existing production key was restricted to the production hostname. Later checks found a shared-scope key and a published bundle using the development App ID despite the production environment being mapped to the production app. An App Check `OPTIONS` response is only CORS preflight; confirm the `POST` exchange result before calling a token valid.

**How to apply:** Preserve the `development`/`production` split, verify secret scope without exposing values, inspect the published bundle itself, and verify the actual exchange `POST` before enforcement. Keep enforcement disabled until production token exchange succeeds. Do not publish production changes without owner approval.
