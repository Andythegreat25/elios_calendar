import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type { User };

/**
 * Login con email e password.
 * La persistenza della sessione è gestita automaticamente da Supabase (localStorage).
 */
export async function loginWithEmail(
  email: string,
  password: string,
  _remember: boolean,
): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/**
 * Registrazione con email e password.
 * Imposta display_name nei metadati utente.
 */
export async function registerWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const displayName = email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Registrazione fallita');
  return data.user;
}

/**
 * Mappa i messaggi di errore Supabase Auth in italiano.
 */
export function humanizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Email o password non corretti.';
  if (m.includes('email not confirmed'))
    return 'Controlla la tua email e conferma la registrazione.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Email già in uso da un altro account.';
  if (m.includes('password'))
    return 'La password deve avere almeno 6 caratteri.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Errore di rete. Controlla la connessione.';
  if (m.includes('email'))
    return 'Indirizzo email non valido.';
  return 'Errore di autenticazione. Riprova.';
}

/**
 * Esegue il logout dell'utente corrente.
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
