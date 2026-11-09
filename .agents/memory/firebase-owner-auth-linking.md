---
name: Firebase owner authentication continuity
description: Preserve the existing ZionCore owner identity while enabling federated sign-in.
---

Keep owner access on the existing Firebase Auth UID. The existing owner record has the `zioncoreOwner` custom claim, but its provider list is password-only. Google OAuth is enabled and configured at the Firebase project level, so link Google from an authenticated session rather than creating a replacement account or assigning another claim. Apple's provider entry lacks client credentials and is not ready for sign-in.

Only the two owner-designated identities should receive administrative access. Verify role grants server-side using trusted UIDs/custom claims; never authorize from a client-supplied email or role field.

Treat an auth-state observer failure as an explicit error, not an ordinary sign-out. Keep access checks fail-closed while showing the diagnostic to the user.

**Why:** A redirect can return to the app while an observer error silently clears the account view, making a failed session look like a completed sign-out.

**How to apply:** Surface observer errors in the account UI and keep protected data inaccessible until Firebase confirms the current user.

The owner's intended live offers are 50 credits for £2.50, 200 for £8, 1,000 for £32, and Premium for £1/month. The observed production billing catalog differs, so these are target values—not confirmation of current Stripe prices. Do not create duplicate products or change live prices until the discrepancy is resolved.

**Why:** Linking preserves the existing UID, private data ownership, and server-assigned owner claim; creating a second account could strand access or data.

**How to apply:** Have the owner sign in with the existing password account once, then link Google. Verify Apple credentials in Firebase Auth before enabling or testing Apple login. Do not treat an authenticated customer account as an owner without trusted claim verification. Compare live Stripe offers with the stated target before making pricing changes.
