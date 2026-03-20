import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  loginWithEmail,
  registerWithEmail,
  humanizeAuthError,
  logout,
} from '@/services/auth.service';

export type { User };

interface UseAuthReturn {
  user: User | null;
  isAuthReady: boolean;
  isLoggingIn: boolean;
  loginEmail: (email: string, password: string, remember: boolean) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser]           = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    // Recupera la sessione esistente al mount
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setIsAuthReady(true);
    });

    // Ascolta i cambi di stato auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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

  return { user, isAuthReady, isLoggingIn, loginEmail, registerEmail, logoutUser, error, clearError };
}
