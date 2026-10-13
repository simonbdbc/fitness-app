import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.stubGlobal("__DEV__", false);

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    getAllKeys: vi.fn(async () => []),
    multiRemove: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    setItem: vi.fn(async () => undefined),
  },
}));

vi.mock("react-native-safe-area-context", async () => {
  const React = await import("react");

  const Passthrough = ({ children }: { children?: import("react").ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  return {
    SafeAreaProvider: Passthrough,
    SafeAreaView: Passthrough,
    useSafeAreaFrame: () => ({ height: 0, width: 0, x: 0, y: 0 }),
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  };
});

afterEach(() => {
  cleanup();
});
