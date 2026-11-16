# ZionCore Phase 16 — Production Firestore path inventory

**Date:** 2026-11-11  
**Scope:** Read-only rules and metadata inspection for Firebase project
`ethereal-throne-b20e6`. No customer documents were read and no rules were
changed.

## Deployed database and rules release

- Firestore database: `(default)`, `FIRESTORE_NATIVE`, region `us-central1`.
- Deployed release: `projects/ethereal-throne-b20e6/releases/cloud.firestore`.
- Active ruleset: `4f21202a-b142-43b0-9038-892d46299682`.
- Last release update: `2026-11-06T07:14:27.999395Z`.
- The complete ruleset was retrieved from Firebase Rules Management API.

The deployed rules contain a project-wide unconditional grant:

```firestore
match /{document=**} {
  allow read, write, list, get, delete, create: if true;
}
```

This grants every client, including unauthenticated clients, read and write
access to every document path. `write` includes create, update, and delete.
Firestore permissions from matching rules are additive, so a narrower rule
cannot cancel this grant.

## Path and permission map

| Firestore path | Deployed client access | Workspace usage | Compatibility status |
| --- | --- | --- | --- |
| `/{document=**}` | Public get/list/read and create/update/delete at every path | Matches all current and future paths | Critical exposure; no authentication condition |
| `/DivineTreasury/{allPaths=**}` | Explicit public read/write/get/list; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `/ZionLattice/{allPaths=**}` | Explicit public read/write/get/list; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `/SovereignPatents/{allPaths=**}` | Explicit public read/write; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `/advancements/{allPaths=**}` | Explicit public read/write; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `/soul_signatures/{allPaths=**}` | Explicit public read/write; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `/petitions/{allPaths=**}` | Explicit public read/write; also covered by wildcard | No source references | Purpose and external consumers unknown |
| `users/{uid}/frequency_observations/{observationId}` | Public through the wildcard; no UID ownership check in deployed rules | The lab creates, reads/lists, updates interpretations, and deletes this path | Local candidate is owner-scoped and validates writes; not deployed |

The local candidate `firestore.rules` restricts observation access to the
matching authenticated UID: get/list/delete are owner-only, creates are
validated, and updates may change only a bounded interpretation and its
timestamp. Every unclassified path—including all six legacy roots—is denied.
This is stricter than production, but compatibility has not been demonstrated.

## Data and caller inventory

- Firestore's database list returned only `(default)`.
- A metadata-only root collection-ID listing returned an empty list. No document
  IDs, document contents, or customer records were read. This does not prove
  that external clients or subcollection-only paths are absent.
- The only Firestore client calls in workspace source target
  `users/{uid}/frequency_observations/{observationId}`.
- No Firestore or Firebase Admin SDK usage appears in current API source.
  `firebase-admin` is listed only as an external package in the build file.
- The deployed API source/revision is not matched to this workspace. Existing
  production logs include owner/billing routes absent from the current API
  source, so server-side Firestore usage in production remains unknown. Trusted
  Admin SDK access would bypass these rules and must be reviewed separately.
- No `firestore.indexes.json` or additional rules file was found in workspace
  source.

## Deployment decision

**Do not deploy the local rules candidate yet.** Removing the wildcard would
change access for every path; the six legacy roots and the deployed API's
Firestore callers have not been classified. The production source mismatch is
the exact compatibility blocker. No production rules or customer data were
changed during this inventory.
