---
name: Production source provenance
description: Guardrails for reconciling deployed features with the checked-out source.
---

When a deployed feature or API route is absent from the checked-out source, require a verified source revision before modifying or replacing it. Minified production bundles and SPA-fallback `.map` responses are evidence of source drift, not authoritative source. Deployment metadata may confirm a successful build and artifact command without identifying a Git branch or commit. Do not reconstruct routes or protocols from status codes or minified output.

**Why:** Production features can be newer than the workspace checkout; a competing implementation may break compatibility, customer access, or revenue.

**How to apply:** Compare deployment metadata, artifact config, local refs, and reachable Git history. If no matching revision is found, report provenance as unknown and wait for an authorized source ref or restored files. Replit documents file history and checkpoints as Editor UI features; this workspace has no checkpoint-list/content tool. Prefer inspecting/restoring an individual file version over rolling back the whole project. Never bypass an unverified SSH host key to search a remote.
