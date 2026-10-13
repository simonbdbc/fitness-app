import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  acreaLevelEvaluationProtocolVersion,
  isACREAProfileComplete,
  regenerateWeeklyProgram,
  useACREAProfile,
  type ACREAPillarLevels,
} from "@features/programming";
import {
  ActionButton,
  Badge,
  BodyText,
  Card,
  CardHeader,
  TitleText,
} from "@shared/ui";

import { GuidedLevelEvaluationSession } from "../components/GuidedLevelEvaluationSession";
import {
  completePillarLevels,
  LevelTiles,
} from "../components/LevelTiles";
import {
  finalizeLevelTest,
  loadLevelTestState,
  nextRequiredEvaluationPhase,
  startLevelEvaluationSession,
  startLevelTest,
  syncPendingLevelEvaluationAttempts,
  syncLevelTestAttempt,
  type LevelEvaluationPhase,
  type PersistedLevelTestState,
} from "../services/levelTestRepository";

export function LevelTestScreen() {
  const {
    applyCompletedLevelTest,
    notifyWeeklyProgramChanged,
    profile,
  } = useACREAProfile();
  const [attempt, setAttempt] = useState<PersistedLevelTestState | null>(null);
  const [isGuidedOpen, setIsGuidedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [completedLevels, setCompletedLevels] =
    useState<ACREAPillarLevels | null>(null);
  const [regenerationError, setRegenerationError] = useState("");
  const currentLevels = completePillarLevels(profile.pillarLevels);
  const activeSession = useMemo(
    () => attempt?.sessions.find((session) => session.status === "in_progress"),
    [attempt],
  );
  const requiredPhase = attempt
    ? nextRequiredEvaluationPhase(attempt.sessions)
    : null;

  useEffect(() => {
    let mounted = true;
    void loadLevelTestState(profile.id)
      .then((state) => {
        if (!mounted) return;
        setAttempt(state);
        setIsGuidedOpen(
          Boolean(
            state?.sessions.some((session) => session.status === "in_progress"),
          ),
        );
        void syncPendingLevelEvaluationAttempts(profile.id).catch((error) => {
          if (mounted) setMessage(syncErrorText(error));
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [profile.id]);

  async function begin() {
    setSaving(true);
    setMessage("");
    try {
      const started = await startLevelTest(
        profile.id,
        profile.levelTestStatus === "completed" &&
          profile.levelTestVersion >= acreaLevelEvaluationProtocolVersion
          ? "retest"
          : "initial",
      );
      setAttempt(started);
      try {
        await syncLevelTestAttempt(profile.id, started.attemptId);
      } catch (error) {
        setMessage(syncErrorText(error));
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function launchSession(phase: LevelEvaluationPhase) {
    if (!attempt) return;
    setSaving(true);
    setMessage("");
    try {
      await startLevelEvaluationSession(attempt.attemptId, phase);
      const refreshed = await loadLevelTestState(profile.id);
      if (!refreshed) throw new Error("Évaluation en cours introuvable.");
      setAttempt(refreshed);
      setIsGuidedOpen(true);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleSessionComplete(passed: boolean) {
    if (!attempt) return;
    setSaving(true);
    setIsGuidedOpen(false);
    setMessage("");
    try {
      let refreshed = await loadLevelTestState(profile.id);
      if (!refreshed) throw new Error("Évaluation en cours introuvable.");
      setAttempt(refreshed);

      if (!passed) {
        setMessage(
          "La séance est enregistrée mais non validée. Les six exercices doivent être rejoués.",
        );
        try {
          await syncLevelTestAttempt(profile.id, refreshed.attemptId);
        } catch (error) {
          setMessage((current) => `${current} ${syncErrorText(error)}`);
        }
        return;
      }

      const nextPhase = nextRequiredEvaluationPhase(refreshed.sessions);
      if (nextPhase !== null) {
        setMessage(`Séance validée. La séance ${nextPhase} est disponible.`);
        try {
          await syncLevelTestAttempt(profile.id, refreshed.attemptId);
        } catch (error) {
          setMessage((current) => `${current} ${syncErrorText(error)}`);
        }
        return;
      }

      const result = await finalizeLevelTest(profile.id, refreshed.attemptId);
      refreshed = (await loadLevelTestState(profile.id)) ?? refreshed;
      let syncWarning = "";
      try {
        await syncLevelTestAttempt(profile.id, refreshed.attemptId);
      } catch (error) {
        syncWarning = syncErrorText(error);
      }
      let regenerationWarning = "";
      if (!result.profileUpdated) {
        regenerationWarning =
          " Cette ancienne évaluation est archivée sans remplacer un résultat plus récent.";
      } else {
        await applyCompletedLevelTest(
          result.pillarLevels,
          result.completedAt,
          result.protocolVersion,
        );
        const completedProfile = {
          ...profile,
          pillarLevels: result.pillarLevels,
          levelTestStatus: "completed" as const,
          levelTestVersion: result.protocolVersion,
          levelTestCompletedAt: result.completedAt,
        };
        if (isACREAProfileComplete(completedProfile)) {
        try {
          await regenerateWeeklyProgram(completedProfile, new Date());
          notifyWeeklyProgramChanged();
          setRegenerationError("");
        } catch (error) {
          regenerationWarning = ` Programme non régénéré: ${errorText(error)}`;
          setRegenerationError(errorText(error));
        }
        } else {
          regenerationWarning =
            " Complète ton profil pour générer le programme hebdomadaire.";
        }
      }
      setMessage(`${syncWarning}${regenerationWarning}`.trim());
      setCompletedLevels(result.profileUpdated ? result.pillarLevels : null);
      setAttempt(null);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card variant="info">
        <ActivityIndicator accessibilityLabel="Chargement de l’évaluation ACREA" />
        <BodyText>Chargement de l’avancement...</BodyText>
      </Card>
    );
  }

  if (completedLevels) {
    const retryRegeneration = async () => {
      if (!isACREAProfileComplete(profile)) {
        setRegenerationError(
          "Complète ton profil avant de générer le programme.",
        );
        return;
      }
      setSaving(true);
      try {
        await regenerateWeeklyProgram(profile, new Date());
        notifyWeeklyProgramChanged();
        setRegenerationError("");
        setMessage("Programme hebdomadaire régénéré.");
      } catch (error) {
        setRegenerationError(errorText(error));
      } finally {
        setSaving(false);
      }
    };
    return (
      <View className="gap-4">
        <Badge variant="success">Évaluation validée</Badge>
        <TitleText>Niveaux ACREA mis à jour</TitleText>
        <LevelTiles levels={completedLevels} />
        <BodyText>
          Le programme hebdomadaire peut maintenant utiliser ces niveaux.
        </BodyText>
        {message ? <BodyText>{message}</BodyText> : null}
        {regenerationError ? (
          <ActionButton
            disabled={saving}
            onPress={() => void retryRegeneration()}
            variant="primary"
          >
            Relancer la génération
          </ActionButton>
        ) : null}
      </View>
    );
  }

  if (attempt && activeSession && isGuidedOpen) {
    return (
      <GuidedLevelEvaluationSession
        attemptId={attempt.attemptId}
        key={activeSession.id}
        onComplete={(passed) => void handleSessionComplete(passed)}
        onExit={() => setIsGuidedOpen(false)}
        profileId={profile.id}
        session={activeSession}
      />
    );
  }

  if (!attempt) {
    const isRetest =
      profile.levelTestStatus === "completed" &&
      profile.levelTestVersion >= acreaLevelEvaluationProtocolVersion;
    return (
      <View className="gap-4">
        <View className="gap-2">
          <Badge variant={isRetest ? "success" : "warning"}>
            {isRetest ? "Niveaux actifs" : "Obligatoire"}
          </Badge>
          <TitleText>Évaluation de niveau ACREA</TitleText>
          <BodyText>
            Trois séances successives évaluent les six exercices représentatifs
            des piliers ACREA.
          </BodyText>
        </View>
        <Card variant="info">
          <CardHeader title="Calcul des niveaux" />
          <BodyText>
            Les séances 1 et 2 utilisent la prescription propre à chaque
            exercice. La séance 3 mesure un maximum strict.
          </BodyText>
          <BodyText>
            Les seuils sont propres à chaque mouvement. Le niveau du pilier
            reste le plus faible de ses deux exercices.
          </BodyText>
        </Card>
        {isRetest && currentLevels ? (
          <LevelTiles levels={currentLevels} />
        ) : null}
        {message ? <BodyText>{message}</BodyText> : null}
        <ActionButton disabled={saving} onPress={() => void begin()} variant="primary">
          {saving
            ? "Préparation..."
            : isRetest
              ? "Commencer une nouvelle évaluation"
              : "Commencer l’évaluation"}
        </ActionButton>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Badge variant="info">Évaluation en cours</Badge>
        <TitleText>Parcours en trois séances</TitleText>
        <BodyText>
          Chaque séance doit être entièrement validée avant la suivante.
        </BodyText>
      </View>

      {[1, 2, 3].map((phaseValue) => {
        const phase = phaseValue as LevelEvaluationPhase;
        const phaseSessions = attempt.sessions.filter(
          (session) => session.phase === phase,
        );
        const passed = phaseSessions.some((session) => session.status === "passed");
        const failedCount = phaseSessions.filter(
          (session) => session.status === "failed",
        ).length;
        const inProgress = phaseSessions.find(
          (session) => session.status === "in_progress",
        );
        return (
          <Card key={phase} variant={passed ? "info" : "default"}>
            <CardHeader
              action={
                <Badge variant={passed ? "success" : inProgress ? "info" : failedCount ? "warning" : "muted"}>
                  {passed ? "Validée" : inProgress ? "En cours" : failedCount ? "À rejouer" : "À faire"}
                </Badge>
              }
              description={phaseDescription(phase)}
              title={`Séance ${phase}`}
            />
            {failedCount ? (
              <BodyText>{failedCount} tentative(s) conservée(s).</BodyText>
            ) : null}
            {inProgress ? (
              <ActionButton onPress={() => setIsGuidedOpen(true)} variant="primary">
                Reprendre la séance
              </ActionButton>
            ) : requiredPhase === phase ? (
              <ActionButton
                disabled={saving}
                onPress={() => void launchSession(phase)}
                variant="primary"
              >
                {failedCount ? "Rejouer la séance" : "Démarrer la séance"}
              </ActionButton>
            ) : null}
          </Card>
        );
      })}

      {message ? <BodyText>{message}</BodyText> : null}
    </View>
  );
}

function phaseDescription(phase: LevelEvaluationPhase) {
  if (phase === 1) return "Six prescriptions initiales propres aux exercices.";
  if (phase === 2) return "Six prescriptions avancées propres aux exercices.";
  return "Une série maximale stricte sur chacun des six exercices.";
}

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Évaluation ACREA indisponible.";
}

function syncErrorText(error: unknown) {
  return `L’évaluation est conservée localement, mais la synchronisation distante a échoué. ${errorText(error)}`;
}
