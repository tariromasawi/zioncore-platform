---
name: GCS stream lifecycle
description: Root-cause handling for listener warnings in Google Cloud Storage's Node stream bridge.
---

Google Cloud Storage's fetch-to-Node bridge should use a backpressure-aware stream pipe with explicit error, premature-close, and cancellation handling. Do not raise Node's listener limit to silence warnings: the pipeline bridge can attach repeated lifecycle listeners to short-lived streams, and a higher cap hides that behavior instead of fixing it.

**Why:** concurrent App Storage reads showed the warning came from the one-shot fetch stream lifecycle, not a retained route listener. A scoped listener increase suppressed the warning but did not resolve its cause.

**How to apply:** when changing Node or Google Cloud Storage SDK versions, verify concurrent reads and early cancellation with no `MaxListenersExceededWarning`; preserve backpressure and propagate source errors while destroying the source on downstream cancellation. Never use a process-wide or per-stream listener cap as the acceptance criterion.
