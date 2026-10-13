import type { ACREAWeekPlan } from "../data/acreaSeed";
import { reportTechnicalDegradationOnce } from "@shared/observability/technicalDiagnostics";
import {
  parseWeeklyProgram,
  type WeeklyProgramAiInputV3,
} from "./weeklyProgramContract";

let initialization: Promise<unknown> | null = null;
let runtimePromise: ReturnType<typeof loadRuntime> | null = null;

export async function generateWithWeeklyAiRuntime(
  input: WeeklyProgramAiInputV3,
): Promise<ACREAWeekPlan> {
  runtimePromise ??= loadRuntime();
  const runtime = await runtimePromise;
  initialization ??= runtime.default();
  await initialization;

  const json = JSON.stringify(input);
  try {
    return parseWeeklyProgram(
      JSON.parse(runtime.generate_weekly_program_json(json)),
    );
  } catch (burnError) {
    try {
      const fallbackPlan = parseWeeklyProgram(
        JSON.parse(runtime.generate_weekly_program_rules_json(json)),
      );
      reportTechnicalDegradationOnce("weekly-ai-wasm-rules-fallback", burnError);
      return fallbackPlan;
    } catch {
      throw burnError;
    }
  }
}

function loadRuntime() {
  return import("../../../generated/weekly-ai-wasm/weekly_ai_wasm");
}
