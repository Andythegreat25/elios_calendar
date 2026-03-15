import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/firebase';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  humanizeAuthError,
  logout,
} from '@/services/auth.service';

interface UseAuthReturn {
  user: User | null;
  isAuthReady: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  loginEmail: (email: string, password: string, remember: boolean) => Promise<void>;
  registerEmail: (email: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(humanizeAuthError(code));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginEmail = async (email: string, password: string, remember: boolean) => {
    setIsLoggingIn(true);
    setError(null);
    try {
      await loginWithEmail(email, password, remember);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(humanizeAuthError(code));
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
      const code = (err as { code?: string }).code ?? '';
      setError(humanizeAuthError(code));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      await logout();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(humanizeAuthError(code));
    }
  };

  const clearError = () => setError(null);

  return { user, isAuthReady, isLoggingIn, login, loginEmail, registerEmail, logoutUser, error, clearError };
}
