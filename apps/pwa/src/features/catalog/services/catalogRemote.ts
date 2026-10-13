import {
  isLocalRuntime,
  isSupabaseConfigured,
} from "@shared/config/clientConfig";
import { getSupabaseClient } from "@shared/config/supabaseClient";
import {
  deleteCatalogEquipmentLocal,
  deleteCatalogExerciseLocal,
  deleteCatalogFormatLocal,
  deleteCatalogIntervalLocal,
  deleteCatalogRepetitionLocal,
  deleteCatalogRestLocal,
  deleteCatalogSeriesLocal,
  deleteCatalogSessionTemplateLevelLocal,
  deleteCatalogSessionTemplateLocal,
  getLocalCatalogAdminSnapshot,
  listCatalogEquipmentUsage,
  replaceLocalCatalogCacheFromSnapshot,
  reviewCatalogReleaseExercisesLocal,
  upsertCatalogEquipmentLocal,
  upsertCatalogExerciseLocal,
  upsertCatalogFormatLocal,
  upsertCatalogIntervalLocal,
  upsertCatalogRepetitionLocal,
  upsertCatalogRestLocal,
  upsertCatalogSeriesLocal,
  upsertCatalogSessionTemplateLevelLocal,
  upsertCatalogSessionTemplateLocal,
} from "./catalogRepository";
import type { CatalogExerciseReviewBatch } from "./catalogExerciseRepository";
import type {
  CatalogAdminSnapshot,
  CatalogEquipment,
  CatalogEquipmentInput,
  CatalogEquipmentUsage,
  CatalogExercise,
  CatalogExerciseMedia,
  CatalogExerciseInput,
  CatalogFormatInput,
  CatalogExerciseResponse,
  CatalogFamily,
  CatalogFormat,
  CatalogImpact,
  CatalogInterval,
  CatalogIntervalInput,
  CatalogMuscleGroup,
  CatalogPillar,
  CatalogRepetition,
  CatalogRepetitionInput,
  CatalogRelease,
  CatalogRest,
  CatalogRestInput,
  CatalogSeries,
  CatalogSeriesInput,
  CatalogSessionTemplate,
  CatalogSessionTemplateInput,
  CatalogSessionTemplateLevel,
  CatalogSessionTemplateLevelInput,
  CatalogType,
} from "../types";
import {
  canonicalEquipment,
  equipmentOptionsForExercise,
} from "./equipmentRequirements";

export type {
  CatalogAdminSnapshot,
  CatalogEquipmentInput,
  CatalogExerciseInput,
  CatalogFormatInput,
  CatalogIntervalInput,
  CatalogRepetitionInput,
  CatalogRestInput,
  CatalogSessionTemplateInput,
  CatalogSessionTemplateLevelInput,
  CatalogSeriesInput,
} from "../types";

type RemoteLookupRow = {
  id: number;
  code: string;
  label: string;
  category?: "maison" | "sport";
};

type RemoteExerciseRow = {
  id: number;
  code: string;
  label: string;
  release_id: number;
  source_key: string | null;
  source_url: string;
  source_category: string;
  source_language: string;
  locale: string;
  pillar_id: number;
  difficulty: number;
  impact_id: number;
  family_id: number;
  type_id: number;
  equipment_id: number | null;
  regression_exercise_id: number | null;
  progression_exercise_id: number | null;
  movement_description: string;
  start_position: string;
  outbound_execution: string;
  return_execution: string;
  adapted_version: string;
  tips: string;
  errors: string;
  is_active: boolean;
  review_status: CatalogExercise["reviewStatus"];
  translation_status: CatalogExercise["translationStatus"];
  programming_status: CatalogExercise["programmingStatus"];
  archived_at: string | null;
  admin_overridden_at: string | null;
  updated_at: string;
};

type RemoteReleaseRow = {
  id: number;
  code: string;
  source: string;
  source_revision: string;
  locale: string;
  expected_exercise_count: number;
  status: CatalogRelease["status"];
  license_id: string | null;
  activation_backup_reference: string | null;
  activation_diff_reference: string | null;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
  updated_at: string;
};

