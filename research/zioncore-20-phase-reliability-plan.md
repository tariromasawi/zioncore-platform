# ZionCore: 20-phase reliability and capability plan

## Objective

Deliver the capabilities described on the frontend with evidence, preserve the
existing product and customer data, and drive known critical/high-severity
defects to zero. Literal zero weaknesses cannot be guaranteed; every phase must
instead produce measurable acceptance evidence and keep unverified behavior
clearly identified.

Do not remove frontend information or replace a missing capability with
marketing language. Keep measured signal data, supported protocol decoding,
and exploratory spiritual interpretation distinct.

## Phases and exit criteria

1. **Baseline claims against working capabilities — COMPLETE**
   Map public product claims to code, tests, and known limitations. Record the
   current launch blockers without editing the site copy.
2. **Restore Firebase data access — BLOCKED**
   Have a project administrator grant the least-privilege Firestore data role
   needed by the backend. Verify an authenticated read, then a safe write/read
   only if explicitly authorized. Do not alter IAM from the service account.
3. **Verify Firebase Authentication and App Check — PARTIAL**
   Test email, Google, and Apple sign-in, token validation, session renewal, and
   App Check in development and production with real authorized accounts.
4. **Prove data ownership and Firestore rules — PARTIAL**
   Verify a customer can access only their own wallet/history and that client
   writes to balances, ledgers, reservations, or entitlements are denied.
5. **Verify live AI provider connectivity — PASS (development)**
   Make an approved minimal Gemini request, then exercise OpenAI fallback,
   provider timeouts, limits, cost accounting, and safe error handling.
6. **Verify paid interpretation accounting — PARTIAL**
   Confirm quote → reservation → generation → settlement/release is atomic,
   idempotent, recoverable, and reflected in the persistent balance.
7. **Verify Stripe catalog and checkout configuration — PARTIAL**
   Reconcile the approved live prices, currency, VAT presentation, account
   authentication, return URLs, and environment boundaries.
8. **Verify Stripe webhook fulfillment — PARTIAL**
   Confirm signature mapping, duplicate delivery handling, credit fulfillment,
   subscription events, reconciliation, and safe failure recovery. Use a
   controlled live transaction only with explicit charge approval.
9. **Complete wallet and membership lifecycle — PARTIAL**
   Test grants, spends, refunds, renewals, cancellations, expiry, and balance
   history against persistent data without resetting existing accounts.
10. **Validate audio capture and import — PARTIAL**
    Test microphone permission, recording, file limits, codecs, sample rates,
    cancellation, silence, clipping, and failure recovery across browsers.
11. **Validate the frequency-analysis engine — PARTIAL**
    Compare measured peaks, resolution, drift, and spectra with reference tones;
    document device calibration and supported acoustic range.
12. **Validate external frequency hardware — PARTIAL**
    Test compatible RF, ultrasonic, and vibration receivers where available;
    keep unsupported ranges explicitly marked until hardware evidence exists.
13. **Validate message encoding and transmission**
    Test text/voice encoding, modulation, playback, packet boundaries, integrity,
    and user consent; add encryption/authentication only with a compatible
    protocol design.
14. **Validate reception, decoding, and recovery**
    Test real two-device transfer, packet loss, replay, corruption, recovery,
    and range; distinguish checksum integrity from sender authentication.
15. **Validate nature and animal analysis**
    Establish appropriate reference data, uncertainty, and evaluation before
    presenting species or behavior classifications as supported.
16. **Strengthen interpretation quality**
    Verify personalized, substantial reports, multi-faith context, evidence
    separation, respectful language, provider fallback, and paid failure paths.
17. **Verify history, privacy, and recovery**
    Test local/cloud persistence, account isolation, export/restore, consent,
    retention, and recovery without exposing private recordings.
18. **Improve onboarding, Premium, and accessibility**
    Verify signup and membership value, cancellation, screen-reader/keyboard
    access, mobile Safari, desktop layouts, and clear purchase choices.
19. **Harden performance, security, and operations**
    Resolve dependency/storage warnings, startup and bundle costs, rate limits,
    monitoring, backups, alerting, and owner-dashboard access.
20. **Run the launch gate**
    Complete the authenticated customer journey, reconcile real production
    services, publish only an approved build, monitor a staged rollout, and
    issue a go/no-go report with evidence and rollback steps.

## Phase 1 baseline — 8 November 2026

### Capability mapping

| Frontend capability | Evidence/status |
| --- | --- |
| Microphone and imported-audio analysis | Implemented in the browser; signal measurements are available locally. Physical device calibration is not certified. |
| AI interpretation and faith reflection | Prompt/schema/provider paths exist. The server now rejects a requested reflection unless it has at least three paragraphs of at least 30 words each. A real authenticated production generation was not run. |
| Encoded messages | Text and short voice packets can be prepared, played, and decoded through supported paths. Packets are limited and are not sender-authenticated or encrypted; real two-device interoperability remains unverified. |
| Frequency receiver, RF, ultrasound, animal/species recognition | Hardware-specific sensing and classification remain unverified or absent; the frontend describes these boundaries. |
| Personal learning/evolution | Saved history and comparison provide user-specific continuity; no autonomous model retraining is claimed. |
| Credits and Premium | Pricing, reservation, ledger, and entitlement code paths exist and have automated coverage; live purchase-to-balance and subscription lifecycle evidence is incomplete. |

### Verified during the baseline

- Existing homepage, stage descriptions, Messages, Discover, Field Guide, and
  education/SEO routes were reviewed against the implementation. Their known
  hardware, packet, and interpretation boundaries were retained.
- The targeted interpretation-quality test passed (2/2); API typecheck passed.
- The full local release workflow passed types, unit/emulator suites, and
  production builds. The API restarted successfully and `/api/healthz` returned
  HTTP 200. These are not production customer-journey tests.
- The production `ai_interpretation_jobs.expiresAt` collection-group ascending
  index now reports `READY`; the existing three field indexes were preserved.
  The read-only cleanup query still fails with Firestore `PERMISSION_DENIED`
  (code 7). No documents were deleted.

