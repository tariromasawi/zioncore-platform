# ZionCore Phase 13 — Firebase Web App and Environment Comparison

**Scope:** Read-only comparison of Firebase web app registrations, Replit Development/Production public Firebase configuration, and authorized Auth domains for project `ethereal-throne-b20e6`. App Check secret values were not accessed.

## Registered Firebase web apps

The Firebase Management API returned HTTP 200 and two registered web apps. Their `appUrls` fields are empty, so Firebase's app listing does not itself associate either app with a host.

| Replit environment | Configured App ID matches | Firebase display name | Project and Auth domain |
|---|---|---|---|
| Development | `1:635097760381:web:4d796bbbdb94f181e56714` | `ZionCore ` | Project `ethereal-throne-b20e6`; `ethereal-throne-b20e6.firebaseapp.com` |
| Production | `1:635097760381:web:c718ecaac8b0b21de56714` | `Zioncore` | Project `ethereal-throne-b20e6`; `ethereal-throne-b20e6.firebaseapp.com` |

The non-secret Replit environment values confirm that Development and Production use **different App IDs**, and each matches a registered web app. Both use the requested Firebase project and its default Auth domain. This verifies the production web App ID at the Replit environment-config level; it does not prove which build revision is currently serving.

## Authorized Auth domains

The live Firebase Auth configuration returned HTTP 200 and listed:

- `zioncore.replit.app` — main production host
- `c9c8012c-55d1-412b-af8f-e60455c226a4-00-3ernpyafogg1c-33xtb81r.spock.replit.dev` — research-lab preview host
- `ethereal-throne-b20e6.firebaseapp.com`
- `ethereal-throne-b20e6.web.app`
- `localhost`

Both the production and temporary preview hosts are authorized for Firebase Auth. The Firebase web-app metadata contains no host URL mapping, so the environment App ID comparison is the evidence identifying the intended Development/Production split.

## App Check secret scope and limitation

- The secret named `VITE_FIREBASE_APPCHECK_SITE_KEY` is present in **Shared**.
- Development and Production secret views also report the key as present, but those views include Shared secrets. The available secret inspection returns existence only, not the value or source scope, so it does **not** prove that separate Development and Production keys exist or differ.
- No App Check key value was read. App Check's registered app mapping, hostname validity, and token exchange were not checked in this phase.
- The earlier request to remove the duplicate Shared secret was not carried out here: the available secret inspection cannot prove environment-specific keys are independently configured, and removing Shared could leave one or both builds without a key. No secret deletion operation is exposed through the currently available secrets interface.

## Conclusion and next evidence

1. Firebase web App ID separation is configured correctly in Replit: Development and Production point to distinct registered apps in the same Firebase project.
2. Firebase Auth allows both the intended production host and the temporary preview host. This is an Auth-domain allowlist result, not evidence that the preview uses a distinct App Check key.
3. **App Check remains unverified.** Before removing Shared or enabling enforcement, verify independent per-environment site-key configuration, registration against the corresponding web App IDs, hostname restrictions, and successful token exchange. Keep enforcement unchanged until those checks pass.
4. The `.env.example` file contains blank template entries for App ID and Auth domain; it is not the live environment configuration and was not changed.

No Firebase app registration, Replit environment variable, secret, Auth domain, App Check setting, rule, customer record, or deployment was changed.
