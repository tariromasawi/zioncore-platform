# ZionCore Phase 17 — Firestore rules diff review

**Date:** 2026-11-11  
**Scope:** Read-only comparison of the active production Firestore rules and
`artifacts/zioncore-frequency-lab/firestore.rules`.

## Permission changes

| Path | Current production permissions | Proposed local permissions | Change |
| --- | --- | --- | --- |
| `/{document=**}` | Unconditional public get/list/read and create/update/delete | No catch-all grant; unmatched paths denied | Revokes client access on every unclassified path |
| `/DivineTreasury/{allPaths=**}` | Unconditional public read/write/get/list | Denied by default | Removes public access; external purpose/consumer unknown |
| `/ZionLattice/{allPaths=**}` | Unconditional public read/write/get/list | Denied by default | Removes public access; external purpose/consumer unknown |
| `/SovereignPatents/{allPaths=**}` | Unconditional public read/write | Denied by default | Removes public access; external purpose/consumer unknown |
| `/advancements/{allPaths=**}` | Unconditional public read/write | Denied by default | Removes public access; external purpose/consumer unknown |
| `/soul_signatures/{allPaths=**}` | Unconditional public read/write | Denied by default | Removes public access; external purpose/consumer unknown |
| `/petitions/{allPaths=**}` | Unconditional public read/write | Denied by default | Removes public access; external purpose/consumer unknown |
| `users/{uid}/frequency_observations/{observationId}` | Public CRUD via the catch-all; no ownership check | Matching authenticated UID may get/list/delete; create is schema-validated; update is limited to a validated interpretation and a request-time timestamp | Narrows public access to owner-scoped operations; no new principal or path is granted |

The proposed rules have **no permission expansion** relative to production. The
only explicit client path retained is the observation path already available to
everyone through the live wildcard. The candidate does not define owner/admin
or server-client grants for billing, wallets, or legacy data.

## Overlap review

- Production has one unconditional `match /{document=**}` plus six explicit
  public legacy-root matches. Every legacy path matches both the wildcard and
  its root rule. The explicit matches do not restrict the wildcard.
- Firestore evaluates overlapping `allow` expressions as OR: a request is
  allowed when any matching expression is true. A narrower false rule cannot
  override the live wildcard's `if true` grant.
- The proposed rules have one application-level match:
  `match /users/{uid}/frequency_observations/{observationId}`. They contain no
  recursive catch-all and no overlapping legacy grants that could restore
  access to denied paths.
- Firebase documents this behavior in
  [Overlapping match statements](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements).

## Compatibility decision

**Do not deploy the candidate yet.** Removing the wildcard will revoke public
client access from every path, including the six legacy roots. The root
collection-ID listing was empty, but that metadata-only result does not identify
external clients or prove the legacy paths are unused. No workspace Firestore
Admin calls were found, but the deployed API source/revision remains unmatched;
its server-side callers cannot be ruled out.

The local emulator test suite passed **7/7** in the demo project. Those tests
validate candidate rules, not compatibility with production data, external
clients, or Admin SDK workflows. No production rules or customer records were
changed.
