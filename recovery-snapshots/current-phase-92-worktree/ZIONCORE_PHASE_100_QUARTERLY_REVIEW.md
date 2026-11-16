# ZionCore Phase 100 — Quarterly evidence review

**Review cut-off:** 12 November 2026  
**Window:** 2026 Q4 to date (1 October through 12 November UTC)  
**Decision:** Do not expand the feature plan from this partial baseline. Keep production privacy/security repair as the priority.

## Evidence by outcome area

| Area | Observed evidence | What it does not establish |
| --- | --- | --- |
| Reliability | Replit reports the current public Autoscale deployment has a successful build. Phase 96 local release checks passed: 225 frontend, 102 API, 10 tooling, 3 Auth-emulator, 11 Firestore-emulator, and 19 wallet/fulfillment/recovery tests; local API and web builds passed. | A successful build is not uptime or a production SLO. Analytics contains 0 performance events in Q4 to date, so there are no sampled TTFB, LCP, INP, or CLS values. Live sign-in, private history, payment and owner journeys remain unverified. |
| Customer activity | Replit website analytics recorded **146 pageviews** and **52 approximate monthly visitors** in November to date. That is about **2.8 pageviews per approximate visitor**. October returned no analytics rows; this may mean no coverage or no tracked visits, not a verified zero-activity month. | Pageviews do not prove that a protected page loaded private account data. `session_id` is an approximate identifier and rotates monthly. |
| Most-viewed paths | `/` 51 views / 31 visitors; `/history` 41 / 13; `/wallet` 17 / 11; `/messages` 10 / 7; `/discover` 7 / 4; `/devices` 6 / 5. | Route views do not prove successful authentication, history access, wallet reads, or completed message workflows. The `/admin` path had 3 pageviews from 1 approximate visitor; that does not establish owner access. |
| Tracked outcomes | One custom event in Q4 to date: `guide_cta_click`. In the past seven days it occurred once, from the closing placement to `live_lab`. No `guide_article_open` or `signup_success` events were recorded in the queried period. | The sample is too small for conversion conclusions. Checkout, purchases, completed analyses, saved research, and privacy outcomes are not instrumented as analytics events. Absence of a tracked event is not proof the underlying action never occurred. |
| Research | No shared research corpus or aggregate experiment-outcome measure was available for this review. Private customer histories and recordings were not queried. | No conclusion about research progress, discovery rates, or repeatability can be drawn from pageviews or local tests. |
| Privacy and security | The reviewed production configuration still has broad public Firestore read/write rules. App Check enforcement is off; production token exchange has not been verified with the correct production App ID/key pair. | These are configuration risks, not evidence that a particular customer record was accessed or misused. |
| Cost | Phase 98 contains published-rate scenarios for Replit, Firebase, and AI usage. | Actual Replit, Firebase, Stripe, and provider spend, credit consumption, and per-request token averages were not available; the estimate is not an invoice or margin calculation. |

## Interpretation and next priorities

1. **Close privacy/security blockers first:** correct and verify production App Check pairing, then review and safely replace broad Firestore client access without breaking legitimate paths.
2. **Establish service reliability evidence:** capture production uptime/error/latency and web-vitals samples; distinguish build status from runtime availability.
3. **Measure complete, privacy-safe journeys:** after security gates are resolved, consider minimal aggregate events for successful authentication, completed analysis, saved history, checkout completion, and recovery. Do not send personal data, recordings, message text, or financial identifiers to analytics.
4. **Measure research only with consent and provenance:** report counts of completed experiments and repeatable comparisons without exposing private records; keep interpretations separate from observations.
5. **Reconcile real costs:** use Replit/Firebase/provider billing and token usage after an owner-approved test window before setting ongoing budgets or changing prices.

Use this scorecard at the close of each calendar quarter. Compare only periods with confirmed analytics coverage; report monthly visitors separately across month boundaries; include sample sizes and missing data; and require owner approval before selecting or publishing consequential follow-up work.

## Data handling

Analytics queries were aggregate and read-only. No raw visitor rows, customer records, private recordings, Firebase documents, payment records, or credentials were accessed. The second ZionCore experience has no registered production website route and is not separately represented in these website metrics.
