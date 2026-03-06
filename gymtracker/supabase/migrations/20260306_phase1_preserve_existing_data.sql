-- ============================================================
-- GymTracker — Phase 1 safe migration
-- Goal: fix multi-tenant constraints/RLS without losing existing data
-- Safe to run on an existing project with data already in production.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Backups before any cleanup
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.backup_workout_exercises_20260306') IS NULL THEN
    EXECUTE 'CREATE TABLE public.backup_workout_exercises_20260306 AS TABLE public.workout_exercises';
  END IF;

  IF to_regclass('public.backup_set_logs_20260306') IS NULL THEN
    EXECUTE 'CREATE TABLE public.backup_set_logs_20260306 AS TABLE public.set_logs';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Exercises: make tenancy-safe without deleting user data
-- ------------------------------------------------------------
ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_name_key;

DROP POLICY IF EXISTS "All authenticated users can view exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can view own exercises" ON public.exercises;

CREATE POLICY "Users can view own exercises"
  ON public.exercises FOR SELECT
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_name_unique
  ON public.exercises (user_id, lower(btrim(name)));

-- ------------------------------------------------------------
-- 2. workout_exercises: dedupe and protect against future duplicates
-- ------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    workout_id,
    exercise_id,
    ROW_NUMBER() OVER (
      PARTITION BY workout_id, exercise_id
      ORDER BY display_order ASC, id ASC
    ) AS rn,
    MAX(target_sets) OVER (
      PARTITION BY workout_id, exercise_id
    ) AS merged_target_sets,
    MIN(display_order) OVER (
      PARTITION BY workout_id, exercise_id
    ) AS merged_display_order
  FROM public.workout_exercises
),
keepers AS (
  UPDATE public.workout_exercises AS we
  SET
    target_sets = ranked.merged_target_sets,
    display_order = ranked.merged_display_order
  FROM ranked
  WHERE we.id = ranked.id
    AND ranked.rn = 1
  RETURNING we.id
)
DELETE FROM public.workout_exercises AS we
USING ranked
WHERE we.id = ranked.id
  AND ranked.rn > 1;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workout_id
      ORDER BY display_order ASC, id ASC
    ) - 1 AS next_display_order
  FROM public.workout_exercises
)
UPDATE public.workout_exercises AS we
SET display_order = ordered.next_display_order
FROM ordered
WHERE we.id = ordered.id
  AND we.display_order IS DISTINCT FROM ordered.next_display_order;

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_workout_id_exercise_id_key;

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_target_sets_check;

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_target_sets_check
  CHECK (target_sets BETWEEN 1 AND 20);

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_workout_id_exercise_id_key
  UNIQUE (workout_id, exercise_id);

-- ------------------------------------------------------------
-- 3. set_logs: dedupe and protect set identity inside a session
-- ------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, exercise_id, set_number
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.set_logs
)
DELETE FROM public.set_logs AS sl
USING ranked
WHERE sl.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE public.set_logs
  DROP CONSTRAINT IF EXISTS set_logs_session_id_exercise_id_set_number_key;

ALTER TABLE public.set_logs
  DROP CONSTRAINT IF EXISTS set_logs_weight_kg_check;

ALTER TABLE public.set_logs
  DROP CONSTRAINT IF EXISTS set_logs_reps_check;

ALTER TABLE public.set_logs
  DROP CONSTRAINT IF EXISTS set_logs_set_number_check;

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_weight_kg_check CHECK (weight_kg >= 0);

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_reps_check CHECK (reps > 0);

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_set_number_check CHECK (set_number > 0);

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_session_id_exercise_id_set_number_key
  UNIQUE (session_id, exercise_id, set_number);

-- ------------------------------------------------------------
-- 4. Indexes aligned with the new access patterns
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order
  ON public.workout_exercises(workout_id, display_order);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date
  ON public.workout_sessions(user_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_set_logs_session_exercise
  ON public.set_logs(session_id, exercise_id, set_number);

COMMIT;
