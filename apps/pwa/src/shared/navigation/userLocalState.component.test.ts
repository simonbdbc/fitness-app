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
      "acrea-fitness.timer-screen.v1:user-a",
      "acrea-fitness.session-timer.v2:timer%3Auser-a%3Astandalone",
      "acrea-fitness.session-timer.v2:timer%3Auser-b%3Astandalone",
      "acrea-fitness.guided-training.v1:user-a",
      "acrea-fitness.guided-training.v1:user-b",
      "catalog-library-filter-preferences:v1:user-a",
      "catalog-library-filter-preferences:v1:user-b",
      "unrelated-key",
    ]);

    await clearUserLocalState("user-a");

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "acrea-fitness.timer-screen.v1:user-a",
      "acrea-fitness.session-timer.v2:timer%3Auser-a%3Astandalone",
      "acrea-fitness.guided-training.v1:user-a",
      "catalog-library-filter-preferences:v1:user-a",
    ]);
  });
});
