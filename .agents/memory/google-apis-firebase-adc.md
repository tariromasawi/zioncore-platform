---
name: Google APIs via Firebase ADC
description: Use the existing Firebase service-account credential for read-only Google API checks without interactive login.
---

For authorized read-only Google API inspection, prefer the existing `FIREBASE_SERVICE_ACCOUNT_JSON` through Application Default Credentials and call the API with its short-lived access token. Some `gcloud` commands still require an active gcloud account even when ADC works; when supported, call the Google REST API with ADC rather than requesting an interactive CLI login. If this workspace has no ADC configuration and the Firebase CLI cannot authenticate non-interactively, an in-memory Google Auth `JWT` client can use the existing service-account secret for narrowly scoped read-only REST requests without writing the credential to disk. Describe this accurately as service-account JWT authentication, not ADC.

**Why:** In this workspace, ADC previously read Firebase Auth configuration while some `gcloud` commands failed for lack of an active account. A later check found no configured gcloud ADC file and the Firebase CLI returned `Failed to authenticate, have you run firebase login?`; an in-memory Google Auth `JWT` client using the existing service-account secret still read Firebase project metadata without interactive login.

**How to apply:** Prefer supported SDK/REST calls that accept ADC. If ADC is unavailable, use the Google Auth library directly with the authorized service-account secret in memory; never write or print credentials or tokens, and restrict queries to the minimum metadata needed.
