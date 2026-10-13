export type CatalogLookup = {
  id: number;
  code: string;
  label: string;
  updatedAt?: string;
};

export type CatalogPillar = CatalogLookup;
export type CatalogImpact = CatalogLookup;
export type CatalogFamily = CatalogLookup;
export type CatalogType = CatalogLookup;
export type CatalogMuscleGroup = CatalogLookup;
export type CatalogEquipmentCategory = "maison" | "sport";

export type CatalogEquipment = CatalogLookup & {
  category: CatalogEquipmentCategory;
  labelEn?: string;
};

export type CatalogEquipmentOption =
  | { kind: "bodyweight"; equipmentCodes: [] }
  | { kind: "equipment"; equipmentCodes: string[] };

export type CatalogEquipmentFilter =
  { kind: "bodyweight" } | { kind: "equipment"; equipmentCode: string };
export type CatalogExerciseFamily = CatalogFamily;

export type CatalogEquipmentUsage = CatalogEquipment & {
  exerciseCount: number;
  profileCount: number;
};

export type CatalogEquipmentInput = {
  id?: number | null;
  code: string;
  label: string;
  category: CatalogEquipmentCategory;
};

export type CatalogLookupSeed = {
  code: string;
  label: string;
};

export type CatalogPillarSeed = CatalogLookupSeed;
export type CatalogImpactSeed = CatalogLookupSeed;
export type CatalogFamilySeed = CatalogLookupSeed;
export type CatalogTypeSeed = CatalogLookupSeed;
export type CatalogMuscleGroupSeed = CatalogLookupSeed;
export type CatalogEquipmentSeed = CatalogLookupSeed & {
  category?: CatalogEquipmentCategory;
  labelEn?: string;
};

export const catalogExerciseReviewStatuses = [
  "a_verifier",
  "valide",
  "a_revoir",
] as const;

export type CatalogExerciseReviewStatus =
  (typeof catalogExerciseReviewStatuses)[number];

export const catalogExerciseReviewStatusLabels: Record<
  CatalogExerciseReviewStatus,
  string
> = {
  a_verifier: "À vérifier",
  valide: "Validé",
  a_revoir: "À revoir",
};

export const catalogReleaseStatuses = [
  "prepared",
  "active",
  "archived",
] as const;
export type CatalogReleaseStatus = (typeof catalogReleaseStatuses)[number];

export const catalogExerciseTranslationStatuses = [
  "source_only",
  "translated",
  "validated",
] as const;
export type CatalogExerciseTranslationStatus =
  (typeof catalogExerciseTranslationStatuses)[number];

export const catalogExerciseProgrammingStatuses = [
  "library_only",
  "eligible",
  "blocked",
] as const;
export type CatalogExerciseProgrammingStatus =
  (typeof catalogExerciseProgrammingStatuses)[number];

export type CatalogRelease = {
  id: number;
  code: string;
  source: string;
  sourceRevision: string;
  locale: string;
  expectedExerciseCount: number;
  status: CatalogReleaseStatus;
  licenseId: string | null;
  activationBackupReference: string | null;
  activationDiffReference: string | null;
  createdAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
};

export type CatalogReleaseSeed = Omit<CatalogRelease, "id">;

export type CatalogExerciseMediaKind = "poster" | "animation";
export type CatalogExerciseMediaStatus = "ready" | "missing" | "invalid";

export type CatalogExerciseMedia = {
  id: number;
  exerciseId: number;
  kind: CatalogExerciseMediaKind;
  uri: string;
  fileName: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  frameCount: number;
  loopCount: number | null;
  sha256: string | null;
  status: CatalogExerciseMediaStatus;
  updatedAt: string;
};

export type CatalogExerciseMediaSeed = Omit<
  CatalogExerciseMedia,
  "id" | "exerciseId"
>;

export type CatalogExerciseSeed = {
  /** Canonical, English exercise identifier. */
  slug: string;
  /** Stable identity inside a catalog release, independent from database ids. */
  sourceKey?: string;
  labelFr: string;
  labelEn: string;
  categorySlug: string;
  equipmentSlug: string;
  /** @deprecated Internal SQLite compatibility field; always equal to slug. */
  code: string;
  /** @deprecated Internal display compatibility field; always equal to labelFr. */
  label: string;
  pillarCode: string;
  difficulty: number;
  impactCode: string;
  familyCode: string;
  typeCode: string;
  equipmentCode: string;
  regressionExerciseCode: string | null;
  progressionExerciseCode: string | null;
  movementDescription: string;
  startPosition: string;
  outboundExecution: string;
  returnExecution: string;
  adaptedVersion: string;
  tips: string;
  errors: string;
  muscleGroupCodes: readonly string[];
  releaseCode?: string;
  sourceCategory?: string;
  sourceLanguage?: string;
  locale?: string;
  isActive?: boolean;
  reviewStatus?: CatalogExerciseReviewStatus;
  translationStatus?: CatalogExerciseTranslationStatus;
  programmingStatus?: CatalogExerciseProgrammingStatus;
  archivedAt?: string | null;
  adminOverriddenAt?: string | null;
  media?: readonly CatalogExerciseMediaSeed[];
};

