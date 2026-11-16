# ZionCore version architecture decision

**Phase:** 91 — choose the second-version architecture

**Reviewed:** 2026-11-12

**Primary baseline:** production commit `ca6ff0b252155295315beae1f65fc8e71029ebc1`

**Second-version source:** `zioncore-2nd-task-source` at `7be5bc14971d67445dc68282aee140b75833b476`

## Decision

Use a **separate path-based artifact on the existing ZionCore application**
as the preferred integration target, at a path such as
`/zioncore-2nd/`. Keep the two applications as separate source trees and
separate artifact packages. Do not merge their screens into one UI or replace
either source line.

This is a target architecture, not a claim that the route is already working.
The route/build tests show that the second app can build with a prefixed asset
base, but its current client router does not recognize prefixed routes. Phase
92 must give it a unique artifact identity/path and make routing prefix-aware,
then retest direct navigation, reloads, assets, API calls, and auth before any
main-page link is added.

No production or billing change was made, and no new deployment was created.

## Source and registration evidence

- The verified primary production source contains one web artifact:
  `artifacts/zioncore-frequency-lab`, artifact ID
  `artifacts/zioncore-frequency-lab`, `previewPath = "/"`. It includes the
  primary experience's Live Lab, Messages, Devices, Signal Cards, account,
  wallet/Plans, and owner routes.
- The second source is a separate Git branch, not a second artifact in the
  production snapshot. It reuses the same artifact directory, package name,
  artifact ID, and root preview path, but contains a different React
  application with Live Lab, History, device-history routes, and Exploration.
- Both sources use Wouter routes rooted at `/`. The current second-source
  artifact manifest also registers `/` and the second-source build defaults to
  root asset URLs. A path prefix cannot be safely added by changing only the
  Vite `base` option.
- The current workspace `main` at
  `3c83aa51e729f0847efc154b0fc3a758c9e622e4` is not a descendant of the
  verified production commit. Do not treat it as the deployment source or
  merge it wholesale. The Phase 92 integration must start from the verified
  production source and explicitly bring in the second-source branch.

## Route and build tests

Builds were run in isolated worktrees using the existing lockfiles and installed
dependencies. Preview servers used separate local ports; no public deployment
or Firebase sign-in was involved.

| Source and mode | Build / route result |
| --- | --- |
| Primary production source, root base | Production Vite build succeeded. Headless browser rendered `/`, `/messages`, and `/devices` with their expected page headings. |
| Second source, root base | Production Vite build succeeded. Headless browser rendered `/`, `/history`, and `/exploration` with their expected page headings. |
| Second source, `/zioncore-2nd/` base | Production build succeeded and generated JavaScript, CSS, and favicon URLs under `/zioncore-2nd/`. A headless browser opened `/zioncore-2nd/history`, but the app rendered its **Page not found** screen. The unprefixed `/history` route is still what the app router recognizes. |
| Primary `/wallet` route | The isolated static preview displayed the app's generic error screen because the shared API service was not running in this route test. This does not establish a production wallet failure; it means the commercial journey still needs a paired API test. |

Both bundles report a large JavaScript chunk above 500 kB. The second source
also emitted a sourcemap-location warning for `src/components/ui/label.tsx`.
Builds completed; these are recorded as optimization/diagnostic follow-ups, not
proof of a route failure.

## Architecture comparison

| Option | Findings | Decision |
| --- | --- | --- |
| Separate Static deployment | Provides clean root routing and source isolation, but Replit's current documentation says Static Deployments are not compatible with apps created using Agent. The two source trees also currently reuse the same artifact slug/ID, so they cannot both be registered as-is. Replit documents Static hosting as free for eligible projects, with outbound transfer at `$0.05/GiB` beyond applicable limits; that does not make this Agent-created project eligible. A different separate hosting target and its cost have not been selected or quoted. | Do not create a separate deployment in this phase. |
| Path-based artifact in the existing Replit app | Keeps `zioncore.replit.app` as the main entry point and avoids a second deployment. The prefixed build assets work, but the second source's router and current artifact registration do not support the prefix yet. It requires a second, uniquely named artifact package, path-aware client routing and rewrites, and full regression tests for the shared `/api` service and Firebase. | Preferred target, conditional on the Phase 92 route and integration tests passing. |

Official Replit references:
[deployment types](https://docs.replit.com/features/publishing/deployment-types)
and [deployment pricing](https://docs.replit.com/billing/deployment-pricing).
The pricing reference's static-deployment terms apply only to supported Static
Deployments; no estimate is made here for another hosting target.

## Phase 92 acceptance gates

1. Create a dedicated integration branch from the verified production source;
   preserve the second-source branch and its history.
2. Register the copied second app under a unique package/artifact identity and
   a non-root preview path. Do not edit artifact metadata outside the validated
   artifact workflow.
3. Make every second-app route, internal link, static asset, and refresh/deep
   link work under the chosen prefix. Keep the primary app's root routes intact.
4. Verify that shared API requests remain intentionally routed to the existing
   API service, and recheck Firebase project, authorized domains, App Check
   hostname/key, and token exchange before enabling private cloud features.
5. Test public pages and authenticated boundaries without weakening access to
   account history, owner functions, or billing.
6. Add the main-page “ZionCore 2nd” link only after the public destination passes
   the smoke tests in Phase 94. Do not publish until the owner approves.
