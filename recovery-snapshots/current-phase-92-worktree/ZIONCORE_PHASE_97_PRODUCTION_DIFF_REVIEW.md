# ZionCore Phase 97 — Production diff review

**Reviewed:** 12 November 2026  
**Baseline:** verified production source commit `ca6ff0b252155295315beae1f65fc8e71029ebc1`  
**Worktree:** `agent/phase-92-integration`  
**Result:** No committed source drift; pending workspace changes are identified below. No production actions were taken.

## Baseline and tracked changes

The worktree `HEAD` and merge base both equal the verified production commit. The committed diff from that revision is empty. The working tree has no changes to the existing API routes, billing catalogue or prices, main-app route definitions, customer-record schemas, primary Firebase client, or tracked Firestore rules.

The tracked uncommitted changes are limited to:

- `lib/frequency-ai-contract/src/genesis-seed.ts` and `src/index.ts` in the shared contract library: a compile fix and bounded AI prompt assembly; no route, price, record, rule, or provider integration changes.
- `pnpm-lock.yaml`: one new workspace importer for ZionCore 2nd; no existing importer or package-version changes.
- The reliability plan and project notes/memory: documentation only.

## ZionCore 2nd worktree additions

The untracked `artifacts/zioncore-2nd/` contains 85 source files and its own Firebase client, Auth/App Check setup, candidate Firestore rules, and environment template. It has no `.replit-artifact/artifact.toml`, so it is not registered as a production-routed artifact. Its source contains no Stripe checkout, wallet, or billing implementation. Its example keeps `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=false` and contains no credential values.

Its Firestore rules are a separate candidate, not a replacement for the production rules. They permit owner-scoped observation access and a bounded interpretation update, require microphone mode, and default-deny unclassified roots. The main app also supports imported-audio observations, so the two rule contracts are not yet interchangeable. Deploying the second app’s rules alone would not be a reviewed, compatibility-complete production merge.

The candidate tree contains generated `firestore-debug.log` and `tsconfig.tsbuildinfo` files from local checks. Exclude those generated files from any future source integration; no cleanup or deletion was performed in this review.

## Requested change categories

| Category | Phase 97 finding |
| --- | --- |
| Existing routes | No tracked production route changes. ZionCore 2nd has not been registered or linked into the main production site. |
| Prices and checkout | No price/configuration changes. No new Stripe checkout or billing path exists in ZionCore 2nd. |
| Customer records | No schema or data change; no production documents were written. |
| Firestore rules | Main tracked rules are unchanged. The deployed rules remain globally public, as documented in the Phase 95 Firebase review. The second app’s rules remain a separate, unregistered candidate. |
| Integrations | No existing provider or payment integration was changed. ZionCore 2nd adds an environment-configured browser Firebase client, with cloud-history approval off by default. |

## Release blockers unchanged

- Production still has a project-wide public Firestore grant; this is a pre-existing exposure, not introduced by the pending diff.
- The published bundle still uses the Development App ID with the Production App Check key. A valid normal-browser token is not confirmed; enforcement remains off.
- ZionCore 2nd has no registered artifact manifest or stable production route.
- No live payment or provider transaction was performed.

No routes or approved prices were removed or broadened by the pending changes reviewed here. This review does not authorize a merge, rules deployment, artifact registration, or publication.
