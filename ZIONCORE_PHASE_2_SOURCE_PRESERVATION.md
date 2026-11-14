# ZionCore Phase 2 — Source Preservation

**Status:** In progress; Phase 3 is not authorized by this report.  
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

| Source | Branch or worktree | Commit at inspection | Tracked files at commit | Working-tree state |
| --- | --- | --- | ---: | --- |
| Verified production-based source | `phase-87-owner-claims` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | 5 changed files |
| Verified production-based source | `phase-88-dashboard-metrics` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | 1 changed and 2 untracked files |
| Verified production-based source | `phase-89-cost-guards` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | 3 changed and 2 untracked files |
| Verified production-based source | `phase-90-first-load` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | 1 untracked runbook |
| Earlier ZionCore 2nd source candidate | `phase-91-second-source` | `7be5bc14971d67445dc68282aee140b75833b476` | 225 | Clean |
| Version-architecture work | `phase-91-version-architecture` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | 1 untracked decision document |
| Current isolated integration | `phase-92-integration` | `ca6ff0b252155295315beae1f65fc8e71029ebc1` | 610 | Working tree contains preserved integration work; final inventory pending |

The six earlier task worktrees and the current integration worktree were
inspected. The root workspace is an additional source line, not one of those
seven task worktrees: its `main` HEAD is
`911f124d6e811702d55b7e5599e50e56c37eeab5` and its tracked tree includes 4,386
files under `generated-artifacts/`. That divergent root tree is not treated as
the verified production baseline and is not silently merged into this branch.
The supplied production evidence identifies `ca6ff0b252155295315beae1f65fc8e71029ebc1`
as the live-source commit.

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
- The worktree has no GitHub remote; its current branch is
  `agent/phase-92-integration` at base commit
  `ca6ff0b252155295315beae1f65fc8e71029ebc1`, with Phase 2 source edits still
  uncommitted. Only Replit-managed remotes are configured.
- The Replit GitHub source-control connector remains unavailable. The
  authenticated GitHub API connection is usable, so the authorized transfer
  will use Git objects and a development-branch reference while leaving
  `main` unchanged.
- The current Phase 2 worktree contains 836 non-ignored source/configuration
  files. The original standalone source worktree contains 225 files at commit
  `7be5bc14971d67445dc68282aee140b75833b476`; it has 12 documentation/memory
  files absent from the current task tree. Preserve that original snapshot
  separately rather than silently dropping or blending those files.
- The clean main worktree contains 360 source/configuration files after
  excluding `generated-artifacts/`. That generated directory contains a
  16.7 MB source ZIP and extracted generated content; do not copy it into the
  source-preservation branches.
- The five earlier development worktrees (Phases 87–91) contain small dirty
  deltas. Their source files and newer versions are represented in the current
  integration tree; keep their recoverable states separate and do not treat
  them as production.
- The source worktree contains `.env.example` templates, not a tracked
  credential-bearing `.env` file. The repository has separate `.gitignore` and
  `.replitignore` rules; generated outputs and caches are excluded from the
  proposed source branch.
- Production credentials, service-account JSON, private keys, and payment
  secrets are not to be committed. The history scan and clean-copy build remain
  required before reporting Phase 2 complete.

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

Phase 2 is **not complete** until all of the following are verified:

1. The owner supplies or confirms the full approved nine-phase plan reference
   if its original text must be reproduced exactly; the accessible source set
   did not contain it.
2. The owner approves the exact private GitHub destination. **Done:** the
   destination is `tariromasawi/zioncore-platform`, visibility private.
3. Source snapshots from the clean main workspace, original standalone source,
   and current Phase 2 integration are committed on separate, non-production
   branches without actual credentials or secrets.
4. A fresh checkout installs dependencies, passes the agreed tests, type
   checks, and build, and has a complete committed file inventory.
5. The Genesis integration map and source-integrity check below are reviewed.
6. The source-level mismatch between ZionCore 2nd's client AI path and the
   server-side Genesis/provider-routing path is resolved and regression-tested;
   live production App Check and model verification remain an external launch
   dependency, not a claimed pass.

## Verification completed on this development branch

| Check | Result | Evidence |
| --- | --- | --- |
| Whole-workspace TypeScript check | Pass | `pnpm -w run typecheck` checked shared libraries, API server, mockup sandbox, ZionCore 2nd, frequency lab, and scripts |
| Frequency contract and Genesis tests | Pass, 4/4 | `tsx --test lib/frequency-ai-contract/src/*.test.ts`; includes immutable archive SHA-256 and 8,000-character provider-context cap |
| Frequency lab unit tests | Pass, 424/424 | `pnpm --filter @workspace/zioncore-frequency-lab run test:unit` |
| API server unit tests | Pass, 105/105 | `pnpm --filter @workspace/api-server run test:unit` |
| ZionCore 2nd unit tests | Pass, 34/34 | `pnpm --filter @workspace/zioncore-2nd run test:unit` |
| API/Firestore emulator route tests | Pass, 20/20 | `pnpm --filter @workspace/api-server run test:wallet`; includes the quoted base-measurement interpretation route |
| ZionCore 2nd production build | Pass | `PORT=5173 BASE_PATH=/zioncore-2nd/ pnpm --filter @workspace/zioncore-2nd run build`; emitted `dist/public/zioncore-2nd` with non-fatal large-chunk and dependency-comment warnings |
| Main preview at `/` | Renders | Browser preview shows the local-analysis Live Lab without browser errors |
| Main preview at `/zioncore-2nd/` | Not integrated yet | Current main-app preview returns “Page not found”; this is an integration phase task, not a completed route |
| Private GitHub source branches and clean-copy build | Not run | Destination is approved and writable; snapshots still need committing and verification |
| Production Firebase/App Check/provider checks | Not run | No production configuration, rules, IAM, payment, or deployment changes were made |

No production deployment, main-branch merge, Firebase rules change, IAM change,
or App Check enforcement change is authorized by this Phase 2 record. Phase 3
remains blocked until Phase 2 is complete and reviewed.
