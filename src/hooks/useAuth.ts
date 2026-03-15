import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/firebase';
import { loginWithGoogle, logout } from '@/services/auth.service';

interface UseAuthReturn {
  user: User | null;
  /** True finché Firebase non ha determinato lo stato iniziale di auth */
  isAuthReady: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  logoutUser: () => Promise<void>;
  error: string | null;
}

/**
 * Gestisce lo stato di autenticazione Firebase.
 *
 * - Sottoscrive a onAuthStateChanged per reagire a login/logout esterni
 * - Espone login (Google OAuth) e logout
 * - `isAuthReady` è false solo durante il check iniziale (evita flash della login screen)
 */
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
      // onAuthStateChanged aggiornerà lo stato automaticamente
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il login';
      setError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      await logout();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore durante il logout';
      setError(message);
    }
  };

  return { user, isAuthReady, isLoggingIn, login, logoutUser, error };
}
