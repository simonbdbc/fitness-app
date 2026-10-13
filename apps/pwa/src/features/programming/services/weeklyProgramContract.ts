import type {
  CandidateRecentStats,
  RecentWeeklyProgramStats,
} from "@features/training/history";

import type {
  ACREALevel,
  ACREAPillar,
  ACREAProfile,
  ACREASessionAlternative,
  ACREASessionPhase,
  ACREASessionPrescription,
  ACREATraining,
  ACREAWeekPlan,
} from "../data/acreaSeed";
import type { WeeklyProgramCandidate } from "./catalogProgrammingCandidates";

export type IsoWeek = { isoWeekYear: number; isoWeekNumber: number };

export type WeeklyProgramExerciseProgression = {
  exerciseId: number;
  prescription: ACREASessionPrescription;
};

export type WeeklyProgramExerciseHistory = {
  exerciseId: number;
  appreciationAverage: number | null;
  lastIsoWeekYear: number | null;
  lastIsoWeekNumber: number | null;
  reachedMaximum: boolean;
};

export type WeeklyProgramAiInputV3 = {
  schemaVersion: 3;
  profile: {
    id: string;
    objectiveCode: ACREAProfile["objectiveCode"];
    equipmentMode: ACREAProfile["equipmentMode"];
    weeklyFrequency: number;
    sessionMinutesMin: number;
    sessionMinutesMax: number;
    weeklyNoveltyPercent: number;
    levelTestCompleted: boolean;
    levelTestVersion: number;
    pillarLevels: ACREAProfile["pillarLevels"];
    availableEquipment: string[];
    preferredWeekdays: number[];
    restrictions: ACREAProfile["restrictions"];
    excludedExerciseCodes: string[];
  };
  candidates: WeeklyProgramCandidate[];
  recentStats: RecentWeeklyProgramStats;
  candidateRecentStats: CandidateRecentStats[];
  exerciseProgressions: WeeklyProgramExerciseProgression[];
  exerciseHistories: WeeklyProgramExerciseHistory[];
  isoWeekYear: number;
  isoWeekNumber: number;
  catalogVersion: string;
};

export function getIsoWeek(date: Date): IsoWeek {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return {
    isoWeekYear: utcDate.getUTCFullYear(),
    isoWeekNumber: Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7),
  };
}

