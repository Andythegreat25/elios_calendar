import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/firebase';

const googleProvider = new GoogleAuthProvider();

/**
 * Avvia il flusso di login con Google tramite popup.
 * Restituisce l'utente Firebase autenticato.
 * @throws FirebaseError se il popup viene chiuso o il login fallisce.
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Esegue il logout dell'utente corrente.
 * @throws FirebaseError in caso di errore di rete.
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}
