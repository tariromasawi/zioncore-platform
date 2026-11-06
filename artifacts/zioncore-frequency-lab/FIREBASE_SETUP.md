# Firebase setup notes

This code targets the existing Firebase project `ethereal-throne-b20e6`. It does
not create a project, enable services, change console settings, or deploy rules.

## Before connecting the web app

1. Register or confirm the existing Firebase Web app in that project.
2. Confirm the project's current Authentication providers, Firestore rules, and
   App Check settings before changing any of them. This workspace could not read
   the live Firebase project.
3. If desired, enable Email/Password under Firebase Authentication. The app's
   account panel uses only this provider.
4. Configure the approved Firestore database and register a reCAPTCHA Enterprise
   key for Firebase App Check. The web app refuses cloud history and AI requests
   until App Check is initialized.
5. Enable Firebase AI Logic with the Gemini Developer API only after verifying
   the project's actual model availability and quota. The configured model is
   `gemini-3.5-flash-lite`; Firebase currently lists it as supported without
   requiring a billing account on the limited free tier. Quotas still apply.
   Do not link Cloud Billing or switch to a paid model without explicit approval.
6. Set the public Web app configuration and App Check site key in the artifact's
   environment using the names in `.env.example`. Never use a service-account
   key or Admin SDK credential in the browser.

The model call is opt-in. It sends only sample rate, FFT size, frequency
resolution, dominant frequency, spectral peaks, relative RMS, and duration.
It never sends audio, spectrum bins, or observation notes.

## Firestore rules safety

`firestore.rules` is a project-specific ruleset for
`users/{uid}/frequency_observations/{observationId}`. It is provided for local
emulator tests and as a rule to integrate. **Do not deploy it as a replacement
for the existing project's rules until those rules have been inspected and
merged.** Firestore rules are project-wide; deployment replaces the active
ruleset. The rules deny all access outside the user's own observation path,
reject updates, and validate the stored fields, ranges, and each of the six
current microphone peak slots. The browser also validates values before writes.

To run the local rules tests, use the artifact's `test:rules` command. It uses
the demo project ID `demo-zioncore-frequency-lab` and the local Firestore
emulator; it does not contact the real Firebase project.
