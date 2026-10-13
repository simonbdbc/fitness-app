import { isSupabaseConfigured } from "@shared/config/clientConfig";
import { getSupabaseClient } from "@shared/config/supabaseClient";
import { withDatabase } from "@shared/db";
import {
  reportTechnicalDegradation,
  reportTechnicalDegradationOnce,
} from "@shared/observability/technicalDiagnostics";

import {
  createEmptyACREAProfile,
  type ACREAProfileState,
  type ACREAStructuredRestriction,
} from "../data/acreaSeed";
import { loadCanonicalExcludedExercises } from "./catalogExerciseCanonicalizationRepository";

type ProfileRow = {
  profile_id: string;
  name: string;
  objective: string | null;
  objective_code: string | null;
  equipment_mode: string | null;
  weekly_frequency: number | null;
  average_session_minutes: number | null;
  session_minutes_min: number | null;
  session_minutes_max: number | null;
  weekly_novelty_percent: number | null;
  level_test_status: ACREAProfileState["levelTestStatus"];
  level_test_version: number;
  level_test_completed_at: string | null;
  renforcement_level: number | null;
  cardio_level: number | null;
  proprioception_level: number | null;
  preferred_weekdays_json: string;
};

type RemoteProfileRow = Omit<
  ProfileRow,
  "profile_id" | "preferred_weekdays_json"
> & {
  user_id: string;
  preferred_weekdays: number[];
};

export type ACREAEquipmentOption = {
  code: string;
  label: string;
  category: "maison" | "sport";
};

export class ACREAProfileSyncError extends Error {
  readonly profile: ACREAProfileState;

  constructor(profile: ACREAProfileState, cause: unknown) {
    super(
      `Le profil ACREA reste local et doit être resynchronisé. ${errorMessage(cause)}`,
    );
    this.name = "ACREAProfileSyncError";
    this.profile = profile;
  }
}

export async function listACREAEquipmentOptions(): Promise<
  ACREAEquipmentOption[]
> {
  return withDatabase((db) =>
    db.getAllAsync<ACREAEquipmentOption>(
      `SELECT code, label, category
       FROM catalog_equipment
       WHERE code <> 'a-evaluer'
       ORDER BY category, label COLLATE NOCASE, code`,
    ),
  );
}

export async function loadOrCreateACREAProfile({
  id,
  name,
}: {
  id: string;
  name: string;
}): Promise<ACREAProfileState> {
  if (isSupabaseConfigured) {
    const remote = await loadRemoteProfile(id).catch((error: unknown) => {
      reportTechnicalDegradation("acrea-profile-remote-load", error);
      return null;
    });
    if (remote) {
      await saveLocalProfile(remote, "synced");
      return (await loadLocalProfile(id)) ?? remote;
    }
  }

  const local = await loadLocalProfile(id);
  if (local) {
    if (isSupabaseConfigured) {
      await saveLocalProfile(local, "pending");
      try {
        await saveRemoteProfile(local);
        await saveLocalProfile(local, "synced");
      } catch (error) {
        throw new ACREAProfileSyncError(local, error);
      }
    }
    return local;
  }

  const created = createEmptyACREAProfile({ id, name });
  if (isSupabaseConfigured) {
    await saveLocalProfile(created, "pending");
    try {
      await saveRemoteProfile(created);
      await saveLocalProfile(created, "synced");
    } catch (error) {
      throw new ACREAProfileSyncError(created, error);
    }
  } else {
    await saveLocalProfile(created, "local");
  }
  return created;
}

/** Reads the persisted profile only; it never contacts Supabase or writes data. */
export async function loadLocalACREAProfile(
  profileId: string,
): Promise<ACREAProfileState | null> {
  return loadLocalProfile(profileId);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Synchronisation Supabase impossible.";
}

