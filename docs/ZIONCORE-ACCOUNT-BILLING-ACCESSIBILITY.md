# Signup and billing accessibility — verification record

## Outcome

Software accessibility defects were corrected. Keyboard verification passed for the reachable signed-out account, Plans and Premium journey. **Full real-device acceptance is still incomplete:** no VoiceOver, NVDA, physical iPhone Safari or authenticated Checkout/portal session was available.

No account was created, no provider sign-in completed, no purchase/Checkout/portal session created, no subscription cancelled, and no membership or balance changed. Preview purchasing remained paused; it was not enabled for this test.

## Corrections

| Component | Root cause | Correction |
|---|---|---|
| Account access | Busy progress depended on changing text inside disabled controls. | Persistent atomic status region outside the busy form; named form and explicit busy state. |
| Password input | Minimum-length instruction existed only in placeholder text. | Persistent instructions linked by `aria-describedby`; existing native labels, validation and autocomplete retained. |
| Billing offers | Repeated generic action names obscured which offer a screen-reader button represented. | Shared accessible-name formatter includes visible action, offer, credits and formatted price; applies to enabled, signed-out and paused controls. |
| Billing handoff | New-tab behavior/progress was not explicitly described to assistive technology. | Visible linked new-tab notice, persistent progress/success status and readable/title-labelled opening window. Existing trusted Stripe URL checks and authentication remain intact. |
| Catalogue error | A failed catalogue request also appeared as “no active offers.” | Failed loading is presented as an error, not an empty catalogue conclusion. |
| Profile editor | Saving progress could be hidden within a busy form. | Named busy form with progress status outside that form. |
| Focus visibility | Billing actions relied solely on global styles. | Scoped visible keyboard-focus outline added without replacing global rules. |

## Browser evidence

Actual browser: Chromium **157.0.8103.38**; desktop viewport 1365×900.

| Check | Result | Evidence/limits |
|---|---|---|
| Sign-in / Join free keyboard switching | PASS | Enter and Space changed the pressed state correctly. |
| Email/password labels and autocomplete | PASS | Explicit labels; email, current-password and new-password semantics observed. |
| Password instructions | PASS | Visible help linked to the input. |
| Empty-form validation | PASS | Browser validation focused email and showed the required-field error. No credentials submitted. |
| Tab order / trap | PASS | Traversed account, providers and archive controls; no trap observed. |
| Visible keyboard focus | PASS | Account controls and Premium sign-in link had visible outlines. |
| Plans navigation | PASS | Enter on the Plans navigation reached `/wallet`. |
| Enabled purchase / billing-portal controls | BLOCKED | Preview pauses purchasing and the browser has no authenticated customer session. No live session was created. |
| Offer names | PARTIAL | Browser found repeated paused names. Those were corrected afterward using the shared formatter; focused formatter regression tests passed. Enabled live offer names were not browser-verified. |
| Premium signed-out navigation | PASS | Keyboard activation reached `/history`. |
| Narrow layout | PASS — emulation only | 390×844 Chromium viewport: no horizontal overflow or offscreen controls on History, Wallet and Premium. |
| Browser runtime errors | PASS within observed pages | Vite and React development notices only. |
| Actual WebKit / desktop Safari | NOT VERIFIED | Available attempted context still identified as Chromium. |
| Physical iPhone Safari + VoiceOver | NOT VERIFIED | No physical device or VoiceOver session available. |
| Windows + NVDA | NOT VERIFIED | No Windows/NVDA session available. |
| Spoken busy/error/membership announcements | NOT VERIFIED | DOM semantics checked; spoken output cannot be established by Chromium inspection. |
| Authenticated membership / profile / portal journey | NOT VERIFIED | No existing authorised signed-in session was available. |

Browser screenshot evidence: `0t9fn0` (native validation), `hlt2l1` (account fields/help), `hcfr28` (focused Premium link), `jm1n6q` (paused catalogue), `61actm` (narrow History). These are browser-run evidence identifiers, not durable files.

## Engineering checks

- Frontend typecheck: PASS.
- Full frontend suite before the final formatter extraction: 206 tests passed.
- Final focused account/offer accessibility tests: 5 passed, including 2 new formatter tests.
- Final production build: PASS; pre-existing large-chunk warning remains.
- Whitespace check: PASS.
- Screenshot of the updated 402×874 History preview rendered without browser errors.
- These changes have not been published by this task.

## Required real-device pass

Use an existing authorised account; do not create a purchase or change membership.

1. Record OS, browser and screen-reader versions.
2. On iPhone Safari/VoiceOver and a Windows browser/NVDA, navigate account action buttons and input labels. Confirm focus and spoken selected states.
3. Trigger only empty native validation, then verify the instruction/error is reachable. Do not disclose passwords or tokens in evidence.
4. Sign in interactively with the existing account. Verify the account indicator and membership status are spoken accurately.
5. Review each offer by controls list: confirm distinct action, credits, price and recurrence.
6. Only if authorised, open Checkout or billing management without paying, cancelling or changing anything. Confirm new-tab notice, opening progress and safe return focus.
7. Test blocked popup and recoverable network/error feedback without causing financial mutations.
8. Record PASS/FAIL with actual spoken wording and focus destination. A mobile viewport screenshot is not evidence of VoiceOver or physical Safari behavior.

## Scope of the latest research directive

The attached Open Discovery directive asks for open inquiry, revisable hypotheses and evidence-based discovery states. It explicitly prioritises essential commercial restoration over experimental expansion. This task does not claim to implement a Frontier Discovery Engine, validate celestial/divine communications or change research truth claims. That work remains separate from this bounded signup/billing accessibility correction.