export function buildWeeklyProgramAiInput({
  candidates,
  catalogVersion,
  profile,
  recentStats,
  candidateRecentStats,
  exerciseProgressions = [],
  exerciseHistories = [],
  week,
}: {
  candidates: WeeklyProgramCandidate[];
  catalogVersion: string;
  profile: ACREAProfile;
  recentStats: RecentWeeklyProgramStats;
  candidateRecentStats: CandidateRecentStats[];
  exerciseProgressions?: WeeklyProgramExerciseProgression[];
  exerciseHistories?: WeeklyProgramExerciseHistory[];
  week: IsoWeek;
}): WeeklyProgramAiInputV3 {
  integerRange(profile.weeklyFrequency, 1, 7, "weeklyFrequency");
  validateDurationRange(profile.sessionMinutesMin, profile.sessionMinutesMax);
  integerRange(profile.weeklyNoveltyPercent, 0, 100, "weeklyNoveltyPercent");
  if (profile.weeklyNoveltyPercent % 10 !== 0) throw new Error("weeklyNoveltyPercent doit utiliser un pas de 10.");
  integerRange(week.isoWeekNumber, 1, 53, "isoWeekNumber");
  integerRange(week.isoWeekYear, 1970, 9999, "isoWeekYear");
  Object.values(profile.pillarLevels).forEach((level) => integerRange(level, 1, 10, "pillarLevel"));
  if (!profile.id.trim() || !catalogVersion.trim() || candidates.length === 0) throw new Error("Le profil, le catalogue et les candidats sont requis.");
  if (profile.levelTestStatus !== "completed" || profile.levelTestVersion < 3) throw new Error("L’évaluation de niveau ACREA V3 doit être validée avant la génération.");
  if (profile.equipmentMode === "aucun" && profile.availableEquipment.length > 0) throw new Error("Le mode Aucun ne peut pas contenir d'équipement.");
  uniqueStrings(profile.availableEquipment, "availableEquipment");
  uniqueStrings(profile.excludedExerciseCodes, "excludedExerciseCodes");
  if (profile.preferredWeekdays.length !== profile.weeklyFrequency) throw new Error("Le nombre de jours préférés doit correspondre à la fréquence.");
  if (new Set(profile.preferredWeekdays).size !== profile.preferredWeekdays.length || profile.preferredWeekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) throw new Error("Les jours préférés doivent être uniques et compris entre 1 et 7.");
  assertRecentStats(recentStats, "recentStats");
  candidateRecentStats.forEach((entry) => {
    positiveInteger(entry.sessionTemplateId, "candidateRecentStats.sessionTemplateId");
    positiveInteger(entry.exerciseId, "candidateRecentStats.exerciseId");
    positiveInteger(entry.formatId, "candidateRecentStats.formatId");
    assertRecentStats(entry.stats, "candidateRecentStats.stats");
  });
  candidates.forEach(validateCandidate);
  uniqueNumbers(
    candidates.map((candidate) =>
      candidate.sessionTemplateId * 1_000_000_000 +
      candidate.exerciseId * 1_000_000 +
      candidate.formatId * 10 +
      candidate.level,
    ),
    "candidates",
  );
  exerciseProgressions.forEach((entry) => {
    positiveInteger(entry.exerciseId, "exerciseProgression.exerciseId");
    validatePrescription(entry.prescription);
  });
  exerciseHistories.forEach((entry) => {
    positiveInteger(entry.exerciseId, "exerciseHistory.exerciseId");
    if (entry.appreciationAverage !== null && (!Number.isFinite(entry.appreciationAverage) || entry.appreciationAverage < 1 || entry.appreciationAverage > 5)) throw new Error("Moyenne d'appréciation invalide.");
    if (entry.lastIsoWeekNumber !== null) integerRange(entry.lastIsoWeekNumber, 1, 53, "lastIsoWeekNumber");
    if (entry.lastIsoWeekYear !== null) integerRange(entry.lastIsoWeekYear, 1970, 9999, "lastIsoWeekYear");
    if ((entry.lastIsoWeekYear === null) !== (entry.lastIsoWeekNumber === null)) throw new Error("L'année et la semaine du dernier exercice doivent être fournies ensemble.");
  });
  uniqueNumbers(exerciseProgressions.map(({ exerciseId }) => exerciseId), "exerciseProgressions");
  uniqueNumbers(exerciseHistories.map(({ exerciseId }) => exerciseId), "exerciseHistories");

  return {
    schemaVersion: 3,
    profile: {
      id: profile.id,
      objectiveCode: profile.objectiveCode,
      equipmentMode: profile.equipmentMode,
      weeklyFrequency: profile.weeklyFrequency,
      sessionMinutesMin: profile.sessionMinutesMin,
      sessionMinutesMax: profile.sessionMinutesMax,
      weeklyNoveltyPercent: profile.weeklyNoveltyPercent,
      levelTestCompleted: true,
      levelTestVersion: profile.levelTestVersion,
      pillarLevels: profile.pillarLevels,
      availableEquipment: [...profile.availableEquipment],
      preferredWeekdays: [...profile.preferredWeekdays],
      restrictions: profile.restrictions.map((restriction) => ({ ...restriction })),
      excludedExerciseCodes: [...profile.excludedExerciseCodes],
    },
    candidates,
    recentStats,
    candidateRecentStats,
    exerciseProgressions,
    exerciseHistories,
    isoWeekYear: week.isoWeekYear,
    isoWeekNumber: week.isoWeekNumber,
    catalogVersion,
  };
}

