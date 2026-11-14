export type FirebaseAppIdentity = {
  projectId?: string;
  appId?: string;
};

export type FirebaseAppIdentityMismatch = 'project' | 'app-id' | null;

export function getFirebaseAppIdentityMismatch(
  existing: FirebaseAppIdentity | null | undefined,
  expected: FirebaseAppIdentity,
): FirebaseAppIdentityMismatch {
  if (!existing) return null;
  if (existing.projectId !== expected.projectId) return 'project';
  if (existing.appId !== expected.appId) return 'app-id';
  return null;
}
