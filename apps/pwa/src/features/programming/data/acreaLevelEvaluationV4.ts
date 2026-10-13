import manifestArtifact from "../../../../../../contracts/catalog/acrea-level-evaluation-v4.json";

import type { ACREAPillar } from "./acreaSeed";
import {
  acreaEntryTestExercises,
  type ACREAEntryTestExerciseCode,
} from "./acreaEntryLevelTest";

export type ACREAEvaluationMappingConfidence = "high" | "medium";
export type ACREALevelEvaluationProtocolVersion = 3 | 4;

export type ACREAEvaluationExerciseMapping = {
  evaluationExerciseCode: string;
  exerciseSlug: string;
  pillar: ACREAPillar;
  protocolVariant: string;
  mappingConfidence: ACREAEvaluationMappingConfidence;
  countUnit: "reps";
  phase1: { series: number; repetitions: number };
  phase2: { series: number; repetitions: number };
  phase3: { series: 1; repetitions: null };
  levelThresholds: { level2Minimum: number; level3Minimum: number };
};

export type ACREALevelEvaluationV4Manifest = {
  schemaVersion: 2;
  protocolVersion: 4;
  catalogReleaseCode: "exercise-library-v2";
  exercises: readonly ACREAEvaluationExerciseMapping[];
};

const manifest = manifestArtifact as ACREALevelEvaluationV4Manifest;
assertValidManifest(manifest);

export const acreaLevelEvaluationV4Manifest = manifest;
export const acreaLevelEvaluationV4Mappings = manifest.exercises;

export function exerciseSlugForACREALevelEvaluationProtocol(
  protocolVersion: ACREALevelEvaluationProtocolVersion,
  evaluationExerciseCode: ACREAEntryTestExerciseCode,
) {
  if (protocolVersion === 4) {
    return requireACREALevelEvaluationV4Mapping(evaluationExerciseCode).exerciseSlug;
  }
  const exercise = acreaEntryTestExercises.find(
    (candidate) => candidate.code === evaluationExerciseCode,
  );
  if (!exercise) throw new Error(`Exercice d’évaluation ACREA V3 inconnu : ${evaluationExerciseCode}.`);
  return exercise.exerciseSlug;
}

export function requireACREALevelEvaluationV4Mapping(evaluationExerciseCode: string) {
  const mapping = manifest.exercises.find(
    (candidate) => candidate.evaluationExerciseCode === evaluationExerciseCode,
  );
  if (!mapping) throw new Error(`Mapping d’évaluation ACREA V4 inconnu : ${evaluationExerciseCode}.`);
  return mapping;
}

function assertValidManifest(value: ACREALevelEvaluationV4Manifest) {
  if (value.schemaVersion !== 2 || value.protocolVersion !== 4 || value.catalogReleaseCode !== "exercise-library-v2") {
    throw new Error("Manifeste d’évaluation ACREA V4 incompatible.");
  }
  if (value.exercises.length !== 6) throw new Error("Le protocole ACREA V4 doit contenir six exercices.");
  const evaluationCodes = new Set<string>();
  const exerciseSlugs = new Set<string>();
  const pillarCounts = new Map<ACREAPillar, number>();
  for (const mapping of value.exercises) {
    const legacyExercise = acreaEntryTestExercises.find(
      (candidate) => candidate.code === mapping.evaluationExerciseCode,
    );
    if (evaluationCodes.has(mapping.evaluationExerciseCode) || exerciseSlugs.has(mapping.exerciseSlug)) {
      throw new Error("Le manifeste ACREA V4 contient un mapping dupliqué.");
    }
    if (!legacyExercise || legacyExercise.pillar !== mapping.pillar) {
      throw new Error(`Le protocole ACREA V4 diverge pour ${mapping.evaluationExerciseCode}.`);
    }
    evaluationCodes.add(mapping.evaluationExerciseCode);
    exerciseSlugs.add(mapping.exerciseSlug);
    pillarCounts.set(mapping.pillar, (pillarCounts.get(mapping.pillar) ?? 0) + 1);
  }
  for (const pillar of ["strength", "cardio", "proprioception"] as const) {
    if (pillarCounts.get(pillar) !== 2) throw new Error(`Deux exercices ACREA V4 sont requis pour ${pillar}.`);
  }
}
