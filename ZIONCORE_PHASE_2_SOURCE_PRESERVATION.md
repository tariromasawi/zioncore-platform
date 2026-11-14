# ZionCore Phase 2 — Source Preservation

**Status:** Source preservation completed on private development branches; Phase 3 has not started.  
**Controlling scope:** The owner-approved nine-phase plan, Phase 2, “Preserve Everything in Private GitHub.”  
**Updated:** 2026-11-14

This is a Phase 2 evidence record, not a replacement for the approved nine-phase
plan. The full nine-phase plan text was not found in the accessible repository,
worktrees, or project documentation. The owner’s latest instruction identifies
the controlling Phase 2 title and requirements. Older `ZIONCORE_PHASE_1` to
`ZIONCORE_PHASE_9` documents describe a separate completion/provenance sequence;
they are not substituted for the approved nine-phase plan. The Genesis
100-phase programme is also separate.

## Preserved source references

| Source snapshot | Private GitHub branch | Snapshot commit | Files | Notes |
| --- | --- | --- | ---: | --- |
| Main ZionCore source | `preservation/zioncore-main` | `1ecbfd6dd050d6c05c7049d0fc96459023e492f8` | 360 | Original source snapshot |
| Phase 87 worktree | `preservation/phase-87-owner-claims` | `ebdb0dacb2930b7a6cc44b6620bbb86967888b99` | 610 | Preserved worktree state |
| Phase 88 worktree | `preservation/phase-88-dashboard-metrics` | `03572b836212c94b774646196f6c857b32dd9e29` | 612 | Preserved worktree state |
| Phase 89 worktree | `preservation/phase-89-cost-guards` | `14885b1f6c848057c4d58f4e1ddfe3a774950da7` | 612 | Preserved worktree state |
| Phase 90 worktree | `preservation/phase-90-recovery-operations` | `eccd549fb2b24b29ea36027698cf7361c19b1413` | 611 | Preserved worktree state |
| Original ZionCore 2nd source | `preservation/zioncore-2nd-original` | `9629f8892c9b28ffa6a4d9a99ff897c71cb9b9d2` | 225 | Original standalone snapshot |
| Phase 91 worktree | `preservation/phase-91-version-architecture` | `c5d414f2d94c27195d1d6a7b55e8d20408750205` | 611 | Preserved worktree state |
| Current Phase 2 source | `phase2/source-preservation` | `1cfe61c4aeb72593ae6fd832c11230b6cad1f74f` | 836 | Current integration worktree snapshot |
| Main source with lockfile correction | `preservation/zioncore-main-lockfile-fixed` | `87c1d33a762ff360e50c9d4c2e6882e5f1efe8e5` | 360 | One lockfile specifier correction; original snapshot unchanged |

The six earlier task worktrees and the current integration worktree were
inspected. The root workspace is an additional source line, not one of those
seven task worktrees: its `main` HEAD is
`911f124d6e811702d55b7e5599e50e56c37eeab5`. The clean main-source snapshot
contains 360 source/configuration files; 4,386 paths under `generated-artifacts/`
(including a 16.7 MB generated ZIP) were excluded. The root source is preserved
on a separate branch and is not silently merged into the task branch. The
owner-supplied production evidence identifies
`ca6ff0b252155295315beae1f65fc8e71029ebc1` as the live-source commit.

### Earlier worktree changes

- The Phase 87 owner-claim changes are represented in this integration branch.
  Differences from that working copy are limited to test wording/comments and
  additional App Check middleware coverage; the owner claim and allowlist
  checks remain present.
- Phase 88's metrics implementation and helper are present. Its test difference
  is wording only.
- Phase 89's billable-confirmation implementation and route/UI changes match
  this integration branch byte-for-byte.
- Phase 90's operations recovery runbook is present byte-for-byte.
- The Phase 91 version-architecture document is present with its original
  content retained and an appended Phase 92 source recheck.
- Phase 91's second-source worktree remains a separate, clean source reference;
  it is not overwritten by the integrated copy.

## ZionCore 2nd source comparison

At `7be5bc14971d67445dc68282aee140b75833b476`, the original source candidate
contains 98 files under `artifacts/zioncore-frequency-lab/` (225 tracked files
across the whole worktree). The integrated copy at
`artifacts/zioncore-2nd/` contains 101 eligible source/configuration files after excluding
`node_modules`, build output, `firestore-debug.log`, and `tsconfig.tsbuildinfo`.
The raw tree scan counted 103 files before excluding those two generated files.

Among the 98 comparable artifact files, 90 are byte-identical, seven have
intentional path-specific or integration edits, and the original
`.replit-artifact/artifact.toml` is not duplicated in the integrated subfolder.
That manifest remains preserved in the original source reference. It is not
copied into the integrated subfolder because the second experience is intended
to be a path inside the existing app, not a second root artifact.

