import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearUserLocalState } from "./userLocalState";

describe("user local state", () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([]);
    vi.mocked(AsyncStorage.multiRemove).mockResolvedValue(undefined);
  });

  it("clears only the signed-out user's functional values", async () => {
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
      "acrea-fitness-public-demo.timer-screen.v1:user-a",
      "acrea-fitness-public-demo.session-timer.v2:timer%3Auser-a%3Astandalone",
      "acrea-fitness-public-demo.session-timer.v2:timer%3Auser-b%3Astandalone",
      "acrea-fitness-public-demo.guided-training.v1:user-a",
      "acrea-fitness-public-demo.guided-training.v1:user-b",
      "fitness-public-demo-library-filter:v1:user-a",
      "fitness-public-demo-library-filter:v1:user-b",
      "unrelated-key",
    ]);

    await clearUserLocalState("user-a");

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "acrea-fitness-public-demo.timer-screen.v1:user-a",
      "acrea-fitness-public-demo.session-timer.v2:timer%3Auser-a%3Astandalone",
      "acrea-fitness-public-demo.guided-training.v1:user-a",
      "fitness-public-demo-library-filter:v1:user-a",
    ]);
  });
});
