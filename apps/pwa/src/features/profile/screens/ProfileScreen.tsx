import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  getWeeklyProgramRegenerationState,
  isACREAProfileComplete,
  listACREAEquipmentOptions,
  regenerateWeeklyProgram,
  useACREAProfile,
  type ACREAEquipmentOption,
  type WeeklyProgramRegenerationState,
} from "@features/programming";
import { reportTechnicalDegradation } from "@shared/observability/technicalDiagnostics";
import {
  displaySessionStorageKey,
  usePersistentScreenState,
} from "@shared/persistence";
import { BodyText, TitleText } from "@shared/ui";

import {
  ProfileLimitsOverview,
  ProfileSummaryCard,
} from "../components/ProfileOverview";
import { ProfileSettingsCard } from "../components/ProfileSettingsCard";
import { errorMessage, formatDate } from "../domain/profilePreferences";
import { confirmRegeneration } from "../services/programRegenerationConfirmation";

export function ProfileScreen() {
  const {
    notifyWeeklyProgramChanged,
    profile,
    saveProfile,
    syncError,
    weeklyProgramRevision,
  } = useACREAProfile();
  const baselineRef = useRef(profile);
  const {
    clear: clearDraft,
    isRestoring: isRestoringDraft,
    setValue: setDraft,
    value: draft,
  } = usePersistentScreenState({
    initialValue: profile,
    parse: (value) => parseProfileDraft(value, profile.id),
    storageKey: displaySessionStorageKey(profile.id, "route:profile:draft"),
  });
  const [equipmentOptions, setEquipmentOptions] = useState<
    ACREAEquipmentOption[]
  >([]);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [regenerationState, setRegenerationState] =
    useState<WeeklyProgramRegenerationState | null>(null);
  const [regenerationStatus, setRegenerationStatus] = useState<
    "idle" | "loading" | "regenerating" | "success" | "error"
  >("loading");
  const [regenerationMessage, setRegenerationMessage] = useState("");
  const hasUnsavedChanges =
    !isRestoringDraft && !areProfilesEqual(draft, baselineRef.current);
  const isProfileComplete = isACREAProfileComplete(profile);

  useEffect(() => {
    if (isRestoringDraft) return;
    if (hasUnsavedChanges) return;
    baselineRef.current = profile;
    setDraft(profile);
  }, [hasUnsavedChanges, isRestoringDraft, profile, setDraft]);
  useEffect(() => {
    let active = true;
    void listACREAEquipmentOptions().then((options) => {
      if (active) setEquipmentOptions(options);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!isACREAProfileComplete(profile)) {
      setRegenerationState(null);
      setRegenerationStatus("idle");
      return;
    }
    let active = true;
    setRegenerationStatus("loading");
    void getWeeklyProgramRegenerationState(profile, new Date())
      .then((state) => {
        if (!active) return;
        setRegenerationState(state);
        setRegenerationStatus("idle");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRegenerationStatus("error");
        setRegenerationMessage(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [profile, weeklyProgramRevision]);

  const save = async () => {
    setSaveState("saving");
    try {
      await saveProfile(draft);
      baselineRef.current = draft;
      await clearDraft();
      setSaveState("saved");
    } catch (error) {
      reportTechnicalDegradation("profile-save", error);
      setSaveState("error");
    }
  };

  const cancelDraft = () => {
    baselineRef.current = profile;
    setDraft(profile);
    void clearDraft();
    setSaveState("idle");
  };

  const regenerate = async () => {
    if (!isACREAProfileComplete(profile)) {
      setRegenerationStatus("error");
      setRegenerationMessage(
        "Complète les réglages du profil et l’évaluation avant de générer le programme.",
      );
      return;
    }
    setRegenerationStatus("loading");
    setRegenerationMessage("");
    try {
      const state = await getWeeklyProgramRegenerationState(
        profile,
        new Date(),
      );
      setRegenerationState(state);
      if (!state.canRegenerate || !state.effectiveDate) {
        setRegenerationStatus("idle");
        return;
      }
      if (
        (state.hasProgress || state.replaceableTrainingCount > 0) &&
        !(await confirmRegeneration(state))
      ) {
        setRegenerationStatus("idle");
        return;
      }
      setRegenerationStatus("regenerating");
      const plan = await regenerateWeeklyProgram(profile, new Date());
      notifyWeeklyProgramChanged();
      setRegenerationStatus("success");
      setRegenerationMessage(
        `Programme mis à jour à partir du ${formatDate(state.effectiveDate)}. ${plan.trainings.length} séance(s) conservée(s) ou planifiée(s).`,
      );
    } catch (error) {
      setRegenerationStatus("error");
      setRegenerationMessage(errorMessage(error));
    }
  };

  return (
    <View className="w-full max-w-full min-w-0 gap-4">
      <View className="gap-2">
        <TitleText>Profil</TitleText>
        <BodyText>
          Niveaux actuels par pilier, fréquence, équipement et limites ACREA.
        </BodyText>
      </View>

      <ProfileSummaryCard profile={profile} />

      <ProfileSettingsCard
        draft={draft}
        equipmentOptions={equipmentOptions}
        hasUnsavedChanges={hasUnsavedChanges}
        isProfileComplete={isProfileComplete}
        onChange={setDraft}
        onCancel={cancelDraft}
        onRegenerate={() => void regenerate()}
        onSave={() => void save()}
        regenerationMessage={regenerationMessage}
        regenerationState={regenerationState}
        regenerationStatus={regenerationStatus}
        saveState={saveState}
        syncError={syncError}
      />

      <ProfileLimitsOverview profile={profile} />
    </View>
  );
}

function parseProfileDraft(value: unknown, profileId: string) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ReturnType<typeof useACREAProfile>["profile"]>;
  if (
    candidate.id !== profileId ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.availableEquipment) ||
    !Array.isArray(candidate.preferredWeekdays) ||
    !Array.isArray(candidate.restrictions) ||
    !Array.isArray(candidate.excludedExerciseCodes) ||
    !candidate.pillarLevels ||
    typeof candidate.pillarLevels !== "object"
  ) {
    return null;
  }
  return candidate as ReturnType<typeof useACREAProfile>["profile"];
}

function areProfilesEqual(
  left: ReturnType<typeof useACREAProfile>["profile"],
  right: ReturnType<typeof useACREAProfile>["profile"],
) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}
