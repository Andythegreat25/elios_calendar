import { useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { CalendarEvent } from '@/types';
import {
  subscribeToEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/services/events.service';

interface UseEventsReturn {
  events: CalendarEvent[];
  isLoading: boolean;
  isSaving: boolean;
  addEvent: (event: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => Promise<string>;
  editEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

/**
 * Gestisce gli eventi del calendario.
 *
 * - Sottoscrive in real-time alla collezione events
 * - Espone CRUD wrappato con stato loading/error
 * - `addEvent` e `editEvent` aggiungono automaticamente ownerId e createdAt
 * - `isSaving` è true durante operazioni di scrittura (previene doppio-click)
 */
export function useEvents(user: User | null): UseEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    setIsLoading(true);

    const unsubscribe = subscribeToEvents(
      (updated) => {
        setEvents(updated);
        setIsLoading(false);
      },
      (err) => {
        console.error('[useEvents] subscription error:', err);
        setError(err.message);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const addEvent = useCallback(
    async (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>): Promise<string> => {
      if (!user) throw new Error('Utente non autenticato');
      setIsSaving(true);
      setError(null);
      try {
        const id = await createEvent({
          ...eventData,
          ownerId:   user.uid,
          createdAt: new Date().toISOString(),
        });
        return id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore creazione evento';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [user],
  );

  const editEvent = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
    ): Promise<void> => {
      setIsSaving(true);
      setError(null);
      try {
        await updateEvent(id, updates);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore modifica evento';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const removeEvent = useCallback(async (id: string): Promise<void> => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteEvent(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore eliminazione evento';
      setError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { events, isLoading, isSaving, addEvent, editEvent, removeEvent, error, clearError };
}
