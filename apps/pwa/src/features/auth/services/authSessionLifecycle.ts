import type { AuthChangeEvent } from "@supabase/supabase-js";

export type AuthSessionLifecycleAction =
  | "clear"
  | "hydrate"
  | "ignore"
  | "refresh-profile"
  | "session-only";

export function resolveAuthSessionLifecycleAction({
  activeUserId,
  event,
  hydratingUserId,
  nextUserId,
}: {
  activeUserId: string | null;
  event: AuthChangeEvent;
  hydratingUserId: string | null;
  nextUserId: string | null;
}): AuthSessionLifecycleAction {
  if (event === "SIGNED_OUT") return "clear";
  if (!nextUserId) return event === "INITIAL_SESSION" ? "clear" : "ignore";
  if (event === "TOKEN_REFRESHED") return "session-only";
  if (event === "USER_UPDATED") return "refresh-profile";
  if (
    event === "SIGNED_IN" &&
    (activeUserId === nextUserId || hydratingUserId === nextUserId)
  ) {
    return "session-only";
  }
  return "hydrate";
}
