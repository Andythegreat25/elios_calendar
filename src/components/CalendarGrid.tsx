import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
  onEventDrop?: (eventId: string, newDate: Date, newStartTime: string, newEndTime: string) => void;
}

// ─── DraggableEvent ──────────────────────────────────────────────────────────

interface EventCardProps {
  event: CalendarEvent;
  color: string;
  top: number;
  height: number;
  onEventClick: (e: CalendarEvent) => void;
  isDragOverlay?: boolean;
}

function DraggableEventCard({ event, color, top, height, onEventClick, isDragOverlay }: EventCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !!event.isExternal,
  });

  const style: CSSProperties = {
    top: `${top}px`,
    height: `${Math.max(height, 24)}px`,
    backgroundColor: `${color}33`,
    ...(isDragOverlay
      ? { transform: CSS.Translate.toString(transform), opacity: 1, boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }
      : { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); if (!isDragging) onEventClick(event); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onEventClick(event)}
      className="absolute left-1.5 right-1.5 rounded-2xl p-3 text-xs overflow-hidden cursor-grab active:cursor-grabbing transition-opacity hover:shadow-md border border-white/40 select-none text-zinc-800 dark:text-zinc-100"
    >
      <div className="font-medium mb-1 truncate">{event.title}</div>
      {height >= 48 && (
        <div className="text-[10px] opacity-70 truncate">
          {event.startTime} – {event.endTime}
        </div>
      )}
    </div>
  );
}

// ─── DroppableSlot ───────────────────────────────────────────────────────────

function DroppableSlot({
  id, time, slotKey, flashSlot, onClick,
}: {
  id: string;
  time: string;
  slotKey: string;
  flashSlot: string | null;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'h-20 cursor-pointer transition-colors duration-150',
        isOver ? 'bg-zinc-200/40' : flashSlot === slotKey ? 'bg-zinc-200/60' : 'hover:bg-zinc-50/50',
      )}
    />
  );
}

// ─── CalendarGrid ────────────────────────────────────────────────────────────