export function parseWeeklyProgram(value: unknown): ACREAWeekPlan {
  const root = record(value, "weeklyProgram");
  exactKeys(root, ["schemaVersion", "isoWeekYear", "isoWeekNumber", "catalogVersion", "role", "validationFocus", "generatedBy", "trainings"]);
  if (root.schemaVersion !== 3) throw new Error("Seuls les programmes ACREA v3 actifs sont supportés.");
  const isoWeekYear = integerRange(root.isoWeekYear, 1970, 9999, "isoWeekYear");
  const isoWeekNumber = integerRange(root.isoWeekNumber, 1, 53, "isoWeekNumber");
  return {
    schemaVersion: 3,
    isoWeekYear,
    isoWeekNumber,
    catalogVersion: string(root.catalogVersion, "catalogVersion"),
    role: string(root.role, "role"),
    validationFocus: string(root.validationFocus, "validationFocus"),
    generatedBy: string(root.generatedBy, "generatedBy"),
    trainings: array(root.trainings, "trainings").map((training) => parseTraining(training, isoWeekYear, isoWeekNumber)),
  };
}

function parseTraining(value: unknown, year: number, week: number): ACREATraining {
  const row = record(value, "training");
  exactKeys(row, ["code", "day", "title", "dominantPillar", "durationMinutes", "status", "seances"]);
  const code = string(row.code, "training.code");
  if (!/^T[1-7]$/.test(code)) throw new Error("Code entraînement invalide.");
  const day = string(row.day, "training.day");
  const status = string(row.status, "training.status");
  if (!isTrainingStatus(status)) throw new Error("Statut entraînement invalide.");
  const seances = array(row.seances, "training.seances").map(parseSeance);
  const phases = seances.map((seance) => seance.phase);
  if (phases.length !== 5 || phases[0] !== "warmup" || phases[4] !== "cooldown" || phases.filter((phase) => phase === "main").length !== 3) throw new Error("Une séance ACREA doit contenir échauffement, trois piliers et assouplissements.");
  return {
    code: code as ACREATraining["code"],
    day,
    scheduledDate: isoDateForWeekday(year, week, weekdayFromLabel(day)),
    title: string(row.title, "training.title"),
    dominantPillar: pillar(row.dominantPillar),
    durationMinutes: integerRange(row.durationMinutes, 1, 180, "durationMinutes"),
    status,
    seances,
  };
}

function parseSeance(value: unknown) {
  const row = record(value, "seance");
  exactKeys(row, ["code", "phase", "pillar", "title", "sessions"]);
  const phase = sessionPhase(row.phase);
  const parsedPillar = row.pillar === null ? null : pillar(row.pillar);
  if ((phase === "main") !== (parsedPillar !== null)) throw new Error("Un pilier est requis uniquement pour une séance principale.");
  const sessions = array(row.sessions, "seance.sessions").map(parseSession);
  if (sessions.length === 0 || sessions.some((session) => session.phase !== phase)) throw new Error("Phase de séance incohérente.");
  return { code: string(row.code, "seance.code"), phase, pillar: parsedPillar, title: string(row.title, "seance.title"), sessions };
}

function parseSession(value: unknown) {
  const row = record(value, "session");
  exactKeys(row, ["code", "sessionTemplateId", "exerciseId", "exerciseCode", "exerciseName", "formatId", "formatLabel", "formatCode", "phase", "level", "prescription", "easier", "harder", "safetyRule"]);
  const prescription = parsePrescription(row.prescription);
  const phase = sessionPhase(row.phase);
  if ((phase === "main") !== prescription.adaptable || (phase === "main") === (prescription.kind === "fixed")) throw new Error("Prescription incohérente avec la phase de session.");
  return {
    code: string(row.code, "session.code"),
    sessionTemplateId: positiveInteger(row.sessionTemplateId, "sessionTemplateId"),
    exerciseId: positiveInteger(row.exerciseId, "exerciseId"),
    exerciseCode: string(row.exerciseCode, "exerciseCode"),
    exerciseName: string(row.exerciseName, "exerciseName"),
    formatId: positiveInteger(row.formatId, "formatId"),
    formatLabel: string(row.formatLabel, "formatLabel"),
    formatCode: string(row.formatCode, "formatCode"),
    phase,
    level: integerRange(row.level, 1, 10, "level") as ACREALevel,
    prescription,
    easier: parseAlternative(row.easier),
    harder: parseAlternative(row.harder),
    safetyRule: string(row.safetyRule, "safetyRule"),
  };
}

