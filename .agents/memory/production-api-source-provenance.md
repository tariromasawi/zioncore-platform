---
name: Production source provenance
description: Guardrails for reconciling deployed features with the checked-out source.
---

When a deployed feature or API route is absent from the checked-out source, require a verified source revision before modifying or replacing it. Minified production bundles and SPA-fallback `.map` responses are evidence of source drift, not authoritative source. Deployment metadata may confirm a successful build and artifact command without identifying a Git branch or commit. Do not reconstruct routes or protocols from status codes or minified output.

A verified production commit may exist on a production-tracking ref while the active task checkout has diverged. A commit-count difference alone does not prove that one branch is a direct continuation of the other.

**Why:** Production features can be newer than the workspace checkout; the user explicitly requires preserving those live capabilities and not publishing incomplete source or restrictive rules before dependencies are reconciled. Forked task checkouts can also contain a separate commit line, so describing them as merely "ahead" can misstate source ancestry.

**How to apply:** Compare deployment metadata, artifact config, local refs, `merge-base`, and ancestor relationships. If no matching revision is found, report provenance as unknown and wait for an authorized source ref or restored files. Replit documents file history and checkpoints as Editor UI features; this workspace has no checkpoint-list/content tool. Prefer extracting files into a separate branch over rolling back the whole project. Do not deploy restrictive Firestore rules until affected production paths and callers are reconciled. Never bypass an unverified SSH host key to search a remote.
