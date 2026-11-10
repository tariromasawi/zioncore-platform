import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseApp, firebaseAuth, firebaseCloudReady } from '@/lib/firebase';
import { observationSchema, type ValidatedObservation } from '@/lib/observation-validation';
import type { Observation } from '@/lib/observations';

async function firestoreForCurrentUser() {
  if (!firebaseCloudReady || !firebaseApp || !firebaseAuth?.currentUser) {
    throw new Error('Account cloud history is paused until Firestore rules and App Check are verified for this client.');
  }
  const firestore = await import('firebase/firestore');
  const collectionRef = firestore.collection(
    firestore.getFirestore(firebaseApp),
    'users',
    firebaseAuth.currentUser.uid,
    'frequency_observations',
  );
  return { firestore, collectionRef };
}

function fromSnapshot(snapshot: DocumentSnapshot<DocumentData> | QueryDocumentSnapshot<DocumentData>): Observation {
  const createdAt = snapshot.get('createdAt');
  const value = {
    id: snapshot.id,
    createdAt: createdAt?.toDate?.()?.toISOString?.(),
    sampleRate: snapshot.get('sampleRate'),
    fftSize: snapshot.get('fftSize'),
    frequencyResolutionHz: snapshot.get('frequencyResolutionHz'),
    dominantFrequencyHz: snapshot.get('dominantFrequencyHz'),
    topPeaksHz: snapshot.get('topPeaksHz'),
    rmsLevel: snapshot.get('rmsLevel'),
    durationSeconds: snapshot.get('durationSeconds'),
    mode: snapshot.get('mode'),
    ...(snapshot.get('notes') ? { notes: snapshot.get('notes') } : {}),
    ...(snapshot.get('interpretation') != null
      ? { interpretation: snapshot.get('interpretation') }
      : {}),
  };
  const parsed = observationSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`A saved cloud observation (${snapshot.id}) has invalid measurement data.`);
  }
  return parsed.data as Observation;
}

function sameInterpretation(
  left: Observation['interpretation'],
  right: Observation['interpretation'],
) {
  if (!left || !right) return left === right;
  return left.scientificInterpretation === right.scientificInterpretation
    && left.confidence === right.confidence
    && left.uncertainty === right.uncertainty
    && JSON.stringify(left.possibleSources) === JSON.stringify(right.possibleSources)
    && left.faithReflection === right.faithReflection
    && left.model === right.model;
}

export async function saveCloudObservation(observation: Observation) {
  const parsed = observationSchema.safeParse(observation);
  if (!parsed.success) {
    throw new Error('This measurement does not pass validation and was not uploaded.');
  }
  const { firestore, collectionRef } = await firestoreForCurrentUser();
  const reference = firestore.doc(collectionRef, parsed.data.id);
  const existingSnapshot = await firestore.getDoc(reference);
  if (existingSnapshot.exists()) {
    const existing = fromSnapshot(existingSnapshot);
    const sameMeasurement = existing.sampleRate === parsed.data.sampleRate
      && existing.fftSize === parsed.data.fftSize
      && existing.frequencyResolutionHz === parsed.data.frequencyResolutionHz
      && existing.dominantFrequencyHz === parsed.data.dominantFrequencyHz
      && JSON.stringify(existing.topPeaksHz) === JSON.stringify(parsed.data.topPeaksHz)
      && existing.rmsLevel === parsed.data.rmsLevel
      && existing.durationSeconds === parsed.data.durationSeconds
      && existing.mode === parsed.data.mode
      && existing.notes === parsed.data.notes;
    if (!sameMeasurement) {
      throw new Error('This observation ID already has different cloud measurement data. No existing record was changed.');
    }
    if (parsed.data.interpretation
      && !sameInterpretation(existing.interpretation, parsed.data.interpretation)) {
      await firestore.updateDoc(reference, {
        interpretation: parsed.data.interpretation,
        updatedAt: firestore.serverTimestamp(),
      });
    }
    return;
  }
  const measurement: Omit<ValidatedObservation, 'id' | 'createdAt'> = {
    sampleRate: parsed.data.sampleRate,
    fftSize: parsed.data.fftSize,
    frequencyResolutionHz: parsed.data.frequencyResolutionHz,
    dominantFrequencyHz: parsed.data.dominantFrequencyHz,
    topPeaksHz: parsed.data.topPeaksHz,
    rmsLevel: parsed.data.rmsLevel,
    durationSeconds: parsed.data.durationSeconds,
    mode: parsed.data.mode,
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    ...(parsed.data.interpretation
      ? { interpretation: parsed.data.interpretation }
      : {}),
  };
  await firestore.setDoc(reference, {
    ...measurement,
    createdAt: firestore.serverTimestamp(),
    updatedAt: firestore.serverTimestamp(),
  });
}

export async function listCloudObservations() {
  const { firestore, collectionRef } = await firestoreForCurrentUser();
  const result = await firestore.getDocs(
    firestore.query(collectionRef, firestore.orderBy('createdAt', 'desc')),
  );
  return result.docs.map(fromSnapshot);
}

export async function getCloudObservation(id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return undefined;
  const { firestore, collectionRef } = await firestoreForCurrentUser();
  const snapshot = await firestore.getDoc(firestore.doc(collectionRef, id));
  return snapshot.exists() ? fromSnapshot(snapshot) : undefined;
}

export async function deleteCloudObservations(ids: string[]) {
  const { firestore, collectionRef } = await firestoreForCurrentUser();
  await Promise.all(ids.map(id => firestore.deleteDoc(firestore.doc(collectionRef, id))));
}

export function getCloudHistoryErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error
    ? String(error.code).toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (code.includes('permission-denied') || message.includes('app check')) {
    return 'Firebase rejected this request. Check your sign-in and App Check settings.';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return 'Cloud history is temporarily unavailable. Check your connection and retry.';
  }
  if (code.includes('resource-exhausted') || code.includes('quota')) {
    return 'Firebase quota is currently exhausted. Your local observations are unchanged.';
  }
  if (code.includes('failed-precondition')) {
    return 'Cloud history is not fully enabled in Firebase yet. Check the Firestore setup and indexes.';
  }
  return error instanceof Error ? error.message : 'Could not access cloud history. Try again.';
}
