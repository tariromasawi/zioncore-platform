---
name: Production cleanup-index approval
description: The owner approved indefinite index-admin access for the app's Firebase service account.
---

The owner explicitly approved indefinite `roles/datastore.indexAdmin` access for
the service account configured by `FIREBASE_SERVICE_ACCOUNT_JSON`. This
supersedes the earlier “keep production unchanged” decision. The current
credential cannot grant itself IAM permissions; an authorized project
administrator must assign the role.

**Why:** the owner requested the fastest path with minimal repeated involvement
so the production cleanup index can be managed and verified.

**How to apply:** after the project administrator grants the role, deploy the
approved `ai_interpretation_jobs.expiresAt` collection-group ascending index.
Keep work scoped to index configuration; this role does not authorize unrelated
production changes.