### Phase 1 outcome

The frontend is substantially represented by working code, with several
hardware and production paths explicitly incomplete. The highest-priority
blocker is Phase 2: the production index is fixed, but Firestore document access
is still denied. Live sign-in, provider generation, Stripe fulfillment, and the
complete paid customer journey remain unverified. No frontend content was
removed or rewritten.

## Phase 3 progress — 8 November 2026

### Verified

- Firebase web configuration and the App Check site-key variable are present in
  both development and production environments; values were not displayed.
- Email registration, sign-out, sign-in, duplicate-account rejection, and bad
  password rejection pass against the Auth Emulator.
- The server Admin SDK accepts a real emulator-issued ID token, rejects a
  malformed token, and accepts a refreshed token for the same UID.
- API identity middleware tests pass for missing/invalid credentials, verified
  UID handling, owner claims, and the optional App Check header.
- Provider UI code is wired for Google and Apple redirects with actionable
  setup and account-collision errors.

### Still unverified

- Real production email, Google, and Apple sign-in and redirect return flows
  require authorized test accounts and were not exercised.
- App Check token acquisition and server verification were not tested against
  reCAPTCHA Enterprise. The client treats App Check as best-effort, and API
  routes currently allow authenticated requests without an App Check token.
- The backend verifies Firebase ID tokens, but revocation checking is not
  enabled. Production session renewal and sign-out behavior were not tested.

Phase 3 remains **PARTIAL**, not a production authentication certification. No
production credentials, providers, App Check enforcement, or IAM settings were
changed in this phase.

## Phase 4 progress — 8 November 2026

### Verified locally

- Firestore rules permit a signed-in customer to read their own membership and
  observation records while rejecting cross-account observation and membership
  access.
- Client Firestore reads, creates, updates, and deletes are denied for wallet,
  credit-transaction, reservation, and interpretation-job records.
- Wallet and transaction-history API routes use only the UID set by verified
  Firebase identity middleware. Tests confirm a caller-supplied `uid` query
  value cannot select another account, and requests without a verified UID
  return 401 before the ledger is called.
- These checks use the local emulators and isolated route tests; they did not
  access or alter production customer data.

### Still blocked

- A real production wallet/history read cannot be verified until the existing
  Firebase Admin data-access permission issue from Phase 2 is resolved. Passing
  emulator rules and route tests is not evidence of production Firestore access.

Phase 4 remains **PARTIAL** pending an authorized production read for a real
customer account and confirmation that a second account cannot access it.

## Phase 5 progress — 8 November 2026

### Verified

- Gemini and OpenAI integration secrets are present in development and
  production; no values were displayed.
- The existing Gemini client made live requests using `GOOGLE_GENAI_API_KEY`.
  The `gemini-3-flash-preview` model responded, and one short response parsed
  as the requested JSON probe.
- The existing fallback router was exercised with a controlled synthetic
  Gemini 503. Its OpenAI callback made a real request through the configured
  OpenAI integration; `gpt-5.4-mini` returned a valid response and the router
  reported `fallbackUsed: true`.
- Two Gemini probes and one OpenAI fallback response included token usage
  metadata. The application’s conservative estimates total approximately
  $0.001415 USD; this is an estimate, not the providers’ final bill.
- API tests passed 82/82, including provider fallback, timeout/deadline,
  concurrency/cooldown, output validation, and usage-cost estimation checks.

Phase 5 is **PASS for live provider connectivity and tested safeguards in the
development runtime**. Production secret presence is confirmed, but a request
from the deployed production runtime was not made. Paid customer accounting and
wallet settlement remain Phase 6 and are not proven by these provider checks.

## Phase 6 progress — 9 November 2026

### Verified

- Production pricing configuration matches the approved 35-credit price:
  approval is enabled and a pricing version is present. Values were checked
  without printing the version or other environment values.
- The development runtime has no approved price configuration, so the quote
  route fails closed there rather than generating a billable interpretation.
- Firestore Emulator accounting tests passed **15/15** across wallet, job
  recovery, and fulfillment cases. They cover bucket priority, idempotent
  operations, persistent emulator balances, reservation/settlement/release,
  concurrent overspend prevention, replay, stale leases, and recovery.
- API unit tests passed **101/101**, including price validation, ambiguous
  reservation recovery, provider failure handling, and wallet response checks.
- The route code verifies the current quote before claiming a job, reserves
  before provider work, validates and saves a result before settlement, and
  attempts release on generation failure. Uncertain reservation state remains
  recoverable under the same request key.
- Added an HTTP-level integration test against the local Firestore Emulator.
  It verifies an unauthenticated quote is rejected; a signed quote matches the
  approved price; credits are reserved before the provider callback; a valid
  result is persisted before settlement; repeating the same request returns
  the saved result without another provider call or charge; and failed primary
  plus fallback providers release the reservation and close the job as failed.
- The coordinated `pnpm run verify:release` gate passed workspace typechecks,
  frontend unit tests, Firestore rules emulator tests, wallet/fulfillment/
  recovery tests (**17/17**, including the new route integration test), and
  production API and web builds.

### Still unverified

- The route-level test uses the Firestore Emulator and deterministic provider
  callbacks; it is not evidence of production Firestore access, live provider
  generation, or a real customer charge.
- A real production wallet read/write and paid interpretation were not tested.
  Phase 2's Firestore permission failure prevents that check. No production
  customer data, balances, or credits were touched.

Phase 6 is **PASS for the route-level accounting chain in the isolated emulator
environment**, and remains **PARTIAL for production** until authorized
production wallet access and a controlled live paid interpretation are
verified. Emulator results are not production payment or persistence evidence.

## Phase 7 progress — 8 November 2026 (historical snapshot)

### Verified

- The deployment service confirms the public production site is
  `https://zioncore.replit.app` and its current build is reported successful.
- Production checkout flags are `live`, approved, and configured for automatic
  tax, paid usage, and Premium. Live Stripe and webhook secrets are present.
