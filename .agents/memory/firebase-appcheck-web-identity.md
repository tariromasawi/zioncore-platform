---
name: Firebase App Check web identity
description: Keep App Check bound to the intended Firebase web application in a shared-origin integration.
---

Initialize each ZionCore frontend from its own environment-specific Firebase web App ID. Do not reuse another app's `[DEFAULT]` Firebase instance merely because it targets the same Firebase project; App Check attestation is tied to the web App ID, not just the project.

**Why:** ZionCore Main and ZionCore 2nd can share a Firebase project while having distinct web App IDs and hostname-specific reCAPTCHA Enterprise keys. Reusing a same-project default instance can pair the wrong App ID with an otherwise correct site key and cause attestation failure.

**How to apply:** Before initializing Auth or App Check, verify both the Firebase project ID and App ID against the current environment. Keep Development and Production keys separate, then confirm token exchange from a real browser on each intended hostname before enforcing App Check.
