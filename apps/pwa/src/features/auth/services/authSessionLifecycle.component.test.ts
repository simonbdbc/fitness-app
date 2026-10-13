import { describe, expect, it } from "vitest";

import { resolveAuthSessionLifecycleAction } from "./authSessionLifecycle";

describe("auth session lifecycle", () => {
  it("keeps the mounted account on token refresh and repeated sign-in", () => {
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "TOKEN_REFRESHED",
        hydratingUserId: null,
        nextUserId: "user-1",
      }),
    ).toBe("session-only");
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "SIGNED_IN",
        hydratingUserId: null,
        nextUserId: "user-1",
      }),
    ).toBe("session-only");
  });

  it("hydrates only an initial or genuinely different account", () => {
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: null,
        event: "INITIAL_SESSION",
        hydratingUserId: null,
        nextUserId: "user-1",
      }),
    ).toBe("hydrate");
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "SIGNED_IN",
        hydratingUserId: null,
        nextUserId: "user-2",
      }),
    ).toBe("hydrate");
  });

  it("refreshes profile data without clearing the session", () => {
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "USER_UPDATED",
        hydratingUserId: null,
        nextUserId: "user-1",
      }),
    ).toBe("refresh-profile");
  });

  it("clears only a real sign-out or an empty initial session", () => {
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "SIGNED_OUT",
        hydratingUserId: null,
        nextUserId: null,
      }),
    ).toBe("clear");
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: null,
        event: "INITIAL_SESSION",
        hydratingUserId: null,
        nextUserId: null,
      }),
    ).toBe("clear");
    expect(
      resolveAuthSessionLifecycleAction({
        activeUserId: "user-1",
        event: "TOKEN_REFRESHED",
        hydratingUserId: null,
        nextUserId: null,
      }),
    ).toBe("ignore");
  });
});
