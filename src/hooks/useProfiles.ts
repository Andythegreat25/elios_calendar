import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Profile } from '@/types';
import {
  getProfile,
  createProfile,
  updateProfile,
  subscribeToProfiles,
} from '@/services/profiles.service';

interface UseProfilesReturn {
  profiles: Profile[];
  currentProfile: Profile | null;
  isLoading: boolean;
  saveProfile: (updates: Partial<Omit<Profile, 'uid'>>) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * Gestisce i profili utente.
 *
 * - Al mount (con utente autenticato): crea il profilo se non esiste
 * - Sottoscrive in real-time all'intera collezione profiles
 * - Espone `saveProfile` per aggiornare il profilo corrente
 */
export function useProfiles(user: User | null): UseProfilesReturn {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inizializzazione profilo al primo login
  useEffect(() => {
    if (!user) {
      setCurrentProfile(null);
      return;
    }

    const initProfile = async () => {
      setIsLoading(true);
      try {
        const existing = await getProfile(user.uid);
        if (!existing) {
          // Genera un colore di default casuale tra un set predefinito
          const defaultColors = ['#a881f3', '#2dd4bf', '#f472b6', '#60a5fa', '#fb923c'];
          const color = defaultColors[Math.floor(Math.random() * defaultColors.length)];

          const newProfile: Profile = {
            uid:         user.uid,
            displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Utente',
            color,
            photoURL:    user.photoURL ?? undefined,
          };
          await createProfile(newProfile);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore inizializzazione profilo';
        setError(message);
        console.error('[useProfiles] initProfile error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initProfile();
  }, [user]);

  // Real-time listener su tutta la collezione profiles
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      return;
    }

    const unsubscribe = subscribeToProfiles(
      (updated) => {
        setProfiles(updated);
        const mine = updated.find((p) => p.uid === user.uid) ?? null;
        setCurrentProfile(mine);
      },
      (err) => {
        console.error('[useProfiles] subscription error:', err);
        setError(err.message);
      },
    );

    return unsubscribe;
  }, [user]);

  const saveProfile = async (updates: Partial<Omit<Profile, 'uid'>>) => {
    if (!user) return;
    setError(null);
    try {
      await updateProfile(user.uid, updates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore salvataggio profilo';
      setError(message);
      throw err; // Ri-lancia per permettere al chiamante di gestire l'errore
    }
  };

  const clearError = useCallback(() => setError(null), []);
  return { profiles, currentProfile, isLoading, saveProfile, error, clearError };
}