- The published billing-catalog endpoint responded successfully with
  `checkoutEnabled: true` and `portalEnabled: true`. This verifies that the
  deployed app can read its live catalog; no Checkout Session was created and
  no charge was made.
- Stripe's live catalog contains the five approved credit prices, all active
  in GBP with inclusive tax: 250/£2.50, 500/£5, 1,050/£10, 2,750/£25, and
  5,750/£50.
- The workspace's billing-catalog tests passed **3/3**. The workspace source
  exposes only the current approved packs and Premium.

### Launch blockers found

- The published endpoint returns only the older 50/£2.50, 200/£8, and
  1,000/£32 credit offers plus £1/month Premium, and marks them purchasable.
  That response conflicts with both the approved live catalog and current
  workspace source. The deployed behavior must be brought into sync and
  rechecked before promoting Checkout.
- The live £1/month Premium price has exclusive tax behavior. With automatic
  tax, applicable tax may be added to £1; this does not establish a
  tax-inclusive £1 customer total.
- Checkout success, cancel, and portal return URLs are built from a validated
  request Origin. The published host is known, but the production
  `REPLIT_DOMAINS` allowlist could not be verified through the environment
  variable viewer, and no authenticated Checkout session was created.
- Development is marked `live` mode but its live-approval and tax flags are
  false, so the application code should keep Checkout disabled there.

Phase 7 remains **PARTIAL**. No Stripe catalog items or production settings
were changed. The public pricing mismatch and Premium tax treatment need
resolution before Phase 7 can pass.

### Production recheck — 9 November 2026

- The public production `GET /api/billing/catalog` returned HTTP 200 with
  `checkoutEnabled: true` and `portalEnabled: true`. The endpoint successfully
  returned the currently purchasable live Stripe offers:
  250/£2.50, 500/£5, 1,050/£10, 2,750/£25, 5,750/£50, and Premium at £1/month.
  The prior credit-catalog mismatch is therefore resolved in the deployed
  public catalog response.
- Production configuration reports live mode, checkout approval, automatic
  tax, paid usage, and Premium enabled. The live API and webhook secrets are
  configured; only existence status was checked, never their values.
- Checkout code requires Firebase-authenticated identity, looks up an
  allowlisted Stripe price server-side, and uses only the approved production
  origin for return URLs. Live sessions enable Stripe automatic tax. No
  Checkout Session was created and no charge was made.
- The development environment reports live mode but does not have the required
  production checkout-approval and automatic-tax flags, so its live Checkout
  path should remain disabled.
- Focused local catalog, billing-origin, fulfillment, and webhook-delivery
  checks passed **16/16** with Firestore Emulator enabled.

### Remaining Phase 7 gaps

- The public catalog response does not expose Stripe `tax_behavior`. The prior
  Stripe inspection recorded Premium's £1 price as tax-exclusive; this turn
  did not re-query that field. Therefore the £1 Premium amount cannot be
  represented as a verified VAT-inclusive total. No Stripe price or tax
  setting was changed.
- No authenticated customer Checkout Session, billing-portal session, or live
  webhook delivery was exercised. The catalog response proves deployed
  live-catalog access and enabled flags, not a completed customer payment.

Phase 7 is **PASS for live catalog access, approved GBP amounts, and checkout
configuration checks**, but **PARTIAL for VAT-inclusive Premium pricing and an
authenticated end-to-end checkout journey**. No customer charge or production
Stripe resource modification was performed.

## Phase 2 recheck — 8 November 2026

- The credential loaded by the API project for this Firestore check matched the
  supplied service-account identity and target project:
  `zioncore-firebase-cli@ethereal-throne-b20e6.iam.gserviceaccount.com` /
  `ethereal-throne-b20e6`. The Firestore database reached was `(default)` in
  `us-central1`.
- Effective IAM `testIamPermissions` returned HTTP 200. Index permissions
  `datastore.indexes.list` and `datastore.indexes.get` are effective, but
  entity permissions `datastore.entities.get`, `.list`, `.create`, `.update`,
  and `.delete` are not.
- The previously failing collection-group cleanup query was rerun against the
  production project and still failed with Firestore code 7,
  `PERMISSION_DENIED`. The precise missing permission for this query is
  `datastore.entities.list`.
- Firestore Admin API field configuration confirms all four existing
  `expiresAt` single-field indexes are `READY`, including the ascending
  `COLLECTION_GROUP` index. This matches `firestore.indexes.json`.
- Because the read-only query failed and create/get/delete permissions are
  absent, the authorized temporary-document write/read/delete test was not
  attempted. No customer documents or indexes were changed.

Phase 2 remains **BLOCKED**. The intended data-access role is not effective
for the credential and project tested. Before changing IAM, verify the
`roles/datastore.user` binding is on this exact project and service account,
and check for a conditional binding, deny policy, or propagation delay.

### Retest after reported IAM update — 8 November 2026

- The current `FIREBASE_SERVICE_ACCOUNT_JSON` credential again matched the
  supplied service-account email and project. Effective permission checks
  remain unchanged: entity `get/list/create/update/delete` are denied, while
  index `list/get` are allowed.
- The cleanup query again failed with code 7, `PERMISSION_DENIED`; therefore
  the temporary write/read/delete test was skipped as authorized.
- The public production `/api/healthz` endpoint returned HTTP 200. This
  confirms the app is reachable, not that production Firestore data access
  works.

## Phase 8 progress — 8 November 2026 (historical snapshot)

### Verified

- The deployed live endpoint
  `https://zioncore.replit.app/api/stripe/webhook` is publicly reachable.
  An unsigned POST returned HTTP 400 with “Missing Stripe signature.”
- Stripe lists two enabled live webhook endpoints at that same ZionCore URL.
  One subscribes to the handler's relevant events; the other is broadly
  subscribed. The app has one configured live signing secret, so confirm the
  secret-to-endpoint mapping; the extra destination may create invalid
  signature retries or duplicate deliveries. Neither endpoint was changed.
