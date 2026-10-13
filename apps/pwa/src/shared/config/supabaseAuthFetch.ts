import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";

type SupabaseFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createSupabaseAuthFetch(delegate: SupabaseFetch): SupabaseFetch {
  return async (input, init) => {
    try {
      return await delegate(input, init);
    } catch (error) {
      if (isLocalSignOutRequest(input, init)) {
        reportTechnicalDegradationOnce("supabase-local-sign-out", error);
        // A local sign-out only needs the client cleanup performed by auth-js.
        // Returning 204 lets auth-js remove its persisted session and emit
        // SIGNED_OUT even when the remote revocation endpoint is unreachable.
        return new Response(null, { status: 204 });
      }

      if (!isSupabaseAuthRequest(input)) {
        throw error;
      }

      reportTechnicalDegradationOnce("supabase-auth-network", error);
      // auth-js logs thrown fetch errors with console.error before wrapping
      // them. A synthetic 503 preserves retryable semantics without opening
      // the development error overlay.
      return new Response(null, {
        status: 503,
        statusText: "Service Unavailable",
      });
    }
  };
}

export function isSupabaseAuthRequest(input: RequestInfo | URL) {
  const rawUrl = requestUrl(input);

  try {
    return new URL(rawUrl, "https://acrea.local").pathname.includes(
      "/auth/v1/",
    );
  } catch {
    return false;
  }
}

export function isLocalSignOutRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const method =
    init?.method ?? (typeof Request !== "undefined" && input instanceof Request
      ? input.method
      : "GET");
  if (method.toUpperCase() !== "POST") return false;

  const rawUrl = requestUrl(input);

  try {
    const url = new URL(rawUrl, "https://acrea.local");
    return (
      url.pathname.endsWith("/auth/v1/logout") &&
      url.searchParams.get("scope") === "local"
    );
  } catch {
    return false;
  }
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}
