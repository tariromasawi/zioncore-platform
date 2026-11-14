# ZionCore custom analytics events

Replit's injected Umami tracker records these custom events only when analytics
is enabled in Publishing settings and the app has been published or republished.
The application does not configure or load an analytics script itself. In
development, or before the tracker is available, the shared wrapper is a no-op.
Analytics exceptions are swallowed and do not block navigation or account flows.

## Events

| Event | Properties | When it fires |
| --- | --- | --- |
| `guide_article_open` | `route` (`discover`), `topic` (static article ID), `action` (`open`) | A Discover field-note article is opened. Opening all notes records each opened article. |
| `guide_cta_click` | `route` (`discover`), `action` (`click`), `placement` (`hero` or `closing`), `destination` (`live_lab`, `guide_index`, `signup`, or `plans`) | A Discover call to action is selected. |
| `signup_success` | `outcome` (`success`), `method` (`email_password`, `google`, or `apple`) | An email/password account is created or a provider redirect confirms a new Google/Apple account. Existing-user sign-ins do not fire this event. |

## Data limits

The app does not send email addresses, account IDs, notes, audio, frequency
measurements, faith context, free-text searches, passwords, or provider
credentials. Signup events contain only the outcome and method category. Guide
events use static route, article-ID, placement, action, and destination values.
Search input changes are deliberately not instrumented.

## Activation

Go to Publishing settings, enable analytics, and publish or republish the app.
Events begin collecting only after the published site receives Replit's
injected tracker. This instrumentation provides aggregate content and action
counts; signup events intentionally carry no article attribution or user
identifier.
