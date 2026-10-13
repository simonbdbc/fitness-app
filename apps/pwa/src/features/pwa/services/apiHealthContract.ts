import type { PwaApiStatus } from "../types";

export function apiStatusForConnectivity({
  configured,
  online,
}: {
  configured: boolean;
  online: boolean;
}): PwaApiStatus {
  if (!configured) return "not-configured";
  return online ? "checking" : "unavailable";
}

export function isExpectedApiHealthPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return payload.status === "ok" && payload.service === "fitness-backend";
}
