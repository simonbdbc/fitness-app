import type { Session } from "@supabase/supabase-js";

import { getSupabaseClient } from "@shared/config/supabaseClient";
import {
  buildAuthUser,
  buildFallbackBasicUser,
  resolveUserAccountType,
  type AuthSession,
  type AuthUser,
} from "../domain/authPolicy";

type UserProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  account_type: string | null;
};

export function toAuthSession(session: Session): AuthSession {
  return { accessToken: session.access_token, provider: "supabase" };
}

export async function loadUserFromProfile(
  session: Session,
): Promise<AuthUser> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("user_profiles")
    .select("id,email,display_name,account_type")
    .eq("id", session.user.id)
    .maybeSingle<UserProfileRow>();

  if (error) throw error;
  if (!data) throw new Error("Aucun user_profiles associé à la session.");

  return buildAuthUser({
    id: session.user.id,
    email: data.email ?? session.user.email ?? null,
    name: data.display_name ?? session.user.user_metadata.name ?? null,
    accountType: resolveUserAccountType(data.account_type),
  });
}

export function fallbackUserFromSession(session: Session) {
  return buildFallbackBasicUser({
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.user_metadata.name ?? null,
  });
}

export async function signOutCurrentSupabaseSession() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
  if (error) throw error;
}