export function CalendarGrid({
  currentDate, view, events, calendars, onSlotClick, onEventClick, onEventDrop,
}: CalendarGridProps) {
  const [flashSlot, setFlashSlot] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleSlotClick = (day: Date, time: string, key: string) => {
    setFlashSlot(key);
    setTimeout(() => setFlashSlot(null), 250);
    onSlotClick(day, time);
  };

  const days = view === 'week'
    ? Array.from({ length: 7 }, (_, i) =>
        addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))
    : [currentDate];

  const timeSlots = generateTimeSlots(7, 21);

  const visibleCalendarIds = new Set(
    calendars.filter((c) => c.visible !== false).map((c) => c.id),
  );

  const internalEvents = events.filter((e) => !e.isExternal && visibleCalendarIds.has(e.calendarId));
  const externalEvents = events.filter((e) => e.isExternal);

  const visibleEvents = [
    ...expandEventsForRange(internalEvents, days[0], days[days.length - 1]),
    ...expandEventsForRange(externalEvents, days[0], days[days.length - 1]),
  ];

  const activeEvent = activeId ? visibleEvents.find((e) => e.id === activeId) : null;
  const activeColor = activeEvent
    ? (activeEvent.isExternal
        ? (activeEvent.ownerColor ?? '#94a3b8')
        : (calendars.find((c) => c.id === activeEvent.calendarId)?.color ?? '#a881f3'))
    : '#a881f3';

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || !onEventDrop) return;

    const eventId = active.id as string;
    const parts = (over.id as string).split('-');
    if (parts.length < 2) return;

    const dayIdx = parseInt(parts[0], 10);
    const timeIdx = parseInt(parts[1], 10);

    const draggedEvent = visibleEvents.find((e) => e.id === eventId);
    if (!draggedEvent || draggedEvent.isExternal) return;

    const newDate = days[dayIdx];
    const newStartTime = timeSlots[timeIdx];

    // Preserva la durata originale
    const [sH, sM] = draggedEvent.startTime.split(':').map(Number);
    const [eH, eM] = draggedEvent.endTime.split(':').map(Number);
    const durationMin = (eH * 60 + eM) - (sH * 60 + sM);

    const [nsH, nsM] = newStartTime.split(':').map(Number);
    const endTotalMin = nsH * 60 + nsM + durationMin;
    const newEndH = Math.min(Math.floor(endTotalMin / 60), 23);
    const newEndM = endTotalMin % 60;
    const newEndTime = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`;

    onEventDrop(eventId, newDate, newStartTime, newEndTime);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full bg-white dark:bg-[#1C1C1E] overflow-hidden">
        {/* Header giorni */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-700/50 bg-white dark:bg-[#1C1C1E] pt-4 pb-2">
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
                      : 'bg-transparent text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700',
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid orari */}
        <div className="flex-1 overflow-y-auto relative bg-[#F8F9FA] dark:bg-[#111113]">
          <div className="flex min-h-full pt-4">
            {/* Colonna ore */}
            <div className="w-16 flex-shrink-0 bg-[#F8F9FA] dark:bg-[#111113]">
              {timeSlots.map((time, i) => {
                const isHour = time.endsWith(':00');
                const [hourStr] = time.split(':');
                return (
                  <div key={i} className={cn(
                    'h-20 border-b relative',
                    time.endsWith(':00') ? 'border-zinc-300' : 'border-zinc-200/50',
                  )}>
                    {isHour && (
                      <span className="absolute -top-2.5 right-4 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {parseInt(hourStr, 10)}:00
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Colonne giorni */}
            <div
              className="flex-1 grid relative bg-white dark:bg-[#1C1C1E] rounded-tl-3xl border-l border-t border-zinc-100 dark:border-zinc-700/50 shadow-sm"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            >
              {/* Linee orizzontali */}
              <div className="absolute inset-0 pointer-events-none">
                {timeSlots.map((time, i) => (
                  <div key={i} className={cn(
                    'h-20 border-b w-full',
                    time.endsWith(':00') ? 'border-zinc-200 dark:border-zinc-700' : 'border-zinc-100 dark:border-zinc-700/40',
                  )} />
                ))}
              </div>

              {days.map((day, dayIdx) => {
                const dayEvents = visibleEvents.filter((e) => isSameDay(e.date, day));
                return (
                  <div
                    key={dayIdx}
                    className="relative border-r border-zinc-100/50 dark:border-zinc-700/50 last:border-r-0"
                  >
                    {/* Slot droppabili */}
                    {timeSlots.map((time, timeIdx) => {
                      const slotKey = `${dayIdx}-${timeIdx}`;
                      return (
                        <DroppableSlot
                          key={slotKey}
                          id={slotKey}
                          time={time}
                          slotKey={slotKey}
                          flashSlot={flashSlot}
                          onClick={() => handleSlotClick(day, time, slotKey)}
                        />
                      );
                    })}

                    {/* Eventi */}
                    {dayEvents.map((event) => {
                      const { top, height } = getEventPosition(event.startTime, event.endTime);
                      const calendar = !event.isExternal
                        ? calendars.find((c) => c.id === event.calendarId)
                        : null;
                      const color = event.isExternal
                        ? (event.ownerColor ?? '#94a3b8')
                        : (calendar?.color ?? '#a881f3');

                      if (event.isExternal) {
                        return (
                          <div
                            key={event.id}
                            title={`${event.title}\n${event.startTime}–${event.endTime}`}
                            className="absolute left-1.5 right-1.5 rounded-xl p-2 text-xs overflow-hidden cursor-default opacity-75 border"
                            style={{
                              top: `${top}px`,
                              height: `${Math.max(height, 20)}px`,
                              background: `repeating-linear-gradient(45deg, ${color}18, ${color}18 4px, ${color}08 4px, ${color}08 8px)`,
                              borderColor: `${color}60`,
                              borderLeft: `3px solid ${color}`,
                            }}
                          >
                            <div className="flex items-center gap-1 font-medium italic text-zinc-500 overflow-hidden">
                              <Link2 className="w-3 h-3 shrink-0" style={{ color }} />
                              <span className="truncate">{event.title}</span>
                            </div>
                            {event.ownerName && height > 34 && (
                              <div className="text-[10px] truncate mt-0.5 italic" style={{ color: `${color}bb` }}>
                                {event.ownerName}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <DraggableEventCard
                          key={event.id}
                          event={event}
                          color={color}
                          top={top}
                          height={height}
                          onEventClick={onEventClick}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay visivo durante il drag */}
      <DragOverlay dropAnimation={null}>
        {activeEvent && !activeEvent.isExternal && (() => {
          const { top, height } = getEventPosition(activeEvent.startTime, activeEvent.endTime);
          return (
            <div
              style={{
                width: '120px',
                height: `${Math.max(height, 24)}px`,
                backgroundColor: `${activeColor}33`,
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                opacity: 0.95,
              }}
              className="rounded-2xl p-3 text-xs border border-white/40 cursor-grabbing text-zinc-800 dark:text-zinc-100"
            >
              <div className="font-medium mb-1 truncate">{activeEvent.title}</div>
              {height >= 48 && (
                <div className="text-[10px] opacity-70 truncate">
                  {activeEvent.startTime} – {activeEvent.endTime}
                </div>
              )}
            </div>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
