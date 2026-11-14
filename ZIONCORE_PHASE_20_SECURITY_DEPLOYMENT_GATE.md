# ZionCore Phase 20 — Production security deployment gate

**Date:** 2026-11-11  
**Decision:** **Do not deploy Firestore rules or enable App Check enforcement.**

## Gate review

| Prerequisite | Status | Evidence |
| --- | --- | --- |
| Production rules fully mapped | Partial | The active ruleset is known, but deployed API callers and the six public legacy roots remain unclassified. |
| Candidate permission diff reviewed | Complete | Candidate adds no access; it removes public access across all Firestore paths. |
| Customer-isolation validation | Local only | 7/7 demo-emulator tests pass, including cross-account get/list/create/update/delete denial. Production still has an unconditional public wildcard. |
| Financial records server-controlled | Unverified | No finance paths or backend implementations were found in workspace source; deployed billing/wallet routes are unmatched. |
| Production App Check token exchange | Not verified | The published bundle uses the Development App ID; a headless production-host POST returned HTTP 403. A normal-browser success is still required. |
| Separate operation approval | Required | The approved charter requires specific approval for each consequential production operation. No production action was taken. |

## Decision and next steps

The prerequisites for a safe production security change are not met. The
previous conditional instruction to deploy only if secure and compatible does
not make the unresolved compatibility and token-exchange checks pass.

Before presenting a production approval request:

1. Identify the authoritative deployed API source and classify its Firestore
   and financial-data callers.
2. Reconcile all legacy paths with the candidate rules and rerun compatibility
   tests.
3. Build the production client with the Production Firebase App ID and
   correctly scoped App Check key, then verify a successful production-host
   token exchange in a normal browser.
4. Present the exact change, affected paths/services, test evidence, and
   rollback plan for separate owner approval.

No rules, enforcement settings, customer records, or production build were
changed in this phase.
