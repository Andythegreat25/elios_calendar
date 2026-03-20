import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  loginWithEmail,
  registerWithEmail,
  humanizeAuthError,
  logout,
  sendPasswordReset,
  updatePassword as updatePasswordService,
} from '@/services/auth.service';

export type { User };

interface UseAuthReturn {
  user: User | null;
  isAuthReady: boolean;
  isLoggingIn: boolean;
  isRecoveryMode: boolean;
  loginEmail: (email: string, password: string, remember: boolean) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser]               = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    // Recupera la sessione esistente al mount
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setIsAuthReady(true);
    });

    // Ascolta i cambi di stato auth.
    // PASSWORD_RECOVERY: Supabase ha elaborato il token dal link email
    // e ha creato una sessione temporanea → mostriamo la schermata nuova password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setUser(session?.user ?? null);
      } else {
        setIsRecoveryMode(false);
        setUser(session?.user ?? null);
      }
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginEmail = async (email: string, password: string, remember: boolean) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithEmail(email, password, remember);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore di autenticazione';
      setError(humanizeAuthError(message));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const registerEmail = async (email: string, password: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await registerWithEmail(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore di registrazione';
      setError(humanizeAuthError(message));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const resetPassword = async (email: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await sendPasswordReset(email);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore invio email';
      setError(humanizeAuthError(message));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await updatePasswordService(newPassword);
      setIsRecoveryMode(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore aggiornamento password';
      setError(humanizeAuthError(message));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      await logout();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore logout';
      setError(humanizeAuthError(message));
    }
  };

  const clearError = () => setError(null);

  return {
    user,
    isAuthReady,
    isLoggingIn,
    isRecoveryMode,
    loginEmail,
    registerEmail,
    resetPassword,
    updatePassword,
    logoutUser,
    error,
    clearError,
  };
}
