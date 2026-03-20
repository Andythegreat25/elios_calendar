/**
 * Servizio Firebase Storage per le foto profilo.
 *
 * Le foto vengono salvate in:  profiles/{uid}/avatar
 * e i corrispondenti URL (https://firebasestorage.googleapis.com/...)
 * vengono salvati nel documento Firestore del profilo come `photoURL`.
 *
 * Questo evita di memorizzare stringhe base64 (fino a 50 KB) direttamente
 * in Firestore, riducendo i costi di lettura e la quantità di dati scaricati
 * da tutti i client ad ogni subscription update.
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '@/firebase';

/**
 * Carica un file immagine su Firebase Storage come foto profilo dell'utente.
 * Sovrascrive silenziosamente la foto precedente (stesso percorso).
 *
 * @param uid  - UID Firestore dell'utente
 * @param file - file immagine (già ridimensionato/compresso dal chiamante)
 * @returns    - URL pubblico di download (https://...)
 */
export async function uploadProfilePhoto(uid: string, file: File | Blob): Promise<string> {
  const photoRef = ref(storage, `profiles/${uid}/avatar`);
  const snapshot = await uploadBytes(photoRef, file, {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000', // 1 anno — l'URL cambia ad ogni upload
  });
  return getDownloadURL(snapshot.ref);
}

/**
 * Elimina la foto profilo da Firebase Storage.
 * Ignora silenziosamente l'errore se il file non esiste.
 */
export async function deleteProfilePhoto(uid: string): Promise<void> {
  try {
    const photoRef = ref(storage, `profiles/${uid}/avatar`);
    await deleteObject(photoRef);
  } catch {
    // Il file potrebbe non esistere (profilo senza foto o già eliminato)
  }
}
