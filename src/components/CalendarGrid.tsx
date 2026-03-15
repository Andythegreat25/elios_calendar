import type { CalendarEvent, Calendar } from '@/types';
import { format, isSameDay, addDays, startOfWeek, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/utils/cn';
import { generateTimeSlots, getEventPosition } from '@/utils/date';
import { expandEventsForRange } from '@/utils/recurrence';

interface CalendarGridProps {
  currentDate: Date;
  view: 'day' | 'week';
  events: CalendarEvent[];
  calendars: Calendar[];
  onSlotClick: (date: Date, time: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarGrid({
  currentDate, view, events, calendars, onSlotClick, onEventClick,
}: CalendarGridProps) {
  const days = view === 'week'
    ? Array.from({ length: 7 }, (_, i) =>
        addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))
    : [currentDate];

  const timeSlots = generateTimeSlots(8, 20);

  const visibleCalendarIds = new Set(
    calendars.filter((c) => c.visible !== false).map((c) => c.id),
  );
  const visibleEvents = expandEventsForRange(
    events.filter(e => visibleCalendarIds.has(e.calendarId)),
    days[0],
    days[days.length - 1],
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header giorni */}
      <div className="flex border-b border-zinc-100 bg-white pt-4 pb-2">
        <div className="w-16 flex-shrink-0" />
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day, i) => (
            <div key={i} className="flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-zinc-400 capitalize mb-2">
                {format(day, 'EEEE', { locale: it })}
              </span>
              <div
                className={cn(
                  'w-16 h-20 rounded-2xl flex items-center justify-center text-3xl font-medium transition-all',
                  isToday(day)
                    ? 'bg-[#2A2A2C] text-white shadow-md'
                    : 'bg-transparent text-zinc-900 hover:bg-zinc-50',
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid orari */}
      <div className="flex-1 overflow-y-auto relative bg-[#F8F9FA]">
        <div className="flex min-h-full pt-4">
          {/* Colonna ore */}
          <div className="w-16 flex-shrink-0 bg-[#F8F9FA]">
            {timeSlots.map((time, i) => {
              const isHour = time.endsWith(':00');
              const [hourStr] = time.split(':');
              return (
                <div key={i} className="h-20 border-b border-zinc-200/50 relative">
                  {isHour && (
                    <span className="absolute -top-2.5 right-4 text-[11px] text-zinc-400 font-medium">
                      {parseInt(hourStr, 10)}:00
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Colonne giorni */}
          <div
            className="flex-1 grid relative bg-white rounded-tl-3xl border-l border-t border-zinc-100 shadow-sm"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {/* Linee orizzontali */}
            <div className="absolute inset-0 pointer-events-none">
              {timeSlots.map((_, i) => (
                <div key={i} className="h-20 border-b border-zinc-100/50 w-full" />
              ))}
            </div>

            {days.map((day, dayIdx) => {
              const dayEvents = visibleEvents.filter((e) => isSameDay(e.date, day));
              return (
                <div
                  key={dayIdx}
                  className="relative border-r border-zinc-100/50 last:border-r-0"
                >
                  {/* Slot cliccabili */}
                  {timeSlots.map((time, timeIdx) => (
                    <div
                      key={timeIdx}
                      onClick={() => onSlotClick(day, time)}
                      className="h-20 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                    />
                  ))}

                  {/* Eventi posizionati in assoluto */}
                  {dayEvents.map((event) => {
                    const { top, height } = getEventPosition(event.startTime, event.endTime);
                    const calendar = calendars.find((c) => c.id === event.calendarId);
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onEventClick(event)}
                        className="absolute left-1.5 right-1.5 rounded-2xl p-3 text-xs overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border border-white/40"
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 24)}px`,
                          backgroundColor: `${calendar?.color ?? '#a881f3'}33`,
                          color: '#18181B',
                        }}
                      >
                        <div className="font-medium mb-1 truncate">{event.title}</div>
                        {height >= 48 && (
                          <div className="text-[10px] opacity-70 truncate">
                            {event.startTime} – {event.endTime}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
