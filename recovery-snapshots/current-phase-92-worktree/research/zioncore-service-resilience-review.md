# Service resilience review

## Changes

- Each Gemini/OpenAI attempt has a 120-second application deadline covering
  stream setup and consumption. A stalled primary can reach the existing
  single-provider fallback rather than holding a server slot indefinitely.
- SDK requests receive the abort signal. OpenAI's internal retries are disabled
  for this path, leaving retry/fallback decisions to the application.
- Stream accumulation rejects responses above 262,144 characters rather than
  retaining an unlimited stream or serving a truncated reading. Normal output
  remains capped at the existing 8,192 tokens; models and prices are unchanged.
- Tests enforce that the two provider budgets leave settlement time inside
  the existing five-minute job lease. No lease or retention duration changed.
- Cloud observation operations capture the initiating user before loading
  Firestore, check identity again afterward, and bind their collection to that
  captured UID. A sign-out or account switch cannot silently redirect the
  operation to a replacement account.

## Evidence and boundaries

141 unit tests passed (89 frontend, 52 API), including 11 new regression tests.
Both type checks and builds passed. The restarted API health request returned
HTTP 200, and the homepage rendered without browser runtime errors.

Regression tests exercise stalled setup/streams, deadline cancellation,
fallback count, unchanged nonretryable errors, output bounds and account
changes during lazy loading. All provider outputs and identities in these
tests are controlled fixtures, not real paid calls or customer accounts.

SDK abort signals do not guarantee remote generation cancellation or a refund
of provider usage. Live provider speed, live OAuth, customer billing and cloud
operations under real authentication were not certified by this pass.

Initial-load JavaScript size remains a performance concern. Firestore itself
was already dynamically imported, so no redundant lazy-loading change was
made and no startup-speed improvement is claimed.

No production configuration, live payment or customer data was changed.
