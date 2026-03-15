import { startOfWeek, addDays, parse, isBefore, isAfter } from 'date-fns';

/**
 * Restituisce i 7 giorni della settimana a partire da lunedì,
 * per la settimana che contiene `date`.
 */
export const getWeekDays = (date: Date): Date[] => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/**
 * Genera un array di slot temporali da `startHour:00` a `endHour:00`
 * con intervalli di 30 minuti.
 * Es: generateTimeSlots(8, 10) → ["08:00", "08:30", "09:00", "09:30", "10:00"]
 */
export const generateTimeSlots = (startHour = 8, endHour = 20): string[] => {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
    if (h !== endHour) {
      slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
};

/**
 * Restituisce true se `slot` è compreso tra `start` (incluso) e `end` (escluso).
 * Tutti i parametri sono stringhe "HH:mm".
 */
export const isTimeSlotBetween = (slot: string, start: string, end: string): boolean => {
  const base = new Date();
  const slotTime  = parse(slot,  'HH:mm', base);
  const startTime = parse(start, 'HH:mm', base);
  const endTime   = parse(end,   'HH:mm', base);
  return (
    (isAfter(slotTime, startTime) || slotTime.getTime() === startTime.getTime()) &&
    isBefore(slotTime, endTime)
  );
};

/**
 * Calcola la posizione CSS assoluta di un evento nel grid.
 * Baseline: 08:00 = top 0px. Ogni 30 minuti = 80px.
 *
 * @returns { top, height } in pixel
 */
export const getEventPosition = (
  start: string,
  end: string,
): { top: number; height: number } => {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM]     = end.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes   = endH   * 60 + endM;
  const dayStart     = 8 * 60; // 08:00

  const top    = ((startMinutes - dayStart) / 30) * 80;
  const height = ((endMinutes - startMinutes) / 30) * 80;

  return { top, height };
};