type RemoteExerciseMediaRow = {
  id: number;
  exercise_id: number;
  kind: CatalogExerciseMedia["kind"];
  uri: string;
  file_name: string;
  mime_type: "image/webp";
  width: number;
  height: number;
  frame_count: number;
  loop_count: number | null;
  sha256: string | null;
  source_url: string | null;
  status: CatalogExerciseMedia["status"];
  updated_at: string;
};

type RemoteExerciseMuscleGroupRow = {
  exercise_id: number;
  muscle_group_id: number;
};

type RemoteExerciseEquipmentOptionRow = {
  id: number;
  exercise_id: number;
  option_index: number;
  kind: "bodyweight" | "equipment";
};

type RemoteExerciseEquipmentOptionItemRow = {
  option_id: number;
  equipment_id: number;
};

type RemoteSeriesRow = {
  id: number;
  code: string;
  label: string;
  series: number;
  updated_at: string;
};

type RemoteRepetitionRow = {
  id: number;
  code: string;
  label: string;
  reps: number | null;
  updated_at: string;
};

type RemoteRestRow = {
  id: number;
  code: string;
  label: string;
  rest_seconds: number;
  updated_at: string;
};

type RemoteIntervalRow = {
  id: number;
  code: string;
  label: string;
  effort_seconds: number;
  updated_at: string;
};

type RemoteFormatRow = {
  id: number;
  code: string;
  format_type: CatalogFormat["formatType"];
  series_id: number;
  repetitions_id: number | null;
  rest_id: number;
  interval_id: number | null;
  label: string;
  description: string;
  source_status: string;
  updated_at: string;
};

type RemoteSessionTemplateRow = {
  id: number;
  code: string;
  title: string;
  description: string;
  exercise_id: number;
  phase: "warmup" | "main" | "cooldown";
  is_active: boolean;
  source_status: string;
  updated_at: string;
};

type RemoteSessionTemplateLevelRow = {
  session_template_id: number;
  level: number;
  updated_at: string;
};

const remoteCatalogOrderColumns = {
  catalog_releases: "id",
  catalog_pillars: "id",
  catalog_impacts: "id",
  catalog_families: "id",
  catalog_types: "id",
  catalog_muscle_groups: "id",
  catalog_equipment: "id",
  catalog_exercises: "id",
  catalog_exercise_media: "exercise_id",
  catalog_exercise_muscle_groups: "exercise_id",
  catalog_exercise_equipment_options: "exercise_id",
  catalog_exercise_equipment_option_items: "option_id",
  catalog_series: "id",
  catalog_repetitions: "id",
  catalog_rests: "id",
  catalog_intervals: "id",
  catalog_formats: "id",
  catalog_session_templates: "id",
  catalog_session_template_levels: "session_template_id",
} as const;

type RemoteCatalogTableName = keyof typeof remoteCatalogOrderColumns;

export async function fetchCatalogAdminSnapshotForAdminUi(): Promise<CatalogAdminSnapshot> {
  if (usesLocalCatalogAdminSnapshot()) {
    return getLocalCatalogAdminSnapshot();
  }

  const snapshot = await fetchCatalogAdminSnapshot();
  await cacheRemoteCatalogSnapshotBestEffort(snapshot);
  return snapshot;
}

export async function listCatalogEquipmentUsageForAdminUi(): Promise<
  CatalogEquipmentUsage[]
