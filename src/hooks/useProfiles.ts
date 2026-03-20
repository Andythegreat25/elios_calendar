import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
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

  // Inizializzazione profilo + real-time subscription in sequenza.
  //
  // I due `useEffect` originali erano indipendenti: la subscription poteva
  // arrivare prima che initProfile terminasse, lasciando currentProfile null
  // al primo render. Se initProfile falliva (rete), il profilo non veniva
  // mai creato e nessun retry veniva eseguito.
  //
  // Questo singolo effect:
  //  1. Crea il profilo se non esiste (fino a 3 tentativi con back-off)
  //  2. Avvia la subscription solo dopo che l'init è completato
  //  3. Pulisce la subscription al dismount / cambio utente
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setCurrentProfile(null);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const run = async () => {
      setIsLoading(true);

      // Tentativi con back-off esponenziale: 0ms, 500ms, 1000ms
      const MAX_RETRIES = 3;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (cancelled) break;
        try {
          const existing = await getProfile(user.id);
          if (!existing && !cancelled) {
            const defaultColors = ['#a881f3', '#2dd4bf', '#f472b6', '#60a5fa', '#fb923c'];
            const color = defaultColors[Math.floor(Math.random() * defaultColors.length)];
            const newProfile: Profile = {
              uid:         user.id,
              displayName: (user.user_metadata?.display_name as string | undefined)
                            ?? user.email?.split('@')[0]
                            ?? 'Utente',
              color,
            };
            await createProfile(newProfile);
          }
          break; // successo — esci dal loop
        } catch (err) {
          const isLastAttempt = attempt === MAX_RETRIES - 1;
          if (isLastAttempt || cancelled) {
            const message = err instanceof Error ? err.message : 'Errore inizializzazione profilo';
            setError(message);
            console.error('[useProfiles] initProfile failed after', MAX_RETRIES, 'retries:', err);
            break;
          }
          // Attendi prima del prossimo tentativo
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }

      if (cancelled) return;
      setIsLoading(false);

      // Avvia la subscription real-time solo dopo che il profilo è stato creato
      unsubscribe = subscribeToProfiles(
        (updated) => {
          if (cancelled) return;
          setProfiles(updated);
          setCurrentProfile(updated.find((p) => p.uid === user.id) ?? null);
        },
        (err) => {
          if (cancelled) return;
          console.error('[useProfiles] subscription error:', err);
          setError(err.message);
        },
      );
    };

    run();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  const saveProfile = async (updates: Partial<Omit<Profile, 'uid'>>) => {
    if (!user) return;
    setError(null);
    try {
      await updateProfile(user.id, updates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore salvataggio profilo';
      setError(message);
      throw err; // Ri-lancia per permettere al chiamante di gestire l'errore
    }
  };

  const clearError = useCallback(() => setError(null), []);
  return { profiles, currentProfile, isLoading, saveProfile, error, clearError };
}
