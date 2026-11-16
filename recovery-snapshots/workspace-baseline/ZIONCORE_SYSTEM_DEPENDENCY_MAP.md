# ZionCore system dependency map

**Reviewed:** 2026-11-10
**Repository baseline:** `main` at `5b14ee79c35a5d0e8721cdfe2d9866dfe91ce81c`
**Production:** `https://zioncore.replit.app`, public Autoscale, successful build reported; deployed Git revision is unknown.

This map follows current workspace code from entry point to result, then marks where production behavior cannot be traced to that code. Production facts below are observations; they are not substitutes for missing source.

For verified credential scopes, service-account access, Firebase registration, Stripe endpoints, and remaining owner-access blockers, see [ZIONCORE_ACCESS_AND_PRODUCTION_ALIGNMENT.md](ZIONCORE_ACCESS_AND_PRODUCTION_ALIGNMENT.md).

## End-to-end flows

### Web entry and routing

```text
artifacts/zioncore-frequency-lab/index.html
  -> src/main.tsx
  -> ErrorBoundary
  -> src/App.tsx
  -> Firebase auth-state observer + Wouter routes
       /                 Live microphone lab
       /history          Local or authenticated cloud observation history
       /history/:id      Observation detail and saved interpretation
       /exploration      Sign-in-gated experimental research session
       unmatched path    NotFound
```

`artifacts/zioncore-frequency-lab/.replit-artifact/artifact.toml` builds a static Vite app under `dist/public` and rewrites app paths to `index.html`. The API artifact is a separate Express service under `/api`, configured for port 8080. Replit's current deployment metadata exposes one primary production URL and no source revision tying either artifact to the serving build.

### Live microphone measurement and result

```text
User presses Start
  -> useLabEngine.start()
  -> InstrumentRegistry acquires browser microphone
  -> MediaStream -> AudioContext -> MediaStreamAudioSourceNode -> AnalyserNode
  -> animation-frame loop calculates sample rate, FFT resolution, peak bins, RMS,
     elapsed time, silence state, and relative spectrum
  -> Reading shown in Live Lab
       -> user may save summary to browser localStorage
       -> user may request an opt-in Gemini explanation
       -> user may explicitly save the validated summary to Firestore
```

The microphone stream is released on stop/unmount; no raw audio is recorded or uploaded. The saved observation schema is in `src/lib/observations.ts` and `src/lib/observation-validation.ts`.

### AI interpretation

```text
Stopped measurement + explicit explanation request
  -> App.tsx requestAnalysis()
  -> ai-analysis.ts validates the bounded summary and constructs the prompt
  -> firebase.ts supplies Firebase App + App Check
  -> firebase/ai GoogleAIBackend -> gemini-3.5-flash-lite
  -> strict JSON schema -> scientific interpretation, confidence,
     uncertainty, possible sources, optional faith reflection
  -> displayed separately from measurement and optionally saved with it
```

Only structured measurement summaries are sent; audio, spectrum bins, and notes are excluded. The last live request returned `RESOURCE_EXHAUSTED` because Gemini prepayment credits were depleted. The local error handling covers quota/network/permission failures. No alternate AI provider or backend route is connected.

### Cloud history and identity

```text
firebase.ts -> Firebase App -> Firebase Auth + reCAPTCHA Enterprise App Check
  -> account-access.tsx: email/password, Google redirect/link, reset, sign-out
  -> onAuthStateChanged in App.tsx
  -> cloud-observations.ts requires currentUser + initialized Auth/App Check
  -> Firestore users/{uid}/frequency_observations/{observationId}
  -> Firestore rules validate owner and observation fields
```

`firebaseCloudReady` means the client objects initialized; it does not prove the current hostname can exchange a valid App Check token. The local candidate rules match the observation path, but production rules do not: they allow public reads/writes. The published bundle combines the development Firebase App ID with the production site key. Production cloud access therefore is not verified.

Observation history in `src/lib/observations.ts` uses one device-global localStorage key. When cloud history is unavailable, signed-in users also fall back to this local collection. By contrast, Celestial Exploration sessions use a UID-suffixed localStorage key. Neither local store is encrypted.

### Experimental message, playback, observation, and research record

```text
Signed-in user opens /exploration
  -> CelestialRoute -> CelestialExplorationPage
  -> compose text/prayer intent + choose registered research domain
  -> encodeCelestialMessage() creates ZC-EXP-DTMF-v1 symbol packet
  -> decodeCelestialSymbols() verifies the same in-memory symbols/checksum
  -> createCelestialWaveform() -> Web Audio buffer -> authorized local speaker
  -> optional microphone measurement windows -> session observation summaries
  -> local measured/uncertainty/reflection/hypothesis/findings fields
  -> UID-scoped browser storage -> local statistics/comparison -> JSON export
```

