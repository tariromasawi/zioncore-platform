# ZionCore Phase 18 — Customer isolation tests

**Date:** 2026-11-11  
**Scope:** Local Firestore emulator using the `demo-zioncore-frequency-lab`
project only. No production documents were read or written.

## Results

The candidate rules passed **7/7** emulator tests. The cross-account test
verifies that a second authenticated user cannot get, list, create, update, or
delete the first user's observation. The owner's record remains after the
denied delete. Other tests cover valid owner access, schema validation,
unauthenticated access, interpretation updates, and default denial for legacy
or unmatched paths.

## Production status

This does **not** establish production isolation. The deployed project-wide
`allow read, write: if true` wildcard permits unauthenticated and cross-account
access on every Firestore path. No production isolation probe was made because
the rule already establishes that result and probing could expose customer
data. The local candidate remains undeployed until the production API source
and legacy consumers are reconciled.
