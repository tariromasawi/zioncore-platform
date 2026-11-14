# Data retention and deletion — ZionCore Frequency Lab

This note describes the current research-lab artifact only. It is not a policy
for the separate main ZionCore application.

## Current storage

- Live microphone samples and explicitly selected supported WAV files are
  processed in browser memory. The lab does not persist or upload source audio.
- A 256-bucket min/max waveform envelope and the spectrum are view-only reading
  data held in the current page state. Saved observation records contain summary
  measurements, not waveform envelopes or spectrum bins.
- Configured synthetic signals and WAV exports are generated locally. Samples
  remain in memory for the current preview; export is a user-requested download.
  Playback requires explicit consent and a separate play action; it is not
  transmitted or uploaded.
- Visitor observations are stored in this browser's local storage.
- Signed-in device observations and research sessions are stored in separate
  browser-local keys scoped to the Firebase UID. They are not cloud-synced.
- Browser-local records have no automatic expiry. They remain until deleted by
  the user or removed by browser storage settings.
- Account cloud observations are disabled until production Firestore rules and
  App Check are reviewed and verified. Their production retention and backup
  behavior have not been verified.
- This workspace has no connected credit or membership service.

## Deletion behavior

- The History page can export observation metadata and can delete one record or
  the records selected in the active archive. Confirmation is bound to the
  archive scope and selected record IDs; changing account or archive cancels a
  pending clear.
- Local deletion refuses to rewrite an archive if its stored contents fail
  validation. It does not silently discard records it cannot verify.
- A client-side deletion audit service is not available. The current API source
  has no authenticated deletion-audit endpoint, so local deletions are not
  recorded in a durable server audit log.
- Cloud deletion must remain disabled until a reviewed backend path can enforce
  authorization and write an audit record. Production Firestore rules have not
  been changed by this work.

## Export coverage

The signed-in dashboard export contains account-device observations, saved
research sessions, and the authenticated Firebase profile fields shown in the
dashboard. Cloud observations are included only when the approved cloud path is
available. Credits, membership, raw audio, visitor-browser records, and other
accounts' data are not included.
