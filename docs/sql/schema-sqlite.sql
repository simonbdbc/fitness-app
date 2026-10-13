-- ACREA Fitness - schema SQLite documente.
-- ATTENTION 2026-08-11: schema historique, incomplet pour releases/medias/V4.
-- Ne pas utiliser pour reparer V32. Regeneration suivie par FIT-170.
-- Etat BDD local courant: briques formats + socle catalogue metier.
-- RLS, grants et policies sont propres a PSQL et ne s'appliquent pas a SQLite.
-- Les roles et user_profiles Supabase restent distants ; le profil ACREA metier est disponible offline.

PRAGMA foreign_keys = ON;

CREATE TABLE catalog_pillars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('warm-up', 'cardio', 'strength', 'proprioception', 'flexibility')),
  label TEXT NOT NULL
);

CREATE TABLE catalog_impacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('faible', 'modere', 'eleve')),
  label TEXT NOT NULL
);

CREATE TABLE catalog_families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('corps-entier', 'haut-du-corps', 'bas-du-corps')),
  label TEXT NOT NULL
);

CREATE TABLE catalog_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('echauffement', 'cardio', 'gainage', 'force', 'endurance', 'proprioception', 'assouplissement')),
  label TEXT NOT NULL
);

CREATE TABLE catalog_muscle_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('bras', 'epaules', 'dos', 'jambes', 'fessiers', 'abdos', 'pecs')),
  label TEXT NOT NULL
);

CREATE TABLE catalog_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('maison', 'sport'))
);

CREATE TABLE catalog_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  pillar_id INTEGER NOT NULL REFERENCES catalog_pillars(id) ON DELETE RESTRICT,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  impact_id INTEGER NOT NULL REFERENCES catalog_impacts(id) ON DELETE RESTRICT,
  family_id INTEGER NOT NULL REFERENCES catalog_families(id) ON DELETE RESTRICT,
  type_id INTEGER NOT NULL REFERENCES catalog_types(id) ON DELETE RESTRICT,
  equipment_id INTEGER REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
  regression_exercise_id INTEGER REFERENCES catalog_exercises(id) ON DELETE SET NULL,
  progression_exercise_id INTEGER REFERENCES catalog_exercises(id) ON DELETE SET NULL,
  movement_description TEXT NOT NULL DEFAULT '',
  start_position TEXT NOT NULL DEFAULT '',
  outbound_execution TEXT NOT NULL DEFAULT '',
  return_execution TEXT NOT NULL DEFAULT '',
  adapted_version TEXT NOT NULL DEFAULT '',
  tips TEXT NOT NULL DEFAULT '',
  errors TEXT NOT NULL DEFAULT ''
);
CREATE TABLE catalog_exercise_equipment_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bodyweight', 'equipment')),
  UNIQUE (exercise_id, option_index)
);
CREATE TABLE catalog_exercise_equipment_option_items (
  option_id INTEGER NOT NULL REFERENCES catalog_exercise_equipment_options(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
  PRIMARY KEY (option_id, equipment_id)
);

CREATE TABLE catalog_exercise_muscle_groups (
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
  muscle_group_id INTEGER NOT NULL REFERENCES catalog_muscle_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, muscle_group_id)
);

