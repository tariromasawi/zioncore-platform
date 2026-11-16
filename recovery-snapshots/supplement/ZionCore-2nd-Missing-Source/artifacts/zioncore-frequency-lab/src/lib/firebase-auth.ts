import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import type { SignupMethod } from '@/lib/project-analytics';

export type SocialAuthProvider = 'google' | 'apple';
export type ProviderRedirectOutcome = {
  user: User | null;
  isNewUser: boolean;
  method: Exclude<SignupMethod, 'email_password'> | null;
  hadPendingRedirect: boolean;
};

const pendingProviderRedirectKey = 'zioncore.auth.pending-provider-redirect';
const providerRedirectMaxAgeMs = 20 * 60 * 1000;

export function parsePendingProviderRedirect(value: string | null, now = Date.now()): SocialAuthProvider | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed
      || typeof parsed !== 'object'
      || !('provider' in parsed)
      || (parsed.provider !== 'google' && parsed.provider !== 'apple')
      || !('startedAt' in parsed)
      || typeof parsed.startedAt !== 'number'
      || !Number.isFinite(parsed.startedAt)
      || parsed.startedAt > now
      || now - parsed.startedAt > providerRedirectMaxAgeMs
    ) {
      return null;
    }
    return parsed.provider;
  } catch {
    return null;
  }
}

function readPendingProviderRedirect(): SocialAuthProvider | null {
  try {
    return typeof window === 'undefined'
      ? null
      : parsePendingProviderRedirect(window.sessionStorage.getItem(pendingProviderRedirectKey));
  } catch {
    return null;
  }
}

function clearPendingProviderRedirect() {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(pendingProviderRedirectKey);
  } catch {
    // Sign-in must still work when session storage is restricted.
  }
}

function savePendingProviderRedirect(provider: SocialAuthProvider) {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(pendingProviderRedirectKey, JSON.stringify({
        provider,
        startedAt: Date.now(),
      }));
    }
  } catch {
    // Firebase's redirect result remains the source of truth when storage is unavailable.
  }
}

export function createFirebaseAuthOperations(auth: Auth | null) {
  return {
    async authenticateWithEmail(
      mode: 'sign-in' | 'create',
      email: string,
      password: string,
    ): Promise<User> {
      if (!auth) {
        throw new Error('Firebase Authentication is not configured for this project.');
      }
      await setPersistence(auth, browserLocalPersistence);
      const normalizedEmail = email.trim();
      const credential = mode === 'create'
        ? await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        : await signInWithEmailAndPassword(auth, normalizedEmail, password);
      return credential.user;
    },

    async authenticateWithProvider(providerName: SocialAuthProvider): Promise<void> {
      if (!auth) {
        throw new Error('Firebase Authentication is not configured for this project.');
      }

      const provider = providerName === 'google'
        ? new GoogleAuthProvider()
        : new OAuthProvider('apple.com');

      if (providerName === 'google') {
        provider.setCustomParameters({ prompt: 'select_account' });
      } else {
        provider.addScope('email');
        provider.addScope('name');
      }

      await setPersistence(auth, browserLocalPersistence);
      savePendingProviderRedirect(providerName);
      try {
        await signInWithRedirect(auth, provider);
      } catch (error) {
        clearPendingProviderRedirect();
        throw error;
      }
    },

    async completeProviderRedirect(): Promise<ProviderRedirectOutcome | null> {
      if (!auth) return null;
      const pendingProvider = readPendingProviderRedirect();
      try {
        const result = await getRedirectResult(auth);
        clearPendingProviderRedirect();
        if (result) {
          const providerId = result.providerId;
          return {
            user: result.user,
            isNewUser: getAdditionalUserInfo(result)?.isNewUser === true,
            method: providerId === 'google.com' ? 'google' : providerId === 'apple.com' ? 'apple' : null,
            hadPendingRedirect: true,
          };
        }

        // Some browsers restore the Firebase user while the redirect result is
        // unavailable. Treat the restored user as signed in, but only navigate
        // when this tab had initiated a provider redirect.
        if (pendingProvider) {
          return {
            user: auth.currentUser,
            isNewUser: false,
            method: pendingProvider,
            hadPendingRedirect: true,
          };
        }
        return null;
      } catch (error) {
        clearPendingProviderRedirect();
        throw error;
      }
    },

    async signOutCurrentUser(): Promise<void> {
      if (!auth) return;
      await firebaseSignOut(auth);
    },
  };
}

const configuredAuthOperations = createFirebaseAuthOperations(firebaseAuth);

export const authenticateWithEmail = configuredAuthOperations.authenticateWithEmail;
export const authenticateWithProvider = configuredAuthOperations.authenticateWithProvider;
export const completeProviderRedirect = configuredAuthOperations.completeProviderRedirect;
export const signOutCurrentUser = configuredAuthOperations.signOutCurrentUser;

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  if (code.includes('email-already-in-use')) return 'An account already uses this email. Sign in instead.';
  if (code.includes('unauthorized-domain')) {
    return 'This app domain is not authorized for Firebase sign-in. Add the exact hostname under Firebase Authentication settings.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'This sign-in method is not enabled in Firebase Authentication yet. Enable the provider in Firebase Console.';
  }
  if (code.includes('account-exists-with-different-credential')) {
    return 'An account with this email uses a different sign-in method. Sign in with that method first; accounts are not linked automatically.';
  }
  if (code.includes('credential-already-in-use')) {
    return 'That provider account is already linked to another ZionCore account.';
  }
  if (code.includes('missing-or-invalid-nonce')) {
    return 'Apple sign-in could not be verified. Start a new sign-in attempt.';
  }
  if (code.includes('invalid-oauth-client-id') || code.includes('invalid-oauth-provider')) {
    return 'The provider configuration is incomplete in Firebase Console.';
  }
  if (code.includes('web-storage-unsupported')) {
    return 'This browser blocks the storage needed for sign-in. Use a supported browser and allow site storage.';
  }
  if (code.includes('user-cancelled') || code.includes('redirect-cancelled-by-user')) {
    return 'Sign-in was cancelled.';
  }
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'That email and password could not be verified.';
  }
  if (code.includes('weak-password')) return 'Choose a password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little while, then try again.';
  if (code.includes('network-request-failed')) return 'Network connection failed. Check your connection and retry.';
  if (code.includes('popup-blocked')) return 'Your browser blocked the sign-in window. Allow pop-ups for ZionCore and retry.';
  if (code.includes('web-storage-unsupported')) {
    return 'This browser blocks the storage needed for sign-in. Allow site storage and retry in a supported browser.';
  }
  const safeCode = /^auth\/[a-z0-9-]+$/.test(code) ? ` (Firebase code: ${code})` : '';
  return `Sign-in could not be completed. Retry, and share the displayed Firebase error code with support if it continues.${safeCode}`;
}
