-- ============================================================
-- GymTracker — Reconcile remaining legacy system exercises
-- Migration: 20260408_reconcile_remaining_legacy_system_exercises.sql
--
-- Fixes a small set of legacy aliases that may remain with
-- `system_key IS NULL` after the main system catalog seed.
-- ============================================================

BEGIN;

CREATE TEMP TABLE tmp_remaining_system_aliases (
  legacy_name TEXT NOT NULL,
  legacy_modality TEXT,
  legacy_muscle_group TEXT NOT NULL,
  canonical_system_key TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  canonical_modality TEXT,
  canonical_muscle_group TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_remaining_system_aliases (
  legacy_name,
  legacy_modality,
  legacy_muscle_group,
  canonical_system_key,
  canonical_name,
  canonical_modality,
  canonical_muscle_group
)
VALUES
  ('Abdominal', 'Máquina', 'Abdominais', 'abdominal-supra-maquina', 'Abdominal Supra', 'Máquina', 'Abdominais'),
  ('Remada Cavalinho', 'Barra Livre', 'Costas', 'remada-cavalinho', 'Remada Cavalinho', 'Barra-Livre', 'Costas'),
  ('Pull Overhead', 'Halter', 'Peito', 'pull-overhead-halter', 'Pull Overhead', 'Halter', 'Peito'),
  ('Flexora Unilateral', 'Máquina', 'Pernas', 'cadeira-flexora-unilateral', 'Cadeira Flexora Unilateral', 'Máquina', 'Pernas'),
  ('Stiff', 'Barra', 'Pernas', 'stiff-barra-livre', 'Stiff', 'Barra-Livre', 'Pernas');

INSERT INTO public.exercises (
  system_key,
  user_id,
  name,
  is_system,
  modality,
  muscle_group,
  archived_at
)
SELECT
  alias.canonical_system_key,
  NULL,
  alias.canonical_name,
  TRUE,
  alias.canonical_modality,
  alias.canonical_muscle_group,
  NULL
FROM tmp_remaining_system_aliases AS alias
ON CONFLICT (system_key) DO UPDATE SET
  user_id = NULL,
  name = EXCLUDED.name,
  is_system = TRUE,
  modality = EXCLUDED.modality,
  muscle_group = EXCLUDED.muscle_group,
  archived_at = NULL;

CREATE TEMP TABLE tmp_remaining_alias_matches AS
SELECT
  legacy.id AS legacy_id,
  canonical.id AS canonical_id,
  alias.canonical_system_key,
  alias.canonical_name,
  alias.canonical_modality,
  alias.canonical_muscle_group
FROM tmp_remaining_system_aliases AS alias
JOIN public.exercises AS legacy
  ON legacy.is_system = TRUE
 AND legacy.user_id IS NULL
 AND legacy.system_key IS NULL
 AND lower(btrim(legacy.name)) = lower(btrim(alias.legacy_name))
 AND lower(btrim(COALESCE(legacy.modality, ''))) = lower(btrim(COALESCE(alias.legacy_modality, '')))
 AND lower(btrim(COALESCE(legacy.muscle_group, ''))) = lower(btrim(COALESCE(alias.legacy_muscle_group, '')))
JOIN public.exercises AS canonical
  ON canonical.system_key = alias.canonical_system_key
 AND canonical.is_system = TRUE;

UPDATE public.exercise_overrides AS override_row
SET exercise_id = match.canonical_id
FROM tmp_remaining_alias_matches AS match
WHERE override_row.exercise_id = match.legacy_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.exercise_overrides AS duplicate_override
    WHERE duplicate_override.user_id = override_row.user_id
      AND duplicate_override.exercise_id = match.canonical_id
  );

DELETE FROM public.exercise_overrides AS override_row
USING tmp_remaining_alias_matches AS match
WHERE override_row.exercise_id = match.legacy_id;

UPDATE public.workout_exercises AS workout_exercise
SET exercise_id = match.canonical_id
FROM tmp_remaining_alias_matches AS match
WHERE workout_exercise.exercise_id = match.legacy_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.workout_exercises AS duplicate_workout_exercise
    WHERE duplicate_workout_exercise.workout_id = workout_exercise.workout_id
      AND duplicate_workout_exercise.exercise_id = match.canonical_id
  );

DELETE FROM public.workout_exercises AS workout_exercise
USING tmp_remaining_alias_matches AS match
WHERE workout_exercise.exercise_id = match.legacy_id;

UPDATE public.set_logs AS set_log
SET exercise_id = match.canonical_id
FROM tmp_remaining_alias_matches AS match
WHERE set_log.exercise_id = match.legacy_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.set_logs AS duplicate_set_log
    WHERE duplicate_set_log.session_id = set_log.session_id
      AND duplicate_set_log.exercise_id = match.canonical_id
      AND duplicate_set_log.set_number = set_log.set_number
  );

DELETE FROM public.set_logs AS set_log
USING tmp_remaining_alias_matches AS match
WHERE set_log.exercise_id = match.legacy_id;

DELETE FROM public.exercises AS legacy
USING tmp_remaining_alias_matches AS match
WHERE legacy.id = match.legacy_id;

COMMIT;
