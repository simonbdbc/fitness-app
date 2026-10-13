import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppLifecycle } from "./useAppLifecycle";

const { trackPwaEventMock } = vi.hoisted(() => ({
  trackPwaEventMock: vi.fn(),
}));

vi.mock("../services/pwaAnalytics", () => ({
  trackPwaEvent: trackPwaEventMock,
}));

describe("useAppLifecycle", () => {
  beforeEach(() => {
    trackPwaEventMock.mockReset();
    setVisibilityState("visible");
  });

  it("distinguishes app start, background and foreground", () => {
    render(<LifecycleProbe />);

    expect(trackPwaEventMock).toHaveBeenCalledWith("pwa_app_start");

    act(() => {
      setVisibilityState("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(trackPwaEventMock).toHaveBeenCalledWith("pwa_app_background", {
      previousVisibility: "visible",
    });

    act(() => {
      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(trackPwaEventMock).toHaveBeenCalledWith("pwa_app_foreground");
  });

  it("does not interpret focus or blur as lifecycle transitions", () => {
    render(<LifecycleProbe />);
    trackPwaEventMock.mockClear();

    act(() => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(trackPwaEventMock).not.toHaveBeenCalled();
  });
});

function LifecycleProbe() {
  useAppLifecycle();
  return null;
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
}
