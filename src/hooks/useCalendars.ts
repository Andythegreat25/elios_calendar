import { useEffect, useState, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Calendar, Profile } from '@/types';
import {
  subscribeToCalendars,
  createCalendarWithId,
  updateCalendar,
  personalCalendarId,
  MEETING_ROOM_ID,
  cleanupDuplicateCalendars,
} from '@/services/calendars.service';

interface UseCalendarsReturn {
  calendars: Calendar[];
  isLoading: boolean;
  toggleCalendarVisibility: (id: string) => void;
  changeCalendarColor: (id: string, color: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * Gestisce i calendari dell'applicazione.
 *
 * Design pattern:
 * - I dati Firestore (senza `visible`) sono in `rawCalendars` (ref)
 * - Lo stato `visible` è in `visibleIds` (Set in ref per evitare closure stale)
 * - `calendars` (state) è l'unione: rawCalendar + visible
 * - La subscription aggiorna `rawCalendars` e poi ricalcola `calendars`
 */
export function useCalendars(
  user: User | null,
  currentProfile: Profile | null,
): UseCalendarsReturn {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref per evitare stale closure nella subscription
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const rawCalendarsRef = useRef<Omit<Calendar, 'visible'>[]>([]);

  /** Ricalcola calendars state da raw + visibleIds */
  const rebuildCalendars = useCallback(() => {
    setCalendars(
      rawCalendarsRef.current.map((c) => ({
        ...c,
        visible: visibleIdsRef.current.has(c.id),
      })),
    );
  }, []);

  // Inizializza il calendario personale e la sala riunioni al primo login
  useEffect(() => {
    if (!user || !currentProfile) return;

    const initCalendars = async () => {
      setIsLoading(true);
      try {
        await createCalendarWithId(personalCalendarId(user.id), {
          name:    currentProfile.displayName,
          color:   currentProfile.color,
          type:    'user',
          ownerId: user.id,
        });
        await createCalendarWithId(MEETING_ROOM_ID, {
          name:    'Sala Riunioni',
          color:   '#2dd4bf',
          type:    'room',
          ownerId: user.id,
        });
        await cleanupDuplicateCalendars(user.id);
      } catch (err) {
        console.error('[useCalendars] initCalendars error:', err);
        setError(err instanceof Error ? err.message : 'Errore inizializzazione calendari');
      } finally {
        setIsLoading(false);
      }
    };

    initCalendars();
  }, [user, currentProfile]);

  // Real-time listener
  useEffect(() => {
    if (!user) {
      setCalendars([]);
      rawCalendarsRef.current = [];
      visibleIdsRef.current = new Set();
      return;
    }

    const unsubscribe = subscribeToCalendars(
      (firestoreCalendars) => {
        // Aggiungi nuovi calendari come visibili di default
        firestoreCalendars.forEach((c) => {
          if (!visibleIdsRef.current.has(c.id)) {
            visibleIdsRef.current.add(c.id);
          }
        });
        rawCalendarsRef.current = firestoreCalendars;
        rebuildCalendars();
      },
      (err) => {
        console.error('[useCalendars] subscription error:', err);
        setError(err.message);
      },
    );

    return unsubscribe;
  }, [user, rebuildCalendars]);

  // Sync nome e colore del calendario personale con il profilo
  useEffect(() => {
    if (!user || !currentProfile) return;
    const calId = personalCalendarId(user.id);
    const personal = rawCalendarsRef.current.find((c) => c.id === calId);
    if (!personal) return;
    const needsUpdate =
      personal.color !== currentProfile.color ||
      personal.name  !== currentProfile.displayName;
    if (needsUpdate) {
      updateCalendar(calId, {
        color: currentProfile.color,
        name:  currentProfile.displayName,
      }).catch(console.error);
    }
  }, [currentProfile, user]);

  const toggleCalendarVisibility = useCallback((id: string) => {
    if (visibleIdsRef.current.has(id)) {
      visibleIdsRef.current.delete(id);
    } else {
      visibleIdsRef.current.add(id);
    }
    rebuildCalendars();
  }, [rebuildCalendars]);

  const changeCalendarColor = useCallback(async (id: string, color: string) => {
    setError(null);
    try {
      await updateCalendar(id, { color });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore aggiornamento colore';
      setError(message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { calendars, isLoading, toggleCalendarVisibility, changeCalendarColor, error, clearError };
}
