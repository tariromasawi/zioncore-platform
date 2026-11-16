# ZionCore 2nd — Phase 3 Recovery Integration Record

**Status: In progress.** The preserved source snapshot has been compared, and a
dedicated recovery branch now incorporates the verified route and local-history
gaps described below. Phase 3 is not complete: the original Replit project is
not accessible from this workspace, so original-source parity cannot yet be
confirmed.

## Source provenance and preservation

- Private repository: <https://github.com/tariromasawi/zioncore-platform>
- Recovery branch: `zioncore-2nd/recovery-phase3`
- Integration base: `phase2/source-preservation` at
  `2aec8c42af0c56437ff9ad5b1087335c71a31bdb`
- The existing `zioncore-2nd/standalone-prep` branch remains separately
  preserved at `36ce3d3d538421cc8fb4c1bbb2109ed8f3c51597`.
- Source snapshots and comparison evidence remain on
  `zioncore-2nd/phase3-source-snapshot` at
  `2e352721be2b9eb348ae9919496e756692e980e0`.
- The standalone source was **not** replaced by the main app's
  `artifacts/zioncore-2nd` artifact. No production branch, production service,
  Firebase configuration, customer data, or deployment was changed.

The snapshot archive manifest records 4,846 source-file entries and validated
zero missing files, size mismatches, or checksum mismatches. The separate
recovery branch contains source-only copies of three available source lanes
(1,550 files total) and their file-by-file comparison records. Main-source and
task-source histories have a common base but materially differ; a wholesale
merge was intentionally avoided.

Direct comparison of the task-source Firebase lab with the available workspace
baseline found:

| Comparison | Files |
| --- | ---: |
| Workspace-baseline files | 199 |
| Task-source files | 98 |
| Byte-identical | 71 |
| Different | 27 |
| Workspace-baseline-only | 101 |
| Task-source-only | 0 |

The changed files include application routing, Firebase/authentication,
observation storage, and styling, so they require compatibility review rather
than blind replacement.

## Recovered routes and integration

The recovery branch now registers 21 routes:

`/`, `/discover`, `/missions`, `/astronomy`, `/bioacoustics`, `/exploration`,
`/access`, `/devotional`, `/cards`, `/history`, `/history/device`,
`/history/device/:id`, `/history/:id`, `/messages`, `/voice-v2`, `/devices`,
`/premium`, `/admin`, `/owner`, `/dashboard`, and `/wallet`.

The current routes already exposed Missions, Astronomy, Bioacoustics, Voice V2,
Access, Dashboard, Messages, and the other listed experiences. Reconciliation
added the two device-history routes that were present in the recovered source
lane but absent from the preservation branch.

Device history is explicitly local-only and separate from cloud history. A
signed-in user's device archive and recovery/restore flow use that account's
browser-storage scope; they do not upload or sync those records. Anonymous
device history remains in the browser's visitor scope. Cloud history continues
to use the existing authenticated cloud path. A regression test confirms a
backup restore for one account leaves another account's archive unchanged.

The exact original Genesis Seed has been copied from the preserved preparation
branch to `governance/genesis/GENESIS_SEED.original.txt`. Its SHA-256 is:

`f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`

The source file is unchanged. Its presence in this branch preserves the
foundational text; this record does not claim that the complete raw seed is
injected into every runtime AI request.

## Verification

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| Workspace typechecks and builds (`PORT=18238 BASE_PATH=/ pnpm run build`) | Passed |
| API unit tests | 105 passed |
| ZionCore frequency-lab unit tests | 425 passed |
| Firebase Auth emulator tests | 2 passed |
| Firestore rules emulator tests | 14 passed |
| Wallet/Stripe emulator tests | 20 passed |
| Total automated checks above | 566 passed |
| Registered route inventory | 21 routes |
| Exact Genesis Seed hash | Matches preserved source |
| Tracked-source secret-pattern scan | No private-key, Stripe-secret, cloud-key, or GitHub-token patterns found |
| Credential-bearing `.env` files | None tracked; safe templates retained |
| Production Firebase, Stripe, AI, or deployment changes | None made |

The emulator and unit-test results do not prove live production Firebase or
Stripe connectivity. No live payment, customer-data, App Check enforcement,
or production Firestore operation was performed.

## Remaining Phase 3 blockers

1. The original Replit project `c9c8012c-55d1-412b-af8f-e60455c226a4` is not
   available as an editable source workspace to this agent. Its preview URL
   alone does not expose source files. Therefore, recovered snapshots cannot
   yet be asserted to be the complete original, and source parity remains
   unverified.
2. The exact approved nine-phase plan is only partially present in accessible
   history/source. A Phase 4 specification was not recovered. The separate
   Genesis 100-phase plan is not a substitute.
3. Live Firebase configuration, live AI provider availability, production
   authentication, Stripe fulfilment, and iPhone Safari behavior require
   separately authorized access and end-to-end verification.

To remove blocker 1, the project owner must open the original Replit project
and either grant the required editor/source access through Replit's sharing
mechanism or make the original source available in this authorized workspace.
Until then, this recovery branch must remain a snapshot-based integration, not
be represented as complete original-system recovery.
