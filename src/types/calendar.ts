/**
 * Tipo di calendario:
 * - "user"   → calendario personale di un utente
 * - "room"   → sala riunioni prenotabile
 * - "shared" → calendario condiviso di team (futuro)
 */
export type CalendarType = 'user' | 'room' | 'shared';

/**
 * Rappresenta un calendario.
 * Corrisponde al documento Firestore in /calendars/{calendarId}.
 *
 * Nota: `visible` è uno stato UI-only e NON viene persistito su Firestore.
 * Viene gestito localmente in useCalendars hook.
 */
export interface Calendar {
  id: string;
  name: string;
  /** Colore hex del calendario (es. "#2dd4bf") */
  color: string;
  type: CalendarType;
  ownerId: string;
  /** Solo lato client: indica se il calendario è visibile nel grid */
  visible?: boolean;
}
