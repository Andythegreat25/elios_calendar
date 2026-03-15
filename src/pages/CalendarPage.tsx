import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { format, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Sidebar } from '@/components/Sidebar';
import { CalendarGrid } from '@/components/CalendarGrid';
import { EventModal } from '@/components/EventModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Toast } from '@/components/ui/Toast';

import { useProfiles } from '@/hooks/useProfiles';
import { useCalendars } from '@/hooks/useCalendars';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/hooks/useAuth';

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
  const { currentProfile, saveProfile, error: profileError, clearError: clearProfileError } = useProfiles(user);
  const { calendars, toggleCalendarVisibility, changeCalendarColor, error: calError, clearError: clearCalError } = useCalendars(user, currentProfile);
  const { events, isSaving, addEvent, editEvent: updateEvent, removeEvent, error: eventError, clearError } = useEvents(user);

  // ─── Stato UI locale ───────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Aggrega errori da tutti gli hook per mostrarli via Toast
  const toastMessage = profileError ?? calError ?? eventError ?? null;
  const clearToast = useCallback(() => {
    clearProfileError();
    clearCalError();
    clearError();
  }, [clearProfileError, clearCalError, clearError]);

  // ─── Navigazione ───────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    setCurrentDate((d) => view === 'week' ? subWeeks(d, 1) : subDays(d, 1));
  }, [view]);

  const handleNext = useCallback(() => {
    setCurrentDate((d) => view === 'week' ? addWeeks(d, 1) : addDays(d, 1));
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
  const handleSaveEvent = useCallback(
    async (eventData: Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>) => {
      await addEvent(eventData);
      handleCloseModal();
    },
    [addEvent, handleCloseModal],
  );

  const handleUpdateEvent = useCallback(
    async (id: string, eventData: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>) => {
      await updateEvent(id, eventData);
      handleCloseModal();
    },
    [updateEvent, handleCloseModal],
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
          events={events}
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

            {/* Toggle vista giorno/settimana */}
            <div className="flex items-center bg-zinc-100/50 p-1 rounded-full border border-zinc-200/50">
              {(['day', 'week'] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-6 py-2 text-sm font-medium rounded-full transition-all ${
                    view === v
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {v === 'day' ? 'Giorno' : 'Settimana'}
                </button>
              ))}
            </div>
          </header>

          {/* Calendar grid */}
          <div className="flex-1 p-6 overflow-hidden">
            <CalendarGrid
              currentDate={currentDate}
              view={view}
              events={events}
              calendars={calendars}
              onSlotClick={handleSlotClick}
              onEventClick={handleEventClick}
            />
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
        calendars={calendars}
        editEvent={editingEvent}
        currentUserId={user.uid}
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
