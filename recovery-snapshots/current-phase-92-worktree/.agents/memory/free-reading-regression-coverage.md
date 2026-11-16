---
name: Free-reading regression coverage
description: Keep deterministic guest reading tests useful as editorial copy evolves.
---

For local free-listening flows, test stable behavior and boundaries: measurement-derived values, no paid-provider dependency, no account requirement, privacy, export availability, and the report's section structure. Avoid asserting long exact paragraphs or arbitrary counts when those are editorial content.

**Why:** Editorial improvements changed report wording and section detail while leaving the guest workflow intact; brittle expectations produced misleading failures.

**How to apply:** When copy changes, update semantic assertions and retain tests for measurement validity, unsupported claims, privacy, and free access. Do not change application behavior just to satisfy stale wording snapshots.
