import { CalendarEvent, Calendar as CalendarType } from '../types';
import { format, isSameDay, addDays, startOfWeek, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { clsx } from 'clsx';
import { generateTimeSlots, getEventPosition } from '../utils/date';

interface CalendarGridProps {
  currentDate: Date;
  view: 'day' | 'week';
  events: CalendarEvent[];
  calendars: CalendarType[];
  onSlotClick: (date: Date, time: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarGrid({ currentDate, view, events, calendars, onSlotClick, onEventClick }: CalendarGridProps) {
  const days = view === 'week' 
    ? Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))
    : [currentDate];

  const timeSlots = generateTimeSlots(8, 20);
  const visibleCalendars = calendars.filter(c => c.visible);
  const visibleCalendarIds = new Set(visibleCalendars.map(c => c.id));

  const visibleEvents = events.filter(e => visibleCalendarIds.has(e.calendarId));

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-zinc-100 bg-white pt-4 pb-2">
        <div className="w-16 flex-shrink-0" />
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((day, i) => (
            <div key={i} className="flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-zinc-400 capitalize mb-2">
                {format(day, 'EEEE', { locale: it })}
              </span>
              <div className={clsx(
                "w-16 h-20 rounded-2xl flex items-center justify-center text-3xl font-medium transition-all",
                isToday(day) ? "bg-[#2A2A2C] text-white shadow-md" : "bg-transparent text-zinc-900 hover:bg-zinc-50"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto relative bg-[#F8F9FA]">
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 bg-[#F8F9FA]">
            {timeSlots.map((time, i) => {
              const [hourStr] = time.split(':');
              const hour = parseInt(hourStr, 10);
              const isHour = time.endsWith(':00');
              const displayTime = isHour ? `${hour}:00` : '';

              return (
                <div key={i} className="h-20 border-b border-zinc-200/50 relative">
                  {isHour && (
                    <span className="absolute -top-2.5 right-4 text-[11px] text-zinc-400 font-medium">
                      {displayTime}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Days columns */}
          <div className="flex-1 grid relative bg-white rounded-tl-3xl border-l border-t border-zinc-100 shadow-sm" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {/* Horizontal lines */}
            <div className="absolute inset-0 pointer-events-none">
              {timeSlots.map((_, i) => (
                <div key={i} className="h-20 border-b border-zinc-100/50 w-full" />
              ))}
            </div>

            {/* Vertical columns */}
            {days.map((day, dayIdx) => {
              const dayEvents = visibleEvents.filter(e => isSameDay(e.date, day));

              return (
                <div key={dayIdx} className="relative border-r border-zinc-100/50 last:border-r-0">
                  {/* Clickable slots */}
                  {timeSlots.map((time, timeIdx) => (
                    <div
                      key={timeIdx}
                      onClick={() => onSlotClick(day, time)}
                      className="h-20 cursor-pointer hover:bg-zinc-50/50 transition-colors"
                    />
                  ))}

                  {/* Events */}
                  {dayEvents.map(event => {
                    const { top, height } = getEventPosition(event.startTime, event.endTime);
                    const calendar = calendars.find(c => c.id === event.calendarId);
                    
                    return (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                        className="absolute left-1.5 right-1.5 rounded-2xl p-3 text-xs overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] border border-white/40"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: `${calendar?.color}33`,
                          color: '#18181B' // Dark text for contrast on pastel
                        }}
                      >
                        <div className="font-medium mb-1 truncate">{event.title}</div>
                        <div className="text-[10px] opacity-70 truncate">
                          {event.startTime} - {event.endTime}
                        </div>
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