The second experience includes its Live Lab, History, device-history,
Exploration, and Genesis routes. The current main lab source contains separate
pages for Missions, Astronomy, Bioacoustics, Voice V2, Access, Devotional
Workspace, and Customer Dashboard. Presence in source does not by itself prove
each page’s production or end-to-end readiness.

## Genesis integration status

The uploaded original remains byte-identical at the preserved archive path with
SHA-256 `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`.
Runtime context version 1.3.0 is source-linked and bounded to 8,000 characters.
Both lab AI clients now use the authenticated server route, App Check token,
existing signed credit quote, explicit user confirmation, and idempotent
recovery. A base measurement can omit advanced features; the backend explicitly
instructs the model not to infer those missing values. Unit and emulator route
tests cover this source-level integration. Live production token exchange,
provider availability, quota behavior, and mobile-browser verification remain
unverified. See `ZIONCORE_GENESIS_SEED_INTEGRATION.md` and
`ZIONCORE_GENESIS_SEED_CHANGELOG.md`.

## Secret-safe preservation status

- The connected GitHub App authenticates as `tariromasawi` (`GET /user`
  returned HTTP 200). The approved destination is verified:
  `https://github.com/tariromasawi/zioncore-platform`, owner `tariromasawi`,
  private, default branch `main`.
- Its initial commit is
  `0418e864d93e929eb60425ba5854beca76763ecf`; it contains no application
  source. The owner has explicitly authorized preserving and pushing the
  Phase 2 source on a separate development branch.
- The local Phase 2 worktree still has no GitHub Git remote; its current branch
  is `agent/phase-92-integration` at base commit
  `ca6ff0b252155295315beae1f65fc8e71029ebc1`. Its complete source snapshot is
  preserved at `phase2/source-preservation`.
- The Replit GitHub source-control connector remains unavailable. The
  authenticated GitHub API connection created and verified the authorized
  branches without pushing to or changing `main`. The Replit Git pane is not
  connected for future direct commits.
- The current Phase 2 worktree contains 836 non-ignored source/configuration
  files. The original standalone source worktree contains 225 files at commit
  `7be5bc14971d67445dc68282aee140b75833b476`; it has 12 documentation/memory
  files absent from the current task tree. Preserve that original snapshot
  separately rather than silently dropping or blending those files.
- The clean main worktree contains 360 source/configuration files after
  excluding `generated-artifacts/`. That directory contains a 16.7 MB generated
  ZIP and extracted generated content; it is excluded from source preservation.
- Per-file SHA-256 inventories for all eight original snapshots and the
  lockfile-corrected main variant are committed on
  `preservation/source-inventory`, commit
  `b74f4ad32337e18ecbf3aafd5414691b17b40313`.
- Committed history for the six development worktrees and two source-candidate
  refs is preserved on `preservation/worktree-history`, commit
  `fc01aa97fbf455c89abc5fb62fea017c4f8a19aa`. Its four bundle parts total
  1,689,659 bytes and reassemble to SHA-256
  `686dfdb72c3b970a779595c2d1aed43bf58e600ad7604d8c3e743960a90f5797`.
  The root main worktree's full history is not in this bundle because it reaches
  the excluded generated ZIP; its source tree is preserved separately.
- The source worktree contains `.env.example` templates, not a tracked
  credential-bearing `.env` file. The repository has separate `.gitignore` and
  `.replitignore` rules; generated outputs and caches are excluded from the
  proposed source branch.
- No credential-bearing `.env` file was included. Production credentials,
  service-account JSON, private keys, and payment secrets were not committed.
  Clean-source installation, tests, typechecks, and builds are recorded below.

### Pre-upload scan findings

- The worktree scan found two Google API-key-shaped values in `.replit`; the
  history scan checked 1,452 reachable Git blobs and found only those
  Firebase-web-key-shaped matches (15 occurrences in `.replit`). Firebase
  documentation says Firebase API keys identify the project, do not authorize
  access, and are safe in code/configuration. The generic static-analysis rule
  flags them, but they are not service-account or authorization credentials.
  Keep the working configuration intact and verify API restrictions separately.
- No Stripe secret/webhook key, GitHub token, AWS access key, PEM private key,
  or service-account private-key block matched.
- The Firebase guidance used for this classification is
  https://firebase.google.com/docs/projects/api-keys.
- Workspace Security scans reported 0 critical, 27 high, 51 moderate, and 9 low
  dependency findings; 10 static-analysis findings; and 0 HoundDog dataflow
  findings. The SAST findings include two medium hard-coded Google API-key
  findings in the root `.replit` and historical generated-worktree CORS
  warnings. These scanners covered the workspace, including generated history,
  and are not a substitute for final scanning of the exact push snapshot.

