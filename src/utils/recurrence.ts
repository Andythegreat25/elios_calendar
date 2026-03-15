import { addDays, addWeeks, addMonths, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import type { CalendarEvent } from '@/types';

/**
 * Espande gli eventi ricorrenti in istanze virtuali per il range [rangeStart, rangeEnd].
 * Le istanze virtuali hanno id = "${originalId}_${dateString}" per distinguerle.
 * Gli eventi non ricorrenti vengono filtrati per il range.
 */
export function expandEventsForRange(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  for (const event of events) {
    const recurrence = event.recurrence ?? 'none';

    if (recurrence === 'none') {
      const eventDay = startOfDay(event.date);
      if (!isBefore(eventDay, rangeStartDay) && !isAfter(eventDay, rangeEndDay)) {
        result.push(event);
      }
      continue;
    }

    // Generate virtual instances in range
    let current = event.date;
    let safety = 0;
    const maxIter = 400;

    while (!isAfter(startOfDay(current), rangeEndDay) && safety++ < maxIter) {
      const currentDay = startOfDay(current);
      if (!isBefore(currentDay, rangeStartDay)) {
        const dateStr = `${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`;
        result.push({
          ...event,
          id: isSameDay(current, event.date) ? event.id : `${event.id}_${dateStr}`,
          date: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
        });
      }
      switch (recurrence) {
        case 'daily':   current = addDays(current, 1);   break;
        case 'weekly':  current = addWeeks(current, 1);  break;
        case 'monthly': current = addMonths(current, 1); break;
      }
    }
  }

  return result;
}
