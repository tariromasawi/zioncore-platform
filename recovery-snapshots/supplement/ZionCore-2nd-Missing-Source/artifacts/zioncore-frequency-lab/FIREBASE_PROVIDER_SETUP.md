# Firebase sign-in providers

The account panel supports email/password, Google, and Apple ID sign-in. Apple
ID is the provider associated with an iCloud account; Firebase does not offer a
separate “iCloud” OAuth provider. Firebase creates an account on the first
successful provider sign-in, so the same buttons handle both registration and
returning sign-in.

## Firebase Console setup

1. In Firebase Console, open **Authentication → Sign-in method** and enable
   **Google** and **Apple**.
2. In **Authentication → Settings → Authorized domains**, add the exact Replit
   preview hostname and the production hostname before testing those
   environments.
3. For Apple ID, configure the Apple provider with the Apple Developer
   identifiers and signing key requested by Firebase. Keep private keys in
   Firebase Console or an approved secret manager; never put them in browser
   code or commit them.

Until a provider is enabled and configured, its button reports a setup error
from Firebase instead of silently falling back to email/password. Provider
accounts that share an email with an existing account are not linked
automatically; the user must first sign in with the existing method.
