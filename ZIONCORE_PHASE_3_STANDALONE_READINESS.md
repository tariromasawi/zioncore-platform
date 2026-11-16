# ZionCore 2nd — Phase 3 Standalone Readiness

**Status:** In progress; independent deployment is not verified.  
**Purpose:** Preserve the available original standalone source and record what is
verified without treating the main app's integrated copy as authoritative.

## Source provenance and branches

- Available original standalone source snapshot: commit
  `7be5bc14971d67445dc68282aee140b75833b476`, local branch
  `zioncore-2nd-task-source`, 225 tracked files before this release preparation.
- The original source is preserved separately on private GitHub branch
  `preservation/zioncore-2nd-original`; its GitHub snapshot commit is
  `9629f8892c9b28ffa6a4d9a99ff897c71cb9b9d2`.
- The original source history is retained in the private repository's
  `preservation/worktree-history` bundle, including the
  `zioncore-2nd-task-source` ref.
- This preparation branch, `zioncore-2nd/standalone-prep`, starts from the
  available source commit above. It does not change the archival branch or
  GitHub `main`.
- The prepared branch includes the original 225-file source snapshot, the
  separate Genesis master, this readiness report, and a one-line lockfile
  correction. The Git tree contains 228 files. The manifest at
  `governance/manifests/zioncore-2nd-standalone.sha256` covers all 227
  non-generated files except the manifest itself.
- The source worktree is clean at the original commit. Equality between this
  snapshot and the private original Replit project's inaccessible source/runtime
  cannot be independently established yet.

## Original Genesis Seed

The exact uploaded source is preserved at
`governance/genesis/GENESIS_SEED.original.txt`.

- SHA-256:
  `f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e`
- The seed text is not edited or paraphrased. Technical corrections, if later
  approved, must be separate from this immutable master.
- The original standalone source commit did not contain a Genesis file. The
  seed is therefore an additive file on this preparation branch, copied
  directly from the user's uploaded source.
- The original standalone API server currently exposes only `/api/healthz`;
  its AI analysis call is made from the browser through Firebase AI Logic.
  Backend Genesis-context integration is not yet implemented in this original
  source branch. This report does not claim otherwise.

## Source route and capability inventory

The available snapshot registers these frontend routes in `App.tsx`:

- `/` — Live Lab
- `/history`, `/history/device`, `/history/:id`, and
  `/history/device/:id` — observation history and detail
- `/exploration` — Celestial Exploration

The inspected app source does not register `/missions`, `/astronomy`,
`/bioacoustics`, `/voice-v2`, `/access`, `/dashboard`, or `/messages`; no
dedicated page modules for those experiences were found in this snapshot. The
API server has only `/api/healthz`; it does not contain server-side sign-in,
billing, messaging, or AI routes. This proves those paths are absent from this
snapshot, not that they were removed from the private original project.

## Reproducible source correction and validation

The original lockfile's `tsx` catalog specifier (`4.23.15`) did not match the
workspace catalog range (`^4.21.0`), so a clean frozen install failed. On this
separate preparation branch only, the lockfile specifier was changed to
`^4.21.0`; the resolved version remains `4.23.15`. The original source branch is
unchanged.

The pushed commit was checked from a fresh shallow clone of GitHub branch
`zioncore-2nd/standalone-prep` at
`e6f10476d0bd177e7c4e18d1653807535e3697d0`. The clone contained 228 tracked
files. With the required `PORT=18238 BASE_PATH=/` build environment:

- `pnpm install --frozen-lockfile` — passed; 980 packages linked, no downloads.
- `pnpm run build` — passed workspace typecheck and builds for the mockup,
  API-server, and frequency-lab packages.
- Frequency-lab unit tests — 34/34 passed.
- Firestore emulator rules tests — 7/7 passed against the demo emulator only.
- SHA-256 manifest verification — 227/227 files passed.
- Clean-clone working tree after verification — no changes.

An initial build attempt without `PORT` failed because the mockup Vite config
requires it; the clean-clone rerun with `PORT=18238 BASE_PATH=/` passed.

Non-fatal notices: Vite reports large client chunks above 500 kB; the Firebase
emulator emitted IPv6 loopback binding warnings, but the emulator tests passed.
The clean build install also reported ignored dependency build scripts for
`@firebase/util`, `protobufjs`, and `re2`; this did not fail the build or tests.

## Approved nine-phase plan availability

The accessible workspace search found references to the approved nine-phase
plan, the separate 100-phase Genesis plan, and a 20-phase reliability plan, but
did not find the exact nine phase titles, objectives, and acceptance criteria.
Those requirements cannot be recreated faithfully from the reference alone;
the original approved plan must be supplied or made accessible before a
phase-completion register can be treated as authoritative.

## Preview and deployment evidence

- The supplied preview host is
  `https://c9c8012c-55d1-412b-af8f-e60455c226a4-00-3ernpyafogg1c-33xtb81r.spock.replit.dev`.
  Its root returns a Replit private-app login page, not the ZionCore UI, so
  browser access to the standalone app cannot be verified without authorized
  access to that Replit project.
- The preview's `/api/healthz` returned HTTP 200 with `{"status":"ok"}`. This
  verifies only the health route, not authentication, AI, Firebase data access,
  billing, or customer workflows.
- The current workspace's verified deployment URL is
  `https://zioncore.replit.app`, the main ZionCore application. It is not an
  independent ZionCore 2nd deployment and is not presented as one.
- No independent published ZionCore 2nd URL or build-to-commit mapping is
  available from this workspace. No production publication or change to the
  main app, Firebase, Stripe, rules, or customer data was made.

## Remaining blockers

1. Replit's official instructions state that the project owner must grant
   collaborator access manually; an Agent cannot request or manage it. The
   owner can open the original project and start the Agent there, or use the
   project's Invite flow to add an authorized human editor. Do not paste private
   invitation links or credentials into chat.
2. The approved nine-phase plan's exact titles and acceptance criteria were not
   found in accessible files and must be supplied before authoritative phase
   tracking.
3. The available backend snapshot has only a health route. The cloud AI call is
   client-side; backend authentication, Genesis context integration, and
   production workflows remain unverified.
4. No independent deployment was created or published. This task workspace
   cannot publish a forked project; publication must occur from the authorized
   original project after owner review.
5. Firebase sign-in, App Check token exchange, Firestore compatibility, Stripe,
   and real customer/admin journeys were not tested against the standalone
   deployment.

The main ZionCore source and production service remain untouched. Phase 3 is
not complete until the original standalone project and its independent
deployment are accessible and verified.
