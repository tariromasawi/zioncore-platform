# ZionCore vision-to-implementation matrix

**Snapshot:** 2026-11-10  
**Related register:** [ZionCore completion ledger](ZIONCORE-COMPLETION-LEDGER.md)

## Source material reviewed

- Founding product brief: `attached_assets/Pasted-ZIONCORE-PHASE-1-PIONEERING-INTELLIGENCE-PRODUCTION-COM_1794278098340.txt`
- Finalisation requirements and repository history: `research/zioncore-completion-audit.md`, `research/zioncore-bioacoustic-evaluation.md`, `research/zioncore-release-checklist.md`, `research/replit-capcut-zioncore-strategy.md`
- Protocol and operations documentation: `docs/acoustic-message-protocol.md`, `docs/production-operations.md`, `docs/project-analytics-events.md`
- Shared product decisions: `.agents/memory/zioncore-product-direction.md`, `.agents/memory/ai-interpretation-quality.md`, `.agents/memory/audio-provider-consent.md`, `.agents/memory/credit-wallet-accounting.md`, `.agents/memory/membership-entitlements.md`, `.agents/memory/resonance-engine.md`
- Available Git history: `main`, `replit-agent`, and `gitsafe-backup/main`; the current `main` HEAD is recorded in the completion ledger. The deployed revision is not exposed by current deployment metadata.

## Core product lanes

The founding brief names SENSE, INTERPRET, REPROGRAM, BROADCAST, and DISCOVER. The product code does not define five autonomous engine classes with those names. The lanes map to existing, composable tools:

| Product lane | Actual implementation and customer entry | Dependencies and data boundary | Status and completion path |
|---|---|---|---|
| **SENSE — receive a signal** | `/` live lab: `src/App.tsx`, `src/hooks/use-local-audio-recorder.ts`, `src/lib/audio-recorder.ts`, `src/lib/audio-file-analysis.ts`, `src/lib/signal-analysis.ts`. `/devices`: `src/components/device-connection-center.tsx`, `src/lib/device-adapters.ts`, `src/lib/device-signal-importers.ts`. | Microphone permission or user-selected file; processing is local. Adapter profiles distinguish browser microphone, AudioMoth and Echo Meter file imports, receive-only RTL-SDR IQ/bridge, Phidget bridge, and environmental CSV. | **Software input paths exist.** Synthetic/test-browser coverage is not physical receiver evidence. Complete the already-tracked Safari, desktop-browser and specialist receiver checks; describe imports separately from live connections. |
| **TRANSLATE — measure, decode, interpret** | Measurements: `src/lib/signal-analysis.ts`, `src/lib/audio-file-analysis.ts`. Supported packet decode: `/messages`, `src/components/messages-page.tsx`, `src/lib/acoustic-message.ts`. AI result: `src/components/analysis-panel.tsx`, `src/lib/ai-analysis.ts`, `/api/ai/interpretation` and `/api/ai/interpretation/audio-quote`. | Local measurements stay in the browser. Standard AI receives derived features and selected context. Direct audio review is a separate, explicitly consented, quoted provider request. Paid API processing depends on verified Firebase identity, Firestore job/credit records and the configured provider. | **Local measurement and protocol paths have tests; production AI is unverified.** A real minimal Gemini request and a real authorized paid job through result delivery and settlement remain necessary. Quality gates reduce unsupported claims but are not a species or source classifier. |
| **REPROGRAM — compose and encode** | `/messages`: local text/prayer packet and optional short voice packet generation, WAV export and message preview. Implemented in `src/lib/acoustic-message.ts`; protocol details in `docs/acoustic-message-protocol.md`. | User-authored text or user-recorded short voice. Encoding and WAV creation are local; the supported protocol applies framing and CRC. | **Documented software encoder exists.** Encoding prepares a signal; it does not transmit it. Test actual cross-device packet recovery and environmental noise before claiming broad interoperability. |
| **BROADCAST — user-authorized output** | `/messages` user-started playback/download, `src/lib/audio-playback.ts`; resonance assets are served by `/api/resonance-audio/:assetId`. | Browser audio output or a user-downloaded file. The resonance library registers the Mudzimu Unoyera asset and its App Storage path; the asset file is present in `attached_assets`. | **Acoustic output/export path exists; live asset delivery and real-device playback were not verified in this stage.** No browser RF transmitter, continuous scheduler, or remotely authorized broadcast engine is implemented. |
| **DISCOVER — compare and learn under user control** | `/discover` mounts `src/components/discovery-studio.tsx`, which compares two locally saved observations with `src/lib/discovery-engine.ts`. This stage connects that UI to the existing versioned record builder/archive in `src/lib/research-experiments.ts`. | The user supplies a hypothesis and explicitly saves a record. The record stores measurement metadata and provenance, not audio or observation notes; it remains in the current browser profile and is exportable. No provider, analytics, cloud, or credit request is needed for this operation. | **Local, user-directed research record path is connected in this stage.** This is personal comparison, not model training or production knowledge change. The separate consent/owner-reviewed shared-learning pipeline remains unimplemented and must wait for verified Firebase identity/data paths. |