CREATE TABLE catalog_rests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL CHECK (rest_seconds >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE catalog_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  series INTEGER NOT NULL CHECK (series > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE catalog_repetitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  reps INTEGER CHECK (reps IS NULL OR reps > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE catalog_intervals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  effort_seconds INTEGER NOT NULL CHECK (effort_seconds > 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE catalog_formats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  format_type TEXT NOT NULL CHECK (format_type IN ('repetitions', 'intervalles')),
  series_id INTEGER NOT NULL REFERENCES catalog_series(id) ON DELETE RESTRICT,
  repetitions_id INTEGER REFERENCES catalog_repetitions(id) ON DELETE RESTRICT,
  rest_id INTEGER NOT NULL REFERENCES catalog_rests(id) ON DELETE RESTRICT,
  interval_id INTEGER REFERENCES catalog_intervals(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_status TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (format_type = 'repetitions' AND repetitions_id IS NOT NULL AND interval_id IS NULL)
    OR
    (format_type = 'intervalles' AND interval_id IS NOT NULL AND repetitions_id IS NULL)
  )
);

CREATE TABLE catalog_session_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
  phase TEXT NOT NULL DEFAULT 'main' CHECK (phase IN ('warmup', 'main', 'cooldown')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  source_status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE catalog_session_template_levels (
  session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_template_id, level)
);

CREATE TABLE acrea_profiles (
  profile_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  objective_code TEXT CHECK (objective_code IN ('complete', 'strength', 'cardio', 'proprioception')),
  equipment_mode TEXT CHECK (equipment_mode IN ('aucun', 'mixte')),
  weekly_frequency INTEGER CHECK (weekly_frequency BETWEEN 1 AND 7),
  average_session_minutes INTEGER CHECK (average_session_minutes BETWEEN 1 AND 180),
  session_minutes_min INTEGER CHECK (session_minutes_min BETWEEN 20 AND 175 AND session_minutes_min % 5 = 0),
  session_minutes_max INTEGER CHECK (session_minutes_max BETWEEN 25 AND 180 AND session_minutes_max % 5 = 0 AND session_minutes_max >= session_minutes_min + 5),
  weekly_novelty_percent INTEGER CHECK (weekly_novelty_percent BETWEEN 0 AND 100 AND weekly_novelty_percent % 10 = 0),
  level_test_status TEXT NOT NULL DEFAULT 'required' CHECK (level_test_status IN ('required', 'completed', 'retest')),
  level_test_version INTEGER NOT NULL DEFAULT 0 CHECK (level_test_version >= 0),
  level_test_completed_at TEXT,
  renforcement_level INTEGER CHECK (renforcement_level BETWEEN 1 AND 10),
  cardio_level INTEGER CHECK (cardio_level BETWEEN 1 AND 10),
  proprioception_level INTEGER CHECK (proprioception_level BETWEEN 1 AND 10),
  preferred_weekdays_json TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE acrea_profile_equipment (
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES catalog_equipment(id) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id, equipment_id)
);

CREATE TABLE acrea_profile_equipment_pending (
  profile_id TEXT NOT NULL,
  equipment_code TEXT NOT NULL,
  archived_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, equipment_code)
);

CREATE TABLE acrea_profile_restrictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('impactLimit', 'exerciseExclusion', 'pillarLimit', 'equipmentExclusion', 'temporaryPain')),
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  iso_week_year INTEGER NOT NULL CHECK (iso_week_year BETWEEN 2000 AND 9999),
  iso_week_number INTEGER NOT NULL CHECK (iso_week_number BETWEEN 1 AND 53),
  role TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 3 CHECK (schema_version = 3),
  catalog_version TEXT NOT NULL,
  validation_focus TEXT NOT NULL DEFAULT '',
  profile_fingerprint TEXT,
  profile_effective_from TEXT,
  level_evaluation_version INTEGER NOT NULL DEFAULT 0 CHECK (level_evaluation_version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (profile_id, iso_week_year, iso_week_number)
);

CREATE TABLE trainings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  day_label TEXT NOT NULL,
  title TEXT NOT NULL,
  dominant_pillar TEXT NOT NULL CHECK (dominant_pillar IN ('strength', 'cardio', 'proprioception')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL CHECK (status IN ('a faire', 'terminee', 'reportee')),
  scheduled_date TEXT NOT NULL,
  generation_profile_fingerprint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (program_id, code)
);

CREATE TABLE seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  training_id INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
  pillar TEXT CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (training_id, code),
  CHECK ((phase = 'main' AND pillar IS NOT NULL) OR (phase <> 'main' AND pillar IS NULL))
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE RESTRICT,
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
  exercise_code TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  format_id INTEGER NOT NULL REFERENCES catalog_formats(id) ON DELETE RESTRICT,
  format_code TEXT NOT NULL,
  format_label TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('warmup', 'main', 'cooldown')),
  prescription_json TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  easier_json TEXT NOT NULL,
  harder_json TEXT NOT NULL,
  safety_rule TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (seance_id, code)
);

