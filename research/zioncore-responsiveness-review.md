# Page responsiveness review

## Changes

- Local recording analysis now runs its numerical work in a dedicated Web
  Worker, rather than blocking page input and rendering. Audio remains local.
  Success, error, invalid message and timeout paths terminate the worker.
- Navigation resolves section anchors after lazy pages appear, accounts for
  the header height and respects reduced-motion preferences. New routes reset
  to the top instead of retaining an unrelated page's scroll offset.
- Mobile navigation links have larger targets, retain horizontal scrolling and
  do not shrink out of reach. Focus outlines are visible. Mobile header blur
  is removed to reduce compositing work.
- Reference tone preparation displays a cancellable state. Cancel/unmount
  invalidates pending starts so a delayed resume cannot start unwanted sound.
  Stop produces an explicit stopped status.
- Imported results identify their actual FFT size. The spectrum uses the
  reading's FFT metadata, not a newly selected setting for a future recording.
  Changing the next FFT setting does not silently claim to reprocess a reading.
- A failed cloud-detail request records its completed scope so the error can
  display instead of leaving the detail page indefinitely loading.
- A final navigation/screenshot check exposed a storage-SDK cancellation race
  that crashed the API when clients left before response setup completed.
  Asset cancellation now waits for the storage response callback to finish
  establishing its pipeline before destroying the stream. Closed responses
  do not receive attempted error writes.

## Verification

- Frontend unit suite: 72 passing, including background-task output and errors.
- Type check and production build pass. Vite's existing large-chunk warning
  remains.
- API unit suite: 45 passing, including early-disconnect and delayed-header
  regression cases; API type check passes.
- After the cancellation fix, real image requests were interrupted at varying
  delays. The API stayed running; subsequent full-image, audio-range and health
  requests returned HTTP 200, 206 and 200 respectively.
- A browser pass checked desktop and 390 × 844 mobile navigation, Matrix/art
  toggles, section links, route changes, account-panel tabs/required fields,
  real Worker import of a generated 4-second 440 Hz WAV, reference-tone
  play/stop and public recording play/stop.
- Stable 4,096-point browser import returned approximately 441.4 Hz, 85 analysis
  frames and 4 seconds. Audio was not uploaded.
- Browser review identified confusing current-versus-next FFT settings; the
  displayed-reading metadata and explicit next-recording wording were added
  afterward. The browser pass was not repeated for that presentation fix.
- The browser pass reported no page JavaScript errors. It did report Firebase
  App Check throttling warnings and a generic HTTP 400 resource failure.

## Boundaries

No live account was created, no OAuth credentials were entered, no physical
microphone capture was performed, and no paid interpretation or Checkout was
started. Signed-in cloud failure handling was inspected in code, not verified
with a real user's private archive. This is evidence for the listed controls,
not a guarantee that every authenticated/external-service command succeeds.
