---
name: Approved ZionCore project charter
description: Founder-approved governance boundaries for ZionCore development and production changes.
---

Preserve the main and research-lab source lines and their working features. Continue compatible local engineering and verification, but require separate, specific approval for production Firebase settings or rules, customer-data migrations or bulk deletion, live financial changes, owner privilege assignment, and publication. Charter approval is not approval for any individual production operation. Keep App Check enforcement off until production identity/key/hostname matching and token exchange are verified; do not deploy Firestore rules while legacy paths or callers remain unclassified.

**Why:** The founder approved these boundaries on 2026-11-11 to protect customer data, account access, billing integrity, and both source versions.

**How to apply:** Before any consequential Firebase, data, Stripe, role, hardware, or deployment action, present the exact target, effects, validation evidence, and rollback plan and request approval for that operation.
