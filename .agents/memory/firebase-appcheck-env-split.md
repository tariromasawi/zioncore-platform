---
name: Firebase App Check environment split
description: Keep ZionCore's Replit preview and production Firebase registrations isolated.
---

For ZionCore, keep the Replit development preview on its own Firebase web app and reCAPTCHA Enterprise key, restricted to the preview hostname. Production uses its separate Firebase web app and the production key restricted to `zioncore.replit.app`. Do not place App Check site keys in the shared Replit environment. The scoped app IDs and keys now match their registered apps and hostnames, but the live bundle still contains the development app ID with the production key.

**Why:** Live configuration showed that the development app initially had no App Check registration, while the existing production key was restricted to the production hostname. Later verification confirmed that correct environment scopes do not guarantee the deployed bundle used the matching production app.

**How to apply:** Preserve the `development`/`production` split, verify token exchange before enforcement, and inspect the published bundle itself. Keep enforcement disabled until production token exchange succeeds. Do not publish production changes without owner approval.
