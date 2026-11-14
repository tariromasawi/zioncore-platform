# Product ownership: customer recovery

## Interpretation of the mandate

Act with ownership: understand the product's purpose, protect customer trust
and credit accounting, preserve existing capabilities, prioritize measurable
improvements, and report unresolved risks honestly. Care and responsibility
are operating practices, not guarantees of commercial success.

The required knowledge spans customer experience, audio/DSP, user-directed
faith reflection, application security, browser behavior, distributed service
failure, credit accounting, operating costs and product measurement.

## Executed

- Replaced the generic display-error screen with ZionCore recovery guidance.
- Failed dynamic page/CSS downloads offer a fresh page reload; they do not
  offer a rendering retry that would repeat a cached rejected module.
- Ordinary display failures retain a rendering retry.
- Reload/navigation controls warn about losing unsaved recordings and edits.
  They neither delete saved browser records nor initiate a new purchase.
- Recovery copy warns that an earlier paid reading may still be processing.
- Self-contained lazy Messages, Plans and Field Guide pages have local error
  boundaries so their surrounding navigation remains available.
- The live lab retains the outer boundary, which unmounts the capture owner
  on a fatal display failure. A generic child boundary was deliberately not
  used around live-lab controls because their parent owns the microphone.
- Browser-reported offline/restored notices explain which actions need a
  connection. They neither poll the server nor replay purchases/readings.
- Raw error messages are not displayed in recovery UI. Production boundary
  logs use a generic message, and the root no longer duplicates raw diagnostics.

## Verification and boundaries

98 frontend tests passed, including five new tests for failed-download
classification, safe fallback markup, private-debug-message omission and
connectivity state transitions. Type checking and the production build passed.
These UI tests include server-rendered fallback markup; they do not claim a
real-browser reload under a deliberately induced failure.

No customer data, live purchase, provider generation, production configuration
or published release was changed. Live authentication/payment verification,
Firebase configuration issues and existing storage/bundle warnings remain
separate work; this review does not certify launch readiness.