- The handler is registered before JSON parsing, verifies signatures before
  fulfillment, and only acknowledges after Firestore fulfillment succeeds.
  Unit tests passed **12/12** for signature rejection, tampering, retryable
  fulfillment failures, paid-session validation, event/mode matching, and
  idempotency keys.
- Firestore Emulator wallet/fulfillment tests passed **15/15**, including
  duplicate and asynchronous paid-event fulfillment exactly once and
  test/live isolation.

### Still unverified

- No valid signed production event or paid transaction was sent. The Phase 2
  production Firestore permission failure also prevents proving production
  credit fulfillment.
- No dedicated automated tests currently exercise subscription
  created/updated/deleted or `invoice.paid` membership transitions.
- Endpoint-specific signing-secret matching is unverified; the endpoint list
  does not disclose its signing secrets.

Phase 8 remains **PARTIAL** until production Firestore writes, signing-secret
mapping, and subscription lifecycle are verified. No live transaction was
attempted because the plan requires explicit charge approval.

### Production route and membership recheck — 9 November 2026

- The published webhook route was probed with an unsigned request and a
  fabricated signature. Both returned HTTP 400 (`Missing Stripe signature`
  and `Invalid Stripe signature` respectively), before fulfillment. No valid
  event was sent and no production records were changed.
- The focused Stripe webhook and fulfillment suite passed **16/16** with the
  Firestore Emulator enabled. It covers signature rejection, body tampering,
  retryable fulfillment failure, paid-session validation, mode isolation, and
  duplicate/async credit fulfillment.
- Added Firestore Emulator tests for subscription status-to-entitlement mapping
  and the membership writer. They verify Premium for active/trialing only,
  denial for past-due/canceled states, stale-event ordering, access-period
  metadata, and separation of live and test membership documents. The full
  wallet/fulfillment/recovery suite passed **19/19**.
- The complete `pnpm run verify:release` gate passed, including workspace
  typechecks, frontend tests, Firestore rules, wallet/fulfillment/recovery
  tests, and production builds. After restarting the API workflow, its local
  `/api/healthz` endpoint returned HTTP 200.

### Still unverified

- No valid signed production webhook or paid transaction was sent. Production
  Firestore fulfillment remains unverified because the last recorded IAM
  diagnostics show entity writes are denied.
- The last recorded live Stripe inspection found two enabled endpoints at the
  same destination and did not establish which endpoint matches the configured
  signing secret. This recheck did not query Stripe's endpoint list.
- Tests exercise the membership persistence helper, but not a complete signed
  `customer.subscription.*` or `invoice.paid` event through production Stripe
  API retrieval and Firestore fulfillment.

Phase 8 is **PASS for production signature-gate reachability and isolated
credit/membership fulfillment checks**, but remains **PARTIAL for production
event fulfillment** until the exact signing-secret mapping, Firestore access,
and a valid authorized live event are verified. No live charge was made.

## Phase 9 progress — 8 November 2026

### Verified in isolated tests

- Firestore Emulator wallet/fulfillment suite passed **15/15**. It covers
  idempotent grants, promotional-before-purchased consumption, reservations,
  settlement caps, release restoring original buckets, concurrent
  overspend protection, duplicate paid-event fulfillment, and legacy receipt
  reconciliation.
- API unit tests passed **82/82**, including wallet/history routes using only
  the verified Firebase UID and denying requests without a verified identity.
- Existing wallet behavior does not reset a missing summary when transaction
  history exists. Expired interpretation-job results are unavailable and
  cleaned up by emulator tests.

### Still incomplete or unverified

- Production Firestore data permissions remain denied, so persistent live
  wallet balance/history and membership records cannot be checked. No
  production customer data was read or changed in this phase.
- Stripe refund events currently create a `manual_review_required` billing
  record; they do not automatically reverse purchased credits. No automated
  test verifies refund review or its eventual resolution.
- Subscription-created/updated/deleted and `invoice.paid` membership
  transitions have implementation code but no dedicated lifecycle tests.
- Membership expiry/cancellation and balance-history behavior have not been
  proven against production records.

Phase 9 remains **PARTIAL**. Emulator results verify wallet primitives, not
production persistence or the complete refund and Premium membership lifecycle.

## Phase 10 progress — 8 November 2026

### Verified

- Focused audio unit suite passed **22/22**, covering microphone constraints,
  sample-rate bounds, silence, malformed/unsupported inputs, the 12 MB import
  boundary, WAV rate parsing, high-rate WAV preservation, and worker
  cancellation/resource cleanup.
- Chromium headless with a fake microphone verified permission denial messaging,
  retry after permission was granted, capture start/stop, and cleanup. The
  simulated capture reported 44.1 kHz / 22.05 kHz Nyquist; it is not evidence
  about a physical microphone's frequency response.
- In that browser, a provided 60-second 44.1 kHz WAV and a provided
  10-second MP3 both imported and analyzed locally. The WAV produced 256
  analysis frames. No interpretation/provider request was made.
- A synthetic clipped 1 kHz waveform remained finite and analyzable; the
  estimated dominant peak was 996.1 Hz. The current analysis does not expose a
  dedicated clipping flag or warning.
- Local engineering release checks passed; the web workflow remained running.

### Still unverified

- No iPhone/iOS Safari, Firefox, or physical-device test was available. Actual
  microphone hardware, device interruptions, and browser-specific permissions
  remain unverified.
- Only WAV and MP3 imports were exercised in Chromium. AAC, M4A, OGG, and WebM
  decoding, plus file-import cancellation during a real browser decode, were
  not independently verified.
- Clipped input is processed but is not explicitly identified to the user.

Phase 10 remains **PARTIAL** pending real-device/cross-browser validation and
the remaining codec and cancellation checks. No production data or audio was
changed or sent to an AI provider.

## Phase 11 progress — 8 November 2026

### Local reference-file measurements

The supplied test WAVs were PCM 16-bit, mono, 44.1 kHz. Their digital Nyquist
limit is 22.05 kHz. The production analyzer was run against the decoded files
at its default 4,096-point FFT and at 8,192 points:

