# ZionCore enhancement plan

## Product vision

A person can explore a frequency observation, add their own faith context,
understand a rich interpretation, see its price before committing, keep a
private record and recover their work without losing trust in the service.
The product should feel ambitious and personal while remaining dependable
when connections, providers or devices fail.

Faith belongs in the listener's purpose, reflection and chosen context. Signal
measurements remain reproducible observations; reflective meaning is not
presented as an independently verified supernatural measurement.

## Engineering priorities

1. Preserve customer work and account isolation.
2. Reserve and settle approved charges correctly, with recovery by the original
   request identity instead of a second paid request.
3. Make successful actions persistent and visible; make failures actionable.
4. Deliver detailed, useful reports with bounded provider costs and fallback.
5. Measure performance and real customer outcomes before claiming superiority.
6. Preserve existing product identity and working capabilities while changing
   one coherent behavior at a time.

## This refinement: portable local history

Complete the local archive protection with a preview-and-confirm restore flow.
JSON exports and JSON-containing recovery copies are inspected on the device.
No backup content is sent to a provider, server or analytics service.

The preview distinguishes new records, invalid rows, identical duplicates and
identity conflicts. Existing records win over conflicting backup copies.
Different records sharing an identity within the file are rejected rather
than arbitrarily chosen. Skipping invalid/conflicting rows needs explicit
acknowledgement. The final merge validates again, uses the archive lock where
supported, and rejects a changed or damaged destination. No automatic repair,
destructive replacement, credit purchase or cloud import is added.

Files are limited to 5 MiB and 10,000 entries to bound local parsing work.
The source file remains unchanged. A damaged destination is preserved for
recovery, not silently cleared to make an import succeed.

## Validation

Test malformed files, size/count limits, duplicate/conflicting identities,
explicit acknowledgement, repeated imports, stale previews, quota failures and
post-preview tampering. Verify the actual choose-preview-confirm-history
journey in the anonymous development browser, including narrow-screen access
and persistence after reload. Keep previously passing checks valid unless the
measured behavior changes.

## Work that remains separate

Real production sign-in, live payment fulfillment, live paid-generation
verification and SDK warning investigation remain operational evidence
requirements. The earlier review recorded a declined cleanup-index change; that
decision was later superseded by explicit approval and the production index is
now `READY`. Firestore document access still needs an administrator-applied
data role before the cleanup query can succeed.

This is an executable improvement plan, not a claim of perfection, universal
appeal, guaranteed revenue or unrestricted self-modification.
