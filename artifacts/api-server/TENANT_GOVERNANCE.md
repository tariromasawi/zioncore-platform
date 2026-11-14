# Multi-tenant research governance

## Current status

This is a server-side authorization contract and policy scaffold, not an enabled
organization feature. The API server currently exposes health checks only; it
has no Firebase Admin token verifier, tenant membership store, license adapter,
or durable audit store. No tenant route is registered, no customer data is
migrated, and no Firestore rules are changed. Do not onboard partner
organizations using this scaffold alone.

## Required request path

1. A future server route validates the request shape, assigns the correlation
   request UUID, and obtains the Firebase ID token from the authorization
   header. Never log or persist that token.
2. A trusted Firebase Admin adapter verifies the token signature, issuer,
   audience, and expiry. Do not decode a client token and treat it as verified.
3. The server loads the caller's active membership by both the route tenant ID
   and verified UID. Client-provided roles, tenant claims, or membership objects
   are never authoritative.
4. The server loads a current license from a trusted Stripe-verified billing
   workflow or an explicitly approved contract source. Client feature flags are
   not authoritative.
5. For an invitation, the server must atomically reserve a seat against the
   licensed seat limit. `authorizeTenantRequest` requires a reservation adapter
   for that action and denies invitations when it is unavailable or full.
6. `authorizeTenantRequest` checks exact tenant equality, membership status,
   license status and expiry, licensed feature, action role, and ownership for
   researcher edits/deletes. The route must load resource ownership from the
   tenant-scoped server record; never trust a caller-supplied owner UID.
7. A minimal audit event is appended before access is granted. If verification,
   membership/licensing lookup, or audit persistence fails, access is denied.

## Initial role boundary

| Role | Workspace/research access | Member administration | Billing reports | Audit reports |
| --- | --- | --- | --- | --- |
| Owner | All defined research actions | Yes | Yes | Yes |
| Administrator | All defined research actions | Yes | No | Yes |
| Researcher | Create/read; update/delete own records | No | No | No |
| Analyst | Read | No | No | No |
| Viewer | Read | No | No | No |
| Billing manager | Workspace summary only | No | Yes | No |

Owner-role assignment is not exposed by this policy; it must remain a separately
approved, audited server operation. The policy contract requires an atomic seat
reservation adapter for invitations, but no such adapter or invitation route
exists yet. Membership invitation must remain unavailable until that adapter
and its recovery/release behavior are implemented and tested against a
server-controlled store.

## Licensing and audit data

Licenses carry a tenant ID, active/suspended/expired state, explicit feature
list, seat limit, and issue/expiry timestamps. Every action requires an active,
unexpired license with its mapped feature. Billing provider price IDs, payment
secrets, customer emails, research payloads, recordings, exact locations, and
arbitrary request bodies are excluded from this authorization/audit contract.

The audit event records a request UUID, tenant ID, verified actor UID (or the
literal `unverified` for failed identity verification), action, resource
reference, outcome, reason code, and timestamp. A production audit adapter must
be append-only and access-controlled; the current policy only defines the
event and calls an injected adapter.

## Production activation gate

Before exposing any tenant route, implement and test the verifier, membership
repository, trusted license source, atomic seat reservation, audit persistence,
tenant-scoped query filters, data-retention/export/deletion controls, and
least-privilege backend IAM. Review existing Firestore and API callers before
rules or data changes. Obtain specific owner approval before assigning owner
privileges, changing production Firebase policy, migrating customer data, or
publishing.
