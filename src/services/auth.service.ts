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
  remember: boolean,
): Promise<User> {
  // Imposta la preferenza PRIMA del signIn, così storageAdapter la legge correttamente
  if (remember) {
    localStorage.setItem('elios_remember', '1');
  } else {
    localStorage.removeItem('elios_remember');
  }
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
  if (m.includes('weak_password') || (m.includes('password') && (m.includes('contain') || m.includes('of each') || m.includes('weak'))))
    return 'Password troppo debole: usa almeno una maiuscola, una minuscola e un numero.';
  if (m.includes('password') && (m.includes('least') || m.includes('short') || m.includes('length') || /password.{0,30}\d/.test(m)))
    return 'La password deve avere almeno 6 caratteri.';
  if (m.includes('password'))
    return 'Password non valida. Controlla i requisiti e riprova.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Errore di rete. Controlla la connessione.';
  if (m.includes('email'))
    return 'Indirizzo email non valido.';
  return 'Errore di autenticazione. Riprova.';
}

/**
 * Invia email di reset password tramite Supabase Auth.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  // Usa VITE_SITE_URL (impostato nel dashboard Vercel per la produzione)
  // così il link nell'email punta sempre all'app deployata, non a localhost.
  const siteUrl = import.meta.env.VITE_SITE_URL ?? window.location.origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteUrl,
  });
  if (error) throw error;
}

/**
 * Imposta una nuova password per l'utente corrente.
 * Chiamato dopo che Supabase ha emesso l'evento PASSWORD_RECOVERY
 * e l'utente ha inserito la nuova password nel form.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Esegue il logout dell'utente corrente.
 */
export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
