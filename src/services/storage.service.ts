/**
 * Servizio Supabase Storage per le foto profilo.
 *
 * Le foto vengono salvate nel bucket "profile-photos" in:
 *   profiles/{uid}/avatar
 *
 * Il bucket è pubblico in lettura — l'URL viene salvato come `photoURL`
 * nel documento Firestore del profilo, evitando di memorizzare base64
 * (fino a 50 KB) che verrebbe scaricato da tutti i client ad ogni update.
 */

import { supabase } from '@/lib/supabase';

const BUCKET = 'profile-photos';

/**
 * Carica la foto profilo su Supabase Storage.
 * Sovrascrive silenziosamente il file precedente (upsert: true).
 *
 * @param uid  - UID Firebase dell'utente
 * @param file - file già ridimensionato/compresso dal chiamante
 * @returns    - URL pubblico permanente (con cache-buster per forzare il refresh)
 */
export async function uploadProfilePhoto(uid: string, file: File | Blob): Promise<string> {
  const path = `profiles/${uid}/avatar`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: 'image/jpeg',
      upsert: true,          // sovrascrive se il file esiste già
      cacheControl: '31536000', // 1 anno — l'URL cambia grazie al cache-buster
    });

  if (error) throw new Error(`Upload foto fallito: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Cache-buster: aggiunge il timestamp così il browser ricarica l'immagine
  // anche se il path è lo stesso della foto precedente
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Elimina la foto profilo da Supabase Storage.
 * Ignora silenziosamente l'errore se il file non esiste.
 */
export async function deleteProfilePhoto(uid: string): Promise<void> {
  await supabase.storage
    .from(BUCKET)
    .remove([`profiles/${uid}/avatar`]);
}
