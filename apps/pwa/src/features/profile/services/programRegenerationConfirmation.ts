import { Alert, Platform } from "react-native";
import type { WeeklyProgramRegenerationState } from "@features/programming";

import { formatDate } from "../domain/profilePreferences";

export function confirmRegeneration(state: WeeklyProgramRegenerationState) {
  const message = `Le nouveau programme commencera le ${formatDate(
    state.effectiveDate ?? "",
  )}. ${state.replaceableTrainingCount} séance(s) future(s) seront remplacée(s). Les séances réalisées restent conservées.`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert("Régénérer le programme", message, [
      { text: "Annuler", style: "cancel", onPress: () => resolve(false) },
      { text: "Régénérer", onPress: () => resolve(true) },
    ]);
  });
}
