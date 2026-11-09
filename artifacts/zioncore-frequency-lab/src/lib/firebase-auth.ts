import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithRedirect,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';

export async function authenticateWithEmail(
  mode: 'sign-in' | 'create',
  email: string,
  password: string,
): Promise<User> {
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication is not configured for this project.');
  }
  const credential = mode === 'create'
    ? await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password)
    : await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return credential.user;
}

export async function signOutCurrentUser() {
  if (!firebaseAuth) return;
  await firebaseSignOut(firebaseAuth);
}

export async function sendPasswordReset(email: string) {
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication is not configured for this project.');
  }
  await sendPasswordResetEmail(firebaseAuth, email.trim());
}

export async function signInOrLinkWithGoogle() {
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication is not configured for this project.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const currentUser = firebaseAuth.currentUser;

  if (currentUser) {
    if (currentUser.providerData.some(item => item.providerId === 'google.com')) return;
    await linkWithRedirect(currentUser, provider);
    return;
  }

  await signInWithRedirect(firebaseAuth, provider);
}

export async function getAuthRedirectResult() {
  if (!firebaseAuth) return null;
  return getRedirectResult(firebaseAuth);
}

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  if (code.includes('account-exists-with-different-credential')) {
    return 'This Google account matches an existing sign-in. Sign in with that account first, then connect Google to keep the same user and permissions.';
  }
  if (code.includes('credential-already-in-use')) {
    return 'This Google account is linked to another ZionCore account. No accounts were merged.';
  }
  if (code.includes('provider-already-linked')) return 'Google sign-in is already connected to this account.';
  if (code.includes('unauthorized-domain')) return 'This website address is not authorized for Firebase sign-in.';
  if (code.includes('email-already-in-use')) return 'An account already uses this email. Sign in instead.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'That email and password could not be verified.';
  }
  if (code.includes('weak-password')) return 'Choose a password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little while, then try again.';
  if (code.includes('operation-not-allowed')) return 'This sign-in method is not enabled in the Firebase project yet.';
  if (code.includes('network-request-failed')) return 'Network connection failed. Check your connection and retry.';
  return error instanceof Error ? error.message : 'Authentication failed. Try again.';
}