The speaker output is labelled local playback, not external transmission. The decoder does not accept a recorded waveform; no two-device receive/decode path is connected. Sessions do not use Firestore.

### API, database, file storage, billing, and deployment

```text
Current API artifact:
  Express app -> /api router -> GET /api/healthz only
  -> OpenAPI HealthStatus -> generated Zod response

Current app data/services:
  Firestore client for summary observations
  No Firebase Storage or App Storage code
  No application DB tables or API DB calls
  No local Stripe checkout, webhook, wallet, or subscription handlers

Observed production host:
  /api/billing/catalog and owner/wallet/webhook paths exist at runtime,
  but are absent from current API source/OpenAPI and have no verified source SHA.
```

`VITE_FIREBASE_STORAGE_BUCKET` is configured for the web build, but the app has no `firebase/storage` import, object upload, or download flow. `@workspace/api-client-react` is a web dependency but is not imported by the current app. `@workspace/db` is an API dependency, yet the API does not import it and `lib/db/src/schema/index.ts` has no tables. `@workspace/api-zod` is used for the health response.

## Ranked repair queue

| Rank | Issue and customer impact | Inspected root cause | Planned correction and dependency |
|---|---|---|---|
| **P0 — security** | Production Firestore permits unauthenticated access across the database and six legacy roots. Private data could be read or altered. | The deployed rules are a project-wide `allow read, write` plus explicit grants on `/DivineTreasury`, `/ZionLattice`, `/SovereignPatents`, `/advancements`, `/soul_signatures`, and `/petitions`. The local candidate denies unclassified roots; all seven emulator tests pass, but production callers and schemas are not fully classified. | Recover the authoritative web/API source and inventory every Firestore path and external caller. Review a merged deny-by-default ruleset against real queries, remove the broad recursive grant rather than overlapping it, then obtain approval before production rules deployment and verify owner/cross-account/unauthenticated behavior. |
| **P0 — source and release integrity** | Production web/API behavior cannot be safely repaired or regression-tested from this checkout. | Replit deployment metadata has no Git SHA; production bundle routes and App Check config diverge from current source; current API/OpenAPI contain only health. | Recover the exact deployed source revision or archive. Reconcile current and deployed routes/data contracts in a recoverable branch. Do not recreate handlers from bundles. Obtain explicit publish approval before release. |
| **P1 — App Check and cloud/AI readiness** | Production token exchange is unverified; AI requests remain unavailable on the exhausted live quota. | `firebaseAiReady` checks SDK initialization, not successful token exchange. Browser Firestore access now also requires explicit `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` and remains off by default. The production bundle still combines the development Firebase App ID with the production key; the last observed exchange error was `403 PERMISSION_DENIED: App attestation failed`. The Shared site-key secret remains because this session cannot delete Secrets. | Remove only the Shared site-key copy through Replit Secrets, keep distinct Development/Production keys, recover authoritative production routes, and verify token exchange. Set the client opt-in only after the complete ruleset is reviewed/deployed and owner/cross-account/unauthenticated paths pass. Do not re-enable enforcement or publish without approval. |
| **P1 — local observation isolation** | Account-local records are now isolated by Firebase UID, but browser storage is not encrypted and prior anonymous-device records remain separate. | Signed-in local saves use per-UID localStorage keys; signed-out legacy records remain in the original device key. The UI clears account-scoped state on auth changes and exposes device-only history without silently migrating old records. | Preserve the non-destructive separation. Add an owner-confirmed export/import only if a future product requirement establishes who owns legacy shared-device records; never assign them automatically to the current account. |
| **P1 — cloud history** | Cloud history has no verified production authorization or compatibility and is paused in this workspace by default. | The client targets only `users/{uid}/frequency_observations`; the live rules still contain a public recursive grant, production App Check is mismatched, and the production caller inventory is incomplete. Research sessions remain local. | After deployed-source recovery, validate this path and every legacy path, review/deploy merged rules, verify App Check, then explicitly opt in and test signed-in owner save/read/update/delete, cross-account denial, and unauthenticated denial. |
| **P1 — customer identity and dashboard** | Sign-in exists in local code, but account profile, wallet, purchases, and owner dashboard journeys are missing from the checkout. | Current routes are only `/`, `/history`, `/history/:id`, and `/exploration`; production owner/customer route handlers are absent from local source. Firebase's built-in Google provider is enabled with credentials present; Apple is marked enabled but its client ID and secret are absent. Google linking must use the existing owner UID. | Restore authoritative customer/owner source. Verify Google linking on the existing owner account and backend claims, then test customer/owner authorization. Complete Apple provider configuration only through Firebase's secure settings flow when its owner credentials are available. |
| **P1 — AI availability** | AI interpretations currently cannot complete live requests. | The Firebase AI Logic call targets `gemini-3.5-flash-lite`; live quota is exhausted. | Obtain owner approval for quota/billing action, verify model availability and App Check token exchange, then test valid output, quota handling, and no-data-mutation behavior. Do not add an alternate billable provider silently. |
| **P1 — Plans, payments, and credit integrity** | The production Plans link opens a recovery screen; customers cannot complete an end-to-end verified checkout, credit settlement, subscription entitlement, or wallet journey from this checkout. | Production `/wallet` renders a display-recovery error and `/plans` is 404. `/api/billing/catalog` returns six older offers; the requested 50/200/1,000-credit and £1/month products are active in Stripe but absent from that API response. Current workspace API registers only health and has no Checkout/webhook/wallet handlers or ledger schema. The deployed payment source and idempotency path remain unavailable. | Recover authoritative production source and contracts; expose the approved active price IDs without deactivating existing offers, then verify authenticated Checkout, signed webhooks, replay/idempotency, atomic wallet settlement, and subscription entitlements using approved non-charging tests. Do not create live checkout sessions, charges, or price changes until the source and test path are verified. |
| **P2 — uploads and persistent files** | Phase 1–2 upload/import and recording workflows cannot operate; no file store is connected. | A Firebase storage bucket name is configured, but there is no `firebase/storage`, App Storage, upload route, file metadata table, or import UI. | Choose the authorized storage integration after recovering existing contracts; request consent, store bytes in managed object storage, and persist only object references/metadata. Add supported-format, retention, export, and deletion tests. |
| **P2 — acoustic receive/decode loop** | The existing encoder can generate local tone packets, but users cannot recover a message from a recorded/two-device acoustic signal. | The decoder consumes the already generated symbol array; no tone detector, synchronizer, demodulator, audio import, or independent receiver exists. | Preserve the current versioned encoder; implement a tested receiver pipeline for recorded audio, packet synchronization, CRC validation, noise recovery limits, and independent two-device verification before describing it as acoustic messaging. |
| **P2 — research persistence and response claims** | Longitudinal research and cross-device continuity are unavailable; local records are not encrypted. | Celestial sessions are UID-suffixed browser storage only; comparisons are local summaries and not causal tests. | Keep local status explicit until Firestore paths are safe. Add export/deletion and controlled baseline/post-observation comparison before adding cloud research records or claims of response. |
| **P2 — abandoned workspace connections and stale notes** | Developers may assume generated clients, Postgres, or the documented API port already power product services. | The web package declares an unused generated API client; API declares `@workspace/db` but no route imports it; the DB schema is empty. `replit.md` is still a template, says port 5000, and describes a required database; the API artifact config uses port 8080 and no application route uses the DB. | After deployed source recovery, determine whether these scaffolds are intended. Either connect them contract-first or document/remove them safely. Replace the template with verified product/run instructions and correct the port only after confirming workflow configuration. |
| **P3 — domain expansion** | Animal, plant, environmental, astronomical, and specialist sensing are visible as research domains but are not functioning domain-specific services. | Registries define identifiers and adapter contracts; only a browser microphone and deterministic acoustic statistics are active. The historical DSP analyzer is on `main-repl/main`, not current `main`. | Review and selectively recover the historical analyzer. Add datasets/sensors only with provenance, units/calibration, permissions, domain-specific validation, and a customer workflow. |

## Integration checks already evidenced

- Current Stage 5 typecheck, unit suite, production-mode Vite build, and mobile preview passed after local history/detail integration. Firestore emulator tests passed in the prior implementation pass; these UI/storage changes do not alter the rules candidate.
- The inspected current source has no unresolved-import failure. The primary API gap is missing handlers/contracts, not a broken import; the generated web API client is declared but unused.
- Production `/api/healthz` and `/api/billing/catalog` returned 200. Unauthenticated owner and wallet checks returned 401.
- The production webhook rejected an unsigned request with 400 `Missing Stripe signature.` This does not prove successful signed-event processing.
- A 402px Chromium viewport rendered the local web app. No physical iPhone/Safari microphone test is recorded here.

## Guardrails for the repair sequence

1. Do not read or copy customer records while recovering routes.
2. Do not deploy Firestore rules until legacy paths and callers are classified.
3. Do not publish production builds without explicit owner approval.
4. Do not alter Stripe prices, create live test charges, or incur AI spend without approval.
5. Keep measured values, generated signals, symbol-level decoding, AI interpretation, spiritual/personal reflection, and experimentally verified communication as distinct data and UI layers.
