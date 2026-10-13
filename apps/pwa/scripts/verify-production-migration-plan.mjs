import fs from "node:fs";

const expectedProjectRef = "vnsisuhlaxxldpwjhgcm";

const allowedMigrations = [
  "20260719202256_remove_acrea_profile_defaults.sql",
  "20260811090000_bilingual_equipment_reference.sql",
  "20260811100000_exercise_library_v2.sql",
  "20260812083749_beta_catalog_release_v4.sql",
  "20260812105130_beta_catalog_v2_seed.sql",
  "20260812130351_beta_low_impact_fixed_phases.sql",
  "20260812131751_beta_low_impact_main_candidates.sql",
  "20260812132122_beta_low_impact_proprioception_candidate.sql",
  "20260812133824_beta_low_impact_proprioception_entry_candidate.sql",
  "20260812145000_beta_revoke_anon_v4_mapping_select.sql",
  "20260812181410_add_catalog_foreign_key_indexes.sql",
  "20260813074437_catalog_progressive_delivery.sql",
];

const validExpectedStates = ["pending", "empty", "pending-or-empty"];

const [planPath, expectedState = "pending"] = process.argv.slice(2);

if (!planPath || !validExpectedStates.includes(expectedState)) {
  throw new Error(
    "Usage: verify-production-migration-plan.mjs " +
      "<dry-run-output> [pending|empty|pending-or-empty]",
  );
}

if (process.env.SUPABASE_PROJECT_REF !== expectedProjectRef) {
  throw new Error(
    `Production project mismatch: expected ${expectedProjectRef}, ` +
      `received ${process.env.SUPABASE_PROJECT_REF ?? "<missing>"}.`,
  );
}

if (!fs.existsSync(planPath)) {
  throw new Error(`Production dry-run output not found: ${planPath}.`);
}

const output = fs.readFileSync(planPath, "utf8");

if (/--include-(?:all|seed)\b/i.test(output)) {
  throw new Error(
    "Production dry-run must not include --include-all or --include-seed.",
  );
}

const plannedMigrations = [
  ...output.matchAll(/[•*]\s+(\d{14}_[a-z0-9_]+\.sql)/gi),
].map((match) => match[1]);

const duplicateMigrations = plannedMigrations.filter(
  (migration, index) => plannedMigrations.indexOf(migration) !== index,
);

if (duplicateMigrations.length > 0) {
  throw new Error(
    `Duplicate production migration(s): ${[
      ...new Set(duplicateMigrations),
    ].join(", ")}.`,
  );
}

const unexpectedMigrations = plannedMigrations.filter(
  (migration) => !allowedMigrations.includes(migration),
);

if (unexpectedMigrations.length > 0) {
  throw new Error(
    `Unexpected production migration(s): ${unexpectedMigrations.join(", ")}. ` +
      "Update the protected allowlist after review.",
  );
}

const isEmptyPlan = plannedMigrations.length === 0;

const reportsPendingPlan = /Would push these migrations:/i.test(output);

const reportsDatabaseUpToDate =
  /Remote database is up to date\./i.test(output) ||
  /No migrations to push/i.test(output);

/*
 * Une relance peut intervenir après l'application de toutes les migrations
 * ou après l'application d'une partie de la liste.
 *
 * Le plan distant doit donc être :
 * - vide si toutes les migrations ont déjà été appliquées ;
 * - un suffixe ordonné de allowedMigrations si certaines restent à appliquer.
 *
 * Exemples autorisés :
 * - migration 1 + migration 2 ;
 * - migration 2 uniquement ;
 * - aucune migration.
 */
let isAllowedRemainingPlan = false;

if (isEmptyPlan) {
  isAllowedRemainingPlan = true;
} else {
  const firstPendingMigrationIndex = allowedMigrations.indexOf(
    plannedMigrations[0],
  );

  if (firstPendingMigrationIndex !== -1) {
    const expectedRemainingMigrations = allowedMigrations.slice(
      firstPendingMigrationIndex,
    );

    isAllowedRemainingPlan =
      plannedMigrations.join("\n") === expectedRemainingMigrations.join("\n");
  }
}

if (!isAllowedRemainingPlan) {
  throw new Error(
    `Invalid production migration order or incomplete plan. ` +
      `Allowed migration sequence: [${allowedMigrations.join(", ")}]. ` +
      `Received: [${plannedMigrations.join(", ")}].`,
  );
}

if (!isEmptyPlan && !reportsPendingPlan) {
  throw new Error(
    "The expected migrations were parsed, but the Supabase dry-run output " +
      'does not contain "Would push these migrations:".',
  );
}

if (isEmptyPlan && !reportsDatabaseUpToDate) {
  throw new Error(
    "The migration plan appears empty, but the Supabase dry-run output does " +
      "not explicitly confirm that the remote database is up to date.",
  );
}

switch (expectedState) {
  case "pending":
  case "pending-or-empty": {
    console.log(
      isEmptyPlan
        ? "Production database is already up to date; empty migration plan is valid."
        : `Production migration plan is valid: ${plannedMigrations.join(", ")}.`,
    );
    break;
  }

  case "empty": {
    if (!isEmptyPlan) {
      throw new Error(
        `Expected empty production plan, received ` +
          `[${plannedMigrations.join(", ")}].`,
      );
    }

    console.log("Production migration plan is empty and valid.");
    break;
  }

  default:
    throw new Error(`Unsupported expected state: ${expectedState}.`);
}
