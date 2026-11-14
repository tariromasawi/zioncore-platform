import type { User } from 'firebase/auth';

const approvedAdminEmails = new Set([
  'masawit1@icloud.com',
  'tariromasawi19@gmail.com',
]);

export function canShowAdminLink(user: Pick<User, 'email' | 'emailVerified'> | null, ownerClaim: boolean): boolean {
  void ownerClaim;
  return user?.emailVerified === true
    && typeof user.email === 'string'
    && approvedAdminEmails.has(user.email.trim().toLowerCase());
}
