/**
 * Tipo di ricorrenza per gli eventi.
 */
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Rappresenta un evento nel calendario — versione UI.
 * Il campo `date` è un oggetto Date per comodità nei componenti.
 *
 * Corrisponde al documento Firestore in /events/{eventId},
 * ma con `date` deserializzato da stringa YYYY-MM-DD a Date.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Data dell'evento come oggetto Date (UI). Firestore la store come "YYYY-MM-DD". */
  date: Date;
  /** Ora di inizio nel formato "HH:mm" (es. "09:30") */
  startTime: string;
  /** Ora di fine nel formato "HH:mm" (es. "10:30") */
  endTime: string;
  calendarId: string;
  description?: string;
  ownerId: string;
  /** ISO 8601 timestamp di creazione */
  createdAt: string;
  /** Tipo di ricorrenza dell'evento */
  recurrence?: RecurrenceType;
}

/**
 * Rappresenta un evento come viene salvato su Firestore (raw).
 * Usato nei service per la serializzazione/deserializzazione.
 */
export interface FirestoreEvent {
  title: string;
  /** Data in formato "YYYY-MM-DD" */
  date: string;
  startTime: string;
  endTime: string;
  calendarId: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  /** Tipo di ricorrenza dell'evento */
  recurrence?: RecurrenceType;
}