export async function saveACREAProfile(profile: ACREAProfileState) {
  profile = normalizeProfile(profile);
  if (isSupabaseConfigured) {
    await saveLocalProfile(profile, "pending");
    try {
      await saveRemoteProfile(profile);
      await saveLocalProfile(profile, "synced");
    } catch (error) {
      throw new ACREAProfileSyncError(profile, error);
    }
    return;
  }
  await saveLocalProfile(profile, "local");
}

async function loadLocalProfile(
  profileId: string,
): Promise<ACREAProfileState | null> {
  return withDatabase(async (db) => {
    const row = await db.getFirstAsync<ProfileRow>(
      "SELECT * FROM acrea_profiles WHERE profile_id = ? LIMIT 1",
      [profileId],
    );
    if (!row) return null;
    const equipment = await db.getAllAsync<{ equipment_code: string }>(
      `SELECT equipment.code AS equipment_code
             FROM acrea_profile_equipment inventory
             JOIN catalog_equipment equipment ON equipment.id = inventory.equipment_id
             WHERE inventory.profile_id = ?
             ORDER BY equipment.code`,
      [profileId],
    );
    const restrictions = await db.getAllAsync<{ payload_json: string }>(
      "SELECT payload_json FROM acrea_profile_restrictions WHERE profile_id = ? ORDER BY id",
      [profileId],
    );
    const excludedExercises = await loadCanonicalExcludedExercises(
      db,
      profileId,
    );

    return profileFromRows(
      row,
      equipment.map((item) => item.equipment_code),
      restrictions,
      excludedExercises.map(({ code }) => code),
    );
  });
}

async function saveLocalProfile(
  profile: ACREAProfileState,
  syncStatus: "local" | "pending" | "synced",
) {
  profile = normalizeProfile(profile);
  const now = new Date().toISOString();
  await withDatabase((db) =>
    db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO acrea_profiles (
                profile_id, name, objective, objective_code, equipment_mode,
                weekly_frequency, average_session_minutes, session_minutes_min,
                session_minutes_max, weekly_novelty_percent, level_test_status,
                level_test_version, level_test_completed_at, renforcement_level,
                cardio_level, proprioception_level, preferred_weekdays_json,
                sync_status, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(profile_id) DO UPDATE SET
                name = excluded.name, objective = excluded.objective,
                objective_code = excluded.objective_code,
                equipment_mode = excluded.equipment_mode,
                weekly_frequency = excluded.weekly_frequency,
                average_session_minutes = excluded.average_session_minutes,
                session_minutes_min = excluded.session_minutes_min,
                session_minutes_max = excluded.session_minutes_max,
                weekly_novelty_percent = excluded.weekly_novelty_percent,
                level_test_status = excluded.level_test_status,
                level_test_version = excluded.level_test_version,
                level_test_completed_at = excluded.level_test_completed_at,
                renforcement_level = excluded.renforcement_level,
                cardio_level = excluded.cardio_level,
                proprioception_level = excluded.proprioception_level,
                preferred_weekdays_json = excluded.preferred_weekdays_json,
                sync_status = excluded.sync_status, updated_at = excluded.updated_at`,
        [
          profile.id,
          profile.name,
          profile.objective,
          profile.objectiveCode,
          profile.equipmentMode,
          profile.weeklyFrequency,
          averageSessionMinutes(profile),
          profile.sessionMinutesMin,
          profile.sessionMinutesMax,
          profile.weeklyNoveltyPercent,
          profile.levelTestStatus,
          profile.levelTestVersion,
          profile.levelTestCompletedAt,
          profile.pillarLevels.strength,
          profile.pillarLevels.cardio,
          profile.pillarLevels.proprioception,
          JSON.stringify(profile.preferredWeekdays),
          syncStatus,
          now,
          now,
        ],
      );
      await db.runAsync(
        "DELETE FROM acrea_profile_equipment WHERE profile_id = ?",
        [profile.id],
      );
      await db.runAsync(
        "DELETE FROM acrea_profile_equipment_pending WHERE profile_id = ?",
        [profile.id],
      );
      for (const code of profile.availableEquipment) {
        const equipment = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM catalog_equipment WHERE code = ? LIMIT 1",
          [code],
        );
        if (!equipment)
          throw new Error(`Équipement catalogue inconnu: ${code}`);
        await db.runAsync(
          "INSERT INTO acrea_profile_equipment (profile_id, equipment_id) VALUES (?, ?)",
          [profile.id, equipment.id],
        );
      }
      await db.runAsync(
        "DELETE FROM acrea_profile_restrictions WHERE profile_id = ?",
        [profile.id],
      );
      for (const restriction of profile.restrictions) {
        await db.runAsync(
          `INSERT INTO acrea_profile_restrictions
                    (profile_id, restriction_type, payload_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
          [profile.id, restriction.type, JSON.stringify(restriction), now, now],
        );
      }
      await db.runAsync(
        "DELETE FROM acrea_profile_excluded_exercises WHERE profile_id = ?",
        [profile.id],
      );
      for (const exerciseCode of profile.excludedExerciseCodes) {
        const exercise = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM catalog_exercises WHERE code = ?",
          [exerciseCode],
        );
        if (!exercise) throw new Error(`Exercice catalogue inconnu: ${exerciseCode}`);
        await db.runAsync(
          `INSERT INTO acrea_profile_excluded_exercises
             (profile_id, exercise_id, reason, excluded_at)
           VALUES (?, ?, 'manual', ?)`,
          [profile.id, exercise.id, now],
        );
      }
    }),
  );
}

