---
name: Production Firebase identity
description: Owner-confirmed Firebase Admin service-account principal for ZionCore.
---

The intended Production Firebase Admin principal is `zioncore-firebase-cli@ethereal-throne-b20e6.iam.gserviceaccount.com`.

**Why:** the owner confirmed this is the email configured in Production.

**How to apply:** Compare the active Firebase credential identity to this principal when diagnosing IAM. Never request or expose the service-account JSON or private key.