export type CatalogSeed = {
  releases?: readonly CatalogReleaseSeed[];
  pillars: readonly CatalogPillarSeed[];
  impacts: readonly CatalogImpactSeed[];
  families: readonly CatalogFamilySeed[];
  types: readonly CatalogTypeSeed[];
  muscleGroups: readonly CatalogMuscleGroupSeed[];
  equipment: readonly CatalogEquipmentSeed[];
  exercises: readonly CatalogExerciseSeed[];
  series: readonly CatalogSeriesSeed[];
  repetitions: readonly CatalogRepetitionSeed[];
  rests: readonly CatalogRestSeed[];
  intervals: readonly CatalogIntervalSeed[];
  formats: readonly CatalogFormatSeed[];
  sessionTemplates: readonly CatalogSessionTemplateSeed[];
  sessionTemplateLevels: readonly CatalogSessionTemplateLevelSeed[];
};

export type CatalogFormatType = "repetitions" | "intervalles";

export const catalogFormatTypeBusinessLabels: Record<
  CatalogFormatType,
  string
> = {
  repetitions: "Répétitions",
  intervalles: "Intervalles",
};

export function getCatalogFormatTypeBusinessLabel(
  formatType: CatalogFormatType,
) {
  return catalogFormatTypeBusinessLabels[formatType];
}

export type CatalogFormat = {
  id: number;
  code: string;
  formatType: CatalogFormatType;
  seriesId: number;
  seriesCode: string;
  seriesCount: number;
  repetitionsId: number | null;
  repetitionsCode: string | null;
  repetitions: number | null;
  restId: number;
  restCode: string;
  restSeconds: number;
  intervalId: number | null;
  intervalCode: string | null;
  intervalSeconds: number | null;
  label: string;
  description: string;
  sourceStatus: string;
  updatedAt: string;
};

export type CatalogSeries = {
  id: number;
  code: string;
  label: string;
  series: number;
  updatedAt: string;
};

export type CatalogRepetition = {
  id: number;
  code: string;
  label: string;
  reps: number | null;
  updatedAt: string;
};

export type CatalogRest = {
  id: number;
  code: string;
  label: string;
  restSeconds: number;
  updatedAt: string;
};

export type CatalogInterval = {
  id: number;
  code: string;
  label: string;
  effortSeconds: number;
  updatedAt: string;
};

export type CatalogTimerOptions = {
  series: CatalogSeries[];
  repetitions: CatalogRepetition[];
  rests: CatalogRest[];
  intervals: CatalogInterval[];
};

export type CatalogFormatSeed = Omit<
  CatalogFormat,
  | "id"
  | "seriesId"
  | "seriesCount"
  | "repetitionsId"
  | "repetitions"
  | "restId"
  | "restSeconds"
  | "intervalId"
  | "intervalSeconds"
>;

export type CatalogSeriesSeed = Omit<CatalogSeries, "id">;
export type CatalogRepetitionSeed = Omit<CatalogRepetition, "id">;
export type CatalogRestSeed = Omit<CatalogRest, "id">;
export type CatalogIntervalSeed = Omit<CatalogInterval, "id">;

export type CatalogSessionTemplate = {
  id: number;
  code: string;
  title: string;
  description: string;
  exerciseId: number;
  exerciseCode: string;
  exerciseLabel: string;
  pillarId: number;
  pillarCode: string;
  pillarLabel: string;
  familyId: number;
  familyCode: string;
  familyLabel: string;
  phase: "warmup" | "main" | "cooldown";
  levels: number[];
  isActive: boolean;
  sourceStatus: string;
  updatedAt: string;
};

export type CatalogSessionTemplateLevel = {
  sessionTemplateId: number;
  sessionTemplateCode: string;
  level: number;
  updatedAt: string;
};

export type CatalogSessionTemplateSeed = {
  code: string;
  title: string;
  description: string;
  exerciseCode: string;
  phase?: "warmup" | "main" | "cooldown";
  isActive: boolean;
  sourceStatus: string;
  updatedAt: string;
};

export type CatalogSessionTemplateLevelSeed = {
  sessionTemplateCode: string;
  level: number;
  updatedAt: string;
};

