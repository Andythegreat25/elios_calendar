import type { CalendarEvent, Calendar, Profile } from '@/types';
import { Plus, ChevronLeft, ChevronRight, Clock, LogOut, Settings } from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isAfter,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';

interface SidebarProps {
  calendars: Calendar[];
  events: CalendarEvent[];
  profile: Profile | null;
  onToggleCalendar: (id: string) => void;
  onColorChange?: (id: string, color: string) => Promise<void>;
  onNewEvent: () => void;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  user: User;
  onLogout: () => void;
  onOpenSettings: () => void;
}

// ─── ColorPicker con debounce ─────────────────────────────────────────────────

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [localColor, setLocalColor] = useState(color);

  useEffect(() => { setLocalColor(color); }, [color]);

  useEffect(() => {
    if (localColor === color) return;
    const t = setTimeout(() => onChange(localColor), 500);
    return () => clearTimeout(t);
  }, [localColor, color, onChange]);

  return (
    <div
      className="relative w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      title="Cambia colore"
    >
      <input
        type="color"
        value={localColor}
        onChange={(e) => setLocalColor(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="w-5 h-5 rounded-full shadow-sm border border-black/10"
        style={{ backgroundColor: localColor }}
      />
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  calendars, events, profile,
  onToggleCalendar, onColorChange, onNewEvent,
  currentDate, onDateSelect,
  user, onLogout, onOpenSettings,
}: SidebarProps) {
  const [miniCalDate, setMiniCalDate] = useState(currentDate);

  const monthStart = startOfMonth(miniCalDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  const rooms = calendars.filter((c) => c.type === 'room');
  const users = calendars.filter((c) => c.type === 'user');

  // Prossimo evento imminente
  const now = new Date();
  const nextEvent = events
    .filter((e) => {
      const dt = new Date(e.date);
      const [h, m] = e.startTime.split(':').map(Number);
      dt.setHours(h, m, 0, 0);
      return isAfter(dt, now);
    })
    .sort((a, b) => {
      const da = new Date(a.date); const [ha, ma] = a.startTime.split(':').map(Number); da.setHours(ha, ma);
      const db = new Date(b.date); const [hb, mb] = b.startTime.split(':').map(Number); db.setHours(hb, mb);
      return da.getTime() - db.getTime();
    })[0];

  const nextEventCalendar = nextEvent ? calendars.find((c) => c.id === nextEvent.calendarId) : null;

  const [roomsOpen, setRoomsOpen] = useState(true);
  const [usersOpen, setUsersOpen] = useState(true);

  const displayName = profile?.displayName ?? user.displayName ?? 'Utente';
  const photoURL = profile?.photoURL ?? user.photoURL ?? null;

  return (
    <aside className="w-[320px] bg-[#1C1C1E] text-white flex flex-col h-full overflow-y-auto flex-shrink-0">

      {/* Profilo + azioni */}
      <div className="p-8 pb-6">
        <div className="flex items-center justify-between mb-10">
          {/* Cliccando su avatar/nome/email apre le impostazioni */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-3 flex-1 min-w-0 rounded-xl p-1.5 -m-1.5 hover:bg-white/5 transition-colors text-left group"
            title="Impostazioni profilo"
          >
            <div className="relative flex-shrink-0">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-10 h-10 rounded-full border border-white/10 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Overlay "modifica" sull'avatar al hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Settings className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-zinc-400 truncate">{user.email}</div>
            </div>
          </button>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              title="Esci"
            >
              <LogOut className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        <button
          onClick={onNewEvent}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 px-4 py-3.5 rounded-xl font-medium transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nuovo Evento
        </button>
      </div>

      {/* Mini calendario */}
      <div className="px-8 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white capitalize tracking-tight">
            {format(miniCalDate, 'MMMM yyyy', { locale: it })}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setMiniCalDate((d) => subMonths(d, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMiniCalDate((d) => addMonths(d, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-zinc-500 mb-2">
          {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <div key={i}>{d}</div>)}
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
                className={cn(
                  'w-7 h-7 mx-auto rounded-full flex items-center justify-center text-xs transition-all',
                  !isCurrentMonth && 'text-zinc-600',
                  isCurrentMonth && !isSelected && !isToday && 'text-zinc-400 hover:bg-white/10',
                  isSelected && !isToday && 'bg-[#A881F3] text-white font-semibold',
                  isToday && 'bg-white/10 text-white font-medium',
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prossimo evento */}
      <div className="px-8 mb-8">
        {nextEvent ? (
          <div className="bg-gradient-to-br from-[#2A2A2C] to-[#1C1C1E] rounded-2xl p-5 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#A881F3]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-zinc-400">{nextEvent.startTime} - {nextEvent.endTime}</span>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-[10px] text-zinc-300">
                <Clock className="w-3 h-3" />
                {isSameDay(nextEvent.date, now)
                  ? 'Oggi'
                  : format(nextEvent.date, 'dd MMM', { locale: it })}
              </div>
            </div>
            <h3 className="text-sm font-medium text-white mb-4 leading-snug truncate">
              {nextEvent.title}
            </h3>
            <div className="flex gap-2">
              <span className="px-3 py-1.5 rounded-full border border-white/20 text-xs text-zinc-300 truncate max-w-full">
                {nextEventCalendar?.name ?? 'Evento'}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 text-center">
            <p className="text-sm text-zinc-400">Nessun evento imminente</p>
          </div>
        )}
      </div>

      {/* Liste calendari */}
      <div className="px-8 flex-1 flex flex-col gap-8 pb-8">
        {/* Sale riunioni */}
        {rooms.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setRoomsOpen((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-white mb-3 group"
            >
              <span>Sale Riunioni</span>
              <ChevronLeft
                className={cn(
                  'w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-all duration-200',
                  roomsOpen ? '-rotate-90' : 'rotate-0',
                )}
              />
            </button>
            {roomsOpen && (
              <div className="space-y-3">
                {rooms.map((room) => {
                  const count = events.filter(
                    (e) => e.calendarId === room.id && isSameDay(e.date, currentDate),
                  ).length;
                  return (
                    <div key={room.id} className="flex items-center justify-between group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={room.visible ?? true}
                            onChange={() => onToggleCalendar(room.id)}
                            className="appearance-none w-4 h-4 border border-zinc-600 rounded-sm checked:border-transparent transition-colors"
                            style={{ backgroundColor: room.visible ? room.color : 'transparent' }}
                          />
                          {room.visible && (
                            <svg className="w-2.5 h-2.5 text-white absolute pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-zinc-300 font-medium">{room.name}</span>
                      </label>
                      {onColorChange && <ColorPicker color={room.color} onChange={(c) => onColorChange(room.id, c)} />}
                      {count > 0 && (
                        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-zinc-400 ml-2">
                          {count}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Calendari utenti */}
        {users.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setUsersOpen((v) => !v)}
              className="flex items-center justify-between w-full text-sm font-medium text-white mb-3 group"
            >
              <span>Calendari</span>
              <div className="flex items-center gap-2">
                {!usersOpen && (
                  <span className="text-[10px] text-zinc-500 font-normal">{users.length}</span>
                )}
                <ChevronLeft
                  className={cn(
                    'w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-all duration-200',
                    usersOpen ? '-rotate-90' : 'rotate-0',
                  )}
                />
              </div>
            </button>
            {usersOpen && (
              <div className="space-y-3">
                {users.map((cal) => {
                  const count = events.filter(
                    (e) => e.calendarId === cal.id && isSameDay(e.date, currentDate),
                  ).length;
                  const maxCount = Math.max(
                    ...users.map((u) =>
                      events.filter((e) => e.calendarId === u.id && isSameDay(e.date, currentDate)).length,
                    ),
                    1,
                  );
                  const pct = Math.min(100, Math.max(5, (count / maxCount) * 100));

                  return (
                    <div key={cal.id} className="flex items-center justify-between group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cal.color }} />
                        <span className="text-xs text-zinc-300 font-medium">{cal.name}</span>
                      </label>
                      {onColorChange && <ColorPicker color={cal.color} onChange={(c) => onColorChange(cal.id, c)} />}
                      {count > 0 && (
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden ml-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: cal.color }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
