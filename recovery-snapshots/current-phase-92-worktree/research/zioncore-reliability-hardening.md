# Reliability hardening

## Defects addressed

1. Interpretation fetches could remain pending on stalled headers or bodies.
   The browser now applies a 15-second quote deadline and a 180-second
   generation/recovery request deadline, aborting the transport when reached.
   This bounds HTTP requests, not Firebase SDK identity-token acquisition.
2. A malformed successful response or unstructured gateway/authentication
   failure could discard the original paid-reading recovery identity.
   Those cases now retain recovery. Explicit server retry decisions remain
   authoritative. No client timeout grants credits, declares a refund or
   automatically creates a new paid job.
3. Leaving a page did not stop an active local analysis worker. Imports now
   receive an abort signal tied to page unmount and replacement imports.
   Worker cancellation terminates the worker and removes event listeners.
   Native browser audio decoding is not itself cancellable; if it finishes
   after departure, its result is discarded before starting a worker.
4. A malformed worker message could throw after clearing its timer, leaving
   its promise unresolved. Invalid envelopes now fail explicitly and clean up.

## Verification

85 frontend unit tests passed, including 13 additional regression tests.
Type checking and the production build passed; the restarted mobile homepage
rendered without a browser runtime error.

Regression tests cover stalled headers, stalled JSON bodies, request settings
and unchanged idempotency headers, active/pre-cancelled requests, no automatic
network retries, malformed paid replies, gateway/authentication interruption,
worker cancellation, malformed worker replies and resource cleanup.

No live generation, account creation, payment, refund, webhook replay,
production-data write or production configuration change was performed.

## Remaining launch evidence

- Real-user OAuth/authentication and App Check behavior remain to be verified.
- Live purchase-to-wallet/membership fulfillment and paid report delivery
  still require controlled end-to-end evidence.
- The approved production retry cleanup index is now `READY`; the read-only
  cleanup query still receives Firestore `PERMISSION_DENIED` (code 7) because
  data access is not yet verified.
- Existing storage-library listener/deprecation and large-bundle warnings
  remain visible; this work does not claim to resolve them.
