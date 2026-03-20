import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Search, X } from 'lucide-react';
import type { CalendarEvent, Calendar } from '@/types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  calendars: Calendar[];
  onEventClick: (event: CalendarEvent) => void;
}

export function SearchModal({ isOpen, onClose, events, calendars, onEventClick }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const results = q.length < 1 ? [] : events
    .filter((e) => !e.isExternal && e.title.toLowerCase().includes(q))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 30);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/40 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.14)] w-full max-w-[480px] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input ricerca */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
          <Search className="w-5 h-5 text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cerca eventi..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm text-zinc-900 placeholder:text-zinc-400 border-none focus:ring-0 bg-transparent outline-none"
          />
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Risultati */}
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              Digita per cercare un evento
            </p>
          )}
          {q.length > 0 && results.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">
              Nessun risultato per "{query}"
            </p>
          )}
          {results.map((event) => {
            const calendar = calendars.find((c) => c.id === event.calendarId);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => { onEventClick(event); onClose(); }}
                className="w-full flex items-start gap-4 px-6 py-3.5 hover:bg-zinc-50 transition-colors text-left border-b border-zinc-50 last:border-0"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: calendar?.color ?? '#a881f3' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{event.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {format(event.date, 'EEEE d MMMM yyyy', { locale: it })} · {event.startTime}–{event.endTime}
                    {calendar && <span className="ml-2 text-zinc-300">· {calendar.name}</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
