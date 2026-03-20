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
    .upsert(toDb(profile), { onConflict: 'uid', ignoreDuplicates: true });
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

async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw new Error(error.message);
  return (data as DbProfile[]).map(fromDb);
}

export function subscribeToProfiles(
  onUpdate: (profiles: Profile[]) => void,
  onError:  (error: Error) => void,
): () => void {
  const channelName = `profiles-changes-${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => {
        // Re-fetch completo: nessuna race condition, sempre consistente
        fetchAllProfiles().then(onUpdate).catch(onError);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Fetch iniziale solo dopo che il canale è attivo
        fetchAllProfiles().then(onUpdate).catch(onError);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError(new Error(`Realtime profiles: ${status}`));
      }
    });

  return () => { supabase.removeChannel(channel); };
}
