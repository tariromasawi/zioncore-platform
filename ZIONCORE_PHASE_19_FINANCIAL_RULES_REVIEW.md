# ZionCore Phase 19 — Financial record rules review

**Date:** 2026-11-11  
**Scope:** Read-only source and Firestore-policy review. No customer or payment
records were read, and no production settings were changed.

## Findings

- The active production Firestore release remains the November 6 ruleset. Its
  unconditional project-wide wildcard permits unauthenticated clients to read
  and write every Firestore path. If financial records are stored in Firestore,
  the current rules do not protect them. The empty root collection-ID listing
  does not establish where production billing data is stored.
- No wallet, credits, purchase, subscription, entitlement, ledger, or audit
  Firestore path was found in current workspace source. The only Firestore
  client path is the lab's private-observation collection.
- No table definitions appear in the workspace PostgreSQL schema source. The
  current API source registers only the health router and has no Firestore/Admin
  SDK calls; `firebase-admin` appears only in the build's external-package list.
- Previously observed deployed runtime logs include billing and wallet routes
  that do not exist in the workspace API source. Their deployed implementation
  and storage backend are unknown. `DivineTreasury` is an explicitly public,
  unreferenced legacy Firestore root; its name alone is not evidence that it
  contains a wallet or ledger.
- The local candidate has no financial-path grants and denies every
  unclassified path. Trusted Admin SDK code would bypass these client rules,
  but none was found in the current workspace API source. The candidate
  therefore cannot establish that production financial records are
  server-controlled.

## Path and control status

| Record category | Actual Firestore path found in workspace | Live client-rule status | Server-control status |
| --- | --- | --- | --- |
| Wallets and credits | None identified | Any path would be public under the wildcard | Unknown; deployed route source unavailable |
| Ledgers and audit records | None identified | Any path would be public under the wildcard | Unknown; no workspace Firestore writer found |
| Purchases and subscriptions | None identified | Any path would be public under the wildcard | Unknown; production billing routes are not in workspace source |
| Entitlements | None identified | Any path would be public under the wildcard | Unknown; no workspace persistence path found |
| `DivineTreasury` legacy root | Explicit rule path only; no source caller | Unconditional public read/write | Purpose and server workflow unknown |

The local candidate's default-deny behavior is safer for client access but is
not a replacement for the missing billing backend. Do not deploy it or claim
financial records are protected until the deployed billing/API source,
financial storage locations, and any legitimate Admin SDK workflows are
reconciled.