async function loadRemoteProfile(userId: string): Promise<ACREAProfileState | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("acrea_profiles")
    .select(
      "user_id,name,objective,objective_code,equipment_mode,weekly_frequency,average_session_minutes,session_minutes_min,session_minutes_max,weekly_novelty_percent,level_test_status,level_test_version,level_test_completed_at,renforcement_level,cardio_level,proprioception_level,preferred_weekdays",
    )
    .eq("user_id", userId)
    .maybeSingle<RemoteProfileRow>();
  if (error) throw error;
  if (!data) return null;

  const [
    { data: equipment, error: equipmentError },
    { data: restrictions, error: restrictionsError },
    { data: excludedExercises, error: excludedExercisesError },
  ] = await Promise.all([
    client
      .from("acrea_profile_equipment")
      .select("equipment_id,catalog_equipment(code)")
      .eq("user_id", userId),
    client
      .from("acrea_profile_restrictions")
      .select("payload")
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("acrea_profile_excluded_exercises")
      .select("exercise_id,catalog_exercises(code)")
      .eq("user_id", userId),
  ]);
  if (equipmentError) throw equipmentError;
  if (restrictionsError) throw restrictionsError;
  if (excludedExercisesError) throw excludedExercisesError;

  return profileFromRows(
    {
      ...data,
      profile_id: data.user_id,
      preferred_weekdays_json: JSON.stringify(data.preferred_weekdays),
    },
    (equipment ?? []).flatMap((item) => {
      const relation = item.catalog_equipment as
        { code?: unknown } | { code?: unknown }[] | null;
      const code = Array.isArray(relation) ? relation[0]?.code : relation?.code;
      return typeof code === "string" ? [code] : [];
    }),
    (restrictions ?? []).map((item) => ({
      payload_json: JSON.stringify(item.payload),
    })),
    (excludedExercises ?? []).flatMap((item) => {
      const relation = item.catalog_exercises as { code?: unknown } | { code?: unknown }[] | null;
      const code = Array.isArray(relation) ? relation[0]?.code : relation?.code;
      return typeof code === "string" ? [code] : [];
    }),
  );
}

