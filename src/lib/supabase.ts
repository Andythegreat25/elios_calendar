import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Custom storage adapter per il "Ricordami".
 *
 * - remember=true  → sessione in localStorage (persiste dopo chiusura browser)
 * - remember=false → sessione in sessionStorage (cancellata alla chiusura del browser)
 *
 * La scelta viene salvata in localStorage['elios_remember'] da loginWithEmail.
 * Per le sessioni già esistenti in localStorage (remember=true precedente),
 * getItem le trova comunque tramite il fallback.
 */
const storageAdapter = {
  getItem: (key: string): string | null =>
    sessionStorage.getItem(key) ?? localStorage.getItem(key),

  setItem: (key: string, value: string): void => {
    const remember = localStorage.getItem('elios_remember') === '1';
    if (remember) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

/**
 * Client Supabase unico per Auth, Database e Storage.
 * Sostituisce completamente Firebase.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: storageAdapter, persistSession: true },
});
