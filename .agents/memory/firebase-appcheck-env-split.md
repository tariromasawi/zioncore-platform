---
name: Firebase App Check environment split
description: Keep ZionCore's Replit preview and production Firebase registrations isolated.
---

For ZionCore, keep the Replit development preview on its own Firebase web app and reCAPTCHA Enterprise key, restricted to the preview hostname. Production uses its separate Firebase web app and the production key restricted to `zioncore.replit.app`. Do not place App Check site keys in the shared Replit environment.

**Why:** Live configuration showed that the development app initially had no App Check registration, while the existing production key was restricted to the production hostname. Each app and hostname therefore needs its own matching registration.

**How to apply:** When changing Firebase App Check or Replit environment variables, preserve the `development`/`production` split, verify token exchange in preview before enforcing services, and do not publish production changes without owner approval.