> {
  if (usesLocalCatalogAdminSnapshot()) {
    return listCatalogEquipmentUsage();
  }

  const snapshot = await fetchCatalogAdminSnapshot();
  await cacheRemoteCatalogSnapshotBestEffort(snapshot);
  const client = getSupabaseClient();
  const { data: profileInventory, error: profileInventoryError } = await client
    .from("acrea_profile_equipment")
    .select("equipment_id");
  if (profileInventoryError) throw profileInventoryError;
  const usageByEquipmentId = new Map<number, number>();
  const profileUsageByEquipmentId = new Map<number, number>();
  const equipmentIdByCode = new Map(
    snapshot.equipment.map((item) => [item.code, item.id]),
  );

  for (const exercise of snapshot.exercises) {
    for (const code of new Set(
      exercise.equipmentOptions.flatMap((option) => option.equipmentCodes),
    )) {
      const id = equipmentIdByCode.get(code);
      if (id) usageByEquipmentId.set(id, (usageByEquipmentId.get(id) ?? 0) + 1);
    }
  }
  for (const inventory of profileInventory ?? []) {
    const equipmentId = Number(inventory.equipment_id);
    profileUsageByEquipmentId.set(
      equipmentId,
      (profileUsageByEquipmentId.get(equipmentId) ?? 0) + 1,
    );
  }

  return snapshot.equipment
    .map((equipment) => ({
      ...equipment,
      exerciseCount: usageByEquipmentId.get(equipment.id) ?? 0,
      profileCount: profileUsageByEquipmentId.get(equipment.id) ?? 0,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

async function cacheRemoteCatalogSnapshotBestEffort(
  snapshot: CatalogAdminSnapshot,
) {
  try {
    await replaceLocalCatalogCacheFromSnapshot(snapshot);
  } catch (error) {
    console.warn(
      "Le catalogue Supabase est disponible, mais son cache SQLite local n'a pas pu etre mis a jour.",
      error,
    );
  }
}

export function usesLocalCatalogAdminSnapshot() {
  return !isSupabaseConfigured || isLocalRuntime;
}

export async function fetchCatalogExercises(): Promise<
  CatalogExerciseResponse[]
> {
  const snapshot = await fetchCatalogAdminSnapshot();

  return snapshot.exercises;
}

export async function fetchCatalogAdminSnapshot(): Promise<CatalogAdminSnapshot> {
  const [
    releaseRows,
    pillarRows,
    impactRows,
    familyRows,
    typeRows,
    muscleGroupRows,
    equipmentRows,
    exerciseRows,
    exerciseMediaRows,
    exerciseMuscleGroupRows,
    exerciseEquipmentOptionRows,
    exerciseEquipmentOptionItemRows,
    seriesRows,
    repetitionRows,
    restRows,
    intervalRows,
    formatRows,
    sessionTemplateRows,
    sessionTemplateLevelRows,
  ] = await Promise.all([
    fetchAllRows<RemoteReleaseRow>("catalog_releases"),
    fetchAllRows<RemoteLookupRow>("catalog_pillars"),
    fetchAllRows<RemoteLookupRow>("catalog_impacts"),
    fetchAllRows<RemoteLookupRow>("catalog_families"),
    fetchAllRows<RemoteLookupRow>("catalog_types"),
    fetchAllRows<RemoteLookupRow>("catalog_muscle_groups"),
    fetchAllRows<RemoteLookupRow>("catalog_equipment"),
    fetchAllRows<RemoteExerciseRow>("catalog_exercises"),
    fetchAllRows<RemoteExerciseMediaRow>("catalog_exercise_media"),
    fetchAllRows<RemoteExerciseMuscleGroupRow>(
      "catalog_exercise_muscle_groups",
    ),
    fetchAllRows<RemoteExerciseEquipmentOptionRow>(
      "catalog_exercise_equipment_options",
    ),
    fetchAllRows<RemoteExerciseEquipmentOptionItemRow>(
      "catalog_exercise_equipment_option_items",
    ),
    fetchAllRows<RemoteSeriesRow>("catalog_series"),
    fetchAllRows<RemoteRepetitionRow>("catalog_repetitions"),
    fetchAllRows<RemoteRestRow>("catalog_rests"),
    fetchAllRows<RemoteIntervalRow>("catalog_intervals"),
    fetchAllRows<RemoteFormatRow>("catalog_formats"),
    fetchAllRows<RemoteSessionTemplateRow>("catalog_session_templates"),
    fetchAllRows<RemoteSessionTemplateLevelRow>(
      "catalog_session_template_levels",
    ),
  ]);

  const releases = releaseRows.map(mapReleaseRow);
  const pillars = pillarRows.map(mapLookupRow);
  const impacts = impactRows.map(mapLookupRow);
  const families = familyRows.map(mapLookupRow);
  const types = typeRows.map(mapLookupRow);
  const muscleGroups = muscleGroupRows.map(mapLookupRow);
  const categoriesByCode = new Map(
    canonicalEquipment.map((item) => [item.code, item.category]),
  );
  const equipment = equipmentRows.map((row) => ({
    ...mapLookupRow(row),
    category:
      row.category ?? categoriesByCode.get(row.code) ?? ("sport" as const),
  }));
  const refs = {
    pillarsById: mapById(pillars),
    impactsById: mapById(impacts),
    familiesById: mapById(families),
    typesById: mapById(types),
    muscleGroupsById: mapById(muscleGroups),
    equipmentById: mapById(equipment),
    releasesById: mapById(releases),
    exerciseRowsById: new Map(exerciseRows.map((row) => [row.id, row])),
    exerciseMediaRows,
    exerciseMuscleGroupRows,
    exerciseEquipmentOptionRows,
    exerciseEquipmentOptionItemRows,
    seriesById: mapById(seriesRows.map(mapSeriesRow)),
    repetitionsById: mapById(repetitionRows.map(mapRepetitionRow)),
    restsById: mapById(restRows.map(mapRestRow)),
    intervalsById: mapById(intervalRows.map(mapIntervalRow)),
  };
  const exercises = exerciseRows.map((row) => mapExerciseRow(row, refs));
  const series = seriesRows.map(mapSeriesRow);
  const repetitions = repetitionRows.map(mapRepetitionRow);
  const rests = restRows.map(mapRestRow);
  const intervals = intervalRows.map(mapIntervalRow);
  const formatRefs = {
    seriesById: mapById(series),
    repetitionsById: mapById(repetitions),
    restsById: mapById(rests),
    intervalsById: mapById(intervals),
  };
  const formats = formatRows.map((row) => mapFormatRow(row, formatRefs));
  const exercisesById = mapById(exercises);
  const sessionRowsById = new Map(
    sessionTemplateRows.map((row) => [row.id, row]),
  );
  const sessionTemplateLevels = sessionTemplateLevelRows.map((row) => ({
    sessionTemplateId: row.session_template_id,
    sessionTemplateCode: requiredRef(
      sessionRowsById,
      row.session_template_id,
      "template de session",
    ).code,
    level: row.level,
    updatedAt: row.updated_at,
  }));
  const sessionTemplates = sessionTemplateRows.map((row) =>
    mapSessionTemplateRow(row, exercisesById, sessionTemplateLevels),
  );
  return {
    releases,
    pillars,
    impacts,
    families,
    types,
    muscleGroups,
    equipment,
    exercises,
    series,
    repetitions,
    rests,
    intervals,
    formats,
    sessionTemplates,
    sessionTemplateLevels,
    exerciseLevels: exercises.map((exercise) => ({
      exerciseId: exercise.id,
      exerciseCode: exercise.code,
      level: exercise.difficulty,
      isActive: exercise.isActive,
      sourceStatus: "derived from catalog_exercises.difficulty",
      updatedAt: exercise.updatedAt,
    })),
  };
}

export async function upsertCatalogEquipment(
  input: CatalogEquipmentInput,
): Promise<CatalogEquipmentUsage> {
  if (usesLocalCatalogAdminSnapshot()) {
    return upsertCatalogEquipmentLocal(input);
  }

  const row = await upsertRemoteCatalogRow<RemoteLookupRow>(
    "catalog_equipment",
    input.id,
    {
      code: input.code,
      label: input.label,
      category: input.category,
    },
  );

  return {
    ...mapLookupRow(row),
    category: row.category ?? input.category,
    exerciseCount: 0,
    profileCount: 0,
  };
}

export async function deleteCatalogEquipment(id: number) {
  if (usesLocalCatalogAdminSnapshot()) {
    await deleteCatalogEquipmentLocal(id);
    return;
  }

  await deleteRemoteCatalogRow("catalog_equipment", id);
}

export async function upsertCatalogExercise(input: CatalogExerciseInput) {
  void input;
  throw new Error(
    "Les exercices sont en lecture seule : modifiez docs/bibliotheque puis régénérez le catalogue.",
  );
}

export async function reviewCatalogReleaseExercises(
  batch: CatalogExerciseReviewBatch,
) {
  void batch;
  throw new Error(
    "Les fiches sont validées par la génération de la bibliothèque française.",
  );
}

export async function deleteCatalogExercise(id: number) {
  void id;
  throw new Error(
    "Les exercices sont en lecture seule : supprimez ou reclassez leur fiche source.",
  );
}

export async function upsertCatalogFormat(input: CatalogFormatInput) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogFormatLocal(input);
    return;
  }

  await upsertRemoteCatalogRow("catalog_formats", input.id, {
    code: input.code,
    format_type: input.formatType,
    series_id: input.seriesId,
    repetitions_id: input.repetitionsId,
    rest_id: input.restId,
    interval_id: input.intervalId,
    label: input.label,
    description: input.description,
    source_status: input.sourceStatus || "admin Supabase",
    updated_at: input.updatedAt ?? new Date().toISOString(),
  });
}

export async function deleteCatalogFormat(id: number) {
  await dispatchCatalogDelete("catalog_formats", id, deleteCatalogFormatLocal);
}

export async function upsertCatalogSeries(input: CatalogSeriesInput) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogSeriesLocal(input);
    return;
  }

  await upsertRemoteCatalogRow("catalog_series", input.id, {
    code: input.code,
    label: input.label,
    series: input.series,
    updated_at: input.updatedAt ?? new Date().toISOString(),
  });
}

