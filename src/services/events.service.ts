import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/types';
import { MEETING_ROOM_ID } from './calendars.service';

// ─── Serializzazione snake_case ↔ camelCase ───────────────────────────────────

type DbEvent = {
  id:          string;
  title:       string;
  date:        string;   // "YYYY-MM-DD"
  start_time:  string;   // "HH:MM"
  end_time:    string;   // "HH:MM"
  calendar_id: string;
  description: string | null;
  owner_id:    string;
  created_at:  string;
  recurrence:  string;
};

function fromDb(row: DbEvent): CalendarEvent {
  const [year, month, day] = row.date.split('-').map(Number);
  return {
    id:          row.id,
    title:       row.title,
    date:        new Date(year, month - 1, day),
    startTime:   row.start_time,
    endTime:     row.end_time,
    calendarId:  row.calendar_id,
    description: row.description ?? undefined,
    ownerId:     row.owner_id,
    createdAt:   row.created_at,
    recurrence:  (row.recurrence ?? 'none') as CalendarEvent['recurrence'],
  };
}

// ─── CRUD eventi normali ───────────────────────────────────────────────────────

export async function createEvent(
  event: Omit<CalendarEvent, 'id'>,
): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title:       event.title,
      date:        format(event.date, 'yyyy-MM-dd'),
      start_time:  event.startTime,
      end_time:    event.endTime,
      calendar_id: event.calendarId,
      description: event.description ?? null,
      owner_id:    event.ownerId,
      recurrence:  event.recurrence ?? 'none',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
): Promise<void> {
  const patch: Partial<DbEvent> = {};
  if (updates.title       !== undefined) patch.title       = updates.title;
  if (updates.description !== undefined) patch.description = updates.description ?? null;
  if (updates.startTime   !== undefined) patch.start_time  = updates.startTime;
  if (updates.endTime     !== undefined) patch.end_time    = updates.endTime;
  if (updates.calendarId  !== undefined) patch.calendar_id = updates.calendarId;
  if (updates.date        !== undefined) patch.date        = format(updates.date, 'yyyy-MM-dd');
  if (updates.recurrence  !== undefined) patch.recurrence  = updates.recurrence;

  const { error } = await supabase.from('events').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── CRUD atomico sala riunioni (via RPC PostgreSQL) ──────────────────────────

/**
 * Crea un evento nella sala riunioni in modo atomico tramite RPC PostgreSQL.
 * La funzione `create_room_event` usa pg_advisory_xact_lock per prevenire
 * il double-booking anche in caso di scritture concorrenti.
 */
export async function createRoomEvent(
  event: Omit<CalendarEvent, 'id'>,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_room_event', {
    p_title:       event.title,
    p_date:        format(event.date, 'yyyy-MM-dd'),
    p_start:       event.startTime,
    p_end:         event.endTime,
    p_calendar_id: event.calendarId,
    p_description: event.description ?? null,
    p_owner_id:    event.ownerId,
    p_recurrence:  event.recurrence ?? 'none',
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Aggiorna un evento sala con controllo atomico degli overlap.
 */
export async function updateRoomEvent(
  id: string,
  updates: Partial<Omit<CalendarEvent, 'id' | 'ownerId' | 'createdAt'>>,
  currentDate: Date,
): Promise<void> {
  // Per l'update atomico della sala usiamo la RPC; recuperiamo i dati attuali
  // per riempire i campi non modificati
  const { data: existing, error: fetchErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const cur = fromDb(existing as DbEvent);
  const { error } = await supabase.rpc('update_room_event', {
    p_id:          id,
    p_title:       updates.title       ?? cur.title,
    p_date:        format(updates.date ?? currentDate, 'yyyy-MM-dd'),
    p_start:       updates.startTime   ?? cur.startTime,
    p_end:         updates.endTime     ?? cur.endTime,
    p_calendar_id: updates.calendarId  ?? cur.calendarId,
    p_description: updates.description ?? cur.description ?? null,
    p_recurrence:  updates.recurrence  ?? cur.recurrence  ?? 'none',
  });
  if (error) throw new Error(error.message);
}

/**
 * Elimina un evento della sala riunioni (identico a deleteEvent — nessun lock necessario per DELETE).
 */
export async function deleteRoomEvent(id: string): Promise<void> {
  await deleteEvent(id);
}

// ─── Real-time subscription ───────────────────────────────────────────────────

async function fetchAllEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.from('events').select('*');
  if (error) throw new Error(error.message);
  return (data as DbEvent[]).map(fromDb);
}

export function subscribeToEvents(
  onUpdate: (events: CalendarEvent[]) => void,
  onError:  (error: Error) => void,
): () => void {
  const channelName = `events-changes-${Date.now()}`;

  // Fetch immediato — non aspetta il canale Realtime
  fetchAllEvents().then(onUpdate).catch(onError);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events' },
      () => {
        fetchAllEvents().then(onUpdate).catch(onError);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new Error(`Realtime events: ${status}`));
      }
    });

  return () => { supabase.removeChannel(channel); };
}

// Re-export per retrocompatibilità con useEvents.ts
export { MEETING_ROOM_ID };
