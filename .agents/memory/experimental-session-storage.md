---
name: Experimental session storage
description: Storage boundary for private celestial and devotional research sessions.
---

Keep new research-session text, interpretations, and family-related records out of Firestore until the production rules and existing application access patterns are reviewed together and safe to deploy. Use account-scoped browser storage only as a clearly disclosed interim option; it is not encrypted and must not be described as secure or suitable for sensitive family information.

**Why:** Production Firestore permissions were found to include broad public access, and replacing them safely depends on understanding legacy paths and callers.

**How to apply:** Before adding cloud persistence or expanding session data, review deployed rules, actual client queries, backend access, and owner/customer authorization boundaries; deploy only after conflicts are resolved.