## Interpretation and research domains

| Intended experience | Actual source and interface | Evidence boundary and remaining work |
|---|---|---|
| **Spiritual and devotional exploration** | Optional faith-reflection toggle and display in `src/components/analysis-panel.tsx`; report separation in `src/lib/faith-reflection.ts`; user-context and claim controls in `lib/frequency-ai-contract/src/genesis-seed.ts` and API output validation. `/messages` accepts prayer as user-authored packet content. | A generated reflection is a chosen interpretive layer, not a sensor measurement or proof of source. The named devotional audio is registered in the listening library. A private Masawi family prayer archive, scheduled playback program, and authenticated cross-device devotional archive are not present as a complete customer workflow. |
| **Animal, environmental, and plant-associated inquiry** | Local signal measurements and environmental/vibration CSV importers; domain evidence panel and research lens. `research/zioncore-bioacoustic-evaluation.md` records that there is no licensed labeled wildlife set or validated species classifier. | Pattern structure can be measured and hypotheses explored. Species, behavior, plant communication, or intent must remain unverified without an appropriate sensor method, traceable references, and measured precision/recall. The next step is lawful dataset selection and a bounded evaluation taxonomy, not stronger claims. |
| **Celestial and cosmic exploration** | Domain schemas and hypothesis/evidence types exist in `lib/frequency-ai-contract/src/cosmic-intelligence-grid.ts`; selected contextual guidance also exists in the shared Genesis seed. | The web app does not import or mount the cosmic domain registry. No astronomical dataset adapter, calibrated receiver pathway, or observatory data workflow was located in the application routes. Sonification would be a representation of data, not an original audible cosmic recording. Connect only after selecting licensed, provenance-rich datasets and a real customer workflow. |
| **Unknown signals and controlled comparison** | `/discover` compares saved observation peaks/settings, labels the finding as repeatable, changed/ambiguous, or insufficient, and suggests a next experiment. | Similarity is a comparison result, not source attribution or an intentional reply. Repeat captures, controls, provenance, and non-result records are necessary for stronger conclusions. |

## Records, accounts, and commercial operations

