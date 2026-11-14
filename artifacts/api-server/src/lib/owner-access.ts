export const ZIONCORE_ADMIN_EMAILS = [
  'masawit1@icloud.com',
  'tariromasawi19@gmail.com',
] as const;

const adminEmailSet = new Set<string>(ZIONCORE_ADMIN_EMAILS);

export type OwnerIdentity = {
  uid?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  zioncoreOwner?: boolean;
};

export function isOwnerIdentity(identity: OwnerIdentity): boolean {
  if (
    typeof identity.uid !== 'string' ||
    identity.uid.length === 0 ||
    identity.uid.length > 128 ||
    identity.uid.includes('/') ||
    identity.zioncoreOwner !== true ||
    identity.emailVerified !== true ||
    typeof identity.email !== 'string'
  ) return false;
  // A verified Firebase owner claim is required in addition to the approved
  // account allowlist; email verification alone never grants owner access.
  return adminEmailSet.has(identity.email.trim().toLowerCase());
}
