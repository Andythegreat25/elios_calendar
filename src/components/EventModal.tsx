import React, { useState, useEffect } from 'react';
import type { CalendarEvent, Calendar } from '@/types';
import { format } from 'date-fns';
import { X, Clock, Calendar as CalendarIcon, AlignLeft, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => Promise<void>;
  onUpdate?: (id: string, event: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialDate?: Date;
  initialTime?: string;
  calendars: Calendar[];
  editEvent?: CalendarEvent | null;
  currentUserId?: string;
  /** True mentre una scrittura su Firestore è in corso: blocca il submit */
  isSaving?: boolean;
}

export function EventModal({
  isOpen, onClose, onSave, onUpdate, onDelete,
  initialDate, initialTime, calendars, editEvent, currentUserId, isSaving = false,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [calendarId, setCalendarId] = useState(calendars[0]?.id || '');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editEvent) {
      setTitle(editEvent.title);
      setDate(format(editEvent.date, 'yyyy-MM-dd'));
      setStartTime(editEvent.startTime);
      setEndTime(editEvent.endTime);
      setCalendarId(editEvent.calendarId);
      setDescription(editEvent.description || '');
    } else {
      setTitle('');
      setDate(initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(initialTime || '08:00');
      if (initialTime) {
        const [hours, minutes] = initialTime.split(':').map(Number);
        const endH = Math.min(hours + 1, 23).toString().padStart(2, '0');
        setEndTime(`${endH}:${minutes.toString().padStart(2, '0')}`);
      } else {
        setEndTime('09:00');
      }
      setCalendarId(calendars[0]?.id || '');
      setDescription('');
    }
  }, [isOpen, initialDate, initialTime, calendars, editEvent]);

  if (!isOpen) return null;

  const isOwner = editEvent ? editEvent.ownerId === currentUserId : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || isSaving) return;

    // Parsing manuale YYYY-MM-DD → evita offset timezone di new Date("YYYY-MM-DD")
    const [year, month, day] = date.split('-').map(Number);
    const eventData = {
      title: title.trim() || 'Nuovo Evento',
      date: new Date(year, month - 1, day),
      startTime,
      endTime,
      calendarId,
      description,
    };

    if (editEvent && onUpdate) {
      await onUpdate(editEvent.id, eventData);
    } else {
      await onSave(eventData);
    }
  };

  const handleDelete = async () => {
    if (!editEvent || !onDelete || !isOwner) return;
    if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
      await onDelete(editEvent.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgb(0,0,0,0.12)] w-full max-w-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <input
            type="text"
            placeholder="Titolo dell'evento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!isOwner}
            className="w-full text-2xl font-medium text-zinc-900 placeholder:text-zinc-300 border-none focus:ring-0 p-0 bg-transparent disabled:opacity-70"
            autoFocus={!editEvent}
          />
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full transition-all ml-4 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          <div className="space-y-4">
            {/* Data */}
            <div className="flex items-center gap-4">
              <CalendarIcon className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!isOwner}
                required
                className="flex-1 bg-zinc-50/50 border border-zinc-200/60 text-zinc-900 text-sm rounded-2xl focus:ring-zinc-900 focus:border-zinc-900 px-4 py-3 disabled:opacity-70 transition-all font-medium"
              />
            </div>

            {/* Orario */}
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={!isOwner}
                  required
                  className="flex-1 bg-zinc-50/50 border border-zinc-200/60 text-zinc-900 text-sm rounded-2xl px-4 py-3 disabled:opacity-70 transition-all font-medium"
                />
                <span className="text-zinc-400">-</span>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!isOwner}
                  required
                  className="flex-1 bg-zinc-50/50 border border-zinc-200/60 text-zinc-900 text-sm rounded-2xl px-4 py-3 disabled:opacity-70 transition-all font-medium"
                />
              </div>
            </div>

            {/* Calendario */}
            <div className="flex items-center gap-4">
              <AlignLeft className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <select
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                disabled={!isOwner}
                className="flex-1 bg-zinc-50/50 border border-zinc-200/60 text-zinc-900 text-sm rounded-2xl px-4 py-3 disabled:opacity-70 transition-all font-medium appearance-none"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Descrizione */}
            <div className="flex items-start gap-4">
              <div className="w-5 h-5 flex-shrink-0 mt-3" />
              <textarea
                placeholder="Aggiungi descrizione..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isOwner}
                rows={2}
                className="flex-1 bg-zinc-50/50 border border-zinc-200/60 text-zinc-900 text-sm rounded-2xl px-4 py-3 resize-none disabled:opacity-70 transition-all font-medium"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            {editEvent && isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="p-3.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-all border border-red-100 disabled:opacity-50"
                title="Elimina evento"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={!isOwner || isSaving}
              className="flex-1 bg-[#1C1C1E] hover:bg-black text-white px-6 py-3.5 rounded-2xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" className="border-zinc-500 border-t-white" />
                  Salvataggio...
                </>
              ) : (
                editEvent ? 'Salva Modifiche' : 'Aggiungi Evento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
