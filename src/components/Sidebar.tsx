import { CalendarEvent, Calendar as CalendarType } from '../types';
import { Plus, Calendar as CalendarIcon, Users, Building2, ChevronLeft, ChevronRight, Bell, Clock, LogOut } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isAfter, parse } from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Logo } from './Logo';

interface SidebarProps {
  calendars: CalendarType[];
  events: CalendarEvent[];
  onToggleCalendar: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onNewEvent: () => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  user: any;
  onLogout: () => void;
}

function ColorPicker({ color, onChange }: { color: string, onChange: (color: string) => void }) {
  const [localColor, setLocalColor] = useState(color);

  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localColor !== color) {
        onChange(localColor);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [localColor, color, onChange]);

  return (
    <div className="relative w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" title="Cambia colore">
      <input
        type="color"
        value={localColor}
        onChange={(e) => setLocalColor(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="w-5 h-5 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: localColor }} />
    </div>
  );
}

export function Sidebar({ calendars, events, onToggleCalendar, onColorChange, onNewEvent, currentDate, onDateSelect, user, onLogout }: SidebarProps) {
  const [miniCalendarDate, setMiniCalendarDate] = useState(currentDate);

  const monthStart = startOfMonth(miniCalendarDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setMiniCalendarDate(addMonths(miniCalendarDate, 1));
  const prevMonth = () => setMiniCalendarDate(subMonths(miniCalendarDate, 1));

  const rooms = calendars.filter(c => c.type === 'room');
  const users = calendars.filter(c => c.type === 'user');

  // Find next upcoming event
  const now = new Date();
  const upcomingEvents = events
    .filter(e => {
      const eventDate = new Date(e.date);
      const [hours, minutes] = e.startTime.split(':').map(Number);
      eventDate.setHours(hours, minutes, 0, 0);
      return isAfter(eventDate, now);
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const [hoursA, minutesA] = a.startTime.split(':').map(Number);
      dateA.setHours(hoursA, minutesA, 0, 0);
      
      const dateB = new Date(b.date);
      const [hoursB, minutesB] = b.startTime.split(':').map(Number);
      dateB.setHours(hoursB, minutesB, 0, 0);
      
      return dateA.getTime() - dateB.getTime();
    });

  const nextEvent = upcomingEvents[0];
  const nextEventCalendar = nextEvent ? calendars.find(c => c.id === nextEvent.calendarId) : null;

  return (
    <aside className="w-[320px] bg-[#1C1C1E] text-white flex flex-col h-full overflow-y-auto flex-shrink-0">
      <div className="p-8 pb-6">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border border-white/10" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-medium">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{user?.displayName}</div>
              <div className="text-xs text-zinc-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={onLogout} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors flex-shrink-0" title="Esci">
            <LogOut className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <button
          onClick={onNewEvent}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-4 py-3.5 rounded-xl font-medium transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nuovo Evento
        </button>
      </div>

      <div className="px-8 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white capitalize tracking-tight">
            {format(miniCalendarDate, dateFormat, { locale: it })}
          </h2>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-zinc-500 mb-2">
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, i) => (
            <div key={i}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm">
          {days.map((day, i) => {
            const isSelected = isSameDay(day, currentDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={i}
                onClick={() => onDateSelect(day)}
                className={clsx(
                  "w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs transition-all",
                  !isCurrentMonth && "text-zinc-600",
                  isCurrentMonth && !isSelected && !isToday && "text-zinc-400 hover:bg-white/10",
                  isSelected && !isToday && "bg-[#A881F3] text-white font-semibold",
                  isToday && "bg-white/10 text-white font-medium"
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-8 mb-8">
        {nextEvent ? (
          <div className="bg-gradient-to-br from-[#2A2A2C] to-[#1C1C1E] rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#A881F3]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-zinc-400">{nextEvent.startTime} - {nextEvent.endTime}</span>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-[10px] text-zinc-300">
                <Clock className="w-3 h-3" />
                {isSameDay(new Date(nextEvent.date), new Date()) ? 'Oggi' : format(new Date(nextEvent.date), 'dd MMM', { locale: it })}
              </div>
            </div>
            <h3 className="text-sm font-medium text-white mb-4 leading-snug truncate">
              {nextEvent.title}
            </h3>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 rounded-full border border-white/20 text-xs text-zinc-300 truncate max-w-full">
                {nextEventCalendar?.name || 'Evento'}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 text-center">
            <p className="text-sm text-zinc-400">Nessun evento imminente</p>
          </div>
        )}
      </div>

      <div className="px-8 flex-1 flex flex-col gap-8 pb-8">
        <div>
          <div className="flex items-center justify-between text-sm font-medium text-white mb-4 cursor-pointer">
            My Calendars
            <ChevronRight className="w-4 h-4 text-zinc-500 rotate-90" />
          </div>
          <div className="space-y-3">
            {rooms.map(room => {
              const roomEventsCount = events.filter(e => e.calendarId === room.id && isSameDay(new Date(e.date), currentDate)).length;
              return (
                <div key={room.id} className="flex items-center justify-between group">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={room.visible}
                        onChange={() => onToggleCalendar(room.id)}
                        className="appearance-none w-4 h-4 border border-zinc-600 rounded-sm checked:border-transparent transition-colors group-hover:border-zinc-400"
                        style={{ backgroundColor: room.visible ? room.color : 'transparent' }}
                      />
                      {room.visible && <svg className="w-2.5 h-2.5 text-white absolute pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-xs text-zinc-300 font-medium">{room.name}</span>
                  </label>
                  {roomEventsCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-zinc-400">
                      {roomEventsCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm font-medium text-white mb-4 cursor-pointer">
            Categories
            <ChevronRight className="w-4 h-4 text-zinc-500 rotate-90" />
          </div>
          <div className="space-y-3">
            {users.map(user => {
              const userEventsCount = events.filter(e => e.calendarId === user.id && isSameDay(new Date(e.date), currentDate)).length;
              const maxEvents = Math.max(...users.map(u => events.filter(e => e.calendarId === u.id && isSameDay(new Date(e.date), currentDate)).length), 1);
              const percentage = Math.min(100, Math.max(5, (userEventsCount / maxEvents) * 100));
              
              return (
                <div key={user.id} className="flex items-center justify-between group">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
                    <span className="text-xs text-zinc-300 font-medium">{user.name}</span>
                  </label>
                  {userEventsCount > 0 && (
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: user.color }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
