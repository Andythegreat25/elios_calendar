import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '@/firebase';
import type { CalendarEvent, FirestoreEvent } from '@/types';
import { MEETING_ROOM_ID } from './calendars.service';

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

// ─── Room lock helpers ────────────────────────────────────────────────────────

/**
 * Struttura del documento di lock per la sala riunioni.
 * Chiave: eventId, valore: { start, end, title } della prenotazione.
 */
type SlotEntry = { start: string; end: string; title: string };
type SlotMap   = Record<string, SlotEntry>;

const ROOM_LOCKS_COLLECTION = 'roomLocks';

/** ID univoco del documento di lock per sala + giorno. */
function roomLockId(date: Date): string {
  return `${MEETING_ROOM_ID}_${format(date, 'yyyy-MM-dd')}`;
}

/** Restituisce il primo slot in conflitto con [start, end), escludendo excludeId. */
function findConflict(
  slots: SlotMap,
  start: string,
  end: string,
  excludeId?: string,
): SlotEntry | undefined {
  return Object.entries(slots).find(
    ([id, slot]) => id !== excludeId && start < slot.end && end > slot.start,
  )?.[1];
}

/**
 * Crea uno SlotMap iniziale dal snapshot locale degli eventi noti.
 * Usato per "bootstrappare" il lock doc se ancora non esiste su Firestore.
 */
function slotsFromEvents(knownEvents: CalendarEvent[]): SlotMap {
  const slots: SlotMap = {};
  for (const e of knownEvents) {
    slots[e.id] = { start: e.startTime, end: e.endTime, title: e.title };
  }
  return slots;
}

// ─── CRUD atomico sala riunioni ───────────────────────────────────────────────

/**
 * Crea un evento nella sala riunioni in modo atomico.
 *
 * Usa una transazione Firestore su un documento di lock per giorno
 * ({roomLocks/MEETING_ROOM_ID_YYYY-MM-DD}) così da impedire il double-booking
 * anche in caso di scritture concorrenti da più client.
 *
 * @param event                   - dati dell'evento da creare
 * @param existingRoomEventsForDay - snapshot locale degli eventi già prenotati nello stesso giorno
 *                                   (usato per inizializzare il lock doc se mancante)
 */
export async function createRoomEvent(
  event: Omit<CalendarEvent, 'id'>,
  existingRoomEventsForDay: CalendarEvent[],
): Promise<string> {
  const newEventRef = doc(collection(db, EVENTS_COLLECTION));
  const lockRef     = doc(db, ROOM_LOCKS_COLLECTION, roomLockId(event.date));

  await runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const slots: SlotMap = lockSnap.exists()
      ? ((lockSnap.data().slots ?? {}) as SlotMap)
      : slotsFromEvents(existingRoomEventsForDay);

    const conflict = findConflict(slots, event.startTime, event.endTime);
    if (conflict) {
      throw new Error(
        `Sala già occupata: "${conflict.title}" (${conflict.start}–${conflict.end})`,
      );
    }

    const updatedSlots: SlotMap = {
      ...slots,
      [newEventRef.id]: { start: event.startTime, end: event.endTime, title: event.title },
    };

    tx.set(newEventRef, toFirestoreEvent(event));
    tx.set(lockRef, { slots: updatedSlots, updatedAt: new Date().toISOString() });
  });

  return newEventRef.id;
}

/**
 * Aggiorna un evento della sala riunioni in modo atomico.
 * Rimuove lo slot precedente dal lock doc e controlla che il nuovo orario
 * non confligga con le prenotazioni esistenti.
 *
 * @param id                       - ID Firestore dell'evento
 * @param updates                  - campi da aggiornare
 * @param currentDate              - data attuale dell'evento (necessaria per individuare il lock doc)
 * @param existingRoomEventsForDay - snapshot locale degli eventi nello stesso giorno (per bootstrap)
 */
export async function updateRoomEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
  currentDate: Date,
  existingRoomEventsForDay: CalendarEvent[],
): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, id);
  const lockRef  = doc(db, ROOM_LOCKS_COLLECTION, roomLockId(currentDate));

  await runTransaction(db, async (tx) => {
    const [eventSnap, lockSnap] = await Promise.all([tx.get(eventRef), tx.get(lockRef)]);
    if (!eventSnap.exists()) throw new Error('Evento non trovato');

    const current = eventSnap.data() as FirestoreEvent;
    const slots: SlotMap = lockSnap.exists()
      ? ((lockSnap.data().slots ?? {}) as SlotMap)
      : slotsFromEvents(existingRoomEventsForDay);

    const newStart = updates.startTime ?? current.startTime;
    const newEnd   = updates.endTime   ?? current.endTime;
    const newTitle = updates.title     ?? current.title;

    const conflict = findConflict(slots, newStart, newEnd, id);
    if (conflict) {
      throw new Error(
        `Sala già occupata: "${conflict.title}" (${conflict.start}–${conflict.end})`,
      );
    }

    const updatedSlots: SlotMap = {
      ...slots,
      [id]: { start: newStart, end: newEnd, title: newTitle },
    };

    const firestoreUpdates: Partial<FirestoreEvent> = {};
    if (updates.title       !== undefined) firestoreUpdates.title       = updates.title;
    if (updates.description !== undefined) firestoreUpdates.description = updates.description;
    if (updates.startTime   !== undefined) firestoreUpdates.startTime   = updates.startTime;
    if (updates.endTime     !== undefined) firestoreUpdates.endTime     = updates.endTime;
    if (updates.calendarId  !== undefined) firestoreUpdates.calendarId  = updates.calendarId;
    if (updates.date        !== undefined) firestoreUpdates.date        = format(updates.date, 'yyyy-MM-dd');
    if (updates.recurrence  !== undefined) firestoreUpdates.recurrence  = updates.recurrence;

    tx.update(eventRef, firestoreUpdates);
    tx.set(lockRef, { slots: updatedSlots, updatedAt: new Date().toISOString() });
  });
}

/**
 * Elimina un evento della sala riunioni rimuovendo anche la sua voce dal lock doc.
 */
export async function deleteRoomEvent(id: string, date: Date): Promise<void> {
  const eventRef = doc(db, EVENTS_COLLECTION, id);
  const lockRef  = doc(db, ROOM_LOCKS_COLLECTION, roomLockId(date));

  await runTransaction(db, async (tx) => {
    const lockSnap = await tx.get(lockRef);
    if (lockSnap.exists()) {
      const { [id]: _removed, ...updatedSlots } = (lockSnap.data().slots ?? {}) as SlotMap;
      tx.set(lockRef, { slots: updatedSlots, updatedAt: new Date().toISOString() });
    }
    tx.delete(eventRef);
  });
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
