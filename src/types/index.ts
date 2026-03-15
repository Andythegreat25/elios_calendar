/**
 * Barrel export di tutti i tipi dell'applicazione.
 * Importa sempre da "@/types" per retrocompatibilità e semplicità.
 *
 * Esempio:
 *   import { Calendar, CalendarEvent, Profile } from '@/types';
 */

export type { Profile }                          from './profile';
export type { CalendarType, Calendar }           from './calendar';
export type { CalendarEvent, FirestoreEvent }    from './event';
export type { ViewType, SelectedSlot }           from './common';
