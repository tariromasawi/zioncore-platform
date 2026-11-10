# ZionCore access and production alignment

**Reviewed:** 2026-11-10
**Firebase project:** `ethereal-throne-b20e6`
**Workspace baseline:** `main`, commit `5b14ee79c35a5d0e8721cdfe2d9866dfe91ce81c`
**Production deployment:** `https://zioncore.replit.app`

This is an access/configuration inventory, not a production change report. Credentials and site-key values are not included. No customer records, Firestore documents, Stripe customers, or payment transactions were read.

## Verified access inventory

| Area | Verified state | Boundary or remaining issue |
|---|---|---|
| Replit project/deployment access | Current workspace files and artifact deployment settings are readable. Deployment metadata confirms a public Autoscale deployment with a successful current build and no additional production domain. | Deployment metadata does not expose the Git revision used to build the live app. |
| Replit integrations | Stripe is the only ready MCP integration. Cloudflare, GitHub, GitHub App, and Resend report `connect` and are not usable in this session. | Replit AI Integration credentials are present as environment secrets, but they are not listed as connected external connectors and are not used by the current app code. |
| Replit account/workspace roles | No `REPLIT_API_KEY` is configured. The GitHub and GitHub App integrations are not connected. | Account-level member, workspace, project, and deployment permissions cannot be enumerated from the current session. The Admin API is not a source/checkpoint recovery path. For role inventory only, the installed API contract uses `read:*` for the relevant GET endpoints; only an account admin can create the key. |
| Local source control and history | `main`, `main-repl/main`, `replit-agent`, and `gitsafe-backup/main` refs exist locally. `gitsafe-backup/main` matches `main`; the backup remote answered a read-only branch listing. All refs, reflogs, and the sole unreachable commit were searched for messaging, billing, owner, and webhook implementations. No such implementation was recovered. | `main-repl` and `subrepl-shared` point to `ssh.spock.replit.dev` and prompted for an untrusted SSH host key. It was not accepted. Replit documentation search did not find a published fingerprint to verify it. No GitHub connector is ready. No checkpoint files are present in the workspace. |
| Firebase service account | `FIREBASE_SERVICE_ACCOUNT_JSON` parses as a service-account credential for the requested Firebase project. Application Default Credentials token creation succeeded; Firebase CLI listed both registered web apps without interactive login. | The principal email is intentionally withheld. Direct project bindings include `roles/admin` and `roles/datastore.user`. IAM role-definition lookup did not resolve `roles/admin`, so its exact effective permission set remains unknown. The credential is shared across environments; no IAM changes were made. |
| Firebase project APIs | Read-only checks succeeded for Firebase project metadata, App Check, Firestore rules, Identity Toolkit, service usage, and Storage API. Relevant Firebase APIs are enabled. | An enabled API or a successful service-account read does not establish that the production customer workflow is compatible. |
| Firebase web apps and App Check | The `.replit` Development and Production configurations contain distinct Firebase app IDs and reCAPTCHA keys/hostnames that match their registrations. A local Vite build using the Production configuration contains only the production app/key pair. | The shared `VITE_FIREBASE_APPCHECK_SITE_KEY` project secret is present. Development/Production `viewEnvVars` results include inherited Shared secrets, so those results do not prove separate secret copies exist in both scopes. Production app secrets are managed separately in Publishing and were not changed. The live bundle still contains the development App ID with the production key; the prior token exchange returned `403 PERMISSION_DENIED: App attestation failed`. A corrected live token exchange remains unverified. |
| App Check enforcement | `firebaseml.googleapis.com`, `firestore.googleapis.com`, and `identitytoolkit.googleapis.com` report `UNENFORCED`. | This is intentionally unchanged. Keep enforcement disabled until a valid production token exchange succeeds. |
| Firebase Authentication | The read-only built-in provider configs report email/password enabled and `google.com` enabled with client ID and secret present. The production and preview hostnames are in Firebase's authorized-domain list. | `apple.com` reports enabled, but its client ID and secret are absent, so Apple sign-in is not ready. No values were read into the report, no accounts were exported, and no Google sign-in or same-UID owner-link flow was run. |
| Firestore | The deployed rules release is readable. It has a recursive `/{document=**}` grant for public read/write, plus explicit public read/write rules at `/DivineTreasury/{...}`, `/ZionLattice/{...}`, `/SovereignPatents/{...}`, `/advancements/{...}`, `/soul_signatures/{...}`, and `/petitions/{...}`. | The recursive grant makes narrower overlapping rules ineffective because Firestore allows access if any matching rule grants it. The local candidate only covers `/users/{uid}/frequency_observations/{observationId}`. Do not deploy until every legacy path and caller is classified and the broad grants are removed in a reviewed replacement. |
| Storage | Replit App Storage identifiers and path variables are present as shared secrets. The Firebase project Storage API is enabled, but the service-account query listed no Firebase-project buckets. | The current app/API has no Storage SDK, upload routes, or upload UI. Replit App Storage is distinct from Firebase Storage and is not connected to the app source. |
| AI | Gemini/OpenAI Replit AI integration credentials and `GOOGLE_GENAI_API_KEY` exist as shared secrets. Current app code uses Firebase AI Logic, not those Replit AI endpoints. The AI request path previously returned `RESOURCE_EXHAUSTED`. | No new model call was made because it could incur provider cost. Model availability and quota recovery remain unverified. |
| Stripe | The Stripe MCP connection is ready for one live account. The production billing catalog returns 200 with `checkoutEnabled` and `portalEnabled` true and six offers. Five live webhook endpoints are enabled; four target `/api/stripe/webhook`, one targets the Replit connector webhook path. | Only a live account is connected through MCP. Test keys exist in Replit secrets but are not a connected test-mode account here. Current API source has no billing, webhook, or wallet handlers. No endpoint was changed and no test charge was created. |

