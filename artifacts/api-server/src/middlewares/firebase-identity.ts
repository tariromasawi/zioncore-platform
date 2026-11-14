import type { RequestHandler } from 'express';
import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import {
  FirebaseAdminConfigurationError,
  getFirebaseAdminApp,
} from '../lib/firebase-admin';
import { isOwnerIdentity } from '../lib/owner-access';

export type FirebaseTokenVerifier = {
  verifyIdToken(token: string): Promise<{
    uid: string;
    zioncoreOwner?: boolean;
    email?: string;
    emailVerified?: boolean;
  }>;
  verifyAppCheckToken(token: string): Promise<unknown>;
};

export function createFirebaseIdentityMiddleware(
  getVerifier: () => FirebaseTokenVerifier,
): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const authorization = req.get('authorization') ?? '';
    const idToken = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
    const appCheckToken = req.get('x-firebase-appcheck');

    if (!idToken) {
      res.status(401).json({
        error: 'A valid Firebase sign-in is required.',
      });
      return;
    }

    let verifier: FirebaseTokenVerifier;
    try {
      verifier = getVerifier();
    } catch (error) {
      if (error instanceof FirebaseAdminConfigurationError) {
        req.log.error({ err: error }, 'Firebase Admin is not configured');
        res.status(503).json({
          error: 'The wallet service is not configured.',
        });
        return;
      }
      req.log.error({ err: error }, 'Could not initialize Firebase verification');
      res.status(503).json({
        error: 'The wallet service is temporarily unavailable.',
      });
      return;
    }

    try {
      const identity = await verifier.verifyIdToken(idToken);
      // App Check is an optional additional signal. Authentication remains
      // mandatory, and a supplied App Check token must still be valid.
      if (appCheckToken) await verifier.verifyAppCheckToken(appCheckToken);
      res.locals.firebaseUid = identity.uid;
      res.locals.firebaseOwner = isOwnerIdentity(identity);
      next();
    } catch {
      req.log.warn('Rejected a request with invalid Firebase credentials');
      res.status(401).json({
        error: 'Firebase Authentication or supplied App Check verification failed.',
      });
    }
  };
}

export const requireFirebaseIdentity = createFirebaseIdentityMiddleware(() => {
  const app = getFirebaseAdminApp();
  return {
    verifyIdToken: async token => {
      const decoded = await getAuth(app).verifyIdToken(token);
      return {
        uid: decoded.uid,
        zioncoreOwner: decoded.zioncoreOwner === true,
        email: decoded.email,
        emailVerified: decoded.email_verified === true,
      };
    },
    verifyAppCheckToken: token => getAppCheck(app).verifyToken(token),
  };
});

export const requireFirebaseOwnerClaim: RequestHandler = (_req, res, next) => {
  if (res.locals.firebaseOwner !== true) {
    res.status(403).json({ error: 'Owner access is required for this resource.' });
    return;
  }
  next();
};

export const requireFirebaseOwner: RequestHandler[] = [
  requireFirebaseIdentity,
  requireFirebaseOwnerClaim,
];
