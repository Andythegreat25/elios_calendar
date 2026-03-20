import type { CalendarEvent, Calendar } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/utils/cn';
import { expandEventsForRange } from '@/utils/recurrence';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendars: Calendar[];
  onSlotClick: (date: Date, time: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function MonthView({ currentDate, events, calendars, onSlotClick, onEventClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  // Build array of all days in the grid
  const days: Date[] = [];
  let d = gridStart;
  while (!isSameDay(d, addDays(gridEnd, 1))) {
    days.push(d);
    d = addDays(d, 1);
  }

  const visibleCalendarIds = new Set(
    calendars.filter(c => c.visible !== false).map(c => c.id)
  );

  const internalEvents = events.filter(e => !e.isExternal && visibleCalendarIds.has(e.calendarId));
  const externalEventsFiltered = events.filter(e => e.isExternal);

  const expandedEvents = [
    ...expandEventsForRange(internalEvents, gridStart, gridEnd),
    ...expandEventsForRange(externalEventsFiltered, gridStart, gridEnd),
  ];

  const weekDayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Day labels */}
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-white">
        {weekDayLabels.map(day => (
          <div key={day} className="py-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 overflow-y-auto" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(100px, 1fr))` }}>
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const dayEvents = expandedEvents
            .filter(e => isSameDay(e.date, day))
            .slice()
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          const todayFlag = isToday(day);
          const visibleEvents = dayEvents.slice(0, 3);
          const hiddenCount = dayEvents.length - visibleEvents.length;

          return (
            <div
              key={i}
              onClick={() => onSlotClick(day, '09:00')}
              className={cn(
                'border-r border-b border-zinc-100 p-2 cursor-pointer transition-colors min-h-[100px]',
                !isCurrentMonth && 'bg-zinc-50/50',
                isCurrentMonth && 'bg-white hover:bg-zinc-50/30',
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-end mb-1">
                <span className={cn(
                  'w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full',
                  todayFlag && 'bg-[#2A2A2C] text-white',
                  !todayFlag && isCurrentMonth && 'text-zinc-900',
                  !todayFlag && !isCurrentMonth && 'text-zinc-400',
                )}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {visibleEvents.map(event => {
                  const calendar = !event.isExternal
                    ? calendars.find(c => c.id === event.calendarId)
                    : null;
                  const color = event.isExternal
                    ? (event.ownerColor ?? '#94a3b8')
                    : (calendar?.color ?? '#a881f3');

                  if (event.isExternal) {
                    return (
                      <div
                        key={event.id}
                        title={`${event.title}\n${event.startTime}–${event.endTime}`}
                        className="px-2 py-0.5 rounded-lg text-[11px] truncate cursor-default italic opacity-70"
                        style={{
                          background: `repeating-linear-gradient(45deg, ${color}18, ${color}18 3px, transparent 3px, transparent 6px)`,
                          color: '#6b7280',
                          borderLeft: `3px solid ${color}80`,
                        }}
                      >
                        {event.title}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={event.id}
                      onClick={e => { e.stopPropagation(); onEventClick(event); }}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: `${color}25`,
                        color: '#18181B',
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      {event.startTime} {event.title}
                    </div>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="text-[11px] text-zinc-400 font-medium px-1">
                    +{hiddenCount} altri
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