| Fixture | Nominal | Measured peak | FFT spacing | Result |
| --- | ---: | ---: | ---: | --- |
| Reference tone | 1,000 Hz | 1,001.29 Hz | 10.767 Hz | within half-bin |
| Low tone | 20 Hz | 21.53 Hz | 10.767 Hz | within half-bin; centroid 20 Hz |
| Low tone | 100 Hz | 96.90 Hz | 10.767 Hz | within half-bin |
| Low tone, 8,192 FFT | 100 Hz | 102.28 Hz | 5.383 Hz | within half-bin |
| High tone | 8,000 Hz | 7,999.58 Hz | 10.767 Hz | within half-bin |
| High tone | 18,000 Hz | 18,001.76 Hz | 10.767 Hz | within half-bin |

For the steady reference tones, reported dominant-frequency drift and
stability over the analyzer's sampled window were zero. The 20 Hz result
illustrates the coarse bin spacing of a 4,096-point FFT at 44.1 kHz; the
8,192-point setting gives finer resolution. The analyzer reports FFT-bin
frequency, so resolution is not the same as calibrated measurement accuracy.

The Copper challenge and Mudzimu resonance files produced non-tonal,
time-varying spectra. The challenge's dominant/secondary peaks were 107.67
and 258.40 Hz with a 384 Hz centroid; the Mudzimu file's leading peaks were
107.67, 215.33, and 430.66 Hz with a 251.6 Hz centroid. These are descriptions
of the supplied digital recordings, not source identification or spiritual
evidence. The two supplied Copper Resonance Matrix WAVs are byte-identical, so
they are one fixture rather than an independent A/B comparison.

### Supported range and calibration boundary

The analysis accepts digital sample rates from 8 kHz through 192 kHz, giving a
mathematical Nyquist ceiling from 4 kHz through 96 kHz. Actual capture reports
the browser/device-negotiated rate; the test devices negotiated 44.1 kHz.
These digital limits do not establish the microphone or speaker's acoustic
response, calibration, or ability to capture or emit those frequencies. No
calibrated microphone, acoustic calibrator, or physical receiver was available,
so hardware accuracy and physical bandwidth remain unverified.

Phase 11 remains **PARTIAL**: the supplied digital references passed the
software resolution check, but physical calibration and independent Copper
Matrix comparison are not established.

## Phase 12 progress — 8 November 2026

### Verified in the digital pipeline

- Repository inspection found no WebUSB, WebSerial, WebBluetooth, or HID
  receiver integration. The live input path uses browser microphone capture;
  the local file path accepts WAV data. The UI accurately says that dedicated
  RF, ultrasound, or vibration sensing requires a compatible receiver and
  that direct calibrated-device support is not available.
- Chromium imported synthetic 30 kHz / 96 kHz and 40 kHz / 192 kHz WAVs while
  preserving their source sample rates and displaying the corresponding
  48 kHz and 96 kHz Nyquist limits.
- The app's analyzer measured the synthetic peaks at 30,000 Hz and 39,984.38
  Hz respectively. The latter is within one 46.875 Hz FFT bin (0.0391%
  relative error). These were generated digital test files, not signals from
  a physical receiver.

### Hardware validation still blocked

- No RF, ultrasonic, or vibration receiver was connected or available. No
  physical signal was sampled, and no sensor calibration, gain, noise floor,
  passband, or device protocol was verified.
- A high-rate WAV demonstrates digital decoding only; it does not show that a
  microphone, speaker, or receiver can capture or transmit that frequency.

### Universal device software implementation — 8 November 2026

- Added a versioned adapter registry and a strict common signal envelope that
  keeps acoustic waveforms, RF IQ, acceleration, and environmental data in
  separate typed domains. Adapter declarations include models, connection,
  platform/browser, acquisition, units, rate/bandwidth basis, calibration,
  discovery, permissions, lifecycle, recovery, formats, dependencies, and
  reference documentation.
- Added the customer-facing `/devices` centre with browser capability
  detection, device profiles for AudioMoth 1.2.0, RTL-SDR Blog V4,
  PhidgetAccelerometer MOT0100, Echo Meter Touch 2 Pro, microphones, and
  environmental loggers. It labels browser, file, and bridge-required paths
  separately.
- The local importer reads WAV metadata and supported acoustic spectra; accepts
  timestamped accelerometer CSV with per-axis/vector frequency analysis; and
  summarizes environmental CSV without inventing a spectrum.
- Added raw receive-only CU8, CS8, and CF32 IQ import with operator-supplied
  tuning metadata, relative spectrum/level, and AM/FM demodulated WAV preview.
  No transmission or arbitrary network discovery is implemented.
- Added local report export excluding source recordings and documented the SDK
  and security boundary in `DEVICE_ADAPTER_SDK.md`.
- Focused adapter/import suite passed **12/12**. Full local release checks
  passed workspace typechecks, frontend **140/140**, API **82/82**, tooling
  **10/10**, Firebase Auth emulator **3/3**, Firestore rules emulator **9/9**,
  wallet/fulfillment emulator **15/15**, and both production builds. Desktop
  and mobile preview screenshots rendered the new page without browser errors.

### Remaining partial requirements

- No physical receiver, sensor, calibration target, or live device protocol was
  available. AudioMoth and Echo Meter work through supported WAV imports;
  RTL-SDR and Phidgets currently have local file paths only. No authenticated
  local companion bridge is installed or connected, so live RTL-SDR tuning,
  VINT acquisition, hardware discovery, reconnect, and physical performance
  remain unverified.
- Vendor reference links are included in the adapter profiles, but external
  documentation fetches returned HTTP 402 during this run. Device-specific
  driver and export requirements therefore still need manual confirmation
  before labeling those references independently verified.
- Browser capability detection reports API availability, not permission-granted
  accessory discovery. Direct WebUSB/Web Serial/Web Bluetooth integration is
  not claimed because the named device protocols are not implemented in those
  browser APIs here.
- The existing paid AI interpretation contract is acoustic. RF IQ,
  acceleration, and environmental summaries stay local; a domain-specific AI
  schema, quality validation, user consent, quote, and credit settlement path
  must be added before paid AI interpretation of those signal types.
