# ZionCore Phase 93 — public URL readiness

**Reviewed:** 12 November 2026  
**Source branch:** `agent/phase-92-integration`

## URL decision

| Experience | Intended URL | Current status |
| --- | --- | --- |
| Main ZionCore | `https://zioncore.replit.app/` | Live main application |
| ZionCore 2nd | `https://zioncore.replit.app/zioncore-2nd/` | Target path only; not yet routed to the second application |

The path-based destination remains the Phase 91 architecture choice. No separate domain or deployment was created, so no additional hosting cost was incurred. The isolated Replit preview is not a public destination and is not included in application navigation.

## Live smoke check

Read-only requests to `/`, `/zioncore-2nd/`, `/zioncore-2nd/history`, and `/zioncore-2nd/exploration` all returned HTTP 200. However, each response contained the **main app's** page title and main asset paths, not the second app's prefixed bundle. The 200 responses are therefore SPA fallback behavior, not proof the second application is live.

A source scan of both applications' `src` and `public` directories found no link to the private task preview hostname. No “ZionCore 2nd” landing-page link was added.

## Readiness result

Phase 93 is **partial**. Both intended URL identities are recorded and the private preview is not exposed, but the second URL is not a stable working destination yet. Do not send visitors to the target path or treat it as complete.

The next technical gate is to validate the second service in the active artifact manifest, confirm the prefixed bundle is served on direct navigation and refresh for the app, History, and Exploration routes, and only then proceed to Phase 94's main-page-link smoke test. Keep the primary root application unchanged and do not publish without the owner's approval.
