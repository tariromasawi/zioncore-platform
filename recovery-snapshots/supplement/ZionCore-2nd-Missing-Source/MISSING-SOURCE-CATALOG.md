# ZionCore 2nd — Missing Source Supplement

This is a companion to `ZionCore-2nd-Complete-Source.zip`. The first archive is preserved unchanged and contains the full `artifacts/zioncore-2nd/` app, including its Celestial Exploration page and its account-access component. This supplement contains the existing main ZionCore source and dependencies that were not in that first archive.

## Use and preservation

- Paths below retain their workspace-relative layout beneath this folder. Compare them with the destination project before copying; do not blindly overwrite newer main-site files.
- This is a source handoff, not a deployment or a production change. Do not deploy the candidate Firestore rules included in the source tree without a separate compatibility/security review and approval.
- Dependency manifests and lockfiles are included. `node_modules`, build output, caches, debug logs, actual `.env` files, and credential files are excluded. `.env.example` templates are retained.
- The provided Voice V2 WAV is included as a test input; this packaging step did not run a decode against it.

## Requested capabilities and what the source actually contains

| Capability | Included source / current evidence | Boundary |
|---|---|---|
| Exploration | The first archive already includes `artifacts/zioncore-2nd/src/pages/celestial-exploration.tsx`, `src/lib/celestial-experiment.ts`, and their tests. This supplement also contains the main app `/discover` page and discovery studio. | The second app's exploration is not omitted from the first ZIP. |
| Missions / discovery | `artifacts/zioncore-frequency-lab/src/components/discovery-studio.tsx`, `discover-page.tsx`, and the `discovery-engine`, `frontier-discovery`, `local-discovery-ai`, and `listening-dossier` modules and tests. | Observation comparison and research records exist. No dedicated `/missions` dashboard or scheduled mission engine was found. |
| Astronomy | `lib/frequency-ai-contract/src/cosmic-intelligence-grid.ts` and `index.ts`, plus the main discovery workflow and research guidance. | Astronomy is represented in the domain/method registry; no connected observatory feed or dedicated cosmic-observatory page was found. Specialist astronomical formats still require adapters. |
| Bioacoustics | `bioacoustic-evidence-panel.tsx`, `bioacoustic-scope.ts` and tests, the public plant-bioacoustics page, and the bioacoustic evaluation note. | Reference links are curated, but the source marks classes as hypothesis-only; recordings are not bundled or benchmarked and it does not translate animal communication. |
| Voice V2 | `acoustic-message.ts` and tests, Messages UI, audio capture/playback source and tests, plus the user-provided 48 kHz sample. | The V2 codec exists. The decoder analyzes at the supplied input sample rate (bounded to 8–192 kHz); the voice *encoder* resamples its payload to 8 kHz. This archive does not establish successful decoding of the supplied sample or validate an adaptive receive-side resampler. |
| Account / owner access | Main app `account-access.tsx`, Firebase auth/client state and tests, and API-server Firebase identity middleware, owner authorization and route source/tests. | No credentials are included. Production identity, App Check, and deployed permissions are not changed by this package. |

## Main source groups

- `artifacts/zioncore-frequency-lab/` — complete existing main web application source, configuration, static assets, tests, and safe example environment template.
- `artifacts/api-server/` — existing API/server source, route wiring, access controls, tests, and package configuration.
- `lib/` — shared workspace packages, including the frequency AI contract and cosmic intelligence registry.
- `scripts/`, `patches/`, root package/lock/workspace files — workspace build and dependency context.
- `attached_assets/0_voice_v2_non_sensitive_test_48000hz_1794436398418.wav` — supplied audio test input.

This package supplements the first ZIP; it does not replace it. Together they preserve the second app and the currently available main-app source without merging or publishing either.