## Environment scope findings

The Firebase browser configuration is properly split:

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, auth domain, project ID, messaging sender ID, storage bucket, and App Check site key are set in **development** and **production**.
- The two App IDs and App Check keys are distinct and match the registered app/key/hostname pair for each environment.
- The App Check site-key secret exists in the project/shared Secrets tool. Remove only that entry through **Project Editor → Secrets → vertical dots → Delete**. Replit manages production app secrets separately under **Publishing → Adjust settings → Production app secrets**; verify the production key remains there, and preserve the distinct Development/Production configurations. The secret-management callback available here cannot delete secret values.

Backend and provider credentials are different: `FIREBASE_SERVICE_ACCOUNT_JSON`, the live and test Stripe credentials, Gemini/OpenAI integration credentials, `GOOGLE_GENAI_API_KEY`, and the Replit App Storage variables are in **shared** scope. Shared values are inherited by development and production. This makes live Stripe and a project-admin-like Firebase service account available to development processes and is not least-privilege isolation.

The available Replit secret-management callbacks do not provide a way to move existing secret values between scopes. The owner must move production-only values to **production**, test-only Stripe credentials to **development**, and replace the shared Firebase credential with separate least-privilege identities after the deployed backend's actual service-account use is recovered. Do not delete or rotate the current Firebase credential before identifying production consumers.

## Source recovery and messaging compatibility

The current and backup Git refs, reflogs, and unreachable objects do not contain the original `/messages`, billing, wallet, owner, or webhook source. The only unreachable commit is a prior Firebase cloud-history change. The production bundle contains route references, but it is not an authoritative source and was not used to reconstruct handlers.

Replit documentation says checkpoints are viewed in the Project Editor's **Agent** tab, **History** view, or Git pane. The [Replit Admin API](https://docs.replit.com/teams/admin-api) does not return checkpoint source files; the [checkpoint documentation](https://docs.replit.com/features/version-control/checkpoints-and-rollbacks) says a rollback restores the complete project state and removes later changes. No checkpoint files are exposed in this workspace, and this session has no checkpoint browser. Do not roll back the whole project to recover only messaging files. The owner must inspect the relevant checkpoint and extract the message files into a separate branch/copy, or provide an authorized source archive/repository. No Admin API key is needed for that recovery.

