export {
  acreaLevelEvaluationProtocolVersion,
  categoryLabels,
  createEmptyACREAProfile,
  isACREAProfileComplete,
  acreaExerciseSeed,
  acreaNonNegotiableRules,
  acreaPillarLabels,
} from "./data/acreaSeed";
export {
  acreaEntryProtocolRules,
  acreaEntryTestStages,
  acreaEntryTestExercises,
  acreaEntryWarmupItems,
  acreaPillarTerm,
} from "./data/acreaEntryLevelTest";
export {
  acreaLevelEvaluationV4Manifest,
  acreaLevelEvaluationV4Mappings,
  exerciseSlugForACREALevelEvaluationProtocol,
  requireACREALevelEvaluationV4Mapping,
} from "./data/acreaLevelEvaluationV4";
export type {
  ACREACategory,
  ACREAExercise,
  ACREAExerciseMode,
  ACREAImpact,
  ACREALevel,
  ACREAObjectiveCode,
  ACREAPillar,
  ACREAPillarLevelState,
  ACREAPillarLevels,
  ACREAProfile,
  ACREAProfileState,
  ACREAStructuredRestriction,
  ACREASeance,
  ACREASession,
  ACREASessionAlternative,
  ACREASessionPhase,
  ACREASessionPrescription,
  ACREATraining,
  ACREAWeekPlan,
} from "./data/acreaSeed";
export {
  adaptFutureExercisePrescriptions,
  excludeExerciseForProfile,
  replaceExcludedExerciseOccurrences,
} from "./services/exerciseProgressionRepository";
export type {
  ACREAEntryTestExercise,
  ACREAEntryTestExerciseCode,
} from "./data/acreaEntryLevelTest";
export type {
  ACREAEvaluationExerciseMapping,
  ACREAEvaluationMappingConfidence,
  ACREALevelEvaluationV4Manifest,
  ACREALevelEvaluationProtocolVersion,
} from "./data/acreaLevelEvaluationV4";
export {
  generateWeeklyProgram,
  getWeeklyProgramRegenerationState,
  loadCurrentWeeklyProgram,
  regenerateWeeklyProgram,
  type WeeklyProgramRegenerationState,
} from "./services/weeklyProgramAi";
export { computeWeeklyProgramProfileFingerprint } from "./services/weeklyProgramSchedule";
export {
  listACREAEquipmentOptions,
  loadLocalACREAProfile,
  type ACREAEquipmentOption,
} from "./services/acreaProfileRepository";
export { updateWeeklyTrainingStatus } from "./services/weeklyProgramRepository";
export {
  ACREAProfileProvider,
  useACREAProfile,
} from "./providers/ACREAProfileProvider";
