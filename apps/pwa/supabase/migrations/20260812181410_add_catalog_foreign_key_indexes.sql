-- Prevent sequential scans for the foreign-key joins identified by the
-- Supabase production performance advisor. These indexes are additive and
-- idempotent: they do not alter data, constraints, or row-level security.
create index if not exists acrea_exercise_progressions_exercise_id_idx
  on public.acrea_exercise_progressions (exercise_id);

create index if not exists acrea_level_evaluation_mappings_exercise_slug_idx
  on public.acrea_level_evaluation_exercise_mappings (exercise_slug);

create index if not exists acrea_level_evaluation_preferences_exercise_slug_idx
  on public.acrea_level_evaluation_preferences (exercise_slug);

create index if not exists acrea_profile_excluded_exercises_exercise_id_idx
  on public.acrea_profile_excluded_exercises (exercise_id);

create index if not exists catalog_exercises_progression_exercise_id_idx
  on public.catalog_exercises (progression_exercise_id);

create index if not exists catalog_exercises_regression_exercise_id_idx
  on public.catalog_exercises (regression_exercise_id);
