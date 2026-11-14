# ZionCore Phase 92 — Integration Branch

## Preserved source lines

- Main application starts from verified production source `ca6ff0b252155295315beae1f65fc8e71029ebc1`.
- The complete second-version application was copied from `zioncore-2nd-task-source` at `7be5bc14971d67445dc68282aee140b75833b476`.
- Work is isolated on `agent/phase-92-integration`; the main checkout and both source refs remain untouched.

## Integration prepared

The second application is retained as its own workspace package at `artifacts/zioncore-2nd`. Its original pages, styles, instruments, local history, exploration tools, Firebase code, rules, and setup documentation are preserved. The package name is unique, the client router supports the `/zioncore-2nd/` base path, and production assets are emitted under `dist/public/zioncore-2nd/`.

The intended hosting arrangement is a second path-scoped service inside the existing ZionCore web artifact. This avoids creating a new artifact or a separately billable deployment and keeps the two client applications in separate browser documents, including their Firebase initialization lifecycles.

## Verification

- Both application packages built successfully from this branch.
- The second package type-check passed and its 34 unit tests passed.
- Its local server returned the expected application document for `/zioncore-2nd/`, `/zioncore-2nd/history`, and `/zioncore-2nd/exploration`; the client rendered the matching Live Lab, History, and Exploration views.
- Desktop and mobile history-page renders were reviewed.
- The main source build passed. No production deployment, Firebase settings, Firestore rules, customer data, or billing settings were changed.
- Read-only Firebase review used the existing service-account credential through ADC. Provider status, the live App Check pairing, deployed Firestore rules, and application path permissions are documented in [ZIONCORE_FIREBASE_PRODUCTION_REVIEW.md](./ZIONCORE_FIREBASE_PRODUCTION_REVIEW.md). The production rules and enforcement settings remain untouched.
- Phase 93 checked the candidate public URLs against the live site. The intended second path currently falls through to the main application; see [ZIONCORE_PHASE_93_URL_READINESS.md](./ZIONCORE_PHASE_93_URL_READINESS.md). No private preview link was added.
- Phase 94's live destination gate failed, so the landing-page link was withheld; see [ZIONCORE_PHASE_94_LINK_GATE.md](./ZIONCORE_PHASE_94_LINK_GATE.md).
- Phase 95 rechecked production host allowlists and completed two real, read-only Firestore probes through the API's existing Admin credential. A correctly paired headless token exchange still failed attestation; no customer documents or production configuration were changed. See [ZIONCORE_PHASE_95_FIREBASE_HOSTS.md](./ZIONCORE_PHASE_95_FIREBASE_HOSTS.md).

## Remaining integration blocker

The artifact schema tool rejected validation of the proposed additional service because the isolated worktree contains a second copy of the existing artifact with the same `/` preview path (`DUPLICATE_PREVIEW_PATH`). The artifact manifest was therefore left unchanged. The second app can be tested on its own local path, but it is not yet routed through the shared Replit preview or production host.

After this integration branch becomes the active artifact source, validate and add the `/zioncore-2nd` service to the existing artifact manifest. That step must preserve the root service and use the second package's prefixed output and SPA fallback. Do not publish until that routing is validated and the user approves publication.

The separate Firebase blocker is also unresolved: the live production bundle pairs the development App ID with the production key, and automated App Check exchange returned HTTP 403. App Check enforcement is still disabled; production Firestore currently has a project-wide public read/write rule. See the Firebase review for the exact source-backed access matrix and validation results.
