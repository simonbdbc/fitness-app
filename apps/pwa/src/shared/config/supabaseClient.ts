import type { SupabaseClient } from "@supabase/supabase-js";
// Adapter retained for shared repository types, never a network client.
export const supabase: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  throw new Error("La démonstration publique utilise uniquement les données locales.");
}
