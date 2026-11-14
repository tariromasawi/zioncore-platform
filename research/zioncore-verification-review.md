# ZionCore verification review

Reviewed 7 November 2026. This is a bounded engineering review, not a
zero-defect guarantee or proof of live payment fulfillment.

## Corrected

- Image and listening-library streams now stop upstream storage reads when a
  visitor disconnects. Completion removes the added response listener.
- Public asset lookups reject inherited object properties rather than treating
  them as entries in the allowlist.
- Streaming failures before headers are sent return JSON with an appropriate
  content type; audio errors remove stale byte-range/length headers.
- Signal Card saves reject an editor whose saved revision is older than the
  current browser record. Revisions advance even for same-millisecond saves.
  This guards stale edits, not a claim of transactional cross-tab storage.
- Emulator hub/logging explicitly bind IPv4, eliminating the unsupported IPv6
  startup warnings seen in this container.

## Passing evidence

| Check | Result |
| --- | --- |
| Frontend unit checks | 70 passing, including the new stale-editor case |
| API unit checks | 43 passing |
| Firestore wallet, retry-job and Stripe-fulfillment emulator checks | 15 passing |
| Firestore access-rule checks | 9 passing, including rejected client wallet/ledger writes |
| Authentication emulator checks | 2 passing |
| Frontend/API type checks | PASS |
| Frontend/API builds | PASS |
| API health and public artwork requests | HTTP 200 |
| Inherited-name artwork/audio requests | HTTP 404 |
| Audio byte-range request | HTTP 206; exactly 1,024 requested bytes |
| Running homepage screenshot | Renders artwork; no browser runtime error reported |

The 139 automated checks use local logic, controlled fixtures and Firebase
emulators. They do not establish real Google/Apple sign-in, live provider
generation, or a completed live customer payment.

## Still unresolved

1. Existing production logs report a missing collection-group ascending index
   for `ai_interpretation_jobs.expiresAt`. Retry-record cleanup needs that
   Firebase configuration. No production index or data was changed here.
2. The cloud storage transport emits stream listener warnings. A minimal
   successful object read reproduces them inside the third-party transport's
   pipeline code, independently of the route's new disconnect cleanup. The SDK
   also emits credential-constructor deprecation guidance. These warnings were
   not hidden by increasing global listener limits.
3. Vite warns about JavaScript chunks larger than 500 kB. The build succeeds;
   reducing initial download size remains performance work.

No live charge, refund, webhook resend, publication or production-data write was
performed. Publish the reviewed workspace changes separately.
