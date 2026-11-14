# ZionCore Phase 98 — Release and cost estimate

**Prepared:** 12 November 2026  
**Currency:** USD for provider estimates; Stripe offer prices remain in GBP  
**Status:** Planning estimate only. No deployment or billing setting was changed.

## Current baseline and assumptions

- The existing production deployment type, Replit usage credits, Firebase billing plan, regional Firestore rates, and current monthly usage were not available from the source workspace. The estimate therefore uses published rates and explicit scenarios, not an account invoice.
- Keep the current ZionCore web/API deployment. Do not create a second deployment until its destination and account-level cost are approved.
- ZionCore 2nd is currently an unregistered, static Vite client. Its code calls Firebase directly and has no Stripe checkout, wallet, or separate API service. A separate static deployment is the lower-compute option if it is later approved; integrating it into the current application would avoid a second deployment base fee but could increase current compute, request, and transfer usage.
- Browser-local signal tools should remain local. Budget cloud usage only for authenticated cloud history and user-requested AI. No current production AI request volume or average token count was measured.
- Costs below exclude taxes, foreign-exchange conversion, Stripe processing, existing account credits, and any provider-specific negotiated terms.

## Replit published rates

The current Replit documentation lists:

| Hosting option | Published rate | Illustrative monthly cost |
| --- | --- | --- |
| Static Deployment | No hosting fee; $0.05/GiB data transfer | 100 GiB transfer = **$5.00** |
| Autoscale Deployment | $1 base/month, $0.60 per million compute units, $0.40 per million requests, and $0.05/GiB outbound transfer | 1M compute units + 1M requests + 10 GiB transfer = **$2.50** including the base |
| Reserved VM, 0.25 vCPU / 1 GiB | $0.0104/hour | 730 hours = **$7.59** |
| Reserved VM, 0.5 vCPU / 2 GiB | $0.0208/hour | 730 hours = **$15.18** |
| Reserved VM, 1 vCPU / 4 GiB | $0.0486/hour | 730 hours = **$35.48** |

Reserved VM examples assume continuous operation for a 730-hour month and exclude transfer and storage. Autoscale compute-unit consumption cannot be inferred from request count alone; measure it in Replit Usage after an approved release. The separate static site option avoids compute charges, but still incurs transfer and Firebase/AI usage.

### App Storage

Replit's current App Storage rates are **$0.015/GiB-month stored**, **$0.05/GiB transferred**, **$0.0004 per 1,000 basic operations**, and **$0.005 per 1,000 advanced operations**. For illustration, 100 GiB stored, 100 GiB transferred, one million basic operations, and one million advanced operations would total **$11.90/month**. Actual operation counts and media retention are not known, so this is not a forecast.

### AI provider scenarios

The API source routes to Gemini and can fall back to OpenAI. When the Google API key is selected, source chooses `gemini-3-flash-preview`; otherwise it can use Replit's Gemini integration (`gemini-3.8-flash`). Replit's integration documentation says provider API usage is charged at the provider's public API rate and deducted from Replit credits. OpenAI fallback uses `gpt-5.4-mini`.

Illustrative cost per **1,000 completed calls**, assuming **8,000 input tokens and 3,000 output tokens per call**, with no cached input, search grounding, retries, or failed-provider attempts:

| Model / billing path | Input / output rate per 1M tokens | 1,000-call estimate |
| --- | ---: | ---: |
| Gemini 3 Flash Preview, direct Google API | $0.50 / $3.00 | **$13.00** |
| Gemini 3.8 Flash, Replit Gemini integration, through 31 Dec 2026 | $0.75 / $3.75 | **$17.25** |
| Gemini 3.8 Flash, from 1 Jan 2027 | $1.50 / $7.50 | **$34.50** |
| GPT-5.4 mini, OpenAI fallback | $0.75 / $4.50 | **$19.50** |

The main report output ceiling is 8,192 tokens. At that ceiling with the same 8,000-token input assumption, the estimate ranges from **$28.58 to $42.86 per 1,000 calls** at the currently listed prices; Gemini 3.8 Flash at its listed 2027 rate would be **$73.44**. These are token arithmetic scenarios, not measured average use. Fallback attempts can add provider cost, and actual token billing must be reconciled against provider usage.

The server's internal usage-estimation table currently budgets Gemini 3.8 Flash at $2 input / $10 output per million tokens, above the public rates listed above. Treat that as a conservative internal estimate, not an invoice. Reconcile actual cost to provider-reported usage before changing credit pricing or declaring margins.

ZionCore 2nd has a separate Firebase AI Logic path configured in source with model name `gemini-3.5-flash-lite`; its availability and applicable rate have not been verified. It is excluded from these totals and should remain gated until model health and billing behavior are confirmed.

## Firebase usage assumptions

The live Firebase pricing page lists these no-cost thresholds for relevant services:

- Authentication: up to **50,000 monthly active users** for applicable non-phone sign-in methods.
- App Check: no-cost, subject to quotas and limits that vary by attestation provider.
- Firestore Standard: **1 GiB** stored; **50,000 reads/day**, **20,000 writes/day**, **20,000 deletes/day**, and **10 GiB/month** network egress.

Usage beyond no-cost thresholds is charged under the applicable Google Cloud rates, which vary by service, region, and billing configuration. The project's Spark/Blaze status and actual usage were not inspected for this estimate. The two Phase 95 production Firestore probes were bounded, read-only, and did not access customer records; they are not a meaningful usage forecast.

No Firebase Storage or customer-record growth forecast is included. App Check is not currently verified in a normal browser, and production Firestore rules remain globally public; do not enable client history writes or enforcement as a cost optimization.

## Practical budget scenarios

| Scenario | Planning estimate | Conditions |
| --- | ---: | --- |
| Keep existing production app; second experience added under the same approved host | **No new deployment base fee assumed** | Incremental Replit compute/transfer and Firebase/AI costs remain unknown until measured. No route is currently registered. |
| Separate static deployment for ZionCore 2nd | **$0 hosting + $0.05/GiB transfer** | Requires an approved publication path, Firebase configuration, secure rules, and verified App Check. |
| Separate Autoscale deployment | **$1/month + measured compute, requests, and transfer** | Not necessary for the current second-app source, which has no separate API service. |
| 1,000 AI reports/month | **About $13–$19.50** under current direct-provider examples | Uses 8K input + 3K output tokens per call; excludes retries, second-provider fallback, and ZionCore 2nd Firebase AI Logic. |
| 10,000 AI reports/month | **About $130–$195** under the same assumptions | Multiply the illustrative 1,000-call estimate by 10; provider mix changes the amount. |

## Release recommendation

Use the existing deployment for the main product. Do not register or publish a separate app until its hosting option, source integration, and expected traffic are reviewed. Keep AI opt-in and metered; expose a per-request cost estimate from actual input/output token usage before scaling. Check Replit Usage and Google/Firebase billing dashboards after an approved test window before setting a sustained monthly budget.

No billable deployment, paid AI inference, live Stripe transaction, Firebase migration, or production configuration change was performed for Phase 98.

## Sources

- [Replit cloud pricing updates, effective 1 August 2026](https://docs.replit.com/billing/aug-cloud-billing-updates)
- [Replit usage-based billing](https://docs.replit.com/billing/about-usage-based-billing)
- [Replit App Storage billing](https://docs.replit.com/billing/object-storage-billing)
- [Replit AI Integrations billing](https://docs.replit.com/features/integrations/replit-ai-integrations)
- [Firebase pricing](https://firebase.google.com/pricing)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash)
- [OpenAI API pricing](https://platform.openai.com/docs/pricing)
