---
name: Artifact validation from worktrees
description: Handling artifact manifest validation when a branch is isolated in a Git worktree.
---

When an artifact manifest is duplicated into an isolated Git worktree, the artifact validator can reject an otherwise valid update because it sees the active artifact and worktree copy as separate artifacts sharing the same preview path.

**Why:** In Phase 92, validation returned `DUPLICATE_PREVIEW_PATH` for the existing root path, so changing the manifest in the branch would have bypassed the required validation path.

**How to apply:** Keep the active workspace and deployment configuration unchanged. Preserve the code changes in the dedicated branch, then rerun artifact validation when that branch is the active artifact source, or choose a separately approved artifact path.
