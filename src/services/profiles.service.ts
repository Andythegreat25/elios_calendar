import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

// ─── Serializzazione snake_case ↔ camelCase ───────────────────────────────────

type DbProfile = {
  uid:          string;
  display_name: string;
  color:        string;
  photo_url:    string | null;
  ics_url:      string | null;
};

function fromDb(row: DbProfile): Profile {
  return {
    uid:         row.uid,
    displayName: row.display_name,
    color:       row.color,
    photoURL:    row.photo_url  ?? undefined,
    icsUrl:      row.ics_url    ?? undefined,
  };
}

function toDb(profile: Partial<Profile> & { uid?: string }): Partial<DbProfile> {
  const out: Partial<DbProfile> = {};
  if (profile.uid          !== undefined) out.uid          = profile.uid;
  if (profile.displayName  !== undefined) out.display_name = profile.displayName;
  if (profile.color        !== undefined) out.color        = profile.color;
  if ('photoURL' in profile) out.photo_url = profile.photoURL ?? null;
  if ('icsUrl'   in profile) out.ics_url   = profile.icsUrl   ?? null;
  return out;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getProfile(uid: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromDb(data as DbProfile) : null;
}

export async function createProfile(profile: Profile): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .insert(toDb(profile));
  if (error) throw new Error(error.message);
}

export async function updateProfile(
  uid: string,
  updates: Partial<Omit<Profile, 'uid'>>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(toDb(updates))
    .eq('uid', uid);
  if (error) throw new Error(error.message);
}

// ─── Real-time subscription ───────────────────────────────────────────────────

export function subscribeToProfiles(
  onUpdate: (profiles: Profile[]) => void,
  onError:  (error: Error) => void,
): () => void {
  let current: Profile[] = [];

  // Fetch iniziale
  supabase
    .from('profiles')
    .select('*')
    .then(({ data, error }) => {
      if (error) { onError(new Error(error.message)); return; }
      current = (data as DbProfile[]).map(fromDb);
      onUpdate(current);
    });

  // Subscription real-time
  const channel = supabase
    .channel('profiles-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          current = [...current, fromDb(payload.new as DbProfile)];
        } else if (payload.eventType === 'UPDATE') {
          current = current.map((p) =>
            p.uid === (payload.new as DbProfile).uid ? fromDb(payload.new as DbProfile) : p,
          );
        } else if (payload.eventType === 'DELETE') {
          current = current.filter((p) => p.uid !== (payload.old as DbProfile).uid);
        }
        onUpdate(current);
      },
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') onError(new Error('Realtime profiles subscription failed'));
    });

  return () => { supabase.removeChannel(channel); };
}