## Phase 2 completion gates

Phase 2 source preservation is ready for the owner's review. The remaining
connection and live-service items are explicitly not represented as completed:

1. The original nine-phase plan text was not found in accessible project files,
   worktrees, or documentation. The owner supplied the controlling Phase 2
   scope directly; this evidence report does not recreate the missing plan.
2. The owner approved `tariromasawi/zioncore-platform`; GitHub verified the
   owner, private visibility, and default branch `main`.
3. The main source, original ZionCore 2nd source, current Phase 2 source, and
   each earlier task-worktree state are preserved on separate non-production
   branches. Source inventories and task-worktree Git history are preserved
   separately. No actual production credential was committed.
4. A fresh source tree from the Phase 2 GitHub commit passed frozen dependency
   installation, typecheck, all listed tests, and production builds. The
   original main-source snapshot had a catalog/lockfile mismatch; its separate
   correction branch changes only the `tsx` lockfile specifier and passes clean
   frozen installation, typecheck, and API/frequency-lab builds.
5. The original Genesis archive remains byte-identical at the path and SHA-256
   documented below; source-level runtime integration has regression coverage.
6. Live production Firebase App Check token exchange, Firebase Authentication
   and Firestore reads, AI model availability, quota handling, and mobile
   browser behavior remain unverified. No production configuration was changed.
7. The Replit GitHub source-control pane is not connected. GitHub source
   preservation succeeded through the authenticated GitHub API; direct future
   commits from the Replit Git pane still require that connection.

## Verification completed on this development branch

| Check | Result | Evidence |
| --- | --- | --- |
| GitHub Phase 2 source tree | Pass | Freshly fetched all 836 files from commit `1cfe61c4aeb72593ae6fd832c11230b6cad1f74f`; each file's Git blob SHA-1 matched; source size 6,617,542 bytes |
| Frozen install and workspace typecheck | Pass | `pnpm install --frozen-lockfile`; `pnpm -w run typecheck` in the fresh source tree |
| Frequency contract and Genesis tests | Pass, 4/4 | Includes immutable archive SHA-256 and bounded provider-context checks |
| Frequency lab unit tests | Pass, 424/424 | `pnpm --filter @workspace/zioncore-frequency-lab run test:unit` |
| API server unit tests | Pass, 105/105 | `pnpm --filter @workspace/api-server run test:unit` |
| ZionCore 2nd unit tests | Pass, 34/34 | `pnpm --filter @workspace/zioncore-2nd run test:unit` |
| API/Firestore emulator route tests | Pass, 20/20 | `pnpm --filter @workspace/api-server run test:wallet` |
| ZionCore 2nd production build | Pass | `PORT=5173 BASE_PATH=/zioncore-2nd/ pnpm --filter @workspace/zioncore-2nd run build` |
| Frequency lab production build | Pass | `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/zioncore-frequency-lab run build` |
| API server build | Pass | `pnpm --filter @workspace/api-server run build` |
| Main-source frozen install | Pass on correction branch | Original `preservation/zioncore-main` failed because workspace `tsx` specifier `^4.21.0` differed from lockfile specifier `4.23.15`. The separate `preservation/zioncore-main-lockfile-fixed` changes only `pnpm-lock.yaml`; frozen install, typecheck, frequency-lab build, and API build pass. |
| Source inventory | Pass | Per-file SHA-256 CSV files and preservation index committed on `preservation/source-inventory`, commit `b74f4ad32337e18ecbf3aafd5414691b17b40313` |
| Worktree Git history | Pass, with stated exclusion | Bundle on `preservation/worktree-history`, commit `fc01aa97fbf455c89abc5fb62fea017c4f8a19aa`; SHA-256 and remote part contents verified |
| Repository `main` | Unchanged | Still at initial commit `0418e864d93e929eb60425ba5854beca76763ecf`; all application source is on named preservation branches |
| Main preview at `/` | Renders | Browser preview shows the local-analysis Live Lab without browser errors |
| Main preview at `/zioncore-2nd/` | Not integrated | Current main-app preview returns “Page not found”; integration remains future work |
| Replit GitHub source-control pane | Not connected | GitHub API source preservation succeeded; Replit Git-pane connection is a remaining setup item |
| Production Firebase/App Check/provider checks | Not verified | No production configuration, rules, IAM, payment, or deployment changes were made |

The original nine-phase plan text was not found in the accessible workspace;
this report follows the owner's explicit Phase 2 directive and does not replace
that plan. Phase 2 source preservation is presented for review. The Replit Git
pane connection and live Firebase checks remain outstanding; Phase 3 has not
started. No production deployment, main-branch merge, Firestore rules change,
IAM change, App Check enforcement change, Stripe change, or customer-data
operation occurred.