function parsePrescription(value: unknown): ACREASessionPrescription {
  const row = record(value, "prescription");
  exactKeys(row, ["kind", "series", "repetitions", "effortSeconds", "restSeconds", "estimatedDurationSeconds", "adaptable"]);
  const parsed: ACREASessionPrescription = {
    kind: prescriptionKind(row.kind),
    series: integerRange(row.series, 1, 12, "prescription.series"),
    repetitions: nullableInteger(row.repetitions, 4, 12, "prescription.repetitions"),
    effortSeconds: nullableInteger(row.effortSeconds, 1, 300, "prescription.effortSeconds"),
    restSeconds: integerRange(row.restSeconds, 0, 300, "prescription.restSeconds"),
    estimatedDurationSeconds: integerRange(row.estimatedDurationSeconds, 1, 65_535, "prescription.estimatedDurationSeconds"),
    adaptable: boolean(row.adaptable, "prescription.adaptable"),
  };
  validatePrescription(parsed);
  return parsed;
}

function validateCandidate(candidate: WeeklyProgramCandidate) {
  positiveInteger(candidate.sessionTemplateId, "candidate.sessionTemplateId");
  positiveInteger(candidate.exerciseId, "candidate.exerciseId");
  positiveInteger(candidate.formatId, "candidate.formatId");
  integerRange(candidate.level, 1, 10, "candidate.level");
  integerRange(candidate.durationSeconds, 1, 65_535, "candidate.durationSeconds");
  if (typeof candidate.completeExerciseSheet !== "boolean") {
    throw new Error("Indicateur de complétude candidat invalide.");
  }
  sessionPhase(candidate.phase);
  prescriptionKind(candidate.prescriptionKind);
  if ((candidate.phase === "main") === (candidate.prescriptionKind === "fixed")) throw new Error("La phase et le type de prescription candidat sont incohérents.");
  uniqueStrings(candidate.muscleGroupCodes, "candidate.muscleGroupCodes");
  if (candidate.muscleGroupCodes.length === 0 || candidate.muscleGroupCodes.some((code) => !["bras", "epaules", "dos", "jambes", "fessiers", "abdos", "pecs"].includes(code))) throw new Error("Groupe musculaire candidat invalide.");
  if (candidate.equipmentOptions.length === 0) throw new Error("Option matériel candidat requise.");
  let bodyweight = 0;
  candidate.equipmentOptions.forEach((option) => {
    if (option.kind === "bodyweight") {
      bodyweight += 1;
      if (option.equipmentCodes.length !== 0) throw new Error("Une option bodyweight doit être vide.");
    } else {
      if (option.equipmentCodes.length === 0) throw new Error("Une option matériel ne peut pas être vide.");
      uniqueStrings(option.equipmentCodes, "candidate.equipmentOptions");
    }
  });
  if (bodyweight > 1) throw new Error("Option bodyweight dupliquée.");
}

function validateDurationRange(min: number, max: number) {
  integerRange(min, 20, 175, "sessionMinutesMin");
  integerRange(max, 25, 180, "sessionMinutesMax");
  if (min % 5 !== 0 || max % 5 !== 0 || max < min + 5) throw new Error("La durée doit utiliser un pas de 5 minutes et une fourchette d'au moins 5 minutes.");
}

