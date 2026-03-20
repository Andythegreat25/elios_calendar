import { supabase } from '@/lib/supabase';
import type { Calendar } from '@/types';

// ─── Serializzazione snake_case ↔ camelCase ───────────────────────────────────

type DbCalendar = {
  id:       string;
  name:     string;
  color:    string;
  type:     string;
  owner_id: string;
};

function fromDb(row: DbCalendar): Omit<Calendar, 'visible'> {
  return {
    id:      row.id,
    name:    row.name,
    color:   row.color,
    type:    row.type as Calendar['type'],
    ownerId: row.owner_id,
  };
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

export const MEETING_ROOM_ID = 'room_sala-riunioni';

export function personalCalendarId(uid: string): string {
  return `personal_${uid}`;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCalendar(
  calendar: Omit<Calendar, 'id' | 'visible'>,
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('calendars').insert({
    id,
    name:     calendar.name,
    color:    calendar.color,
    type:     calendar.type,
    owner_id: calendar.ownerId,
  });
  if (error) throw new Error(error.message);
  return id;
}

/**
 * Crea un calendario con ID predefinito (upsert — non sovrascrive se già esiste).
 */
export async function createCalendarWithId(
  id: string,
  calendar: Omit<Calendar, 'id' | 'visible'>,
): Promise<void> {
  const { error } = await supabase.from('calendars').upsert(
    { id, name: calendar.name, color: calendar.color, type: calendar.type, owner_id: calendar.ownerId },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

export async function updateCalendar(
  id: string,
  updates: Partial<Omit<Calendar, 'id' | 'ownerId' | 'type' | 'visible'>>,
): Promise<void> {
  const { error } = await supabase
    .from('calendars')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCalendar(id: string): Promise<void> {
  const { error } = await supabase.from('calendars').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Rimuove calendari duplicati:
 * - sale riunioni con ID diverso da MEETING_ROOM_ID
 * - calendari personali duplicati dell'utente
 */
export async function cleanupDuplicateCalendars(userId: string): Promise<void> {
  // Rimuovi sale riunioni duplicate
  const { data: rooms } = await supabase
    .from('calendars')
    .select('id')
    .eq('type', 'room')
    .neq('id', MEETING_ROOM_ID);
  if (rooms?.length) {
    await supabase.from('calendars').delete().in('id', rooms.map((r) => r.id));
  }

  // Rimuovi calendari personali duplicati
  const { data: userCals } = await supabase
    .from('calendars')
    .select('id')
    .eq('type', 'user')
    .eq('owner_id', userId)
    .neq('id', personalCalendarId(userId));
  if (userCals?.length) {
    await supabase.from('calendars').delete().in('id', userCals.map((c) => c.id));
  }
}

// ─── Real-time subscription ───────────────────────────────────────────────────

export function subscribeToCalendars(
  onUpdate: (calendars: Omit<Calendar, 'visible'>[]) => void,
  onError:  (error: Error) => void,
): () => void {
  let current: Omit<Calendar, 'visible'>[] = [];

  supabase
    .from('calendars')
    .select('*')
    .then(({ data, error }) => {
      if (error) { onError(new Error(error.message)); return; }
      current = (data as DbCalendar[]).map(fromDb);
      onUpdate(current);
    });

  const channel = supabase
    .channel('calendars-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendars' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          current = [...current, fromDb(payload.new as DbCalendar)];
        } else if (payload.eventType === 'UPDATE') {
          current = current.map((c) =>
            c.id === (payload.new as DbCalendar).id ? fromDb(payload.new as DbCalendar) : c,
          );
        } else if (payload.eventType === 'DELETE') {
          current = current.filter((c) => c.id !== (payload.old as DbCalendar).id);
        }
        onUpdate(current);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') onError(new Error('Realtime calendars subscription failed'));
    });

  return () => { supabase.removeChannel(channel); };
}
