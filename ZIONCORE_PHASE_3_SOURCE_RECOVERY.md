# ZionCore 2nd — Phase 3 Source Recovery Record

**Status:** Source snapshots preserved and compared; functional integration remains in progress. This is not a Phase 3 completion claim.

## Provenance and source boundaries

The preserved task-source commit is `7be5bc14971d67445dc68282aee140b75833b476`. The existing standalone-preparation branch remains unchanged at its current checkpoint and is the parent of this source-snapshot branch. The original standalone snapshot branch is also preserved separately as `preservation/zioncore-2nd-original` (`9629f8892c9b28ffa6a4d9a99ff897c71cb9b9d2`).

The recovered project snapshot records the phase-92 worktree as based on `ca6ff0b252155295315beae1f65fc8e71029ebc1`, with uncommitted work captured in the snapshot. The user-provided production build record identifies that same commit as the production source at build time. The main-source candidate (`d4be0c767ae0cbe075ac0bce5e40191e32bc2a1d`) and task-source history have a shared base but materially different histories and files; the source-lane record reports 34 candidate-only commits, five task-source-only commits, and 481 differing tracked paths. No wholesale merge was performed.

The archived source inventory contains 4,846 rows. Its original manifest was verified with no missing files, size mismatches, or SHA-256 mismatches. The full archive remains available in the workspace under `generated-artifacts/ZionCore-Complete-Project-Source`. This branch preserves source-only copies of the workspace baseline, phase-92 worktree, and the missing-source supplement in separate directories. Generated caches, dependency folders, build output, ZIP exports, and credential-bearing environment files were excluded from the Git copy. Safe `.env.example` templates were retained.

## File-by-file comparison

`recovery-evidence/FULL_FILE_COMPARISON.csv` contains the per-path SHA-256 comparison for all eight source lanes against their corresponding preserved GitHub branches. Its SHA-256 is `7c3a77adbc27d52df658290624bd5c359de161dc86a90245e768ca9f8f4adc38`.

| Snapshot lane | Snapshot files | Identical | Different | Snapshot-only | GitHub-only |
|---|---:|---:|---:|---:|---:|
| Workspace baseline vs. `phase2/source-preservation` | 376 | 231 | 73 | 72 | 532 |
| Phase-92 worktree vs. `phase2/source-preservation` | 1,187 | 682 | 44 | 461 | 110 |
| Phase-87 owner claims | 610 | 609 | 1 | 0 | 0 |
| Phase-88 dashboard metrics | 612 | 611 | 1 | 0 | 0 |
| Phase-89 cost guards | 612 | 611 | 1 | 0 | 0 |
| Phase-90 recovery operations | 611 | 610 | 1 | 0 | 0 |
| Phase-91 second source | 225 | 224 | 1 | 0 | 0 |
| Phase-91 version architecture | 611 | 610 | 1 | 0 | 0 |

The one-file differences in the six historical worktree comparisons are all `.replit` configuration snapshots, including redacted/rewritten configuration; no product-source difference was found in those six comparisons. The workspace-baseline and phase-92 source differences are retained for review rather than silently overwritten.

The research-lab application itself was also compared directly: the workspace baseline contains 199 files under `artifacts/zioncore-frequency-lab`, versus 98 in the standalone-preparation source. Of these, 71 are byte-identical, 27 differ, and 101 exist only in the baseline; no prep-only application files were found. The additions include research-mission, astronomy, bioacoustic, Voice V2, access, devotional, protocol, discovery, and device-adapter modules. The 27 differing files include the route table, Firebase/auth, observation, and styling code, so these versions require deliberate reconciliation rather than blind copying.

## Feature and route inventory

The authentic task-source snapshot has six routes: `/`, `/exploration`, `/history`, `/history/:id`, `/history/device`, and `/history/device/:id`.

