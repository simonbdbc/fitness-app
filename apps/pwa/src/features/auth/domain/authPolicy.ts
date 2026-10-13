export type UserAccountType = "admin" | "premium" | "basic";

export type AuthSession = {
  accessToken: string;
  provider: "demo" | "supabase";
};

export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  username?: string | null;
  accountType: UserAccountType;
  isAdmin: boolean;
  isPremium: boolean;
};

export function buildAuthUser({
  accountType,
  email,
  id,
  name,
}: {
  id: string;
  email?: string | null;
  name?: string | null;
  accountType: UserAccountType;
}): AuthUser {
  return {
    id,
    email,
    name,
    username: email?.split("@")[0] ?? null,
    accountType,
    isAdmin: accountType === "admin",
    isPremium: accountType === "admin" || accountType === "premium",
  };
}

export function resolveUserAccountType(value: unknown): UserAccountType {
  if (value === "admin" || value === "premium") return value;
  return "basic";
}

export function buildFallbackBasicUser({
  email,
  id,
  name,
}: {
  email?: string | null;
  id: string;
  name?: string | null;
}) {
  return buildAuthUser({ accountType: "basic", email, id, name });
}

export function resolveAuthCapabilities(
  session: AuthSession | null,
  user: AuthUser | null,
) {
  return {
    canAccessAdminCatalog: Boolean(session && user?.isAdmin),
    canAccessPremiumFeatures: Boolean(session && user?.isPremium),
  };
}

export function authErrorMessage(error: unknown) {
  if (isAuthenticationServiceUnavailable(error)) {
    return "Service d'authentification indisponible. Réessaie dans quelques instants.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Action d'authentification impossible.";
}

function isAuthenticationServiceUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;

  const status = "status" in error ? Number(error.status) : null;
  return (
    error.name === "AuthRetryableFetchError" ||
    error.message.includes("Failed to fetch") ||
    status === 0 ||
    (status !== null && status >= 500)
  );
}
