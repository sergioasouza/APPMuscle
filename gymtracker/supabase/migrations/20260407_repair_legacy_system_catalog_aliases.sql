-- ============================================================
-- GymTracker — Repair legacy system exercises without system_key
-- Migration: 20260407_repair_legacy_system_catalog_aliases.sql
--
-- Normalizes legacy system exercises that were seeded before
-- `system_key` existed and collapses duplicates created during the
-- transition to the canonical system catalog.
-- ============================================================

BEGIN;

CREATE TEMP TABLE tmp_alias_matches_raw AS
SELECT
  legacy.id AS legacy_id,
  canonical.id AS canonical_id,
  canonical.system_key,
  canonical.name AS canonical_name,
  canonical.modality AS canonical_modality,
  canonical.muscle_group AS canonical_muscle_group
FROM public.exercises AS legacy
JOIN public.exercises AS canonical
  ON canonical.is_system = TRUE
 AND canonical.system_key IS NOT NULL
 AND legacy.id <> canonical.id
 AND lower(btrim(legacy.name)) = lower(btrim(canonical.name))
 AND lower(btrim(COALESCE(legacy.muscle_group, ''))) = lower(btrim(COALESCE(canonical.muscle_group, '')))
 AND (
   lower(btrim(COALESCE(legacy.modality, ''))) = lower(btrim(COALESCE(canonical.modality, '')))
   OR (
     lower(btrim(COALESCE(legacy.modality, ''))) IN ('cabo', 'polia')
     AND lower(btrim(COALESCE(canonical.modality, ''))) IN ('cabo', 'polia')
   )
 )
WHERE legacy.is_system = TRUE
  AND legacy.user_id IS NULL
  AND legacy.system_key IS NULL;

CREATE TEMP TABLE tmp_alias_matches AS
SELECT raw.*
FROM tmp_alias_matches_raw AS raw
JOIN (
  SELECT legacy_id
  FROM tmp_alias_matches_raw
  GROUP BY legacy_id
  HAVING COUNT(*) = 1
) AS unique_match
  ON unique_match.legacy_id = raw.legacy_id;

CREATE TEMP TABLE tmp_reference_counts AS
SELECT
  exercise.id AS exercise_id,
  (
    COALESCE(workout_refs.count_refs, 0)
    + COALESCE(set_refs.count_refs, 0)
    + COALESCE(override_refs.count_refs, 0)
  ) AS ref_count,
  exercise.created_at
FROM public.exercises AS exercise
LEFT JOIN (
  SELECT exercise_id, COUNT(*) AS count_refs
  FROM public.workout_exercises
  GROUP BY exercise_id
) AS workout_refs
  ON workout_refs.exercise_id = exercise.id
LEFT JOIN (
  SELECT exercise_id, COUNT(*) AS count_refs
  FROM public.set_logs
  GROUP BY exercise_id
) AS set_refs
  ON set_refs.exercise_id = exercise.id
LEFT JOIN (
  SELECT exercise_id, COUNT(*) AS count_refs
  FROM public.exercise_overrides
  GROUP BY exercise_id
) AS override_refs
  ON override_refs.exercise_id = exercise.id
WHERE exercise.id IN (
  SELECT legacy_id
  FROM tmp_alias_matches
);

CREATE TEMP TABLE tmp_merge_plan AS
WITH ranked AS (
  SELECT
    match.canonical_id,
    match.legacy_id,
    match.system_key,
    match.canonical_name,
    match.canonical_modality,
    match.canonical_muscle_group,
    COALESCE(refs.ref_count, 0) AS ref_count,
    refs.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY match.canonical_id
      ORDER BY COALESCE(refs.ref_count, 0) DESC, refs.created_at ASC, match.legacy_id
    ) AS row_number
  FROM tmp_alias_matches AS match
  LEFT JOIN tmp_reference_counts AS refs
    ON refs.exercise_id = match.legacy_id
)
SELECT
  canonical_id,
  legacy_id AS target_id,
  system_key,
  canonical_name,
  canonical_modality,
  canonical_muscle_group
FROM ranked
WHERE row_number = 1;

CREATE TEMP TABLE tmp_merge_sources AS
SELECT
  plan.target_id,
  plan.system_key,
  plan.canonical_name,
  plan.canonical_modality,
  plan.canonical_muscle_group,
  plan.canonical_id AS source_id
FROM tmp_merge_plan AS plan
UNION ALL
SELECT
  plan.target_id,
  plan.system_key,
  plan.canonical_name,
  plan.canonical_modality,
  plan.canonical_muscle_group,
  match.legacy_id AS source_id
FROM tmp_merge_plan AS plan
JOIN tmp_alias_matches AS match
  ON match.canonical_id = plan.canonical_id
WHERE match.legacy_id <> plan.target_id;

UPDATE public.exercise_overrides AS override_row
SET exercise_id = source.target_id
FROM tmp_merge_sources AS source
WHERE override_row.exercise_id = source.source_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.exercise_overrides AS duplicate_override
    WHERE duplicate_override.user_id = override_row.user_id
      AND duplicate_override.exercise_id = source.target_id
  );

DELETE FROM public.exercise_overrides AS override_row
USING tmp_merge_sources AS source
WHERE override_row.exercise_id = source.source_id;

UPDATE public.workout_exercises AS workout_exercise
SET exercise_id = source.target_id
FROM tmp_merge_sources AS source
WHERE workout_exercise.exercise_id = source.source_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.workout_exercises AS duplicate_workout_exercise
    WHERE duplicate_workout_exercise.workout_id = workout_exercise.workout_id
      AND duplicate_workout_exercise.exercise_id = source.target_id
  );

DELETE FROM public.workout_exercises AS workout_exercise
USING tmp_merge_sources AS source
WHERE workout_exercise.exercise_id = source.source_id;

UPDATE public.set_logs AS set_log
SET exercise_id = source.target_id
FROM tmp_merge_sources AS source
WHERE set_log.exercise_id = source.source_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.set_logs AS duplicate_set_log
    WHERE duplicate_set_log.session_id = set_log.session_id
      AND duplicate_set_log.exercise_id = source.target_id
      AND duplicate_set_log.set_number = set_log.set_number
  );

DELETE FROM public.set_logs AS set_log
USING tmp_merge_sources AS source
WHERE set_log.exercise_id = source.source_id;

DELETE FROM public.exercises AS exercise
USING tmp_merge_sources AS source
WHERE exercise.id = source.source_id;

UPDATE public.exercises AS exercise
SET
  system_key = plan.system_key,
  user_id = NULL,
  name = plan.canonical_name,
  is_system = TRUE,
  modality = plan.canonical_modality,
  muscle_group = plan.canonical_muscle_group,
  archived_at = NULL
FROM tmp_merge_plan AS plan
WHERE exercise.id = plan.target_id;

COMMIT;
