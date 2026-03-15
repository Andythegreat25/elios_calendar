import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  type User,
} from 'firebase/auth';
import { auth } from '@/firebase';

const googleProvider = new GoogleAuthProvider();

/**
 * Avvia il flusso di login con Google tramite popup.
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Login con email e password.
 *
 * @param remember - true → persiste dopo la chiusura del browser (localStorage);
 *                   false → sessione singola (sessionStorage, si svuota alla chiusura del tab)
 */
export async function loginWithEmail(
  email: string,
  password: string,
  remember: boolean,
): Promise<User> {
  await setPersistence(
    auth,
    remember ? browserLocalPersistence : browserSessionPersistence,
  );
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Registrazione con email e password.
 * Imposta anche il displayName ricavato dalla parte locale dell'email.
 */
export async function registerWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Imposta il displayName di default come la parte prima della @ dell'email
  const defaultName = email.split('@')[0];
  await updateProfile(result.user, { displayName: defaultName });
  return result.user;
}

/**
 * Mappa i codici di errore Firebase in messaggi leggibili in italiano.
 */
export function humanizeAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email':            'Indirizzo email non valido.',
    'auth/user-not-found':           'Nessun account trovato con questa email.',
    'auth/wrong-password':           'Password errata.',
    'auth/invalid-credential':       'Credenziali non valide.',
    'auth/email-already-in-use':     'Email già in uso da un altro account.',
    'auth/weak-password':            'La password deve avere almeno 6 caratteri.',
    'auth/too-many-requests':        'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/network-request-failed':   'Errore di rete. Controlla la connessione.',
    'auth/popup-closed-by-user':     'Login annullato.',
    'auth/cancelled-popup-request':  'Login annullato.',
  };
  return map[code] ?? 'Errore di autenticazione. Riprova.';
}

/**
 * Esegue il logout dell'utente corrente.
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}
