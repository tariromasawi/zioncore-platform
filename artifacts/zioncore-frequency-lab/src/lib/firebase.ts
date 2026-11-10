import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';

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
const firestoreClientAccessApproved =
  env.VITE_FIRESTORE_CLIENT_ACCESS_APPROVED === 'true';
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
        if (appCheckSiteKey) {
          firebaseAppCheck = initializeAppCheck(firebaseApp, {
            provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
            isTokenAutoRefreshEnabled: true,
          });
        }
        firebaseAuth = getAuth(firebaseApp);
      }
    }
  } catch {
    firebaseInitError =
      'Firebase could not be initialized. Check the web app configuration and App Check site key.';
    firebaseApp = null;
    firebaseAuth = null;
    firebaseAppCheck = null;
  }
}

export const firebaseAuthConfigured = Boolean(firebaseAuth);
export const firebaseCloudReady = Boolean(
  firebaseAuth && firebaseAppCheck && firestoreClientAccessApproved && !firebaseInitError,
);
export const firebaseAiReady = Boolean(
  firebaseApp && firebaseAppCheck && !firebaseInitError,
);

export function getFirebaseSetupMessage() {
  if (firebaseProjectMismatch) {
    return `This lab is locked to Firebase project ${APPROVED_FIREBASE_PROJECT_ID}. The configured project does not match.`;
  }
  if (firebaseInitError) return firebaseInitError;
  if (configMissing.length > 0) {
    return `Firebase is not configured yet. Add ${configMissing.join(', ')} to the web app environment.`;
  }
  if (!appCheckSiteKey || !firebaseAppCheck) {
    return 'Firebase is configured, but App Check is not initialized. Add the registered reCAPTCHA Enterprise site key before using cloud history or AI.';
  }
  if (!firestoreClientAccessApproved) {
    return 'Account-linked cloud history is paused until Firestore rules are reviewed, deployed, and verified. Confirm App Check token exchange before enabling client access.';
  }
  return '';
}
