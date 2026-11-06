import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

export function getAuthErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code)
    : '';
  if (code.includes('email-already-in-use')) return 'An account already uses this email. Sign in instead.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'That email and password could not be verified.';
  }
  if (code.includes('weak-password')) return 'Choose a password with at least 6 characters.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little while, then try again.';
  if (code.includes('operation-not-allowed')) return 'Email and password sign-in is not enabled in the Firebase project yet.';
  if (code.includes('network-request-failed')) return 'Network connection failed. Check your connection and retry.';
  return error instanceof Error ? error.message : 'Authentication failed. Try again.';
}
