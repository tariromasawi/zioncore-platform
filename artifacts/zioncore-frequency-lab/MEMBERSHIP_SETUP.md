# Membership entitlement contract

Phase 2 establishes a server-managed membership record. It does not enable
checkout or grant Premium access by itself.

## Firestore document

The signed-in customer may read only:

`users/{uid}/membership/current`

Expected fields:

- `tier`: `free` or `premium`
- `status`: `free`, `incomplete`, `trialing`, `active`, `past_due`, `canceled`,
  `unpaid`, or `expired`
- `source`: `system` or `stripe`
- `accessUntil`: Firestore timestamp or ISO date string, or `null`
- `cancelAtPeriodEnd`: boolean
- `updatedAt`: Firestore timestamp or ISO date string, or `null`

A missing record means Free. Invalid records and failed reads fail closed and
must not be treated as Premium.

## Authorization boundary

Firestore rules allow a customer to read their own `current` membership record
but deny client creation, updates, and deletion. A future trusted backend must
write subscription state only after verifying Stripe events. Never grant
Premium based on browser-submitted data or a checkout return URL.

The UI presents Premium only when the record is Stripe-sourced, marked active,
and has a future `accessUntil` date. This client check is for display only;
every future Premium operation must enforce entitlement on the server too.

Checkout, cancellation handling, credit balances, and billing management are
outside Phase 2 and remain disabled until their later phases are implemented
and tested.
