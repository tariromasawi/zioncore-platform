---
name: Observation history retention
description: ZionCore's separation of local and cloud observation storage and its user-controlled retention boundary.
---

Local observation history belongs to the browser profile, is not encrypted by ZionCore, and may be accessible to others with access to that profile. Cloud observations are tied to the authenticated account and remain until the user deletes them. Do not introduce automatic expiry for saved observations without an explicit product decision; this would risk deleting user records.

**Why:** History is meant to be a durable, user-selected record. Retention should be transparent and avoid data loss.

**How to apply:** Keep local/cloud boundaries explicit in UI and privacy copy, preserve merge-only local backup restore, and keep short-lived AI retry-result cleanup separate from saved observation retention.
