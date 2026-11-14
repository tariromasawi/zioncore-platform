import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import {
  browserPopupRedirectResolver,
  browserLocalPersistence,
  getAuth,
  initializeAuth,
  type Auth,
  type User,
} from 'firebase/auth';

export const APPROVED_FIREBASE_PROJECT_ID = 'ethereal-throne-b20e6';

const env = import.meta.env ?? ({} as ImportMetaEnv);
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
};

const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const configMissing = [
  ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
].filter(([, value]) => !value).map(([name]) => name);

export let firebaseProjectMismatch =
  Boolean(firebaseConfig.projectId) &&
  firebaseConfig.projectId !== APPROVED_FIREBASE_PROJECT_ID;

export let firebaseApp: FirebaseApp | null = null;
export let firebaseAuth: Auth | null = null;
export let firebaseAppCheck: AppCheck | null = null;
export let firebaseInitError = '';

if (!firebaseProjectMismatch && configMissing.length === 0) {
  try {
    const appName = 'zioncore-frequency-lab';
    const existing = getApps().find(candidate => candidate.name === appName);
    if (existing && existing.options.projectId !== APPROVED_FIREBASE_PROJECT_ID) {
      firebaseProjectMismatch = true;
    } else {
      firebaseApp = existing ?? (
        getApps().some(candidate => candidate.name === '[DEFAULT]')
          ? getApp()
          : initializeApp(firebaseConfig, appName)
      );

      if (firebaseApp.options.projectId !== APPROVED_FIREBASE_PROJECT_ID) {
        firebaseProjectMismatch = true;
        firebaseApp = null;
      } else {
        try {
          firebaseAuth = initializeAuth(firebaseApp, {
            persistence: browserLocalPersistence,
            popupRedirectResolver: browserPopupRedirectResolver,
          });
        } catch (error) {
          const code = typeof error === 'object' && error && 'code' in error
            ? String(error.code)
            : '';
          if (code !== 'auth/already-initialized') throw error;
          firebaseAuth = getAuth(firebaseApp);
        }
        if (appCheckSiteKey) {
          try {
            firebaseAppCheck = initializeAppCheck(firebaseApp, {
              provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
              isTokenAutoRefreshEnabled: true,
            });
          } catch {
            // App Check is optional; it must not block Firebase Authentication.
            firebaseAppCheck = null;
          }
        }
      }
    }
  } catch {
    firebaseInitError = 'Firebase could not be initialized. Check the web app configuration.';
    firebaseApp = null;
    firebaseAuth = null;
    firebaseAppCheck = null;
  }
}

export const firebaseAuthConfigured = Boolean(firebaseAuth);
export const firebaseCloudReady = Boolean(
  firebaseAuth && !firebaseInitError,
);
export const firebaseAiReady = Boolean(
  firebaseApp && firebaseAuth && !firebaseInitError,
);

export function getFirebaseSetupMessage() {
  if (firebaseProjectMismatch) {
    return `This lab is locked to Firebase project ${APPROVED_FIREBASE_PROJECT_ID}. The configured project does not match.`;
  }
  if (firebaseInitError) return firebaseInitError;
  if (configMissing.length > 0) {
    return `Firebase is not configured yet. Add ${configMissing.join(', ')} to the web app environment.`;
  }
  return '';
}

export async function getFirebaseIdentityHeaders(user: User) {
  const idToken = await user.getIdToken();
  if (!idToken) throw new Error('A Firebase sign-in token could not be obtained.');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
    Accept: 'application/json',
  };
  if (firebaseAppCheck) {
    try {
      const appCheckToken = await getToken(firebaseAppCheck);
      if (appCheckToken.token) {
        headers['x-firebase-appcheck'] = appCheckToken.token;
      }
    } catch {
      // App Check is best-effort; verified Firebase Authentication is required.
    }
  }
  return headers;
}
