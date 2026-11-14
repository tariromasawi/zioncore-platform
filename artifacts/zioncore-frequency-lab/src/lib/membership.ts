import { firebaseApp, firebaseAuth, firebaseCloudReady } from '@/lib/firebase';
import {
  FREE_MEMBERSHIP,
  parseMembershipRecord,
  type MembershipSnapshot,
} from '@/lib/membership-model';

export {
  FREE_MEMBERSHIP,
  isPremiumEntitled,
  membershipRecordSchema,
  parseMembershipRecord,
  type MembershipSnapshot,
} from '@/lib/membership-model';

export async function readMembership(uid: string): Promise<MembershipSnapshot> {
  if (!firebaseCloudReady || !firebaseApp || !firebaseAuth?.currentUser) {
    throw new Error('Sign in with the configured Firebase account to read membership status.');
  }
  if (firebaseAuth.currentUser.uid !== uid) {
    throw new Error('Membership status can only be read for the signed-in account.');
  }

  const firestore = await import('firebase/firestore');
  const membershipRef = firestore.doc(
    firestore.getFirestore(firebaseApp),
    'users',
    uid,
    'membership',
    'current',
  );
  const snapshot = await firestore.getDoc(membershipRef);
  return snapshot.exists()
    ? parseMembershipRecord(snapshot.data())
    : FREE_MEMBERSHIP;
}
