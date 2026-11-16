---
name: Browser-only storage coordination
description: Node navigator globals are not evidence of an origin-scoped browser environment.
---

Browser archive coordination must distinguish an actual browser environment
from Node globals. Inject a mutex when testing with fake storage.

**Why:** Node 24 exposes `navigator.locks`. Using that global during the injected
archive-store suite stalled verification; restricting browser lock acquisition
to a browser environment resolved it. A separate bare-Node lock probe behaved
normally, so this is not evidence that Node Web Locks are universally broken.

**How to apply:** do not remove the browser-environment guard merely because
Node provides navigator APIs. Keep origin-level coordination covered by a
browser test and storage logic covered by an injected test mutex.