The local `ZC-EXP-DTMF-v1` experiment encodes text into DTMF symbols with framing/CRC and can play a generated waveform locally. Its decoder validates an already decoded symbol array; it does not demodulate a microphone recording. The original requirements call for a two-device acoustic send/receive demonstration. Until the original `/messages` encoder, decoder, transport, and fixtures are recovered, this local experiment cannot be called wire-compatible with production messaging.

## Local Firestore rules test

All seven Firestore emulator tests pass against the local candidate rules, including validated access under a user's own UID, unauthenticated denial, cross-account denial, and denial for unclassified legacy roots/unmatched paths. This does not validate the currently deployed rules; production still has the public recursive grant, which must be removed rather than overlapped by the candidate.

## Mobile browser preview

A static Chromium preview at 402 × 874 px shows the top navigation, spectrum panel, and capture settings fitting the narrow viewport without visible horizontal overflow. This is a visual check of the unauthenticated preview state only; it does not verify real-device microphone permission, recording recovery after interruption, or signed-in customer flows.

## Root cause and repair order

1. **App Check environment and bundle mismatch:** The `.replit` Development and Production values are distinct, but the project/shared App Check key remains and the published JavaScript bundle was built with the development App ID and production key. Remove only the project/shared entry in the Secrets tool, verify the separate production app secret remains in Publishing, restore authoritative production source, then publish only with owner approval and verify token exchange on `zioncore.replit.app`; enforcement stays off until that succeeds.
2. **Public production Firestore rules:** The currently released recursive rule allows public access across every path and overlaps six explicit public roots. Classify each root and every production caller, prepare one merged deny-by-default ruleset, emulator-test it, and deploy only after secure compatibility review and explicit approval.
3. **Shared high-privilege secrets:** Production and development share service-account and payment credentials. Re-scope in Replit Secrets, issue distinct least-privilege Firebase identities, audit role use, then revoke old keys only after the recovered production services are migrated.
4. **Unverifiable deployed backend:** The current checkout's API exposes health only; production billing routes and webhooks are not represented by its source or OpenAPI contract. Recover the exact deployed revision before changing backend routes or Stripe handlers.
5. **Messaging source recovery:** Use the Project Editor's History/Agent view to identify and provide only the original `/messages` implementation and its dependencies, or connect an authorized HTTPS source repository. The configured SSH remote can be fetched only after its host key is independently verified; do not accept the current prompt without a trusted fingerprint. Compare protocol fixtures before integrating; do not infer the transport from the minified bundle.
6. **Replit account permission inventory:** This is separate from source recovery. If account-level roles are required, an account admin can create a temporary key with the Admin API's read-only `read:*` scope for workspace/member/project/deployment GETs via Account Settings → Developer. Keep it out of shared and production secrets and revoke it after the audit.
7. **Provider verification:** After production source and scopes are aligned, test Google sign-in persistence, valid App Check exchange, cloud history ownership, AI quota behavior, and signed/idempotent Stripe events without using live charges.

## Local-only verification

A local Vite build completed using the `.replit` Production configuration. Its ignored `dist/public` bundle contains the production Firebase App ID and App Check key and excludes the development pair. This confirms that configuration can produce the correct client bundle; it does not verify Replit's separate Publishing secret injection or repair the currently published build. Nothing was deployed. TypeScript typecheck passed; all 30 unit tests passed; all seven Firestore emulator tests passed.

## Actions not taken

- No deployment or production publish.
- No Firestore rule, App Check enforcement, IAM policy, Stripe webhook, product, or secret-scope changes.
- No customer data reads, user exports, live charges, or paid AI requests.
- No SSH host key was trusted automatically.
- No tracked application source code was changed.

**Verification:** service-account ADC and Firebase CLI app listing succeeded; Firebase built-in Google and Apple provider configs were checked without displaying credentials; the active Firestore ruleset and App Check service modes were fetched; Firebase App Check app/key/hostname associations were compared against scoped Replit configuration; the local production build and public live bundle were compared; the billing catalog and Stripe webhook configuration were read; a mobile-sized unauthenticated preview was captured.