CREATE TABLE session_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL UNIQUE,
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  training_id INTEGER REFERENCES trainings(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  session_template_id INTEGER NOT NULL REFERENCES catalog_session_templates(id) ON DELETE RESTRICT,
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE RESTRICT,
  exercise_code TEXT NOT NULL,
  format_id INTEGER NOT NULL REFERENCES catalog_formats(id) ON DELETE RESTRICT,
  training_code TEXT NOT NULL,
  seance_code TEXT NOT NULL,
  seance_index INTEGER NOT NULL,
  seance_title TEXT NOT NULL,
  session_code TEXT NOT NULL,
  session_index INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  format_code TEXT,
  format_label TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 10),
  pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
  performed_at TEXT NOT NULL,
  timer_plan_code TEXT,
  total_seconds INTEGER NOT NULL,
  completed_seconds INTEGER NOT NULL,
  phase_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'stopped')),
  effort_rating INTEGER,
  quality_rating INTEGER,
  appreciation_rating INTEGER CHECK (appreciation_rating BETWEEN 1 AND 5),
  session_phase TEXT NOT NULL DEFAULT 'main' CHECK (session_phase IN ('warmup', 'main', 'cooldown')),
  executed_prescription_json TEXT,
  pain_level TEXT NOT NULL CHECK (pain_level IN ('none', 'mild', 'pain')),
  progression_decision TEXT NOT NULL CHECK (progression_decision IN ('regress', 'maintain', 'progress')),
  progression_preference TEXT NOT NULL CHECK (progression_preference IN ('easier', 'same', 'harder')),
  notes TEXT NOT NULL DEFAULT '' -- historique v2, non écrit par les nouveaux feedbacks
);

CREATE TABLE acrea_level_test_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  remote_attempt_id INTEGER,
  protocol_version INTEGER NOT NULL CHECK (protocol_version > 0),
  attempt_kind TEXT NOT NULL CHECK (attempt_kind IN ('initial', 'retest')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  superseded_at TEXT
);

CREATE TABLE acrea_level_test_stage_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES acrea_level_test_attempts(id) ON DELETE CASCADE,
  exercise_code TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
  exercise_order INTEGER NOT NULL CHECK (exercise_order BETWEEN 1 AND 6),
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 3),
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  target_series INTEGER,
  target_repetitions INTEGER,
  maximum_repetitions INTEGER,
  technical_valid INTEGER NOT NULL CHECK (technical_valid IN (0, 1)),
  attempted_at TEXT NOT NULL,
  UNIQUE (attempt_id, exercise_code, stage, attempt_number)
);

-- Protocole historique v1 conservé ci-dessus en lecture seule.
CREATE TABLE acrea_level_evaluation_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  remote_attempt_id INTEGER,
  protocol_version INTEGER NOT NULL CHECK (protocol_version >= 2),
  attempt_kind TEXT NOT NULL CHECK (attempt_kind IN ('initial', 'retest')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  superseded_at TEXT
);

CREATE TABLE acrea_level_evaluation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES acrea_level_evaluation_attempts(id) ON DELETE CASCADE,
  remote_session_id INTEGER,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 3),
  run_number INTEGER NOT NULL CHECK (run_number > 0),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'passed', 'failed')),
  active_step_index INTEGER NOT NULL DEFAULT 0 CHECK (active_step_index BETWEEN 0 AND 12),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (attempt_id, phase, run_number)
);

CREATE TABLE acrea_level_evaluation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_session_id INTEGER NOT NULL REFERENCES acrea_level_evaluation_sessions(id) ON DELETE CASCADE,
  exercise_code TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('strength', 'cardio', 'proprioception')),
  exercise_order INTEGER NOT NULL CHECK (exercise_order BETWEEN 1 AND 6),
  target_series INTEGER NOT NULL CHECK (target_series > 0),
  target_repetitions INTEGER,
  maximum_repetitions INTEGER,
  technical_valid INTEGER NOT NULL CHECK (technical_valid IN (0, 1)),
  appreciation_rating INTEGER NOT NULL CHECK (appreciation_rating BETWEEN 1 AND 5),
  prescription_json TEXT NOT NULL,
  timer_plan_code TEXT NOT NULL,
  total_seconds INTEGER NOT NULL CHECK (total_seconds >= 0),
  completed_seconds INTEGER NOT NULL CHECK (completed_seconds >= 0),
  attempted_at TEXT NOT NULL,
  UNIQUE (evaluation_session_id, exercise_code)
);

