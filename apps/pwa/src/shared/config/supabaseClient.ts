import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "./clientConfig";
import { createSupabaseAuthFetch } from "./supabaseAuthFetch";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
      },
      global: {
        fetch: createSupabaseAuthFetch(fetch),
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré pour cet environnement.");
  }

  return supabase;
}