export async function deleteCatalogSeries(id: number) {
  await dispatchCatalogDelete("catalog_series", id, deleteCatalogSeriesLocal);
}

export async function upsertCatalogRepetition(input: CatalogRepetitionInput) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogRepetitionLocal(input);
    return;
  }

  await upsertRemoteCatalogRow("catalog_repetitions", input.id, {
    code: input.code,
    label: input.label,
    reps: input.reps,
    updated_at: input.updatedAt ?? new Date().toISOString(),
  });
}

export async function deleteCatalogRepetition(id: number) {
  await dispatchCatalogDelete(
    "catalog_repetitions",
    id,
    deleteCatalogRepetitionLocal,
  );
}

export async function upsertCatalogRest(input: CatalogRestInput) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogRestLocal(input);
    return;
  }

  await upsertRemoteCatalogRow("catalog_rests", input.id, {
    code: input.code,
    label: input.label,
    rest_seconds: input.restSeconds,
    updated_at: input.updatedAt ?? new Date().toISOString(),
  });
}

export async function deleteCatalogRest(id: number) {
  await dispatchCatalogDelete("catalog_rests", id, deleteCatalogRestLocal);
}

export async function upsertCatalogInterval(input: CatalogIntervalInput) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogIntervalLocal(input);
    return;
  }

  await upsertRemoteCatalogRow("catalog_intervals", input.id, {
    code: input.code,
    label: input.label,
    effort_seconds: input.effortSeconds,
    updated_at: input.updatedAt ?? new Date().toISOString(),
  });
}

