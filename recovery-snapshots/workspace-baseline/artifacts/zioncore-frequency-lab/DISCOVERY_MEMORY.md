# Discovery memory versions

Saved exploration sessions can carry an optional `discoveryVersions` ledger (`zioncore.discovery-memory/v1`). The field is additive: older session records without it remain valid and are not rewritten on read.

The ledger versions four separate records:

- **Experiment:** domain, authored message, signal summary, transmission state, and references to associated observation IDs.
- **Protocol:** protocol ID, protocol-contract version, registered encoder method/version, and bounded encoding settings.
- **Hypothesis:** user-authored statement and status.
- **Interpretation:** user-authored measured-pattern description, uncertainty, reflection, and an optional exact observation link.

Each type is append-only within a session and numbered independently. The implementation retains up to 50 versions per type (200 total). It rejects sequence gaps, duplicate revision IDs, and references to observations outside the same session. Existing legacy hypothesis revision history is copied into the ledger when that record is first revised.

Raw acoustic observations remain in the session’s observation collection. Version snapshots contain only observation IDs, not the sample summaries or raw audio; changing a hypothesis or interpretation never rewrites a measurement. The existing JSON session export carries the ledger.

These records remain in ZionCore’s existing account-scoped browser archive, which is **not encrypted**. They are not sent to Firestore or shared collections. Review and secure the production storage rules and data-retention path before moving discovery memory to cloud storage.