CREATE TABLE acrea_level_evaluation_preferences (
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  protocol_version INTEGER NOT NULL CHECK (protocol_version >= 3),
  evaluation_exercise_code TEXT NOT NULL,
  exercise_slug TEXT NOT NULL REFERENCES catalog_exercises(code) ON DELETE RESTRICT,
  appreciation_average REAL NOT NULL CHECK (appreciation_average BETWEEN 1 AND 5),
  sample_count INTEGER NOT NULL CHECK (sample_count > 0),
  evaluated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  PRIMARY KEY (profile_id, protocol_version, exercise_slug)
);

CREATE TABLE acrea_exercise_progressions (
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
  prescription_json TEXT NOT NULL,
  reached_maximum INTEGER NOT NULL DEFAULT 0 CHECK (reached_maximum IN (0, 1)),
  pending_direction TEXT CHECK (pending_direction IN ('easier', 'harder')),
  last_progression_at TEXT,
  level_evaluation_version INTEGER NOT NULL DEFAULT 0 CHECK (level_evaluation_version >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, exercise_id)
);

CREATE TABLE acrea_profile_excluded_exercises (
  profile_id TEXT NOT NULL REFERENCES acrea_profiles(profile_id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('appreciation', 'manual')),
  excluded_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, exercise_id)
);

create index catalog_exercises_pillar_difficulty_idx on catalog_exercises (pillar_id, difficulty, label);
create index catalog_exercises_impact_idx on catalog_exercises (impact_id, label);
create index catalog_exercises_family_idx on catalog_exercises (family_id, label);
create index catalog_exercises_type_idx on catalog_exercises (type_id, label);
create index catalog_exercises_equipment_idx on catalog_exercises (equipment_id, label);
create index catalog_exercise_muscle_groups_group_idx on catalog_exercise_muscle_groups (muscle_group_id);
create index catalog_exercise_equipment_options_exercise_idx on catalog_exercise_equipment_options (exercise_id, option_index);
create index catalog_exercise_equipment_option_items_equipment_idx on catalog_exercise_equipment_option_items (equipment_id, option_id);
create unique index catalog_series_series_unique on catalog_series (series);
create unique index catalog_rests_seconds_unique on catalog_rests (rest_seconds);
create unique index catalog_repetitions_reps_unique on catalog_repetitions (reps) where reps is not null;
create unique index catalog_repetitions_maximum_unique on catalog_repetitions ((1)) where reps is null;
create unique index catalog_intervals_seconds_unique on catalog_intervals (effort_seconds);
create unique index catalog_formats_shape_unique on catalog_formats (format_type, series_id, repetitions_id, interval_id, rest_id);
create index catalog_formats_type_idx on catalog_formats (format_type, label);
create index catalog_formats_series_idx on catalog_formats (series_id);
create index catalog_formats_repetitions_idx on catalog_formats (repetitions_id);
create index catalog_formats_intervals_idx on catalog_formats (interval_id);
create index catalog_formats_rests_idx on catalog_formats (rest_id);
create index catalog_session_templates_exercise_idx on catalog_session_templates (exercise_id, is_active, title);
create index catalog_session_template_levels_level_idx on catalog_session_template_levels (level, session_template_id);
create unique index programs_profile_iso_week_unique on programs (profile_id, iso_week_year, iso_week_number);
create index trainings_program_sort_idx on trainings (program_id, sort_order, code);
create index seances_training_sort_idx on seances (training_id, sort_order, code);
create index sessions_seance_sort_idx on sessions (seance_id, sort_order, code);
create unique index session_feedback_execution_unique on session_feedback (execution_id);
create index session_feedback_profile_session_idx on session_feedback (profile_id, training_code, seance_code, session_code, performed_at);
create index acrea_level_test_attempts_profile_idx on acrea_level_test_attempts (profile_id, status, started_at desc);
create index acrea_level_test_stage_results_attempt_idx on acrea_level_test_stage_results (attempt_id, exercise_order, stage, attempt_number desc);
create index acrea_level_evaluation_attempts_profile_idx on acrea_level_evaluation_attempts (profile_id, status, started_at desc);
create index acrea_level_evaluation_sessions_attempt_idx on acrea_level_evaluation_sessions (attempt_id, phase, run_number desc);
create index acrea_level_evaluation_results_session_idx on acrea_level_evaluation_results (evaluation_session_id, exercise_order);
create index acrea_level_evaluation_preferences_profile_idx on acrea_level_evaluation_preferences (profile_id, protocol_version, evaluated_at desc);
create index acrea_exercise_progressions_profile_idx on acrea_exercise_progressions (profile_id, updated_at desc);
