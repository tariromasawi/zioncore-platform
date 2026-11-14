# ZionCore Phase 2 source preservation index

Repository: https://github.com/tariromasawi/zioncore-platform (private; owner tariromasawi). Default branch main remains the initial empty commit 0418e864d93e929eb60425ba5854beca76763ecf. No application source was pushed to main. These branches are preserved source snapshots and must be selected explicitly.

## Source branches

| Branch | Snapshot commit | Files | Purpose |
| --- | --- | ---: | --- |
| preservation/zioncore-main | 1ecbfd6dd050d6c05c7049d0fc96459023e492f8 | undefined | Main ZionCore source snapshot (generated-artifacts excluded) |
| preservation/phase-87-owner-claims | ebdb0dacb2930b7a6cc44b6620bbb86967888b99 | undefined | Phase 87 worktree snapshot |
| preservation/phase-88-dashboard-metrics | 03572b836212c94b774646196f6c857b32dd9e29 | undefined | Phase 88 worktree snapshot |
| preservation/phase-89-cost-guards | 14885b1f6c848057c4d58f4e1ddfe3a774950da7 | undefined | Phase 89 worktree snapshot |
| preservation/phase-90-recovery-operations | eccd549fb2b24b29ea36027698cf7361c19b1413 | undefined | Phase 90 worktree snapshot |
| preservation/zioncore-2nd-original | 9629f8892c9b28ffa6a4d9a99ff897c71cb9b9d2 | undefined | Original standalone ZionCore 2nd source candidate |
| preservation/phase-91-version-architecture | c5d414f2d94c27195d1d6a7b55e8d20408750205 | undefined | Phase 91 worktree snapshot |
| phase2/source-preservation | 1cfe61c4aeb72593ae6fd832c11230b6cad1f74f | undefined | Current Phase 2 source snapshot |
| preservation/zioncore-main-lockfile-fixed | 87c1d33a762ff360e50c9d4c2e6882e5f1efe8e5 | 360 | One-line lockfile correction, original source branch preserved |

A complete SHA-256 file inventory for each listed branch is under inventories/*.csv. Each row records exact repository-relative path, Git mode, byte count and SHA-256.

## Git history preservation

Committed task-worktree history is separately saved at preservation/worktree-history, commit fc01aa97fbf455c89abc5fb62fea017c4f8a19aa. Its split bundle is 1,689,659 bytes across four parts and has SHA-256 686dfdb72c3b970a779595c2d1aed43bf58e600ad7604d8c3e743960a90f5797. The branch README documents reassembly and contains eight original refs. It does not include the root main worktree's full history because that ref reaches a 16.7 MB generated ZIP; the main source tree itself is preserved separately.

## Genesis source

The immutable original is at artifacts/zioncore-2nd/src/content/genesis-declaration.txt on phase2/source-preservation. SHA-256: f87c324da247443bcf6ac4c6b799241e871abc3dec8aaa69c921cd123943f95e. The contents are unchanged.

## Clean-source verification

A fresh source-tree copy was fetched from GitHub objects by commit, with every downloaded blob SHA verified. On phase2/source-preservation: pnpm install --frozen-lockfile and pnpm -w run typecheck passed; unit tests passed (frequency lab 424, API 105, ZionCore 2nd 34, emulator route 20, Genesis contract 4); API, frequency-lab and ZionCore 2nd builds passed with their required environment values. Build output contains non-fatal sourcemap, dependency annotation and large-chunk warnings.

The uncorrected preservation/zioncore-main snapshot initially failed frozen install because the workspace catalog declares tsx ^4.21.0 while the lockfile recorded specifier 4.23.15. The original branch is unchanged. The separate preservation/zioncore-main-lockfile-fixed branch changes only pnpm-lock.yaml's tsx catalog specifier; frozen install, typecheck and API/frequency-lab builds then passed.

## Scope and limits

No production deployment, Firebase rules, IAM, App Check enforcement, Stripe configuration, customer data or production service was changed. Live Firebase token exchange and auth/Firestore access remain unverified. The main application's /zioncore-2nd/ route is not integrated yet; the full second experience remains preserved as source, not a claim of finished integration. The Replit GitHub source-control pane is not connected; the authorized GitHub App API was used to create and verify the branches.

The main-source snapshot excludes generated-artifacts/ (4,386 generated paths, including the 16.7 MB ZIP); node_modules, caches and build outputs are excluded. No credential-bearing .env file was included. The scanner's Firebase web API key pattern is a public client identifier, not a credential; no service-account key, Stripe secret, private key or token was found. See the Phase 2 report in the current source branch for detailed test and security evidence.
