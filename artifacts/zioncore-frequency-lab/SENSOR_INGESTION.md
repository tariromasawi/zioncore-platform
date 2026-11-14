# Bounded sensor ingestion

`LocalSensorIngestionSession` consumes only normalized
`zc-sensor-observation/v1` records. A caller must provide both:

- explicit, purpose-specific consent scoped to `local-memory-only`, with
  `grantedAt` and `expiresAt`; and
- a validated per-batch and per-session record/byte budget plus a retention
  period.

The session streams async inputs into batches, applies backpressure when a
batch fills, checks every observation against the sensor contract, tracks
cumulative session usage even after a batch is drained, and rejects data that
exceeds either the record or byte ceiling. Pending records expire lazily when
the session is used or `expire()` is called. Revoking consent clears pending
in-memory records and prevents further ingestion.

Batches carry their creation time, expiry time, exact serialized byte count,
and an external-cost estimate of zero. Zero is accurate because this module
does not persist records, make network requests, call an AI provider, or access
hardware. It is not a cloud cost estimate for any caller that later sends a
batch elsewhere.

The yielded batch is handed to its caller, which becomes responsible for
respecting `expiresAt`; this module cannot erase copies made by downstream
code. No Firestore, object storage, or automatic persistence path is provided.
Any persistent or external ingestion requires its own explicit authorization,
storage/cost budget, retention policy, and security review.
