# ZionCore Phase 12 — Firebase Authentication Inspection

**Scope:** Read-only inspection of Firebase project `ethereal-throne-b20e6`, Auth provider configuration, authorized domains, source callback behavior, and available sign-in error evidence. No customer records, credentials, or OAuth client secrets were displayed.

## Live Firebase configuration

Access was obtained through Application Default Credentials using the existing `FIREBASE_SERVICE_ACCOUNT_JSON` secret. The credential's project ID matched the requested project. A short-lived local credential file and gcloud config were removed after use; no interactive Firebase CLI login was performed.

| Check | Result |
|---|---|
| Firebase Auth project config | HTTP 200 from the Identity Toolkit Admin API |
| Email/password | Enabled |
| Google (`google.com`) | Enabled |
| Apple (`apple.com`) | Enabled |
| Other default identity providers | None returned |
| Custom OAuth/OIDC provider configs | None returned |
| Authorized domains | `localhost`; `ethereal-throne-b20e6.firebaseapp.com`; `ethereal-throne-b20e6.web.app`; `zioncore.replit.app`; `c9c8012c-55d1-412b-af8f-e60455c226a4-00-3ernpyafogg1c-33xtb81r.spock.replit.dev` |

The production domain and the temporary research-lab preview domain are both currently authorized by this Firebase Auth project. This confirms that Firebase Auth accepts redirects from both hosts; it does **not** prove which Firebase web App ID or App Check key either build uses. App Check key separation and token exchange were not tested in this phase.

## Callback and session behavior in source

### Main-source candidate (`d4be0c7`)

- Email/password and Google/Apple sign-in set Firebase browser-local persistence.
- Google and Apple use redirect sign-in. The app stores a short-lived pending-provider marker in session storage and consumes `getRedirectResult()` after `authStateReady()`.
- If the browser restores the user but does not return a redirect result, the pending marker permits recovery from `auth.currentUser`.
- A completed redirect with a user navigates to `/dashboard`; `onAuthStateChanged` separately updates the shared user/loading state and refreshes the owner claim.
- Authenticated API requests attach a Firebase ID token. The candidate API verifies it server-side with Firebase Admin. App Check is optional in that middleware: a supplied token is verified, but absence is not rejected there.

### Research-lab task source (`7be5bc1`)

- Email/password and Google sign-in/link are present; no Apple client flow was found in this source line.
- The UI consumes `getRedirectResult()` and shows a Google sign-in/link status. `onAuthStateChanged` updates the user and loading state.
- Email/password persistence is left to Firebase SDK defaults rather than explicitly set in the inspected helper.
- The lab has no customer dashboard route; signing in does not imply a dashboard destination.
- Cloud history readiness additionally requires App Check plus the explicit `VITE_FIRESTORE_CLIENT_ACCESS_APPROVED=true` flag. This client gate is not proof that live rules or App Check are correct.

## Sign-in failure evidence

- A read-only Cloud Logging query for `identitytoolkit.googleapis.com` error entries over the 30 days ending 2026-11-11 returned HTTP 200 and **zero matching entries**. This means no matching entries were retained or visible to the query; it does not prove no users encountered errors.
- No real sign-in was initiated, and no demonstration account was created. Therefore there is no observed production callback, browser error code, or confirmed resolution of the previously reported “Join for Free” state.
- The local task-source unit suite passed: **34 tests, 0 failures** (`pnpm --filter @workspace/zioncore-frequency-lab run test:unit`). These validate local logic and error messages, not a real Firebase provider redirect.
- The task-source package has no Auth emulator or browser redirect integration test configured; its Firebase Auth unit tests focus on actionable error-message mapping.
- `gcloud logging read` itself returned: `You do not currently have an active account selected.` To avoid an interactive login, the same ADC credential was used directly with the Logging REST API, which succeeded.

## Findings and remaining verification

1. The Firebase service-account credential is usable through ADC for read-only Auth inspection, so an interactive CLI login was unnecessary for this work.
2. Email/password, Google, and Apple are enabled in the live project. The main candidate includes all three flows; the lab task source includes only email/password and Google.
3. Both the production domain and the temporary preview domain are in the Firebase Auth authorized-domain list. Confirm environment-specific Firebase App IDs and App Check keys before using the preview for cloud operations.
4. No matching Auth error logs were available. To verify the reported navigation issue, a consenting test user must perform a real sign-in in the target build and confirm the resulting auth state and destination.
5. The local source/template and production deployment are not proven to be the same build. Exact deployment-to-commit provenance remains open.

No Firebase settings, providers, domains, rules, App Check enforcement, customer accounts, or production data were changed. This inspection does not complete Firebase Task #2: Firestore rules and App Check still require their separate security review and verification.
