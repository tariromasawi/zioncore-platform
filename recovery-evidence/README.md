# ZionCore complete project source snapshot

This one-file archive preserves the available ZionCore project files across the baseline workspace, the current Phase 92 task worktree, and all six earlier task worktrees present when the archive was created. Each lane is kept separate so versions are not silently merged or overwritten.

## Folder map
- `workspace-baseline/` — baseline workspace source, project documents, configuration, research, and uploaded assets.
- `current-phase-92-worktree/` — current task snapshot, including both app artifacts, Genesis context changes, Firebase integration source, and earlier generated deliverables.
- `historical-worktrees/` — six prior task snapshots, each preserved in its own named folder.

The original Genesis seed and uploaded source instructions are included in the available source/attachment lanes. The 100-phase plan and all phase documents found in the workspace are included; no separate Phase 101 document existed in the source trees at snapshot time.

## Configuration redaction
Literal `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_APPCHECK_SITE_KEY` values in `.replit` files have been replaced with a redaction placeholder in this downloadable copy. Their setting names and file structure remain. Supply environment-specific values through Replit's environment/secrets interface after import. The original workspace files were not changed. No API keys, service-account files, or other credential values are included.

## Exclusions
This is a complete source/workspace snapshot, not a byte-for-byte Replit runtime image. `CONTENT-MANIFEST.tsv` lists every packaged file with byte size and SHA-256. Empty retained directories are included as ZIP directory entries.

Excluded only: reinstallable `node_modules`; build/cache outputs (`dist`, `build`, `.vite`, `.cache`, `.turbo`, coverage and Python caches); transient logs, TypeScript build-info, bytecode and generated source maps; Replit platform-only `.local`/`.config` modules; Git internals and worktree pointer files; actual `.env` files; credential/private-key files; and the archive output itself. `.env.example`, lockfiles, package manifests, source, tests, docs, assets, candidate rules, and existing generated deliverables are retained.

Git commit objects are not included. The current and historical working-tree files are copied as separate lanes, including uncommitted source changes, so their file contents do not depend on absolute worktree pointers.

## Use
Compare lanes before restoring. Do not overlay the baseline or historical snapshots on the current lane without reviewing differences. This archive does not publish, deploy, change Firebase, or change billing configuration.
