---
name: Membership entitlements
description: Security boundary and lifecycle contract for ZionCore Free/Premium membership.
---

ZionCore Premium access must come from a server-managed membership record written only after a verified billing event. Client code may display the record but must never grant or modify membership. Missing or invalid state fails closed to no Premium entitlement.

The customer-facing Premium benefit is a private side-by-side comparison workspace for saved acoustic observations. It compares recorded peaks, relative level, duration, and notes without requesting another AI interpretation or consuming credits.

**Why:** The billing specification requires that client-side changes cannot create entitlements or credits, and a return URL alone cannot prove payment.

**How to apply:** When adding checkout, billing webhooks, or Premium-only operations, keep Firestore client writes denied and verify the entitlement on the trusted server for every protected operation. Keep the comparison scoped to observations the account already owns; do not advertise included AI interpretations or recurring credits unless separately approved.

Billing management is separate from entitlement: keep the Stripe billing portal available for a verified Stripe-linked membership even when it is past due or ended, while keeping Premium features locked unless the current entitlement is valid.

**Why:** Customers may need to update payment details or manage cancellation after paid access stops; hiding billing controls must never preserve or grant Premium access.

**How to apply:** Use the trusted membership source only to display a management path, and continue to enforce Premium access through the server-verified active entitlement.
