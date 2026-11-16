# AI provider inventory

Checked 12 November 2026 against this artifact's source and the linked provider documentation. This is a source/configuration inventory, not a live provider health check. No model request or App Check token exchange was made for this inventory.

## Connected path

| Provider path | Model | Source status | Runtime status |
| --- | --- | --- | --- |
| Firebase AI Logic → `GoogleAIBackend` → Gemini Developer API | `gemini-3.5-flash-lite` | Implemented as the single cloud explanation path; the model appears in Firebase AI Logic's supported-model catalogue. | Firebase SDK/App Check configuration can be inspected in the browser, but that does not verify token exchange, live model availability, project quota, or billing tier. |

No direct OpenAI or other external-model connector is wired into this artifact's current source. The research-agent router currently registers one deterministic, browser-only acoustic statistics agent; it does not call a cloud model.

The active specialist role is read-only: it receives a frozen projection containing only dominant-frequency and relative-RMS metrics plus an aggregate session count, with a maximum of 30 observations and a $0.00 estimated request budget. It cannot access source IDs, timestamps, instrument IDs, personal text, identity, writes, capture/playback, transmission, billing, or administration. Its only declared tool is local deterministic statistics, and its output must pass the bounded result schema. Future model roles require an explicitly consented role and registered provider tool. This registry is application-level policy for trusted bundled code, not an isolated execution sandbox; user-supplied or third-party agent code is not loaded or run.

## Data sent

The explanation request is an explicit, signed-in user action. Its model prompt contains only the following measurement values plus analysis instructions:

- sample rate and FFT size;
- frequency resolution, dominant frequency, and up to six peak frequencies;
- relative RMS amplitude and measurement duration.

The prompt builder does not include raw audio, spectrum bins, user notes, account email, or devotional/family records. Firebase Authentication and App Check tokens are used separately by the Firebase request gateway and are not part of the model prompt. The generated interpretation is parsed and can be saved with the corresponding local observation. Existing browser archives are not encrypted.

The current method and prompt are version 1.1.0. Possible sources are presented as hypotheses; confidence is capped at moderate. The application generates `evidenceUsed` from the exact validated values locally after the model response, and adds fixed technical limitations locally. Neither field is model-authored or sent back to the provider.

The optional experiment-design method/prompt is version 1.0.0 and requires a separate explicit-consent action. It sends the typed question (up to 300 characters), selected registered domain and public description, and up to eight validated numeric summaries from the user's selected saved session. It excludes raw recordings, session/message/prayer text, notes, dates, session ID, account identity, instrument IDs, and personal reflections. Its output is capped at 600 tokens and is labeled as a proposal, not a discovery. The proposal is held in page memory until the user exports it; it is not automatically saved to history.

Google's published Gemini API pricing table currently distinguishes data use by tier: the free tier may use submitted content to improve products; the paid tier says it does not. Google's Gemini API terms separately state that Paid Services data-use terms apply to users in the UK, EEA, and Switzerland even when they use unpaid Gemini API quota. This artifact cannot read the project's actual provider tier, account jurisdiction, or applicable agreement. Do not send sensitive or confidential information.

## Availability and App Check

- Firebase lists `gemini-3.5-flash-lite` as supported. That establishes documented model support, not availability for this Firebase project.
- Client code requires Firebase sign-in and now obtains both an ID token and an App Check token before requesting a model response.
- Firebase also offers project-wide authenticated-users enforcement. The project setting is not readable from this client and must be checked before it can be claimed as an enforced server-side boundary.
- App Check is initialized when the site key is supplied. A valid token exchange is not confirmed by initialization alone. Firebase states that App Check enforcement is required for Firebase AI Logic from 2 November 2026.
- The latest recorded project inspection in `FIREBASE_SETUP.md` (11 November 2026) says AI Logic App Check enforcement was `UNENFORCED` and production token exchange was not verified. Do not treat that historical inspection as a fresh live check.
- Cloud AI now fails closed unless `VITE_FIREBASE_AI_PROJECT_SECURITY_CONFIRMED=true` is set in the matching build environment. This is an operator-controlled UI/readiness gate, not a substitute for Firebase project enforcement.
- Project billing status, provider selection, model enablement, and live quota are not readable from this client inventory. Those require authorised Firebase/Google Cloud project inspection.

## Quota, latency, and cost

- Firebase documents a default Firebase AI Logic `Generate content` quota of 100 requests per user per minute, plus provider/model-level requests-per-minute/day and tokens-per-minute/day limits. These are project-level settings; the active project value is not fetched by the app and may be shared with other apps using that project. The app maps quota-exhausted responses to a recoverable message. Its 15-second cooldown and in-flight lock reduce accidental rapid repeats but are client-side protection, not a server-side user quota.
- Successful explanations record browser-measured request round-trip time from model request to parsed response. This includes network and client parsing, not provider-only inference. It is saved with interpretation provenance and included in CSV export. No cross-user aggregate is collected.
- As published on 12 November 2026, Gemini 3.5 Flash-Lite standard paid rates are $0.30 per million input tokens and $2.50 per million output tokens. The app caps output at 700 tokens, so the output-token portion is at most $0.00175 per request at that rate; input is additional. The project tier, input token count, and actual charged amount are unknown to this browser.

## Official documentation

- [Firebase supported models](https://firebase.google.com/docs/ai-logic/models)
- [Firebase AI Logic pricing](https://firebase.google.com/docs/ai-logic/pricing)
- [Firebase AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas)
- [Firebase AI Logic authenticated-users mode](https://firebase.google.com/docs/ai-logic/auth-mode?api=dev)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)
