import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '@/firebase';
import type { CalendarEvent, FirestoreEvent } from '@/types';

const EVENTS_COLLECTION = 'events';

// ─── Serializzazione / Deserializzazione ─────────────────────────────────────

/**
 * Converte un CalendarEvent (UI) in FirestoreEvent (raw) per il salvataggio.
 * La data viene convertita da Date a stringa "YYYY-MM-DD".
 */
function toFirestoreEvent(event: Omit<CalendarEvent, 'id'>): FirestoreEvent {
  return {
    title:       event.title,
    date:        format(event.date, 'yyyy-MM-dd'),
    startTime:   event.startTime,
    endTime:     event.endTime,
    calendarId:  event.calendarId,
    description: event.description,
    ownerId:     event.ownerId,
    createdAt:   event.createdAt,
    recurrence:  event.recurrence ?? 'none',
  };
}

/**
 * Converte un documento Firestore in CalendarEvent (UI).
 * La data viene convertita da stringa "YYYY-MM-dd" a oggetto Date.
 */
function fromFirestoreEvent(id: string, data: FirestoreEvent): CalendarEvent {
  // Parsing manuale di "YYYY-MM-DD" per evitare problemi di timezone
  // (new Date("YYYY-MM-DD") interpreta come UTC, causando offset di -1 giorno)
  const [year, month, day] = data.date.split('-').map(Number);
  return {
    id,
    title:       data.title,
    date:        new Date(year, month - 1, day),
    startTime:   data.startTime,
    endTime:     data.endTime,
    calendarId:  data.calendarId,
    description: data.description,
    ownerId:     data.ownerId,
    createdAt:   data.createdAt,
    recurrence:  data.recurrence ?? 'none',
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Crea un nuovo evento su Firestore.
 * L'ID viene generato da Firestore (non da Math.random) per sicurezza.
 * Restituisce l'ID assegnato all'evento.
 */
export async function createEvent(
  event: Omit<CalendarEvent, 'id'>,
): Promise<string> {
  const ref = doc(collection(db, EVENTS_COLLECTION));
  const id = ref.id;
  await setDoc(ref, toFirestoreEvent(event));
  return id;
}

/**
 * Aggiorna un evento esistente.
 * Accetta un subset dei campi — non sovrascrive l'intero documento.
 */
export async function updateEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
): Promise<void> {
  const ref = doc(db, EVENTS_COLLECTION, id);
  const firestoreUpdates: Partial<FirestoreEvent> = {};

  if (updates.title       !== undefined) firestoreUpdates.title       = updates.title;
  if (updates.description !== undefined) firestoreUpdates.description = updates.description;
  if (updates.startTime   !== undefined) firestoreUpdates.startTime   = updates.startTime;
  if (updates.endTime     !== undefined) firestoreUpdates.endTime     = updates.endTime;
  if (updates.calendarId  !== undefined) firestoreUpdates.calendarId  = updates.calendarId;
  if (updates.date        !== undefined) firestoreUpdates.date        = format(updates.date, 'yyyy-MM-dd');
  if (updates.recurrence  !== undefined) firestoreUpdates.recurrence  = updates.recurrence;

  await updateDoc(ref, firestoreUpdates);
}

/**
 * Elimina un evento da Firestore.
 */
export async function deleteEvent(id: string): Promise<void> {
  const ref = doc(db, EVENTS_COLLECTION, id);
  await deleteDoc(ref);
}

// ─── Real-time subscription ───────────────────────────────────────────────────

/**
 * Sottoscrive in real-time alla collezione eventi.
 * Ogni modifica (create/update/delete) invoca il callback con la lista aggiornata.
 * Restituisce unsubscribe da chiamare nel cleanup del hook.
 */
export function subscribeToEvents(
  onUpdate: (events: CalendarEvent[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, EVENTS_COLLECTION),
    (snapshot) => {
      const events = snapshot.docs.map((d) =>
        fromFirestoreEvent(d.id, d.data() as FirestoreEvent),
      );
      onUpdate(events);
    },
    onError,
  );
}
