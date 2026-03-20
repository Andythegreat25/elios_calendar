import { useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { format, addWeeks, subWeeks, addDays, subDays, addMonths, subMonths, isSameDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

import { Sidebar } from '@/components/Sidebar';
import { CalendarGrid } from '@/components/CalendarGrid';
import { MonthView } from '@/components/MonthView';
import { EventModal } from '@/components/EventModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Toast } from '@/components/ui/Toast';

import { useProfiles } from '@/hooks/useProfiles';
import { useCalendars } from '@/hooks/useCalendars';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useOutlookEvents } from '@/hooks/useOutlookEvents';
import { MEETING_ROOM_ID } from '@/services/calendars.service';

import type { CalendarEvent, SelectedSlot, ViewType } from '@/types';

interface CalendarPageProps {
  user: User;
}

/**
 * Layout principale dell'applicazione autenticata.
 *
 * Responsabilità:
 * - Orchestrare i 3 hook (profiles, calendars, events)
 * - Gestire lo stato UI locale (view, currentDate, modal, selectedSlot)
 * - Passare dati e handler ai componenti figlio
 * - Mostrare errori via Toast
 */
export function CalendarPage({ user }: CalendarPageProps) {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  const { logoutUser } = useAuth();

  // ─── Dati server ───────────────────────────────────────────────────────────
  const { profiles, currentProfile, saveProfile, error: profileError, clearError: clearProfileError } = useProfiles(user);
  const { calendars, toggleCalendarVisibility, changeCalendarColor, error: calError, clearError: clearCalError } = useCalendars(user, currentProfile);
  const { events, isSaving, addEvent, editEvent: updateEvent, removeEvent, error: eventError, clearError } = useEvents(user);

  // ─── Feed ICS Outlook (read-only) ──────────────────────────────────────────
  const externalRaw = useOutlookEvents(profiles);
  // Converti ExternalEvent → CalendarEvent con flag isExternal
  const externalEvents: CalendarEvent[] = externalRaw.map((e) => ({
    id: `ext_${e.ownerUid}_${e.uid}`,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    calendarId: `external_${e.ownerUid}`,
    ownerId: e.ownerUid,
    createdAt: '',
    isExternal: true,
    ownerColor: profiles.find((p) => p.uid === e.ownerUid)?.color ?? '#94a3b8',
  }));
  // Array unificato: interni + Outlook overlay
  const allEvents: CalendarEvent[] = [...events, ...externalEvents];

  // ─── Notifiche browser ──────────────────────────────────────────────────────
  useNotifications(events);

  // ─── Stato UI locale ───────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Overlap detection per la sala riunioni
  const [overlapError, setOverlapError] = useState<string | null>(null);

  // Aggrega errori da tutti gli hook per mostrarli via Toast
  const toastMessage = overlapError ?? profileError ?? calError ?? eventError ?? null;
  const clearToast = useCallback(() => {
    setOverlapError(null);
    clearProfileError();
    clearCalError();
    clearError();
  }, [clearProfileError, clearCalError, clearError]);

  // ─── Navigazione ───────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    setCurrentDate((d) => {
      if (view === 'week') return subWeeks(d, 1);
      if (view === 'month') return subMonths(d, 1);
      return subDays(d, 1);
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate((d) => {
      if (view === 'week') return addWeeks(d, 1);
      if (view === 'month') return addMonths(d, 1);
      return addDays(d, 1);
    });
  }, [view]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  // ─── Modal eventi ──────────────────────────────────────────────────────────
  const handleSlotClick = useCallback((date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setEditingEvent(null);
    setIsModalOpen(true);
  }, []);

  const handleNewEvent = useCallback(() => {
    setSelectedSlot(null);
    setEditingEvent(null);
    setIsModalOpen(true);
  }, []);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedSlot(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setSelectedSlot(null);
  }, []);

  // ─── CRUD eventi ───────────────────────────────────────────────────────────

  /**
   * Controlla se un evento in fase di creazione/modifica si sovrappone
   * a un evento già esistente nella stessa sala.
   * Algoritmo: due fasce si sovrappongono se start1 < end2 && end1 > start2.
   * Confronto su stringhe HH:MM (24h) — funziona correttamente per ordinamento lessicografico.
   * excludeId: quando si modifica un evento esistente, lo esclude dalla verifica (non confligge con se stesso).
   */
  const checkRoomOverlap = useCallback(
    (calendarId: string, date: Date, startTime: string, endTime: string, excludeId?: string): CalendarEvent | undefined => {
      if (calendarId !== MEETING_ROOM_ID) return undefined;
      return events.find(
        (e) =>
          e.calendarId === MEETING_ROOM_ID &&
          e.id !== excludeId &&
          isSameDay(e.date, date) &&
          startTime < e.endTime &&
          endTime > e.startTime,
      );
    },
    [events],
  );

  const handleSaveEvent = useCallback(
    async (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => {
      const conflict = checkRoomOverlap(eventData.calendarId, eventData.date, eventData.startTime, eventData.endTime);
      if (conflict) {
        setOverlapError(`Sala già occupata: "${conflict.title}" (${conflict.startTime}–${conflict.endTime})`);
        return;
      }
      await addEvent(eventData);
      handleCloseModal();
    },
    [addEvent, handleCloseModal, checkRoomOverlap],
  );

  const handleUpdateEvent = useCallback(
    async (id: string, eventData: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>) => {
      // Overlap check solo se si sta spostando/ridimensionando su una sala
      if (eventData.calendarId !== undefined || eventData.date !== undefined || eventData.startTime !== undefined || eventData.endTime !== undefined) {
        // Recupera i valori attuali dell'evento in caso di aggiornamento parziale
        const existing = events.find((e) => e.id === id);
        if (existing) {
          const targetCalId  = eventData.calendarId ?? existing.calendarId;
          const targetDate   = eventData.date       ?? existing.date;
          const targetStart  = eventData.startTime  ?? existing.startTime;
          const targetEnd    = eventData.endTime    ?? existing.endTime;
          const conflict = checkRoomOverlap(targetCalId, targetDate, targetStart, targetEnd, id);
          if (conflict) {
            setOverlapError(`Sala già occupata: "${conflict.title}" (${conflict.startTime}–${conflict.endTime})`);
            return;
          }
        }
      }
      await updateEvent(id, eventData);
      handleCloseModal();
    },
    [updateEvent, handleCloseModal, checkRoomOverlap, events],
  );

  const handleDeleteEvent = useCallback(
    async (id: string) => {
      await removeEvent(id);
      handleCloseModal();
    },
    [removeEvent, handleCloseModal],
  );

  // ─── Profilo ───────────────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(
    async (updates: Parameters<typeof saveProfile>[0]) => {
      await saveProfile(updates);
    },
    [saveProfile],
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-[1400px] h-[90vh] min-h-[700px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex border border-white/10">

        {/* Sidebar */}
        <Sidebar
          calendars={calendars}
          events={allEvents}
          profile={currentProfile}
          onToggleCalendar={toggleCalendarVisibility}
          onColorChange={changeCalendarColor}
          onNewEvent={handleNewEvent}
          currentDate={currentDate}
          onDateSelect={setCurrentDate}
          user={user}
          onLogout={logoutUser}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Header navigazione */}
          <header className="h-24 px-10 flex items-center justify-between border-b border-zinc-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-6">
              <h1 className="text-3xl font-medium text-zinc-900 capitalize tracking-tight">
                {format(currentDate, 'MMMM, yyyy', { locale: it })}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  aria-label="Periodo precedente"
                  className="p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-full transition-all"
                >
                  Oggi
                </button>
                <button
                  onClick={handleNext}
                  aria-label="Periodo successivo"
                  className="p-2.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 rounded-full transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Toggle vista giorno/settimana/mese */}
            <div className="flex items-center bg-zinc-100/50 p-1 rounded-full border border-zinc-200/50">
              {(['day', 'week', 'month'] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-6 py-2 text-sm font-medium rounded-full transition-all ${
                    view === v
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
                </button>
              ))}
            </div>
          </header>

          {/* Calendar grid */}
          <div className={cn(view === 'month' ? 'flex-1 overflow-hidden' : 'flex-1 p-6 overflow-hidden')}>
            {view === 'month' ? (
              <MonthView
                currentDate={currentDate}
                events={allEvents}
                calendars={calendars}
                onSlotClick={handleSlotClick}
                onEventClick={handleEventClick}
              />
            ) : (
              <CalendarGrid
                currentDate={currentDate}
                view={view}
                events={allEvents}
                calendars={calendars}
                onSlotClick={handleSlotClick}
                onEventClick={handleEventClick}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modali */}
      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        initialDate={selectedSlot?.date}
        initialTime={selectedSlot?.time}
        calendars={calendars.filter(
          (c) => c.type === 'room' || (c.type === 'user' && c.ownerId === user.id),
        )}
        editEvent={editingEvent}
        currentUserId={user.id}
        isSaving={isSaving}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={currentProfile}
        onSave={handleSaveProfile}
      />

      {/* Toast errori */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          variant="error"
          onDismiss={clearToast}
        />
      )}
    </div>
  );
}