function validatePrescription(value: ACREASessionPrescription) {
  const canonicalRepetitions =
    value.repetitions === null ||
    (value.repetitions >= 4 && value.repetitions <= 12);
  if (value.kind === "repetitions" && (!value.adaptable || value.repetitions === null || !canonicalRepetitions || value.effortSeconds !== null || value.series < 2 || value.series > 12)) throw new Error("Prescription de répétitions invalide.");
  if (value.kind === "intervals" && (!value.adaptable || value.repetitions !== null || value.effortSeconds === null || value.effortSeconds < 10 || value.effortSeconds > 300 || value.restSeconds < 10 || value.restSeconds > 300 || value.series < 1 || value.series > 8)) throw new Error("Prescription d'intervalles invalide.");
  if (value.kind === "fixed" && (value.adaptable || value.series !== 1 || value.repetitions !== null || value.effortSeconds === null || value.restSeconds !== 0)) throw new Error("Prescription fixe invalide.");
}

function parseAlternative(value: unknown): ACREASessionAlternative {
  const row = record(value, "alternative");
  exactKeys(row, ["name", "level", "note"]);
  return { name: string(row.name, "alternative.name"), level: integerRange(row.level, 1, 10, "alternative.level") as ACREALevel, note: string(row.note, "alternative.note") };
}

function weekdayFromLabel(label: string) {
  const index = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].indexOf(label);
  if (index < 0) throw new Error(`Jour d'entraînement invalide: ${label}`);
  return index + 1;
}

function isoDateForWeekday(year: number, week: number, weekday: number) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (week - 1) * 7 + weekday - 1);
  return monday.toISOString().slice(0, 10);
}

function sessionPhase(value: unknown): ACREASessionPhase {
  if (value === "warmup" || value === "main" || value === "cooldown") return value;
  throw new Error("Phase ACREA invalide.");
}

function prescriptionKind(value: unknown): ACREASessionPrescription["kind"] {
  if (value === "repetitions" || value === "intervals" || value === "fixed") return value;
  throw new Error("Type de prescription invalide.");
}

function pillar(value: unknown): ACREAPillar {
  if (value === "strength" || value === "cardio" || value === "proprioception") return value;
  throw new Error("Pilier ACREA invalide.");
}

function isTrainingStatus(value: string): value is ACREATraining["status"] {
  return value === "a faire" || value === "terminee" || value === "reportee";
}

function assertRecentStats(stats: RecentWeeklyProgramStats, field: string) {
  (["successRate", "fatigue", "painRate"] as const).forEach((name) => {
    const value = stats[name];
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${field}.${name} doit être compris entre 0 et 1.`);
  });
  integerRange(stats.skippedSessions, 0, 255, `${field}.skippedSessions`);
}

function uniqueStrings(values: string[], field: string) {
  if (values.some((value) => !value.trim()) || new Set(values).size !== values.length) throw new Error(`${field} doit contenir des codes uniques non vides.`);
}

function uniqueNumbers(values: number[], field: string) {
  if (values.some((value) => !Number.isSafeInteger(value)) || new Set(values).size !== values.length) throw new Error(`${field} doit contenir des identifiants uniques.`);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const allowed = new Set(expected);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  const missing = expected.find((key) => !(key in value));
  if (unknown || missing) throw new Error(`Contrat JSON invalide (${unknown ? `champ inconnu ${unknown}` : `champ manquant ${missing}`}).`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} doit être un objet.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} doit être un tableau.`);
  return value;
}

function string(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} doit être une chaîne non vide.`);
  return value;
}

function boolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field} doit être booléen.`);
  return value;
}

function integerRange(value: unknown, min: number, max: number, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`${field} doit être compris entre ${min} et ${max}.`);
  return value;
}

function positiveInteger(value: unknown, field: string) {
  return integerRange(value, 1, Number.MAX_SAFE_INTEGER, field);
}

function nullableInteger(value: unknown, min: number, max: number, field: string) {
  return value === null ? null : integerRange(value, min, max, field);
}
