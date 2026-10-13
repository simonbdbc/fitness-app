import type { ACREAWeekPlan } from "../data/acreaSeed";
import type { WeeklyProgramAiInputV3 } from "./weeklyProgramContract";
import { parseWeeklyProgram } from "./weeklyProgramContract";
import { apiBaseUrl, isApiConfigured } from "@shared/config/clientConfig";

export async function generateWithWeeklyAiRuntime(
  input: WeeklyProgramAiInputV3,
): Promise<ACREAWeekPlan> {
  if (!isApiConfigured) {
    throw new Error("Moteur ACREA distant non configure.");
  }

  const response = await fetch(`${apiBaseUrl}/api/ai/weekly-program`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Moteur ACREA indisponible (${response.status}).`);
  }
  return parseWeeklyProgram(await response.json());
}
