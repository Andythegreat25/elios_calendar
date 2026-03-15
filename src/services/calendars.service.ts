import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { Calendar, CalendarType } from '@/types';

const CALENDARS_COLLECTION = 'calendars';

/**
 * Crea un nuovo calendario su Firestore.
 * L'ID viene generato da Firestore (non da Math.random).
 */
export async function createCalendar(
  calendar: Omit<Calendar, 'id'>,
): Promise<string> {
  const ref = doc(collection(db, CALENDARS_COLLECTION));
  const id = ref.id;
  await setDoc(ref, { ...calendar, id });
  return id;
}

/**
 * Crea un calendario con un ID predefinito.
 * Usato per la creazione del calendario personale al primo login
 * (dove l'ID è derivato dall'UID utente per evitare duplicati).
 */
export async function createCalendarWithId(
  id: string,
  calendar: Omit<Calendar, 'id'>,
): Promise<void> {
  const ref = doc(db, CALENDARS_COLLECTION, id);
  await setDoc(ref, { ...calendar, id }, { merge: true });
}

/**
 * Aggiorna campi specifici di un calendario (es. colore, nome).
 * Non sovrascrive l'intero documento.
 */
export async function updateCalendar(
  id: string,
  updates: Partial<Omit<Calendar, 'id' | 'ownerId' | 'type'>>,
): Promise<void> {
  const ref = doc(db, CALENDARS_COLLECTION, id);
  await updateDoc(ref, updates);
}

/**
 * Elimina un calendario da Firestore.
 * Attenzione: non elimina gli eventi associati (responsabilità del chiamante).
 */
export async function deleteCalendar(id: string): Promise<void> {
  const ref = doc(db, CALENDARS_COLLECTION, id);
  await deleteDoc(ref);
}

/**
 * Sottoscrive in real-time alla collezione calendars.
 * Restituisce unsubscribe da chiamare nel cleanup.
 */
export function subscribeToCalendars(
  onUpdate: (calendars: Omit<Calendar, 'visible'>[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, CALENDARS_COLLECTION),
    (snapshot) => {
      const calendars = snapshot.docs.map((d) => d.data() as Omit<Calendar, 'visible'>);
      onUpdate(calendars);
    },
    onError,
  );
}

/**
 * Genera un ID deterministico per il calendario personale di un utente.
 * Previene la creazione duplicata di calendari personali al re-login.
 */
export function personalCalendarId(uid: string): string {
  return `personal_${uid}`;
}

/**
 * Genera un ID deterministico per la sala riunioni globale.
 * Essendo condivisa, deve avere un ID stabile.
 */
export const MEETING_ROOM_ID = 'room_sala-riunioni';

/**
 * Rimuove i calendari duplicati per evitare conflitti.
 * - Rimuove tutte le sale riunioni tranne quella con MEETING_ROOM_ID
 * - Rimuove tutti i calendari personali duplicati per l'utente
 */
export async function cleanupDuplicateCalendars(userId: string): Promise<void> {
  // Remove duplicate rooms (any room not matching MEETING_ROOM_ID)
  const roomsSnap = await getDocs(query(collection(db, CALENDARS_COLLECTION), where('type', '==', 'room')));
  for (const d of roomsSnap.docs) {
    if (d.id !== MEETING_ROOM_ID) {
      await deleteDoc(doc(db, CALENDARS_COLLECTION, d.id));
    }
  }
  // Remove duplicate personal calendars for this user
  const userCalSnap = await getDocs(query(collection(db, CALENDARS_COLLECTION), where('type', '==', 'user'), where('ownerId', '==', userId)));
  for (const d of userCalSnap.docs) {
    if (d.id !== personalCalendarId(userId)) {
      await deleteDoc(doc(db, CALENDARS_COLLECTION, d.id));
    }
  }
}
