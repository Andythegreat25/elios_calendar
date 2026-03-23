import type { CalendarEvent, Calendar } from '@/types';
import { format, isToday, isTomorrow, isThisWeek, isFuture, isSameDay, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Calendar as CalendarIcon, Link2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { expandEventsForRange } from '@/utils/recurrence';
import { addDays } from 'date-fns';

interface AgendaViewProps {
  events: CalendarEvent[];
  calendars: Calendar[];
  onEventClick: (event: CalendarEvent) => void;
}

function getDayLabel(date: Date): string {
  if (isToday(date)) return 'Oggi';
  if (isTomorrow(date)) return 'Domani';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE', { locale: it });
  return format(date, 'EEEE d MMMM', { locale: it });
}

export function AgendaView({ events, calendars, onEventClick }: AgendaViewProps) {
  const today = startOfDay(new Date());
  const endDate = addDays(today, 60);

  const visibleCalendarIds = new Set(
    calendars.filter((c) => c.visible !== false).map((c) => c.id),
  );

  const internalEvents = events.filter((e) => !e.isExternal && visibleCalendarIds.has(e.calendarId));
  const externalEvents = events.filter((e) => e.isExternal);

  const allExpanded = [
    ...expandEventsForRange(internalEvents, today, endDate),
    ...expandEventsForRange(externalEvents, today, endDate),
  ]
    .filter((e) => isFuture(e.date) || isToday(e.date))
    .sort((a, b) => {
      const da = new Date(a.date);
      const [ha, ma] = a.startTime.split(':').map(Number);
      da.setHours(ha, ma);
      const db = new Date(b.date);
      const [hb, mb] = b.startTime.split(':').map(Number);
      db.setHours(hb, mb);
      return da.getTime() - db.getTime();
    });

  // Raggruppa per giorno
  const grouped: { date: Date; events: CalendarEvent[] }[] = [];
  for (const event of allExpanded) {
    const last = grouped[grouped.length - 1];
    if (last && isSameDay(last.date, event.date)) {
      last.events.push(event);
    } else {
      grouped.push({ date: event.date, events: [event] });
    }
  }

  if (grouped.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
        Nessun evento nei prossimi 60 giorni
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
      {grouped.map(({ date, events: dayEvents }, groupIdx) => (
        <div key={groupIdx}>
          {/* Intestazione giorno */}
          <div className="flex items-center gap-3 mb-3 px-2">
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex flex-col items-center justify-center text-center flex-shrink-0',
                isToday(date) ? 'bg-[#2A2A2C] text-white' : 'bg-zinc-100 dark:bg-zinc-800',
              )}
            >
              <span className={cn('text-xs font-semibold leading-none', isToday(date) ? 'text-white' : 'text-zinc-500 dark:text-zinc-400')}>
                {format(date, 'MMM', { locale: it }).toUpperCase()}
              </span>
              <span className={cn('text-sm font-bold leading-none mt-0.5', isToday(date) ? 'text-white' : 'text-zinc-800 dark:text-zinc-100')}>
                {format(date, 'd')}
              </span>
            </div>
            <div>
              <span className={cn(
                'text-sm font-semibold capitalize',
                isToday(date) ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300',
              )}>
                {getDayLabel(date)}
              </span>
              {!isToday(date) && !isTomorrow(date) && (
                <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                  {format(date, 'yyyy')}
                </span>
              )}
            </div>
          </div>

          {/* Lista eventi del giorno */}
          <div className="space-y-2 ml-13 pl-1">
            {dayEvents.map((event) => {
              const calendar = !event.isExternal
                ? calendars.find((c) => c.id === event.calendarId)
                : null;
              const color = event.isExternal
                ? (event.ownerColor ?? '#94a3b8')
                : (calendar?.color ?? '#a881f3');

              return (
                <button
                  key={event.id}
                  onClick={() => !event.isExternal && onEventClick(event)}
                  className={cn(
                    'w-full text-left rounded-2xl px-4 py-3 transition-all border',
                    event.isExternal
                      ? 'cursor-default opacity-75'
                      : 'hover:shadow-md hover:scale-[1.005] cursor-pointer',
                    'dark:border-white/5',
                  )}
                  style={{
                    backgroundColor: `${color}1A`,
                    borderColor: `${color}30`,
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={cn(
                        'text-sm font-medium flex items-center gap-1 overflow-hidden',
                        event.isExternal ? 'italic text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100',
                      )}>
                        {event.isExternal && <Link2 className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
                        <span className="truncate">{event.title}</span>
                      </div>
                      {event.description && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                          {event.description}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Clock className="w-3 h-3" />
                        {event.startTime} – {event.endTime}
                      </div>
                      {(calendar || event.isExternal) && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <CalendarIcon className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[100px]">
                            {calendar?.name ?? event.ownerName ?? 'Esterno'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
