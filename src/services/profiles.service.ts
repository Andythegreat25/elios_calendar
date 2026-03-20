import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Profile } from '@/types';

const PROFILES_COLLECTION = 'profiles';

/**
 * Recupera il profilo di un utente da Firestore.
 * Restituisce null se il profilo non esiste ancora.
 */
export async function getProfile(uid: string): Promise<Profile | null> {
  const ref = doc(db, PROFILES_COLLECTION, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as Profile;
}

/**
 * Crea o sovrascrive completamente il profilo di un utente.
 * Usato al primo accesso per inizializzare il profilo.
 *
 * Rimuove i campi con valore undefined prima di scrivere su Firestore,
 * che rifiuta esplicitamente undefined come valore di campo (a differenza di null).
 */
export async function createProfile(profile: Profile): Promise<void> {
  const ref = doc(db, PROFILES_COLLECTION, profile.uid);
  const sanitized = Object.fromEntries(
    Object.entries(profile).filter(([, v]) => v !== undefined),
  );
  await setDoc(ref, sanitized);
}

/**
 * Aggiorna campi specifici del profilo (patch, non sovrascrittura).
 * Utile per aggiornare displayName, color o photoURL singolarmente.
 */
export async function updateProfile(
  uid: string,
  updates: Partial<Omit<Profile, 'uid'>>,
): Promise<void> {
  const ref = doc(db, PROFILES_COLLECTION, uid);
  // Firestore non accetta undefined: converte i campi undefined in deleteField()
  const sanitized = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
  );
  await updateDoc(ref, sanitized);
}

/**
 * Sottoscrive in real-time alla collezione profiles.
 * Il callback viene invocato ad ogni modifica.
 * Restituisce la funzione di unsubscribe da chiamare al cleanup.
 */
export function subscribeToProfiles(
  onUpdate: (profiles: Profile[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, PROFILES_COLLECTION),
    (snapshot) => {
      const profiles = snapshot.docs.map((d) => d.data() as Profile);
      onUpdate(profiles);
    },
    onError,
  );
}