The workspace baseline adds `/access`, `/astronomy`, `/bioacoustics`, `/dashboard`, `/devotional`, `/missions`, and `/voice-v2`. The later phase-92 application source adds `/admin`, `/cards`, `/devices`, `/discover`, `/messages`, `/owner`, `/premium`, and `/wallet`. The preserved `phase2/source-preservation` route table contains these later feature routes, but omits the two original device-history paths. The complete route union therefore remains an integration item; do not mark it finished until those paths and their data behavior are restored and tested.

The preserved `phase2/source-preservation` route table has 19 paths; adding the two original device-history paths yields a 21-path route set to verify. The source includes customer and owner access components, Firebase identity middleware, API services for AI interpretation, billing, owner operations, wallets, and resonance audio/visuals, plus research and audio processing modules. Route presence is not proof of production connectivity; Firebase and Stripe live configurations have not been changed or verified in this phase.

The `ZionCore-2nd-Missing-Source` folder is explicitly catalogued as a supplement copied from the main ZionCore source, not as proof of the original standalone project's source. Its own catalog notes that it does not establish a dedicated scheduled mission engine, a connected astronomy feed, or successful decoding of the supplied Voice V2 test audio. Its source has been preserved separately and is not treated as an authoritative replacement.

## Genesis source integrity and runtime status

The exact original user-provided Genesis file is present in the workspace-baseline snapshot and in the standalone-preparation branch. Its SHA-256 is `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`; the hashes match.

The versioned `genesis-seed.ts` module contains structured, bounded operational sections and selects a limited number of relevant references for a request. It does not inject the complete raw source text into every request. The embedded `zioncore-2nd` context file uses the source hash and a short operational summary. Therefore the immutable source is preserved, but the requested full-seed runtime integration is not yet complete and must not be described as complete.

## Credential handling

The source scan found no service-account JSON, private key, Stripe secret, or actual `.env` file in the copied snapshots. It did find two Firebase web API-key values in the inherited root `.replit` configuration. Those values are blanked in this new snapshot branch only; the standalone-preparation branch and its history were not rewritten. The existing preparation history therefore remains a separate review item if the owner requires removing even public Firebase web configuration values from all repository history. No key was printed or rotated.

## Validation evidence

The clean phase-92 source copy installed successfully with `pnpm install --frozen-lockfile`. With `PORT=18238` and `BASE_PATH=/`, the full workspace typecheck and production build passed for the API server, mockup sandbox, ZionCore 2nd artifact, and frequency lab.

| Check | Result |
|---|---|
| API unit tests | 104 passed, 0 failed |
| Frequency-lab unit tests | 225 passed, 0 failed |
| Firebase Auth emulator tests | 2 passed, 0 failed |
| Firestore rules emulator tests | 14 passed, 0 failed |
| Wallet/Stripe emulator tests | 19 passed, 0 failed |
| Full clean build with required `PORT` | Passed |

The missing-source supplement was also installed with a frozen lockfile. Its API and lab unit tests and Firestore rules tests passed. Its root `typecheck`/`build` commands fail because that supplement omits the root `tsconfig.json`; this is recorded as a packaging defect, not hidden by copying a file into the preserved snapshot.

These checks validate source and emulator behavior only. They do not establish original-project parity, live Firebase or Stripe access, a production deployment, or iPhone Safari behavior.

## Remaining Phase 3 requirements

1. Reconcile the route and data behavior across the preserved task source, workspace baseline, and phase-92 feature source on a dedicated integration branch, without changing the standalone-preparation branch.
2. Restore and test `/history/device` and `/history/device/:id` alongside all later routes.
3. Recover the exact approved nine-phase plan. Available project documents include Phases 1–3 and 5–9; Phase 4 was not found. The Genesis 100-phase plan is a separate plan and is not substituted for the nine-phase integration plan.
4. Obtain access to the original Replit project, identifier `c9c8012c-55d1-412b-af8f-e60455c226a4`, to verify whether additional source or Agent history exists. The supplied preview URL is not editor access.
5. Continue only on private development branches. No production Firebase rules, IAM, Stripe configuration, or deployment has been changed.
