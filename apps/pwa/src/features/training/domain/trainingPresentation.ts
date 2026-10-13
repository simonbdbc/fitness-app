import { getCatalogFormatTypeBusinessLabel } from "@features/catalog";
import {
  acreaPillarLabels,
  type ACREASeance,
  type ACREASession,
  type ACREATraining,
} from "@features/programming";
import type {
  GuidedExerciseStepData,
  SessionTimerPlan,
  TimerFormatInput,
} from "@features/workouts";
import type {
  SessionPainLevel,
  SessionProgressionPreference,
} from "../contracts/trainingHistory";

export type TrainingStatus = ACREATraining["status"];

export type SessionFeedbackDraft = {
  effortRating: number;
  qualityRating: number;
  appreciationRating: number | null;
  painLevel: SessionPainLevel;
  progressionPreference: SessionProgressionPreference;
};

export function formatScheduledDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T12:00:00`));
}

export function buildTrainingGuidedStep(
  training: ACREATraining,
  seance: ACREASeance,
  session: ACREASession,
  timerPlan: SessionTimerPlan | null,
): GuidedExerciseStepData {
  const formatLabel = timerPlan
    ? timerPlan.mode === "series"
      ? getCatalogFormatTypeBusinessLabel("repetitions")
      : getCatalogFormatTypeBusinessLabel("intervalles")
    : "Format";
  const isGlobalProposal = seance.phase !== "main";

  return {
    id: `${training.code}-${seance.code}-${session.code}`,
    eyebrow: training.title,
    title: isGlobalProposal
      ? seance.phase === "warmup"
        ? "Proposition d’échauffement"
        : "Proposition d’assouplissements"
      : seance.title,
    subtitle: `${training.day} - ${training.durationMinutes} min`,
    badgeLabel:
      seance.pillar === null
        ? seance.phase === "warmup"
          ? "Échauffement"
          : "Assouplissements"
        : acreaPillarLabels[seance.pillar],
    timerLabel: session.formatLabel,
    timerSeconds: timerPlan?.totalSeconds,
    sections: [
      {
        title: isGlobalProposal ? "Proposition libre" : "Session",
        items: [formatWorkoutSession(session)],
      },
      {
        title: "Format",
        items: [`${formatLabel} - ${session.formatLabel}`],
      },
      {
        title: "Sécurité",
        items: [session.safetyRule],
        tone: "warning",
      },
    ],
  };
}

export function resolveTimerPlanError(
  format: TimerFormatInput | null,
  timerPlan: SessionTimerPlan | null,
) {
  if (timerPlan) {
    return null;
  }

  if (!format) {
    return "Cette session n'a pas de format catalogue assigné.";
  }

  const formatTypeLabel = getCatalogFormatTypeBusinessLabel(format.formatType);

  return `Le format ${formatTypeLabel} "${format.label}" est incomplet dans le catalogue.`;
}

export function formatWorkoutSession(session: ACREASession) {
  return `N${session.level} ${session.exerciseName} | facile N${session.easier.level}: ${session.easier.name} | difficile N${session.harder.level}: ${session.harder.name}`;
}

export function createDefaultFeedbackDraft(): SessionFeedbackDraft {
  return {
    effortRating: 1,
    qualityRating: 5,
    appreciationRating: null,
    painLevel: "none",
    progressionPreference: "harder",
  };
}

export function formatProgressionContext(session: ACREASession) {
  const prescription = session.prescription;
  if (prescription.kind === "repetitions") {
    return `${session.exerciseName} - ${prescription.series} x ${prescription.repetitions}`;
  }
  if (prescription.kind === "intervals") {
    return `${session.exerciseName} - ${prescription.series} x ${prescription.effortSeconds}s / ${prescription.restSeconds}s`;
  }
  return `${session.exerciseName} - bloc fixe`;
}

export function timerFormatFromPrescription(session: ACREASession): TimerFormatInput {
  const prescription = session.prescription;
  if (prescription.kind === "repetitions") {
    return {
      code: `prescription-${session.code}`,
      label: session.formatLabel,
      formatType: "repetitions",
      seriesCount: prescription.series,
      repetitions: prescription.repetitions,
      restSeconds: prescription.restSeconds,
    };
  }
  return {
    code: `prescription-${session.code}`,
    label: session.formatLabel,
    formatType: "intervalles",
    seriesCount: prescription.series,
    intervalSeconds: prescription.effortSeconds ?? prescription.estimatedDurationSeconds,
    restSeconds: prescription.restSeconds,
  };
}

export function sessionFeedbackKey(
  trainingCode: ACREATraining["code"],
  seanceCode: ACREASeance["code"],
  sessionCode: ACREASession["code"],
) {
  return `${trainingCode}-${seanceCode}-${sessionCode}`;
}

export function errorMessageFromUnknown(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Enregistrement de la session impossible.";
}

export function statusLabel(status: TrainingStatus) {
  if (status === "terminee") {
    return "Terminée";
  }

  if (status === "reportee") {
    return "Reportée";
  }

  return "À faire";
}

export function statusVariant(status: TrainingStatus) {
  if (status === "terminee") {
    return "success";
  }

  if (status === "reportee") {
    return "warning";
  }

  return "muted";
}

export function pillarVariant(pillar: string) {
  if (pillar === "strength") {
    return "success";
  }

  if (pillar === "cardio") {
    return "warning";
  }

  return "info";
}