- These additions do not complete the separate production Firebase IAM,
  Stripe fulfillment, live sign-in, or production customer-journey checks in
  earlier phases. The release workflow explicitly remains an engineering check,
  not launch approval.

Phase 12 remains **PARTIAL**. Software file paths and domain-specific signal
calculations are implemented and tested, but live receiver/bridge integration,
AI interpretation for non-acoustic domains, and physical reference
measurements remain unverified. No hardware was configured and no production
customer data or payment settings were changed.

## Phase 13 progress — message encoding and transmission

### Verified

- Text/prayer packets and short voice packets round-trip through the supported
  local BFSK/8-FSK decoders. Tests cover UTF-8 boundaries, the text byte limit,
  voice duration boundaries, truncation, corruption, CRC results, and invalid
  sample rates.
- Playback is controlled by a dedicated lifecycle controller. Tests verify the
  capped gain, fade-stop, completion cleanup, invalid input rejection, repeated
  start serialization, and cancellation while an audio context is still
  starting.
- Headless Chromium exercised the Messages page: speech-to-text remains
  disabled until consent is checked, local text encoding labels the packet as
  unsent, Web Audio playback starts, and Stop updates the state and cancels
  output.
- Local recording, encoding, decoding, and playback do not call a provider or
  payment endpoint. The only speech-recognition option is separated and
  consent-gated; the browser provider may process that speech outside ZionCore.
- CRC is explicitly described as error detection, not sender identity.
  Encryption and sender authentication are not implemented.

### Not physically verified

- The browser test cannot verify audible output, real speaker-to-microphone
  range, packet loss under room conditions, or interoperability on two
  independent physical devices. Those receiver and recovery checks remain in
  Phase 14. No claim of successful environmental transmission is made.
- After the playback lifecycle changes, the release gate passed: frontend
  **146/146**, API **82/82**, tooling **10/10**, Auth Emulator **3/3**,
  Firestore rules Emulator **9/9**, wallet/fulfillment Emulator **15/15**, and
  both production builds. The web build still reports its >500 KB bundle
  warning.

Phase 13’s local encoding and output-control checks are **PASS**. End-to-end
physical transmission remains **NOT TESTED**.

## Phase 14 progress — reception, decoding, and recovery

### Verified in software

- The decoder recovers a valid text packet after a 250 ms leading capture delay.
- Removing a complete encoded symbol from the payload is rejected as a
  truncated or checksum-failed packet; no partial text is presented as
  verified. Existing tests also reject truncated frames and bit corruption.
- Replaying a valid packet retains the same untrusted message ID. A bounded
  256-ID, in-memory session window now shows a user-visible duplicate/replay
  warning for repeats within that window. It does not persist IDs or claim to
  prevent a replay across sessions.
- Headless Chromium imported a generated WAV through the actual Messages file
  picker, recovered its text with CRC status, and showed the warning after the
  same packet was imported again.
- The full release gate passed after the Phase 14 changes: frontend **150/150**,
  API **82/82**, tooling **10/10**, Auth Emulator **3/3**, Firestore rules
  Emulator **9/9**, wallet/fulfillment Emulator **15/15**, and both production
  builds.
- Message IDs and checksums are not authentication. A sender can reuse an ID;
  without a cryptographic identity/signature protocol, replay detection is
  advisory only. Payload encryption, forward-error correction, and automatic
  retransmission are not implemented.

### Not physically verified

- No two independent physical devices, microphone/speaker pair, room, or range
  measurement was available. Hardware transfer, acoustic packet loss in real
  environments, and reception range remain **NOT TESTED**. The tests use
  deterministic signal data and a generated WAV; they are not evidence of
  hardware reception.

Phase 14’s local decoder and duplicate-awareness checks are **PASS**.
Physical transfer and range remain **NOT TESTED**.

## Phase 15 progress — nature and animal analysis

### Implemented and locally tested

- Shared text-feature and raw-audio prompts disclose that ZionCore has no
  validated labeled animal/environment reference set; species and behavior
  claims must remain explicitly unverified hypotheses.
- A deterministic server quality gate rejects common unqualified animal and
  environmental source labels, animal behavior assertions, and claims that an
  animal is conveying intent. Qualified hypotheses remain available.
- Raw-audio segment observations are checked before being included in the
  returned paid interpretation. The UI marks these observations as exploratory
  and unverified.
- Regression tests cover definitive source labels, environmental event labels,
  animal behavior and intent, cautious hypotheses, and the complete report
  quality gate.
- The release gate passed: frontend **150/150**, API **85/85**, tooling
  **10/10**, Auth Emulator **3/3**, Firestore rules Emulator **9/9**,
  wallet/fulfillment Emulator **15/15**, and both production builds.

### Not empirically validated

- No labeled wildlife/environment reference recordings or commercial-use
  licensing evidence are present in the repository or attached assets examined
  for this phase. No species or environmental-class accuracy can therefore be
  claimed.
- The safeguards are targeted text-pattern checks, not a complete semantic
  verifier. They reduce common overclaims but cannot guarantee detection of
  every rephrased model error.
- Reference-set evaluation, per-class metrics, cross-recorder validation, and
  independent ecological review remain outstanding.

Phase 15’s **software claim safeguards are implemented**. Empirical
animal/environment classification accuracy is **NOT TESTED** and remains
blocked on suitably licensed, labeled reference data and independent
evaluation. See `research/zioncore-bioacoustic-evaluation.md` for the evidence
requirements. The web build retains its existing >500 KB JavaScript-chunk
warning.

## Phase 16 progress — interpretation quality and paid failure paths

### Implemented and locally tested

- The shared prompt requests a detailed five-domain report and a separately
  opted-in, multi-faith-aware reflection. It uses context the user supplied,
  does not infer a religion, and requires confidence to stay scoped to measured
  patterns/data quality.
