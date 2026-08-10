import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export function createUserSupabaseClient(accessToken: string) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
