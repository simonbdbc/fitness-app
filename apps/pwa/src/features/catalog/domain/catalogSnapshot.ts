import type {
  CatalogEquipment,
  CatalogExercise,
  CatalogExerciseSeed,
  CatalogFamily,
  CatalogFormat,
  CatalogImpact,
  CatalogInterval,
  CatalogMuscleGroup,
  CatalogPillar,
  CatalogRepetition,
  CatalogRelease,
  CatalogRest,
  CatalogSeed,
  CatalogSeries,
  CatalogSessionTemplate,
  CatalogSessionTemplateLevel,
  CatalogType,
} from "../types";

export type CatalogSnapshotForCache = {
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
};

export function catalogSeedFromSnapshot(
  snapshot: CatalogSnapshotForCache,
): CatalogSeed {
  return {
    releases: snapshot.releases.map(({ id: _id, ...release }) => release),
    pillars: snapshot.pillars.map(lookupSeedFromLookup),
    impacts: snapshot.impacts.map(lookupSeedFromLookup),
    families: snapshot.families.map(lookupSeedFromLookup),
    types: snapshot.types.map(lookupSeedFromLookup),
    muscleGroups: snapshot.muscleGroups.map(lookupSeedFromLookup),
    equipment: snapshot.equipment.map(lookupSeedFromLookup),
    exercises: snapshot.exercises.map(exerciseSeedFromExercise),
    series: snapshot.series.map(({ id: _id, ...series }) => series),
    repetitions: snapshot.repetitions.map(
      ({ id: _id, ...repetition }) => repetition,
    ),
    rests: snapshot.rests.map(({ id: _id, ...rest }) => rest),
    intervals: snapshot.intervals.map(({ id: _id, ...interval }) => interval),
    formats: snapshot.formats.map(
      ({
        id: _id,
        seriesId: _seriesId,
        seriesCount: _seriesCount,
        repetitionsId: _repetitionsId,
        repetitions: _repetitions,
        restId: _restId,
        restSeconds: _restSeconds,
        intervalId: _intervalId,
        intervalSeconds: _intervalSeconds,
        ...format
      }) => format,
    ),
    sessionTemplates: snapshot.sessionTemplates.map(
      ({
        id: _id,
        exerciseId: _exerciseId,
        exerciseLabel: _exerciseLabel,
        pillarId: _pillarId,
        pillarCode: _pillarCode,
        pillarLabel: _pillarLabel,
        familyId: _familyId,
        familyCode: _familyCode,
        familyLabel: _familyLabel,
        levels: _levels,
        ...session
      }) => session,
    ),
    sessionTemplateLevels: snapshot.sessionTemplateLevels.map(
      ({ sessionTemplateId: _sessionTemplateId, ...link }) => link,
    ),
  };
}

function lookupSeedFromLookup(lookup: { code: string; label: string }) {
  return { code: lookup.code, label: lookup.label };
}

function exerciseSeedFromExercise(
  exercise: CatalogExercise,
): CatalogExerciseSeed {
  return {
    slug: exercise.slug,
    sourceKey: exercise.sourceKey,
    labelFr: exercise.labelFr,
    labelEn: exercise.labelEn,
    categorySlug: exercise.categorySlug,
    equipmentSlug: exercise.equipmentCode,
    code: exercise.code,
    label: exercise.label,
    pillarCode: exercise.pillarCode,
    difficulty: exercise.difficulty,
    impactCode: exercise.impactCode,
    familyCode: exercise.family.code,
    typeCode: exercise.type.code,
    equipmentCode: exercise.equipmentCode,
    regressionExerciseCode: exercise.regressionExerciseCode,
    progressionExerciseCode: exercise.progressionExerciseCode,
    movementDescription: exercise.movementDescription,
    startPosition: exercise.startPosition,
    outboundExecution: exercise.outboundExecution,
    returnExecution: exercise.returnExecution,
    adaptedVersion: exercise.adaptedVersion,
    tips: exercise.tips,
    errors: exercise.errors,
    muscleGroupCodes: exercise.muscleGroups.map((group) => group.code),
    releaseCode: exercise.releaseCode,
    sourceCategory: exercise.sourceCategory,
    sourceLanguage: exercise.sourceLanguage,
    locale: exercise.locale,
    isActive: exercise.isActive,
    reviewStatus: exercise.reviewStatus,
    translationStatus: exercise.translationStatus,
    programmingStatus: exercise.programmingStatus,
    archivedAt: exercise.archivedAt,
    adminOverriddenAt: exercise.adminOverriddenAt,
    media: exercise.media.map(
      ({ id: _id, exerciseId: _exerciseId, ...media }) => media,
    ),
  };
}
