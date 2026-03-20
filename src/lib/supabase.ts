import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Client Supabase unico per Auth, Database e Storage.
 * Sostituisce completamente Firebase.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
