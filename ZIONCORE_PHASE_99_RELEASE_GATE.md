# ZionCore Phase 99 — Approved release gate

**Checked:** 12 November 2026  
**Decision:** HOLD — no production release authorized or attempted.

## Recoverable baseline

- Verified production source commit: `ca6ff0b252155295315beae1f65fc8e71029ebc1`.
- Previously verified successful production build: `00c62f95-66ca-47e6-b11b-64a35fc14df0` (10 November 2026, as supplied by the owner).
- The isolated integration branch still has that commit at `HEAD`; new work remains uncommitted in its worktree.
- Replit deployment metadata currently reports public `https://zioncore.replit.app`, Autoscale, with a successful current build. No deployment settings or build were changed.

## Why this candidate is not ready

1. Production Firestore still has a project-wide public read/write grant.
2. The published bundle uses the Development Firebase App ID with the Production App Check key. The correct-pair headless token exchange returned retryable HTTP 401; a normal-browser token has not been verified. Enforcement remains off.
3. ZionCore 2nd is not registered as a production artifact and has no stable production route.
4. Phase 96 passed local tests and builds, but live Google/Apple account journeys, browser-private history, live Checkout/fulfillment, and an authorized owner session have not been verified.
5. The cost estimate uses published rates, not account-specific Replit/Firebase usage.

## Release authorization path

Keep the existing deployment and known-good source/build as the recovery point. Before a future release, require:

- Review and owner approval of the exact source diff and target URL.
- A production build using the registered Production Firebase App ID, followed by successful normal-browser App Check token exchange.
- A compatibility-reviewed Firestore ruleset that removes public access while preserving the required application paths; verify customer isolation before enabling client access.
- Explicit owner approval for registering/linking ZionCore 2nd and for any additional billable deployment.
- Approved, non-production acceptance for payment behavior; do not create real customer charges as a release test.
- A successful local release gate and a documented rollback target.
- The owner to initiate the final Publish action after reviewing the release.

No Firebase rules, App Check settings, user records, prices, payments, deployment metadata, or live source were changed in this phase. The public deployment remains live as it was before the review; this HOLD applies to the proposed worktree changes.
