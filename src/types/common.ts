/**
 * Vista del calendario attiva.
 * - "day"   → mostra un singolo giorno
 * - "week"  → mostra 7 giorni da lunedì
 * - "month" → mostra l'intero mese
 */
export type ViewType = 'day' | 'week' | 'month' | 'agenda' | 'analytics';

/**
 * Rappresenta uno slot temporale selezionato nel grid
 * (click su una cella vuota per creare un nuovo evento).
 */
export interface SelectedSlot {
  date: Date;
  time: string; // "HH:mm"
}