| Capability | Actual source and interface | Current completion status |
|---|---|---|
| **Recording, local history, and recovery** | `/` capture/import, `/history`, `/history/:id`; `src/lib/observations.ts`, `src/lib/observation-validation.ts`, `src/components/observation-backup-restore.tsx`. | Local, browser-profile records and local export/restore are implemented. Cloud sync depends on Firebase Auth and authorized Firestore. Local records are not encrypted and are not automatically synchronized. |
| **Signal Cards and sharing** | Completed analysis mounts `src/components/signal-card-studio.tsx`; `/cards` reopens the local collection; export helpers in `src/lib/signal-card-export.ts`. | Cards are private/local by default; edit/export does not re-run AI or charge credits. No hosted public card URL or cloud sync is implied. |
| **User identity and customer navigation** | `src/components/account-access.tsx`, `src/lib/firebase-auth.ts`, `src/lib/firebase.ts`, `src/middlewares/firebase-identity.ts`. | Google, Apple, and email/password code exists, but the owner reported a production Google return with no clear signed-in state. `/dashboard` currently routes to the wallet page; it is not a distinct complete customer overview. Real session/profile/owner flows require interactive production verification. |
| **Wallet, credits, and paid services** | `/wallet`; API `/api/wallet`, `/api/wallet/transactions`, `/api/billing/catalog`, `/api/billing/checkout`, `/api/billing/portal`, AI quote/submit/recover; Firestore-backed server ledger and Stripe webhook handler. | Source implements reservations, idempotency, provider settlement/release, and webhook verification. The approved schedule is 250/500/1,050/2,750/5,750 credits for £2.50/£5/£10/£25/£50, Premium £1/month, and one full interpretation at 35 credits. Production configuration is live-mode capable, but no live purchase, signed webhook fulfillment, recurring subscription lifecycle, or customer balance journey was verified in this stage. |
| **Premium membership** | `/premium` mounts `src/components/premium-comparison-page.tsx`; membership display and server entitlements are in `src/lib/membership.ts`, API billing/webhook routes, and Firestore. | The approved concrete benefit is private side-by-side comparison of saved observations, separate from AI credits. The active entitlement and billing-portal lifecycle must be verified in production; do not advertise extra benefits or recurring credits without implementation and approval. |
| **Owner operations** | `/admin` and `/owner` mount `src/components/owner-dashboard.tsx`; `/api/owner/summary` and `/api/owner/firebase-diagnostics` use server-side owner checks. | Protected source routes exist. The exact production owner identity/session and diagnostics were not executed in this stage. Use the owner’s actual interactive Firebase session; do not trust an email supplied by the client or bypass authentication. |
| **Public guide, SEO, and analytics** | `/discover`, `src/lib/guide-content.ts`, `src/lib/project-analytics.ts`, `src/components/seo-route-metadata.tsx`, plus static SEO routes in `public/` and artifact rewrites. | Source entry points exist; published search indexing, actual analytics collection, signup attribution, and production metadata were not re-verified. Event payloads must remain free of emails, recordings, notes, faith context, frequencies, and free-text search. |

## Required interpretation vocabulary

Use these as distinct result types throughout the interface:

1. **Measurement:** calculated from actual input samples and reported with acquisition settings and limitations.
2. **Decoded content:** bytes/text recovered by a named supported protocol after framing and checksum validation. The current CRC does not authenticate a sender or prove delivery.
3. **AI interpretation or hypothesis:** model-generated explanation with uncertainty and provenance; it is not decoded data.
4. **Spiritual or symbolic reflection:** optional, user-selected context; it does not establish the physical source of a signal.
5. **Experiment observation:** a recorded comparison against specified baselines/controls; it does not establish intentional communication by itself.

## Stage 2 implementation record

- Replaced the inconsistent six-card homepage description with the founder’s seven named stages: Receive → Decode → Interpret → Learn → Encode → Transmit → Observe.
- Updated the AI Genesis seed to version `1.1.0` and aligned its runtime architecture and lane definitions with the same seven-stage cycle.
- Connected `research-experiments.ts` to the Discovery Studio. Users can explicitly save their own unverified hypothesis with derived measurement metadata to a local archive and export saved records. Raw audio, observation notes, provider calls, analytics, cloud storage, and credit usage are excluded from this action.
- Added focused tests for stage-contract wording and research-record provenance, local persistence, damaged-archive preservation, and quota failure.

### Remaining blockers after Stage 2

- Production deployment cannot yet be tied to a Git SHA; the workspace changes are not published by this stage.
- The production Google/Apple session and complete customer dashboard remain unverified; the Google signed-in state has a reported defect.
- Firebase records contain a timeline conflict: `research/zioncore-completion-audit.md` records an index-ready but `PERMISSION_DENIED` data query on 2026-11-08, while `docs/production-operations.md` records successful read/query and isolated document testing on 2026-11-09. A fresh owner-authorized check is needed before treating cloud history as reliable.
- No live Gemini request, real paid job/settlement, signed production webhook delivery, or subscription lifecycle was executed.
- Physical receiver, two-device transmission, iPhone interruption, other-browser, and ultrasound verification remain pending.
- Autonomous learning, owner-reviewed shared knowledge publication, species identification accuracy, cosmic datasets, family devotional archive/scheduling, and RF broadcasting remain outside the implemented verified software path.
