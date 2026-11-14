---
name: Credit wallet accounting
description: Server-authoritative wallet, ledger, and credit bucket rules for ZionCore.
---

Promotional credits are consumed before purchased credits. Reserve credits before work starts, cap settlement at the reservation, and return unused credits to their original buckets. Credit grants must come from verified server-side events; clients never change wallet balances or ledger entries.

Deduplicate purchases by stable purchase identity, not notification-event identity: several event types may describe one purchase. Changes to receipt identity must also recognize historical receipts, rather than granting again after an upgrade. A missing wallet summary with any credit history requires reconciliation, never automatic reinitialization during a top-up.

**Why:** notification retries and cross-event delivery must not mint extra credits, while a replacement receipt scheme or a new purchase must not conceal or overwrite missing historical balances.

On 2026-11-08 the owner approved this live, tax-inclusive credit schedule: 250 credits £2.50, 500 credits £5.00, 1,050 credits £10.00, 2,750 credits £25.00, and 5,750 credits £50.00. Premium remains £1.00/month. This supersedes the prior credit-pack schedule; older Stripe offers are legacy, not current pricing.

**Why:** The owner approved the more competitive bundle schedule while retaining the £1/month membership.

**How to apply:** Keep existing wallets and paid receipts intact. Retain old offers until the replacement app is deployed and verified, then archive old offers rather than deleting them.

The owner approved a fixed price of 35 credits for one successful full AI interpretation on 2026-11-07. This does not change the price or approval status of credit packs.

**Why:** consistent bucket ordering and atomic server-side accounting prevent overspending and preserve an auditable credit history across purchases and job execution.

**How to apply:** show and reserve the approved interpretation price before generation, settle only on a valid completed report, and release the reservation on provider failure. Recheck the cost basis if provider models, output caps, or credit-pack prices change.

Transport failures, unreadable replies and interrupted authentication do not
establish whether a paid reading completed. Preserve the original job identity
for recovery; do not imply a refund or automatically start a replacement job.

**Why:** a server can settle a completed reading even if its response never
reaches the browser. Dropping recovery identity can lose access to paid service
or lead to an unnecessary second purchase.

Provider-attempt budgets must leave time within the job lease for validation
and credit settlement. SDK cancellation ends local waiting, not necessarily
remote generation or its billable usage.

**Why:** job leases and provider cancellation are separate mechanisms. A local
timeout must not be treated as proof of a provider refund or unused credits.

A reserve call that errors or times out may still have committed. Re-read the
reservation status before deciding whether to release it; if status cannot be
verified, keep the same job recoverable and never claim that credits were
returned.

**Why:** a lost response does not roll back a successful Firestore transaction,
and releasing or retrying on assumption can either strand credits or double
charge.

**How to apply:** Every paid interpretation route must reconcile ambiguous
reservation outcomes using the original operation and idempotency key before
closing the job or asking the customer to start another request.