- The server quality gate enforces substantial requested reflections and now
  rejects targeted unverified divine-source, audio-based danger, coercive
  religious, and confidence-scope claims, in addition to existing signal and
  bioacoustic overclaim checks.
- Provider fallback tests now exercise a semantic-quality rejection, confirm
  one fallback attempt, and verify a validated fallback can be accepted.
- When both providers fail quality checks, a deterministic paid-job recovery
  test verifies that the held reservation is released rather than settled.
  Existing ledger and job tests cover idempotent reservation, settlement,
  recovery, and ambiguous reserve/release outcomes.
- The paid route was inspected: response schema and deterministic quality
  checks run before the generated result is recorded and the reservation is
  settled. Invalid output therefore follows the failure/release path.

### Not verified live

- No real Gemini/OpenAI customer interpretation, authenticated production
  request, live billing operation, or religious-content review by a human was
  performed in this phase. The provider, wallet, and route checks are local
  tests/code-path inspection; they are not proof of production availability or
  model accuracy.
- Text-pattern safeguards are targeted defense-in-depth, not a complete
  semantic or theological reviewer. No system can guarantee error-free
  personalized religious interpretation.

The release gate passed: frontend **150/150**, API **88/88**, tooling
**10/10**, Auth Emulator **3/3**, Firestore rules Emulator **9/9**,
wallet/fulfillment Emulator **15/15**, and both production builds. The web
build retains its >500 KB JavaScript-chunk warning.

Phase 16’s local quality, fallback, and paid-failure checks are **PASS**.
Real-provider generation, production billing, and human-reviewed religious
content remain **NOT TESTED**.

## Phase 17 progress — history, privacy, and recovery

### Implemented and verified in local/emulator checks

- The history screen now explains its retention and recovery boundary. Local
  records are browser-profile data, are not encrypted by ZionCore, and can be
  read by someone with access to that profile. Cloud observations stay in the
  signed-in account until the customer deletes them.
- The privacy guide now distinguishes saved observation retention from
  short-lived AI retry records. In production, completed retry records expire
  after 24 hours and a server sweep removes them; removal can occur after the
  exact expiry time. A Firestore emulator test verifies the 24-hour expiry and
  confirms the retry document contains no raw-audio field.
- External audio consent now has one shared version identifier. The server
  accepts only affirmative consent for the current version; tests reject
  missing, false, non-boolean, and outdated consent.
- Firestore emulator tests verify that another account cannot list, update, or
  delete observations and that undeclared raw-audio fields are rejected.
- Existing local archive tests continue to cover validated JSON export/import,
  merge-only restore, duplicate/conflict handling, damaged archives, quota
  failures, concurrent writes, and avoiding overwrite after a stale preview.
- Typecheck, frontend **150/150**, API **89/89**, tooling **10/10**, Auth
  Emulator **3/3**, Firestore rules Emulator **11/11**, wallet/fulfillment
  Emulator **16/16**, and both production builds passed.

### Remaining recovery and production limits

- Backup import merges into local browser history only; direct cloud-to-cloud
  restore is not implemented. Cloud exports are still available as JSON/CSV.
- Local history is not a device backup; clearing browser data can remove it.
  Cloud observation retention is customer-controlled, with no automatic
  expiration. No self-service deletion flow for the complete account and its
  billing/ledger records was added; that needs a separate retention and
  accounting decision.
- Cloud permissions were tested in the Firestore emulator, not against
  production data. The browser cloud-history calls were code-inspected, not
  signed in and exercised end-to-end in a real customer account. No production
  records were read, changed, or deleted.

Phase 17 is **PASS for local/emulator engineering checks**, with cloud restore,
full account deletion, and production cloud verification outstanding.

## Phase 18 progress — onboarding, Premium, and accessibility

### Implemented and locally verified

- Signup and sign-in messaging states clearly that account creation is free,
  does not start a subscription, and only saves observations the customer
  chooses. Google and Apple ID methods remain visible and correctly grouped
  for assistive technology.
- The account panel now has a semantic heading. Checkout and billing buttons
  expose busy states to assistive technology and update their labels while
  opening Stripe.
- Membership display distinguishes active Premium, payment due, pending setup,
  ended, expired, and Free. A verified Stripe-linked record keeps the billing
  portal link visible even when it no longer grants Premium, so past-due or
  ended customers are not silently cut off from billing management. This does
  not grant Premium access; entitlement remains server-verified.
- The billing page explains that Stripe portal controls depend on the
  configured Stripe settings; cancellation availability was not assumed.
- Membership-state tests, signup/auth tests, the complete release suite,
  responsive CSS review, and desktop/mobile preview screenshots passed.

### Remaining verification limits

- The release suite passed: frontend **152/152**, API **89/89**, tooling
  **10/10**, Auth Emulator **3/3**, Firestore rules Emulator **11/11**,
  wallet/fulfillment Emulator **16/16**, and both production builds.
- Google/Apple sign-in was not completed with real provider accounts, and no
  live Stripe checkout, cancellation, or billing-portal action was performed.
  Stripe portal cancellation settings remain unconfirmed.
- Desktop and mobile preview layouts were checked, but real iPhone Safari,
  keyboard-only use, and screen-reader behavior were not exercised end to end.

Phase 18 is **PASS for local software checks and preview review**; production
provider, portal, and assistive-technology verification remain outstanding.

## Phase 19 progress — performance, security, and operations

### Implemented and verified

- Applied compatible dependency updates for vulnerable transitive packages,
  resolved the Zod 3 peer mismatch, and replaced the resonance uploader's MD5
  comparison with SHA-256 without overwriting existing objects.
- Bounded the in-process AI cooldown map to 5,000 recently active accounts.
- Lazy-loaded the signal-card studio, resonance library, and local backup
  recovery panel. Added a build-time startup JavaScript ceiling of 200,000
  gzip bytes. The final static startup measure was **184,367 gzip bytes**
  (down from 191,480 before the Phase 19 changes).
