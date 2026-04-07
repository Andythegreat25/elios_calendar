import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { CalendarEvent } from '@/types';
import {
  subscribeToEvents,
  fetchAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  createRoomEvent,
  updateRoomEvent,
  deleteRoomEvent,
} from '@/services/events.service';
import { MEETING_ROOM_ID } from '@/services/calendars.service';
import { getRealId } from '@/utils/recurrence';

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
        const fullEvent: Omit<CalendarEvent, 'id'> = {
          ...eventData,
          ownerId:   user.id,
          createdAt: new Date().toISOString(),
        };

        // Per la sala riunioni usa la RPC PostgreSQL con advisory lock
        // per prevenire double booking concorrenti tra più client.
        let newId: string;
        if (eventData.calendarId === MEETING_ROOM_ID) {
          newId = await createRoomEvent(fullEvent);
        } else {
          newId = await createEvent(fullEvent);
        }
        // Aggiorna lo stato immediatamente senza aspettare il canale Realtime
        setEvents(await fetchAllEvents());
        return newId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore creazione evento';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [user, events],
  );

  const editEvent = useCallback(
    async (
      id: string,
      updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
    ): Promise<void> => {
      setIsSaving(true);
      setError(null);
      const dbId = getRealId(id);
      try {
        // Per la sala riunioni usa la RPC PostgreSQL con advisory lock
        const existing = events.find((e) => e.id === dbId);
        if (existing?.calendarId === MEETING_ROOM_ID || updates.calendarId === MEETING_ROOM_ID) {
          const targetDate = updates.date ?? existing?.date ?? new Date();
          await updateRoomEvent(dbId, updates, targetDate);
        } else {
          await updateEvent(dbId, updates);
        }
        // Aggiorna lo stato immediatamente senza aspettare il canale Realtime
        setEvents(await fetchAllEvents());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore modifica evento';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [events],
  );

  const removeEvent = useCallback(
    async (id: string): Promise<void> => {
      setIsSaving(true);
      setError(null);
      const dbId = getRealId(id);
      try {
        const existing = events.find((e) => e.id === dbId);
        if (existing?.calendarId === MEETING_ROOM_ID) {
          await deleteRoomEvent(dbId);
        } else {
          await deleteEvent(dbId);
        }
        // Aggiorna lo stato immediatamente senza aspettare il canale Realtime
        setEvents(await fetchAllEvents());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Errore eliminazione evento';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [events],
  );

  const clearError = useCallback(() => setError(null), []);

  return { events, isLoading, isSaving, addEvent, editEvent, removeEvent, error, clearError };
}
