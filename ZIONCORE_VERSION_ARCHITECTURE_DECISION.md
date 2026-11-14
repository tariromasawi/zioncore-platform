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

## Phase 92 source recheck — 2026-11-14

This section supersedes stale source and router statements above where they
conflict with the current worktrees. It records the inspected state; it does not
claim the integration is complete.

### Source references

| Source | Current reference | What it contains |
| --- | --- | --- |
| Verified production baseline and current integration worktree | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | Main ZionCore Live Lab, Messages, Devices, Signal Cards, Plans/Wallet, owner routes, and the current ZionCore 2nd source folder |
| Original second-source worktree | `7be5bc14971d67445dc68282aee140b75833b476` (detached) | The full second React experience: Live Lab, History, device history, Exploration, Genesis, research instruments, and local/cloud-history code |
| Current root `main` | `911f124d6e811702d55b7e5599e50e56c37eeab5` | A divergent implementation with Voice V2, Missions, Astronomy, Devotional, Bioacoustics, Access, and a customer dashboard |

The six earlier task worktrees and the current integration worktree were
inspected. The owner-claims, dashboard-metrics, and paid-AI guard improvements
were restored into the isolated integration worktree. The current root `main`
is not the verified live production source, and neither source line should be
replaced or wholesale-merged without reconciling its unique routes and
dependencies.

### Route inventory and unresolved integration

- The production-based integration worktree still has `/messages`, `/devices`,
  `/cards`, `/wallet`, `/dashboard`, `/admin`, and `/owner`; those routes are
  absent from current root `main`.
- Current root `main` has `/missions`, `/astronomy`, `/devotional`,
  `/bioacoustics`, `/access`, and its customer dashboard; these remain absent
  from the production-based integration worktree. The original Voice V2 page,
  WAV parser, route, and receive-only resampler have now been restored into the
  isolated integration worktree without changing the transmitter protocol.
- `artifacts/zioncore-2nd/` has `/`, `/history`, `/history/device`,
  `/history/device/:id`, `/history/:id`, `/exploration`, and `/genesis`.
- The second app already uses Vite’s base URL as its Wouter router base. A
  production-mode build using `/zioncore-2nd/` completed and emitted prefixed
  asset URLs. This is a source/build check only; the main artifact does not yet
  register that path, and no live route or homepage link was added.
- The current registered main web artifact still has only the `/` web service.
  No separate ZionCore 2nd deployment was created.
- An attempt to validate a second `/zioncore-2nd/` service in this isolated
  worktree was rejected with `DUPLICATE_PREVIEW_PATH` because the validator sees
  the copied `/` artifact path as another artifact. The registered main
  `artifact.toml` was not changed and no homepage link was added. This must be
  resolved through the existing artifact registration workflow; do not bypass
  validation or create a second deployment.

### Recovered route and audio evidence

- Current root `main` contains research pages and libraries that are useful
  source material, but it also deletes the production-based API's billing,
  wallet, owner, Stripe fulfillment, Firebase identity, and AI request-guard
  modules. It is therefore not a safe whole-tree replacement.
- The root-main customer-dashboard source explicitly reports that verified
  credit and membership services are not connected in that workspace. Keep the
  production-based wallet/dashboard flow rather than substituting that page.
- The restored Voice V2 route processes audio locally and presents input
  metadata, original and decoder sample rates, checksum status, playback, and
  export. Its protocol encoder and packet structure are unchanged.
- Voice V2 checks in the integration worktree: sample-rate/resampler tests
  **7/7**, native WAV parser tests **3/3**, and TypeScript check passed.
- The user-uploaded WAV is valid mono 16-bit PCM at 48 kHz, four seconds long,
  but the actual decoder returns `PREAMBLE_NOT_FOUND`. Its 6 kHz-high-pass RMS
  is about **-57.5 dB** (versus about **-15.0 dB** below 4 kHz), so it does not
  provide evidence of a Voice V2 packet or successful real-message recovery.
  Do not count this file as a valid protocol fixture.

### Verification recorded on this source snapshot

- Production-based integration worktree before the Voice V2 additions: API unit
  tests **105/105**, main lab unit tests **233/233**, and API/main TypeScript
  checks passed. The new Voice V2 tests are reported separately above; a full
  suite rerun is still required.
- Second app: unit tests **36/36**, TypeScript check passed, and Firestore rules
  emulator tests **7/7** passed.
- Production-based main Firestore rules emulator tests **14/14** passed; Auth
  emulator tests **3/3** passed.
- Current root `main`: TypeScript check passed and unit tests **226/226** passed.
- The second-app build emitted the existing large-chunk and source-map warnings;
  it did not fail. No customer or production data was changed during these
  checks.

### Next integration gates

1. Reconcile the route/dependency matrix above on an isolated integration
   branch, preserving both sets of main-app routes and the full second app.
2. Validate the `/zioncore-2nd/` path through the registered main artifact and
   its refresh/deep links before adding a main-page link.
3. Keep the GitHub push blocked until the owner approves the exact private
   repository destination.
4. Keep production rules, App Check enforcement, and publication unchanged
   until their separate compatibility and approval gates are satisfied.