- Traced the image-burst `MaxListenersExceededWarning` to the one-shot
  `teeny-request` stream used by the Google Storage fetch pipeline. The
  Phase 19 per-request listener allowance was an interim mitigation only; it
  silenced the warning without fixing the pipeline lifecycle. Phase 20
  replaces it with explicit stream piping and cancellation/error handling.
- The Phase 19 concurrency probe returned zero warnings while that interim
  allowance was active; this was not accepted as root-cause verification.
  Phase 20 repeats the probe without any listener-limit changes.
- Requested all 19 resonance visual endpoints through the running API:
  **19/19 returned HTTP 200**. Desktop and mobile previews rendered without
  browser-console errors. `/api/healthz` and the public billing catalog
  returned HTTP 200; the unauthenticated owner-summary request correctly
  returned HTTP 401.
- Release gate passed: frontend **153/153**, API **90/90**, tooling
  **10/10**, Auth Emulator **3/3**, Firestore rules Emulator **11/11**,
  wallet/fulfillment Emulator **16/16**, and both production builds.
- Final security scans found no critical issues and **zero HoundDog findings**.

### Remaining risks and blockers

- Dependency audit still reports **2 high and 3 moderate** findings. One high
  is Zod 3, used by shared runtime validation and fixed only by a major Zod 4
  migration; the other is UUID 9 in the Firebase CLI tooling dependency tree,
  whose fix is also a major upgrade. Neither was force-upgraded because that
  could break generated schemas or Firebase tooling.
- Static analysis reports two medium findings for the public browser
  `VITE_FIREBASE_API_KEY` configuration in `.replit`. These are client Firebase
  configuration values, not server credentials; restrict their Google API
  usage and maintain Firebase rules/App Check. No key value is included here.
- The API still logs Google authentication-library notices about the
  deprecated Storage `credentials` option and validation of its trusted,
  fixed sidecar configuration. They did not prevent asset reads, but should
  be revisited with the next Storage SDK/auth update.
- The production Firestore cleanup query continues to be denied by IAM.
  Consequently, production backup/restore, index status, and customer-data
  operations remain unverified. No production data, index, credential, or
  permission was changed.
- AI cooldown/concurrency guards are bounded per process, not shared across
  multiple server instances. Transactional wallet reservations remain the
  cross-request protection for paid work, but a distributed request limiter
  still needs an authorized shared backend.
- The owner dashboard has authorization and response-shape tests, but no live
  owner session was used. Health is a liveness check; external alerting,
  production backup monitoring, and real-device accessibility checks are not
  configured or verified. The Vite build still warns about a large static
  JavaScript chunk and the deferred Firestore SDK chunk, despite the measured
  startup gzip size remaining below the new budget.

Phase 19 is **PARTIAL**: local engineering, performance-budget, and visual
asset checks pass, but the major dependency upgrades and production operations
listed above remain outstanding. This is not production launch approval.

## Phase 20 progress — Zod 4 and storage-stream lifecycle

### Implemented and verified

- Migrated the workspace's direct Zod consumers to **Zod 4.6.7**: generated API
  schemas, shared frequency contracts, the web app, and database tooling.
  Orval now generates Zod 4 schemas and TanStack Query v5 hooks; `drizzle-zod`
  is on its Zod 4-compatible release. Removed only the mockup sandbox's unused
  direct Zod dependency. No customer-facing module, schema behavior, or
  product feature was intentionally removed.
- A first typecheck found stale `node_modules` symlinks still resolving Zod 3
  after the catalog update. A full workspace install corrected those links;
  a fresh typecheck and the subsequent release gate passed.
- Removed the listener-limit workaround and replaced the `teeny-request`
  pipeline bridge with a backpressure-aware stream pipe plus explicit handling
  for source errors, premature close, and downstream cancellation. No
  `setMaxListeners` increase or global listener change remains.
- Read-only App Storage verification: **16 concurrent real asset reads**, 0
  errors and 0 listener warnings; early cancellation after the first chunk,
  0 errors and 0 listener warnings. The test did not read or change customer
  records.
- After restarting the API, all **19 full visual responses returned HTTP 200**
  and all **11 audio byte-range responses returned HTTP 206** under 12-way
  concurrency. These checks validate delivery/range handling; they are not a
  full playback or physical-audio verification.
- Full local release gate passed: workspace typechecks; frontend **153/153**,
  API **90/90**, tooling **10/10**, Auth Emulator **3/3**, Firestore rules
  Emulator **11/11**, wallet/fulfillment/recovery Emulator **16/16**, and both
  production builds. No live payments or production data mutations were run.
- Startup JavaScript remained within its enforced budget at **197,385 gzip
  bytes** of 200,000. The build still reports oversized individual chunks.
- Fresh security scans: **0 critical, 1 high, 3 moderate** dependency
  findings; 2 medium SAST findings; **0 HoundDog findings**. The Zod 3 high
  finding is cleared. The remaining high finding is UUID 9 in the
  Firebase-tools development dependency tree; its available fix requires a
  major update and was not applied without CLI compatibility verification.

### Remaining production and operational blockers

- Production Firestore cleanup still returns `PERMISSION_DENIED`; production
  index state and cleanup behavior remain unverified. No production index,
  IAM permission, credential, customer record, or environment setting was
  changed.
- Real Google/Apple sign-in, live Stripe checkout/webhooks/fulfillment, and a
  real paid AI request were not tested. The release gate explicitly covers
  local and emulator behavior, not live production transactions.
- The API continues to log Google authentication-library notices about the
  Storage `credentials` option and trusted-configuration validation. These
  are separate from the listener warning and were not changed in this phase.
- SAST continues to flag two Firebase browser-configuration lines in `.replit`;
  the scan did not establish that these are server credentials. Review the
  associated Google API restrictions and Firebase rules/App Check.
- The frontend build remains under its gzip budget with only **2,615 bytes**
  of headroom, and oversized chunk warnings remain. No budget was relaxed.

Phase 20 is **PASS for the Zod migration, stream-lifecycle fix, and local
engineering checks**. It is **not production launch approval**: the remaining
IAM, security-audit, live-payment/provider, and bundle risks above are still
open. No feature-loss approval was needed.