export type CatalogExercise = {
  id: number;
  slug: string;
  sourceKey: string;
  labelFr: string;
  labelEn: string;
  categorySlug: string;
  code: string;
  label: string;
  name: string;
  pillarId: number;
  pillarCode: string;
  pillarLabel: string;
  difficulty: number;
  levelMin: number;
  levelMax: number;
  impactId: number;
  impactCode: string;
  impactLabel: string;
  impact: string | null;
  family: CatalogFamily;
  families: CatalogExerciseFamily[];
  type: CatalogType;
  muscleGroups: CatalogMuscleGroup[];
  equipmentId: number | null;
  equipmentCode: string;
  equipmentLabel: string;
  equipment: string;
  equipmentOptions: CatalogEquipmentOption[];
  regressionExerciseId: number | null;
  regressionExerciseCode: string | null;
  regression: string | null;
  progressionExerciseId: number | null;
  progressionExerciseCode: string | null;
  progression: string;
  movementDescription: string;
  description: string;
  startPosition: string;
  outboundExecution: string;
  returnExecution: string;
  adaptedVersion: string;
  tips: string;
  errors: string;
  startPositionSteps: string[];
  outboundExecutionSteps: string[];
  returnExecutionSteps: string[];
  positionSteps: string[];
  executionSteps: string[];
  commonErrors: string[];
  releaseId: number;
  releaseCode: string;
  releaseStatus: CatalogReleaseStatus;
  sourceCategory: string;
  sourceLanguage: string;
  locale: string;
  isActive: boolean;
  reviewStatus: CatalogExerciseReviewStatus;
  translationStatus: CatalogExerciseTranslationStatus;
  programmingStatus: CatalogExerciseProgrammingStatus;
  archivedAt: string | null;
  adminOverriddenAt: string | null;
  media: CatalogExerciseMedia[];
  sourceStatus: string;
  updatedAt: string;
};

export type CatalogFilters = {
  pillarId?: number;
  familyId?: number;
  typeId?: number;
  muscleGroupId?: number;
  equipment?: CatalogEquipmentFilter;
  level?: number;
  query?: string;
  includeArchived?: boolean;
};

export type CatalogFilterOptions = {
  pillars: CatalogPillar[];
  families: CatalogFamily[];
  types: CatalogType[];
  muscleGroups: CatalogMuscleGroup[];
  equipment: CatalogEquipment[];
  hasBodyweightOption: boolean;
  levels: number[];
};

export type CatalogExerciseResponse = CatalogExercise;

export type CatalogAdminSnapshot = {
  releases: CatalogRelease[];
  pillars: CatalogPillar[];
  impacts: CatalogImpact[];
  families: CatalogFamily[];
  types: CatalogType[];
  muscleGroups: CatalogMuscleGroup[];
  equipment: CatalogEquipment[];
  exercises: CatalogExercise[];
  series: CatalogSeries[];
  repetitions: CatalogRepetition[];
  rests: CatalogRest[];
  intervals: CatalogInterval[];
  formats: CatalogFormat[];
  sessionTemplates: CatalogSessionTemplate[];
  sessionTemplateLevels: CatalogSessionTemplateLevel[];
  exerciseLevels: {
    exerciseId: number;
    exerciseCode: string;
    level: number;
    isActive: boolean;
    sourceStatus: string;
    updatedAt: string;
  }[];
};

export type CatalogExerciseInput = {
  id: number;
  code: string;
  name: string;
  pillarId: number;
  pillarCode: string;
  familyId: number;
  typeId: number;
  muscleGroupIds: number[];
  levelMin: number;
  levelMax: number;
  equipmentOptions?: CatalogEquipmentOption[];
  equipment?: string;
  impact: string | null;
  regression: string | null;
  progression: string;
  description: string;
  startPositionSteps: string[];
  outboundExecutionSteps: string[];
  returnExecutionSteps: string[];
  tips: string;
  commonErrors: string[];
  isActive: boolean;
  reviewStatus: CatalogExerciseReviewStatus;
  sourceStatus: string;
  updatedAt?: string;
};

export type CatalogFormatInput = {
  id: number;
  code: string;
  formatType: CatalogFormat["formatType"];
  seriesId: number | null;
  repetitionsId: number | null;
  restId: number | null;
  intervalId: number | null;
  label: string;
  description: string;
  sourceStatus: string;
  updatedAt?: string;
};

export type CatalogSeriesInput = Omit<CatalogSeries, "updatedAt"> & {
  updatedAt?: string;
};

export type CatalogRepetitionInput = Omit<CatalogRepetition, "updatedAt"> & {
  updatedAt?: string;
};

export type CatalogRestInput = Omit<CatalogRest, "updatedAt"> & {
  updatedAt?: string;
};

export type CatalogIntervalInput = Omit<CatalogInterval, "updatedAt"> & {
  updatedAt?: string;
};

export type CatalogSessionTemplateInput = {
  id: number;
  code: string;
  title: string;
  description: string;
  exerciseId: number;
  phase: "warmup" | "main" | "cooldown";
  levels: number[];
  isActive: boolean;
  sourceStatus: string;
  updatedAt?: string;
};

export type CatalogSessionTemplateLevelInput = {
  sessionTemplateId: number;
  level: number;
  updatedAt?: string;
};
