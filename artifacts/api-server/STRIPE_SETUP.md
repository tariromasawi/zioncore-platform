# Stripe production status

This note records a read-only production check performed on 2026-11-07. No
Stripe resource, live environment flag, secret, price, or payment was changed.

## Confirmed

- Production is publicly deployed at `https://zioncore.replit.app`.
- `GET /api/billing/catalog` returned `checkoutEnabled: true` and
  `portalEnabled: true`; all four ZionCore offers were reported purchasable.
- The live catalog contained three credit packs: 50 credits for £2.50, 200
  credits for £8.00, and 1,000 credits for £32.00; Premium was £1/month.
- The server's approved interpretation quote is 35 credits per completed
  interpretation.
- Stripe Tax reported active status in the earlier catalog setup check; that
  setting was not re-queried during the fulfillment verification.
- The live webhook URL is `https://zioncore.replit.app/api/stripe/webhook`.
  Two enabled endpoint records point to that URL: one broad managed endpoint
  and one app-scoped endpoint.
- The required production Stripe secret names and checkout flags are present.
  Their values were not read or recorded.

## Not verified; do not describe fulfillment as flawless yet

- No customer payment or signed webhook delivery was performed. A purchasable
  catalog confirms that Checkout can be offered; it does not prove webhook
  signature matching, credit delivery, subscription activation, refunds, or
  customer-portal behavior end to end.
- Stripe gives each webhook endpoint its own signing secret. The app currently
  configures one `STRIPE_LIVE_WEBHOOK_SECRET`; the matching endpoint and any
  second endpoint secret have not been verified. Duplicate endpoints can create
  repeated deliveries and avoidable failures.
- The previous handler unconditionally called Stripe Sync after Firestore
  fulfillment. A production database inspection now reports no managed production
  PostgreSQL database. Source code has been changed so the unused mirror is
  opt-in via `ZIONCORE_STRIPE_MIRROR_ENABLED=true`; default fulfillment uses
  Firebase without requiring a second database. This fix must be published.
  Do not enable mirroring until its schema and data scope have been provisioned
  and reviewed. If enabled, a mirror error remains retryable and purchase
  deduplication prevents another grant.
- The connected Stripe account also contains products unrelated to ZionCore.
  Do not run an account-wide Stripe Sync backfill into this app without an
  explicit data-scope decision.
- Premium currently activates a server-verified membership status. It does not
  include interpretation credits or a recurring credit grant. No additional
  premium reading features should be advertised until implemented.

Live Checkout is currently enabled, so customers may be charged. Do not claim
that payment fulfillment is fully launch-verified until the endpoint/secret
mapping is confirmed, the hardened handler is published, and an owner-approved payment
or existing signed event is verified through the customer's wallet and
membership record. No live payment was made by the agent.

## Fulfillment hardening and verification

- Production rejects unsigned webhook requests with HTTP 400 and unauthenticated
  Checkout creation with HTTP 401.
- The live account returned no events for the requested recent checkout-success,
  subscription-update, and paid-invoice event types. There is no matching paid
  event to reconcile; this does not prove the account has never processed money.
- Source now deduplicates credit purchases by Checkout session, not by Stripe
  event ID. It transactionally recognizes legacy event-keyed receipts too.
- A top-up cannot recreate a missing wallet summary when ledger or reservation
  history exists. Such a wallet fails closed for reconciliation.
- Invalid signatures now return HTTP 400 in source; processing or configuration
  failures still return an error so Stripe can retry.
- Regression tests use synthetic signing fixtures and an isolated demo Firestore
  emulator. They are not evidence of a real Stripe payment or production
  Firebase Authentication, App Check, or wallet access.

See `research/zioncore-completion-audit.md` for the strategy completion matrix.
