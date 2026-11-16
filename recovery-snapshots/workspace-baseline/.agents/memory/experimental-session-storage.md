---
name: Experimental session storage
description: Storage boundary for private celestial and devotional research sessions.
---

Keep new research-session text, interpretations, and family-related records out of Firestore until the production rules and existing application access patterns are reviewed together and safe to deploy. Use account-scoped browser storage only as a clearly disclosed interim option; it is not encrypted and must not be described as secure or suitable for sensitive family information.

For devotional and family entries, prefer page-session memory plus an explicit user export over browser storage. Do not imply that sign-in encrypts local data or makes an unencrypted downloaded export safe.

Non-devotional mission plans may use account- or visitor-scoped browser storage as a local-only convenience when saving and export are explicit, the UI states that the data is unencrypted, and users are told not to enter sensitive personal or family details. Do not include devotional or ancestral domains in persistent mission records.

**Why:** Production Firestore permissions were found to include broad public access, and replacing them safely depends on understanding legacy paths and callers.

**How to apply:** Before adding cloud persistence or expanding session data, review deployed rules, actual client queries, backend access, and owner/customer authorization boundaries; deploy only after conflicts are resolved. Keep devotional entries ephemeral unless a reviewed, access-controlled persistence path and retention policy are available. A local mission archive is not a cloud history or a secure store.
