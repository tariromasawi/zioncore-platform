---
name: App Storage sidecar auth
description: Authentication behavior when working with Replit App Storage from workspace processes.
---

Use the Replit Object Storage sidecar credential configuration rather than assuming a plain Google Cloud `Storage()` client has default credentials in every workspace process.

For the Node Storage client, construct an `IdentityPoolClient` from the fixed Replit loopback sidecar configuration and pass it through `Storage({ authClient })`. The older `Storage({ credentials })` path emits Google authentication deprecation and external-credential warnings. Preserve Storage's required scopes when supplying the client directly.

**Why:** A shell upload attempt failed with `NO_ADC_FOUND`, while the official sidecar-authenticated client configuration successfully uploaded and served the listening assets. The SDK's direct `authClient` path removes deprecated configuration warnings without replacing Replit's sidecar identity.

**How to apply:** Reuse the official Object Storage skill's sidecar setup for API/workflow storage access and one-off uploads, adapting it to `IdentityPoolClient` plus `authClient` when using Google Cloud Storage. Do not ask for or expose a service-account key for App Storage.