async function saveRemoteProfile(profile: ACREAProfileState) {
  const client = getSupabaseClient();
  const { error } = await client.from("acrea_profiles").upsert({
    user_id: profile.id,
    name: profile.name,
    objective: profile.objective,
    objective_code: profile.objectiveCode,
    equipment_mode: profile.equipmentMode,
    weekly_frequency: profile.weeklyFrequency,
    average_session_minutes: averageSessionMinutes(profile),
    session_minutes_min: profile.sessionMinutesMin,
    session_minutes_max: profile.sessionMinutesMax,
    weekly_novelty_percent: profile.weeklyNoveltyPercent,
    level_test_status: profile.levelTestStatus,
    level_test_version: profile.levelTestVersion,
    level_test_completed_at: profile.levelTestCompletedAt,
    renforcement_level: profile.pillarLevels.strength,
    cardio_level: profile.pillarLevels.cardio,
    proprioception_level: profile.pillarLevels.proprioception,
    preferred_weekdays: profile.preferredWeekdays,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  await client
    .from("acrea_profile_equipment")
    .delete()
    .eq("user_id", profile.id);
  if (profile.availableEquipment.length > 0) {
    const { data: catalogEquipment, error: catalogEquipmentError } =
      await client
        .from("catalog_equipment")
        .select("id,code")
        .in("code", profile.availableEquipment);
    if (catalogEquipmentError) throw catalogEquipmentError;
    const equipmentIdByCode = new Map(
      (catalogEquipment ?? []).map((item) => [
        String(item.code),
        Number(item.id),
      ]),
    );
    const unknownEquipment = profile.availableEquipment.filter(
      (code) => !equipmentIdByCode.has(code),
    );
    if (unknownEquipment.length > 0) {
      throw new Error(
        `Équipement Supabase inconnu: ${unknownEquipment.join(", ")}`,
      );
    }
    const { error: equipmentError } = await client
      .from("acrea_profile_equipment")
      .insert(
        profile.availableEquipment.map((equipmentCode) => ({
          user_id: profile.id,
          equipment_id: equipmentIdByCode.get(equipmentCode),
        })),
      );
    if (equipmentError) throw equipmentError;
  }
  await client
    .from("acrea_profile_restrictions")
    .delete()
    .eq("user_id", profile.id);
  if (profile.restrictions.length > 0) {
    const { error: restrictionError } = await client
      .from("acrea_profile_restrictions")
      .insert(
        profile.restrictions.map((restriction) => ({
          user_id: profile.id,
          restriction_type: restriction.type,
          payload: restriction,
        })),
      );
    if (restrictionError) throw restrictionError;
  }
  await client.from("acrea_profile_excluded_exercises").delete().eq("user_id", profile.id);
  if (profile.excludedExerciseCodes.length > 0) {
    const { data: exercises, error: exercisesError } = await client
      .from("catalog_exercises")
      .select("id,code")
      .in("code", profile.excludedExerciseCodes);
    if (exercisesError) throw exercisesError;
    const idByCode = new Map((exercises ?? []).map((exercise) => [String(exercise.code), Number(exercise.id)]));
    const { error: exclusionsError } = await client
      .from("acrea_profile_excluded_exercises")
      .insert(profile.excludedExerciseCodes.map((code) => ({ user_id: profile.id, exercise_id: idByCode.get(code), reason: "manual" })));
    if (exclusionsError) throw exclusionsError;
  }
}

function profileFromRows(
  row: ProfileRow,
  availableEquipment: string[],
  restrictions: { payload_json: string }[],
  excludedExerciseCodes: string[],
): ACREAProfileState {
  return normalizeProfile({
    id: row.profile_id,
    name: row.name,
    objective: row.objective,
    objectiveCode: normalizeObjectiveCode(row.objective_code),
    equipmentMode: normalizeEquipmentMode(row.equipment_mode),
    weeklyFrequency: row.weekly_frequency,
    sessionMinutesMin: row.session_minutes_min,
    sessionMinutesMax: row.session_minutes_max,
    weeklyNoveltyPercent: row.weekly_novelty_percent,
    levelTestStatus: row.level_test_status,
    levelTestVersion: row.level_test_version,
    levelTestCompletedAt: row.level_test_completed_at,
    pillarLevels: {
      strength: clampLevel(row.renforcement_level),
      cardio: clampLevel(row.cardio_level),
      proprioception: clampLevel(row.proprioception_level),
    },
    availableEquipment,
    preferredWeekdays: parseNumberArray(row.preferred_weekdays_json),
    restrictions: restrictions.flatMap((item) =>
      parseRestriction(item.payload_json),
    ),
    excludedExerciseCodes,
  });
}

function clampLevel(value: number | null) {
  if (value === null) return null;
  return Math.max(
    1,
    Math.min(10, Math.round(value)),
  ) as NonNullable<ACREAProfileState["pillarLevels"]["cardio"]>;
}

function parseNumberArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => Number.isInteger(item))
      : [];
  } catch (error) {
    reportTechnicalDegradationOnce(
      "acrea-profile-preferred-weekdays",
      error,
    );
    return [];
  }
}

