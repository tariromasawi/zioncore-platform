---
name: App Storage stream lifecycle
description: Storage transport cancellation requires care before upstream response setup completes.
---

Treat App Storage read-stream response setup as a lifecycle boundary: cancelling
an output before the transport establishes its pipeline is not safe in this
environment.

**Why:** A navigation-time disconnect produced an uncaught
`ERR_STREAM_UNABLE_TO_PIPE` inside the GCS transport, terminating the API. The
transport emits its response event before constructing the pipeline, so
destroying synchronously during that event is also too early.

**How to apply:** For new streaming routes and transport changes, preserve
deferred cancellation until response setup completes, and verify disconnects
before headers as well as mid-transfer. Do not hide this failure with a global
uncaught-exception handler or conflate it with the separate listener warnings.