export async function deleteCatalogInterval(id: number) {
  await dispatchCatalogDelete(
    "catalog_intervals",
    id,
    deleteCatalogIntervalLocal,
  );
}

export async function upsertCatalogSessionTemplate(
  input: CatalogSessionTemplateInput,
) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogSessionTemplateLocal(input);
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.rpc("admin_upsert_catalog_session_template", {
    p_id: input.id,
    p_code: input.code,
    p_title: input.title,
    p_description: input.description,
    p_exercise_id: input.exerciseId,
    p_phase: input.phase,
    p_levels: input.levels,
    p_is_active: input.isActive,
    p_source_status: input.sourceStatus || "admin Supabase",
    p_updated_at: input.updatedAt ?? new Date().toISOString(),
  });

  if (error) throw error;
}

export async function deleteCatalogSessionTemplate(id: number) {
  await dispatchCatalogDelete(
    "catalog_session_templates",
    id,
    deleteCatalogSessionTemplateLocal,
  );
}

export async function upsertCatalogSessionTemplateLevel(
  input: CatalogSessionTemplateLevelInput,
) {
  if (usesLocalCatalogAdminSnapshot()) {
    await upsertCatalogSessionTemplateLevelLocal(input);
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from("catalog_session_template_levels").upsert(
    {
      session_template_id: input.sessionTemplateId,
      level: input.level,
      updated_at: input.updatedAt ?? new Date().toISOString(),
    },
    { onConflict: "session_template_id,level" },
  );

  if (error) throw error;
}

export async function deleteCatalogSessionTemplateLevel(input: {
  sessionTemplateId: number;
  level: number;
}) {
  if (usesLocalCatalogAdminSnapshot()) {
    await deleteCatalogSessionTemplateLevelLocal(input);
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client
    .from("catalog_session_template_levels")
    .delete()
    .eq("session_template_id", input.sessionTemplateId)
    .eq("level", input.level);

  if (error) throw error;
}

async function fetchAllRows<T>(tableName: RemoteCatalogTableName) {
  const client = getSupabaseClient();
  const pageSize = 1000;
  const rows: T[] = [];
  const orderColumn = remoteCatalogOrderColumns[tableName];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .order(orderColumn, { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

function mapLookupRow(row: RemoteLookupRow) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    updatedAt: "",
  };
}

function mapReleaseRow(row: RemoteReleaseRow): CatalogRelease {
  return {
    id: row.id,
    code: row.code,
    source: row.source,
    sourceRevision: row.source_revision,
    locale: row.locale,
    expectedExerciseCount: row.expected_exercise_count,
    status: row.status,
    licenseId: row.license_id,
    activationBackupReference: row.activation_backup_reference,
    activationDiffReference: row.activation_diff_reference,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

function mapExerciseRow(
  row: RemoteExerciseRow,
  refs: {
    pillarsById: Map<number, CatalogPillar>;
    impactsById: Map<number, CatalogImpact>;
    familiesById: Map<number, CatalogFamily>;
    typesById: Map<number, CatalogType>;
    muscleGroupsById: Map<number, CatalogMuscleGroup>;
    equipmentById: Map<number, CatalogEquipment>;
    releasesById: Map<number, CatalogRelease>;
    exerciseRowsById: Map<number, RemoteExerciseRow>;
    exerciseMediaRows: RemoteExerciseMediaRow[];
    exerciseMuscleGroupRows: RemoteExerciseMuscleGroupRow[];
    exerciseEquipmentOptionRows: RemoteExerciseEquipmentOptionRow[];
    exerciseEquipmentOptionItemRows: RemoteExerciseEquipmentOptionItemRow[];
  },
): CatalogExercise {
  const release = requiredRef(refs.releasesById, row.release_id, "release");
  const pillar = requiredRef(refs.pillarsById, row.pillar_id, "pilier");
  const impact = requiredRef(refs.impactsById, row.impact_id, "impact");
  const family = requiredRef(refs.familiesById, row.family_id, "famille");
  const type = requiredRef(refs.typesById, row.type_id, "type");
  const equipment = row.equipment_id
    ? requiredRef(refs.equipmentById, row.equipment_id, "equipement")
    : null;
  const equipmentOptions = refs.exerciseEquipmentOptionRows
    .filter((option) => option.exercise_id === row.id)
    .sort((left, right) => left.option_index - right.option_index)
    .map((option) =>
      option.kind === "bodyweight"
        ? { kind: "bodyweight" as const, equipmentCodes: [] as [] }
        : {
            kind: "equipment" as const,
            equipmentCodes: refs.exerciseEquipmentOptionItemRows
              .filter((item) => item.option_id === option.id)
              .map(
                (item) =>
                  requiredRef(
                    refs.equipmentById,
                    item.equipment_id,
                    "equipement d'option",
                  ).code,
              )
              .sort(),
          },
    );
  const resolvedEquipmentOptions =
    equipmentOptions.length > 0
      ? equipmentOptions
      : equipment
        ? equipmentOptionsForExercise({
            code: row.code,
            equipmentCode: equipment.code,
          } as never)
        : [{ kind: "bodyweight" as const, equipmentCodes: [] as [] }];
  const regression = row.regression_exercise_id
    ? (refs.exerciseRowsById.get(row.regression_exercise_id) ?? null)
    : null;
  const progression = row.progression_exercise_id
    ? (refs.exerciseRowsById.get(row.progression_exercise_id) ?? null)
    : null;
  const muscleGroups = refs.exerciseMuscleGroupRows
    .filter((link) => link.exercise_id === row.id)
    .map((link) =>
      requiredRef(
        refs.muscleGroupsById,
        link.muscle_group_id,
        "groupe musculaire",
      ),
    );
  const startPositionSteps = splitTextLines(row.start_position);
  const outboundExecutionSteps = splitTextLines(row.outbound_execution);
  const returnExecutionSteps = splitTextLines(row.return_execution);
  const errorSteps = splitTextLines(row.errors);
  const media = refs.exerciseMediaRows
    .filter((item) => item.exercise_id === row.id)
    .map(mapRemoteExerciseMediaRow);

  return {
    id: row.id,
    slug: row.code,
    sourceKey: row.source_key || `${release.code}:${row.code}`,
    labelFr: row.label,
    labelEn: row.label,
    categorySlug: row.source_category,
    code: row.code,
    label: row.label,
    name: row.label,
    pillarId: pillar.id,
    pillarCode: pillar.code,
    pillarLabel: pillar.label,
    difficulty: row.difficulty,
    levelMin: row.difficulty,
    levelMax: row.difficulty,
    impactId: impact.id,
    impactCode: impact.code,
    impactLabel: impact.label,
    impact: impact.code,
    family,
    families: [family],
    type,
    muscleGroups,
    equipmentId: equipment?.id ?? null,
    equipmentCode: equipment?.code ?? "bodyweight",
    equipmentLabel: equipment?.label ?? "Sans matériel",
    equipment: equipment?.label ?? "Sans matériel",
    equipmentOptions: resolvedEquipmentOptions,
    regressionExerciseId: regression?.id ?? null,
    regressionExerciseCode: regression?.code ?? null,
    regression: regression?.label ?? null,
    progressionExerciseId: progression?.id ?? null,
    progressionExerciseCode: progression?.code ?? null,
    progression: progression?.label ?? "",
    movementDescription: row.movement_description,
    description: row.movement_description,
    startPosition: row.start_position,
    outboundExecution: row.outbound_execution,
    returnExecution: row.return_execution,
    adaptedVersion: row.adapted_version,
    tips: row.tips,
    errors: row.errors,
    startPositionSteps,
    outboundExecutionSteps,
    returnExecutionSteps,
    positionSteps: startPositionSteps,
    executionSteps: [...outboundExecutionSteps, ...returnExecutionSteps],
    commonErrors: errorSteps,
    releaseId: release.id,
    releaseCode: release.code,
    releaseStatus: release.status,
    sourceCategory: row.source_category,
    sourceLanguage: row.source_language,
    locale: row.locale,
    isActive: row.is_active,
    reviewStatus: row.review_status,
    translationStatus: row.translation_status,
    programmingStatus: row.programming_status,
    archivedAt: row.archived_at,
    adminOverriddenAt: row.admin_overridden_at,
    media,
    sourceStatus: `catalogue ${release.code}`,
    updatedAt: row.updated_at,
  };
}

function mapRemoteExerciseMediaRow(
  row: RemoteExerciseMediaRow,
): CatalogExerciseMedia {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    kind: row.kind,
    uri: row.uri,
    fileName: row.file_name,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    frameCount: row.frame_count,
    loopCount: row.loop_count,
    sha256: row.sha256,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapSeriesRow(row: RemoteSeriesRow): CatalogSeries {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    series: row.series,
    updatedAt: row.updated_at,
  };
}

function mapRepetitionRow(row: RemoteRepetitionRow): CatalogRepetition {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    reps: row.reps,
    updatedAt: row.updated_at,
  };
}

function mapRestRow(row: RemoteRestRow): CatalogRest {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    restSeconds: row.rest_seconds,
    updatedAt: row.updated_at,
  };
}

function mapIntervalRow(row: RemoteIntervalRow): CatalogInterval {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    effortSeconds: row.effort_seconds,
    updatedAt: row.updated_at,
  };
}

function mapFormatRow(
  row: RemoteFormatRow,
  refs: {
    seriesById: Map<number, CatalogSeries>;
    repetitionsById: Map<number, CatalogRepetition>;
    restsById: Map<number, CatalogRest>;
    intervalsById: Map<number, CatalogInterval>;
  },
): CatalogFormat {
  const series = requiredRef(refs.seriesById, row.series_id, "serie");
  const repetitions = row.repetitions_id
    ? (refs.repetitionsById.get(row.repetitions_id) ?? null)
    : null;
  const rest = requiredRef(refs.restsById, row.rest_id, "repos");
  const interval = row.interval_id
    ? (refs.intervalsById.get(row.interval_id) ?? null)
    : null;

  return {
    id: row.id,
    code: row.code,
    formatType: row.format_type,
    seriesId: series.id,
    seriesCode: series.code,
    seriesCount: series.series,
    repetitionsId: repetitions?.id ?? null,
    repetitionsCode: repetitions?.code ?? null,
    repetitions: repetitions?.reps ?? null,
    restId: rest.id,
    restCode: rest.code,
    restSeconds: rest.restSeconds,
    intervalId: interval?.id ?? null,
    intervalCode: interval?.code ?? null,
    intervalSeconds: interval?.effortSeconds ?? null,
    label: row.label,
    description: row.description,
    sourceStatus: row.source_status,
    updatedAt: row.updated_at,
  };
}

function mapSessionTemplateRow(
  row: RemoteSessionTemplateRow,
  exercisesById: Map<number, CatalogExercise>,
  levels: CatalogSessionTemplateLevel[],
): CatalogSessionTemplate {
  const exercise = requiredRef(
    exercisesById,
    row.exercise_id,
    "exercice de session",
  );

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    exerciseId: exercise.id,
    exerciseCode: exercise.code,
    exerciseLabel: exercise.label,
    pillarId: exercise.pillarId,
    pillarCode: exercise.pillarCode,
    pillarLabel: exercise.pillarLabel,
    familyId: exercise.family.id,
    familyCode: exercise.family.code,
    familyLabel: exercise.family.label,
    phase: row.phase,
    levels: levels
      .filter((link) => link.sessionTemplateId === row.id)
      .map((link) => link.level),
    isActive: row.is_active,
    sourceStatus: row.source_status,
    updatedAt: row.updated_at,
  };
}

function mapById<T extends { id: number }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function requiredRef<T>(refs: Map<number, T>, id: number, label: string) {
  const value = refs.get(id);

  if (!value) {
    throw new Error(`Reference catalogue manquante: ${label} ${id}`);
  }

  return value;
}

function splitTextLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function upsertRemoteCatalogRow<T>(
  tableName: string,
  id: number | null | undefined,
  values: Record<string, unknown>,
): Promise<T> {
  const client = getSupabaseClient();
  const result =
    id && id > 0
      ? await client
          .from(tableName)
          .update(values)
          .eq("id", id)
          .select("*")
          .single()
      : await client.from(tableName).insert(values).select("*").single();

  if (result.error) throw result.error;
  return result.data as T;
}

async function deleteRemoteCatalogRow(tableName: string, id: number) {
  const client = getSupabaseClient();
  const { error } = await client.from(tableName).delete().eq("id", id);

  if (error) throw error;
}

async function dispatchCatalogDelete(
  tableName: string,
  id: number,
  deleteLocal: (id: number) => Promise<void>,
) {
  if (usesLocalCatalogAdminSnapshot()) {
    await deleteLocal(id);
    return;
  }

  await deleteRemoteCatalogRow(tableName, id);
}