function parseRestriction(value: string): ACREAStructuredRestriction[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as Record<string, unknown>).type === "temporaryPain" &&
      "pillar" in parsed
    ) {
      return [
        {
          type: "temporaryPain",
          muscleGroupCodes: [
            "bras",
            "epaules",
            "dos",
            "jambes",
            "fessiers",
            "abdos",
            "pecs",
          ],
        },
      ];
    }
    return isStructuredRestriction(parsed) ? [parsed] : [];
  } catch (error) {
    reportTechnicalDegradationOnce("acrea-profile-restriction", error);
    return [];
  }
}

function isStructuredRestriction(
  value: unknown,
): value is ACREAStructuredRestriction {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const restriction = value as Record<string, unknown>;
  switch (restriction.type) {
    case "impactLimit":
      return (
        restriction.maximumImpact === "faible" ||
        restriction.maximumImpact === "modere" ||
        restriction.maximumImpact === "eleve"
      );
    case "exerciseExclusion":
      return (
        typeof restriction.exerciseCode === "string" &&
        restriction.exerciseCode.length > 0
      );
    case "pillarLimit":
      return (
        (restriction.pillar === "strength" ||
          restriction.pillar === "cardio" ||
          restriction.pillar === "proprioception") &&
        Number.isInteger(restriction.maximumLevel) &&
        Number(restriction.maximumLevel) >= 1 &&
        Number(restriction.maximumLevel) <= 10
      );
    case "equipmentExclusion":
      return (
        typeof restriction.equipmentCode === "string" &&
        restriction.equipmentCode.length > 0
      );
    case "temporaryPain":
      return (
        Array.isArray(restriction.muscleGroupCodes) &&
        restriction.muscleGroupCodes.length > 0 &&
        restriction.muscleGroupCodes.every((code) =>
          [
            "bras",
            "epaules",
            "dos",
            "jambes",
            "fessiers",
            "abdos",
            "pecs",
          ].includes(String(code)),
        )
      );
    default:
      return false;
  }
}

function normalizeObjectiveCode(
  value: string | null,
): ACREAProfileState["objectiveCode"] {
  if (value === null) return null;
  switch (value) {
    case "balance_mobility":
      return "proprioception";
    case "cardio":
      return "cardio";
    case "strength":
      return "strength";
    case "proprioception":
      return "proprioception";
    case "complete":
    case "general_fitness":
      return "complete";
    default:
      return null;
  }
}

function normalizeEquipmentMode(
  value: string | null,
): ACREAProfileState["equipmentMode"] {
  if (value === null) return null;
  if (value === "aucun") return "aucun";
  if (value === "mixte") return "mixte";
  return null;
}

function normalizeProfile(profile: ACREAProfileState): ACREAProfileState {
  return {
    ...profile,
    availableEquipment:
      profile.equipmentMode === null || profile.equipmentMode === "aucun"
        ? []
        : Array.from(new Set(profile.availableEquipment)),
    excludedExerciseCodes: Array.from(new Set(profile.excludedExerciseCodes)),
  };
}

function averageSessionMinutes(profile: ACREAProfileState) {
  if (
    profile.sessionMinutesMin === null ||
    profile.sessionMinutesMax === null
  ) {
    return null;
  }
  return Math.round(
    (profile.sessionMinutesMin + profile.sessionMinutesMax) / 2,
  );
}
