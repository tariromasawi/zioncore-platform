export const ZIONCORE_ADMIN_EMAILS = [
  'masawit1@icloud.com',
  'tariromasawi19@gmail.com',
] as const;

const adminEmailSet = new Set<string>(ZIONCORE_ADMIN_EMAILS);

export type OwnerIdentity = {
  email?: string | null;
  emailVerified?: boolean;
  zioncoreOwner?: boolean;
};

export function isOwnerIdentity(identity: OwnerIdentity): boolean {
  if (identity.emailVerified !== true || typeof identity.email !== 'string') return false;
  // Owner access is restricted to the two explicitly approved, verified accounts.
  return adminEmailSet.has(identity.email.trim().toLowerCase());
}
