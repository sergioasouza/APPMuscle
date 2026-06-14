-- ============================================================
-- GymTracker - consolidated historical migration baseline
--
-- This file consolidates the historical migrations up to 20260419.
-- Use it only as a baseline/history file. For the current production
-- database that already has the previous migrations applied, run only
-- 20260612_add_set_prescriptions_and_segmented_logs.sql.
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260306_phase1_preserve_existing_data.sql
-- ============================================================

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


-- ============================================================
-- END consolidated source: 20260306_phase1_preserve_existing_data.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260307_fix_missing_profiles_and_auth_trigger.sql
-- ============================================================

-- ============================================================
-- GymTracker — Fix missing profiles and keep auth trigger healthy
-- Run in Supabase SQL Editor on production before go-live
-- ============================================================

-- 1) Backfill profiles for auth users that do not have one yet
INSERT INTO public.profiles (id, display_name)
SELECT
    au.id,
    COALESCE(NULLIF(au.raw_user_meta_data->>'display_name', ''), split_part(au.email, '@', 1), 'User')
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 2) Ensure authenticated users can create their own profile if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'profiles'
          AND policyname = 'Users can insert own profile'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)';
    END IF;
END
$$;

-- 3) Recreate signup trigger function as idempotent (on conflict do nothing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'User')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- END consolidated source: 20260307_fix_missing_profiles_and_auth_trigger.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260315_add_archived_at_to_exercises.sql
-- ============================================================

-- ============================================================
-- GymTracker — Add archive support to exercises
-- Migration: 20260315_add_archived_at_to_exercises.sql
--
-- Adds archived_at TIMESTAMPTZ to exercises so that exercises
-- with training history can be hidden from the UI (archived)
-- instead of hard-deleted (which would be blocked by FK
-- constraints from set_logs and workout_exercises).
--
-- After this migration:
--   - archived_at IS NULL  → exercise is active (visible in UI)
--   - archived_at IS NOT NULL → exercise is archived (hidden)
--
-- The application filters active exercises with:
--   WHERE archived_at IS NULL
-- ============================================================

BEGIN;

-- 1. Add the column (nullable — existing rows default to active)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index for fast listing of active exercises per user.
--    Only indexes rows where archived_at IS NULL, keeping the
--    index small even as archived rows accumulate over time.
CREATE INDEX IF NOT EXISTS idx_exercises_active_user
  ON public.exercises (user_id)
  WHERE archived_at IS NULL;

-- 3. Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'exercises'
      AND column_name  = 'archived_at'
  ) THEN
    RAISE EXCEPTION 'Column archived_at was not added to exercises — migration failed.';
  ELSE
    RAISE NOTICE 'exercises.archived_at added successfully.';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- END consolidated source: 20260315_add_archived_at_to_exercises.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260315_unique_session_per_day.sql
-- ============================================================

-- ============================================================
-- GymTracker — Unique constraint on workout_sessions
-- Migration: 20260315_unique_session_per_day.sql
--
-- Prevents duplicate (user_id, workout_id, performed_at) rows
-- in workout_sessions, which can occur in race conditions when
-- two requests try to create the same session simultaneously.
--
-- The application already guards against duplicates at the
-- query level; this constraint adds DB-level protection.
--
-- Safe to run on existing data — deduplication was handled
-- in Phase 1 (20260306_phase1_preserve_existing_data.sql).
-- ============================================================

BEGIN;

-- 1. Sanity check: report any existing duplicates before adding
--    the constraint (should be 0 after Phase 1 dedup).
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*)
  INTO dup_count
  FROM (
    SELECT user_id, workout_id, performed_at
    FROM public.workout_sessions
    GROUP BY user_id, workout_id, performed_at
    HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Found % duplicate (user_id, workout_id, performed_at) rows. '
      'Deduplicate them before running this migration.',
      dup_count;
  ELSE
    RAISE NOTICE 'No duplicate sessions found. Safe to add constraint.';
  END IF;
END $$;

-- 2. Add the unique constraint
ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_user_workout_date_key
  UNIQUE (user_id, workout_id, performed_at);

-- 3. Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname     = 'workout_sessions_user_workout_date_key'
      AND conrelid    = 'public.workout_sessions'::regclass
  ) THEN
    RAISE EXCEPTION 'Constraint workout_sessions_user_workout_date_key was not created.';
  ELSE
    RAISE NOTICE 'Constraint added successfully.';
  END IF;
END $$;

COMMIT;


-- ============================================================
-- END consolidated source: 20260315_unique_session_per_day.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260402_add_body_metrics_and_schedule_rotations.sql
-- ============================================================

-- ============================================================
-- GymTracker — Body metrics + weekly workout rotations
-- Migration: 20260402_add_body_metrics_and_schedule_rotations.sql
--
-- Adds:
--   1. profiles.rotation_anchor_date
--   2. schedule_rotations (weekly variants beyond the base schedule)
--   3. body_measurements (date-based body progress check-ins)
--
-- Design notes:
--   - The existing public.schedule table remains the base rotation
--     (rotation 1) for backward compatibility.
--   - Extra weekly variants live in public.schedule_rotations with
--     rotation_index >= 2.
--   - Body metrics are stored as one check-in row per date and user.
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rotation_anchor_date DATE;

CREATE TABLE IF NOT EXISTS public.schedule_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  rotation_index INT NOT NULL CHECK (rotation_index BETWEEN 2 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_rotations_user_day_rotation_key UNIQUE (user_id, day_of_week, rotation_index)
);

ALTER TABLE public.schedule_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule rotations"
  ON public.schedule_rotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule rotations"
  ON public.schedule_rotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule rotations"
  ON public.schedule_rotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule rotations"
  ON public.schedule_rotations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_rotations_user_day
  ON public.schedule_rotations (user_id, day_of_week, rotation_index);

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL,
  height_cm DECIMAL(5,1) CHECK (height_cm IS NULL OR height_cm BETWEEN 50 AND 300),
  weight_kg DECIMAL(5,1) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 20 AND 500),
  body_fat_pct DECIMAL(4,1) CHECK (body_fat_pct IS NULL OR body_fat_pct BETWEEN 1 AND 80),
  chest_cm DECIMAL(5,1) CHECK (chest_cm IS NULL OR chest_cm BETWEEN 10 AND 300),
  waist_cm DECIMAL(5,1) CHECK (waist_cm IS NULL OR waist_cm BETWEEN 10 AND 300),
  hips_cm DECIMAL(5,1) CHECK (hips_cm IS NULL OR hips_cm BETWEEN 10 AND 300),
  left_arm_cm DECIMAL(5,1) CHECK (left_arm_cm IS NULL OR left_arm_cm BETWEEN 5 AND 150),
  right_arm_cm DECIMAL(5,1) CHECK (right_arm_cm IS NULL OR right_arm_cm BETWEEN 5 AND 150),
  left_thigh_cm DECIMAL(5,1) CHECK (left_thigh_cm IS NULL OR left_thigh_cm BETWEEN 10 AND 200),
  right_thigh_cm DECIMAL(5,1) CHECK (right_thigh_cm IS NULL OR right_thigh_cm BETWEEN 10 AND 200),
  left_calf_cm DECIMAL(5,1) CHECK (left_calf_cm IS NULL OR left_calf_cm BETWEEN 10 AND 120),
  right_calf_cm DECIMAL(5,1) CHECK (right_calf_cm IS NULL OR right_calf_cm BETWEEN 10 AND 120),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT body_measurements_user_date_key UNIQUE (user_id, measured_at)
);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own body measurements"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own body measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own body measurements"
  ON public.body_measurements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own body measurements"
  ON public.body_measurements FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date
  ON public.body_measurements (user_id, measured_at DESC);

COMMIT;


-- ============================================================
-- END consolidated source: 20260402_add_body_metrics_and_schedule_rotations.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260405_add_system_exercises_and_overrides.sql
-- ============================================================

-- ============================================================
-- GymTracker — System exercise catalog + per-user overrides
-- Migration: 20260405_add_system_exercises_and_overrides.sql
--
-- Adds:
--   1. public.exercises support for global system exercises
--   2. public.exercise_overrides for local-only personalization
--   3. RLS updates so every account can read the base catalog
-- ============================================================

BEGIN;

ALTER TABLE public.exercises
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS system_key TEXT,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS modality TEXT,
  ADD COLUMN IF NOT EXISTS muscle_group TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'exercises_system_key_key'
  ) THEN
    ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_system_key_key UNIQUE (system_key);
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_exercises_user_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercises_user_name_modality_unique
  ON public.exercises (
    user_id,
    lower(btrim(name)),
    lower(btrim(COALESCE(modality, '')))
  )
  WHERE user_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_exercises_active_user;

CREATE INDEX IF NOT EXISTS idx_exercises_active_user
  ON public.exercises (user_id, lower(btrim(name)))
  WHERE user_id IS NOT NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exercises_system_catalog
  ON public.exercises (lower(btrim(name)), lower(btrim(COALESCE(modality, ''))))
  WHERE is_system = TRUE;

DROP POLICY IF EXISTS "Users can view own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can insert own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Users can delete own exercises" ON public.exercises;

CREATE POLICY "Users can view accessible exercises"
  ON public.exercises FOR SELECT
  USING (auth.uid() = user_id OR is_system = TRUE);

CREATE POLICY "Users can insert own custom exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(is_system, FALSE) = FALSE
    AND system_key IS NULL
  );

CREATE POLICY "Users can update own custom exercises"
  ON public.exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(is_system, FALSE) = FALSE
    AND system_key IS NULL
  );

CREATE POLICY "Users can delete own custom exercises"
  ON public.exercises FOR DELETE
  USING (auth.uid() = user_id AND COALESCE(is_system, FALSE) = FALSE);

CREATE TABLE IF NOT EXISTS public.exercise_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  custom_name TEXT,
  custom_modality TEXT,
  custom_muscle_group TEXT,
  archived_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exercise_overrides_user_exercise_key UNIQUE (user_id, exercise_id)
);

ALTER TABLE public.exercise_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exercise overrides" ON public.exercise_overrides;
DROP POLICY IF EXISTS "Users can insert own exercise overrides" ON public.exercise_overrides;
DROP POLICY IF EXISTS "Users can update own exercise overrides" ON public.exercise_overrides;
DROP POLICY IF EXISTS "Users can delete own exercise overrides" ON public.exercise_overrides;

CREATE POLICY "Users can view own exercise overrides"
  ON public.exercise_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise overrides"
  ON public.exercise_overrides FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.exercises
      WHERE id = exercise_id
        AND is_system = TRUE
    )
  );

CREATE POLICY "Users can update own exercise overrides"
  ON public.exercise_overrides FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.exercises
      WHERE id = exercise_id
        AND is_system = TRUE
    )
  );

CREATE POLICY "Users can delete own exercise overrides"
  ON public.exercise_overrides FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exercise_overrides_user
  ON public.exercise_overrides (user_id, exercise_id);

CREATE INDEX IF NOT EXISTS idx_exercise_overrides_visible
  ON public.exercise_overrides (user_id, hidden_at, archived_at);

COMMIT;


-- ============================================================
-- END consolidated source: 20260405_add_system_exercises_and_overrides.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260406_seed_system_exercises_catalog.sql
-- ============================================================

-- ============================================================
-- GymTracker — Seed normalized system exercise catalog
-- Migration: 20260406_seed_system_exercises_catalog.sql
--
-- Seeds the global catalog consumed by every account.
-- Safe to re-run: system rows are matched by system_key.
-- ============================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_exercises_system_name_modality_unique;

CREATE TEMP TABLE tmp_system_exercise_seed (
  system_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modality TEXT,
  muscle_group TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_system_exercise_seed (system_key, name, modality, muscle_group)
VALUES
    -- Peito
    ('supino-reto-barra-livre', 'Supino Reto', 'Barra-Livre', 'Peito'),
    ('supino-reto-halter', 'Supino Reto', 'Halter', 'Peito'),
    ('supino-reto-maquina', 'Supino Reto', 'Máquina', 'Peito'),
    ('supino-reto-smith', 'Supino Reto', 'Smith', 'Peito'),
    ('supino-inclinado-barra-livre', 'Supino Inclinado', 'Barra-Livre', 'Peito'),
    ('supino-inclinado-halter', 'Supino Inclinado', 'Halter', 'Peito'),
    ('supino-inclinado-maquina', 'Supino Inclinado', 'Máquina', 'Peito'),
    ('supino-inclinado-smith', 'Supino Inclinado', 'Smith', 'Peito'),
    ('supino-declinado-barra-livre', 'Supino Declinado', 'Barra-Livre', 'Peito'),
    ('supino-declinado-halter', 'Supino Declinado', 'Halter', 'Peito'),
    ('supino-declinado-maquina', 'Supino Declinado', 'Máquina', 'Peito'),
    ('supino-declinado-smith', 'Supino Declinado', 'Smith', 'Peito'),
    ('crucifixo-peck-deck', 'Crucifixo', 'Máquina (Peck Deck)', 'Peito'),
    ('crucifixo-maquina-anilha', 'Crucifixo', 'Máquina (Anilha)', 'Peito'),
    ('crucifixo-halter', 'Crucifixo', 'Halter', 'Peito'),
    ('crucifixo-inclinado-halter', 'Crucifixo Inclinado', 'Halter', 'Peito'),
    ('crucifixo-na-polia', 'Crucifixo na Polia', 'Cabo', 'Peito'),
    ('crossover-superior', 'Crossover Superior', 'Cabo', 'Peito'),
    ('crossover-inferior', 'Crossover Inferior', 'Cabo', 'Peito'),
    ('pullover-com-halter', 'Pullover com Halter', 'Halter', 'Peito'),
    ('paralela-dips', 'Paralela / Dips', 'Livre', 'Peito'),

    -- Costas
    ('puxada-aberta', 'Puxada Aberta', 'Polia', 'Costas'),
    ('puxada-fechada', 'Puxada Fechada', 'Polia', 'Costas'),
    ('puxada-triangulo', 'Puxada Triângulo', 'Polia', 'Costas'),
    ('puxada-neutra', 'Puxada Neutra', 'Polia', 'Costas'),
    ('pull-down', 'Pull Down', 'Cabo', 'Costas'),
    ('face-pull', 'Face Pull', 'Cabo', 'Costas'),
    ('remada-curvada', 'Remada Curvada', 'Barra-Livre', 'Costas'),
    ('remada-cavalinho', 'Remada Cavalinho', 'Barra-Livre', 'Costas'),
    ('remada-aberta-maquina', 'Remada Aberta', 'Máquina', 'Costas'),
    ('remada-aberta-peito-apoiado', 'Remada Aberta com Peito Apoiado', 'Máquina', 'Costas'),
    ('remada-baixa-triangulo', 'Remada Baixa Triângulo', 'Polia', 'Costas'),
    ('remada-baixa-pegada-aberta', 'Remada Baixa Pegada Aberta', 'Polia', 'Costas'),
    ('remada-baixa-fechada', 'Remada Baixa Fechada', 'Polia', 'Costas'),
    ('remada-unilateral-halter', 'Remada Unilateral', 'Halter', 'Costas'),
    ('remada-unilateral-maquina', 'Remada Unilateral', 'Máquina', 'Costas'),
    ('t-bar', 'T-Bar', 'Máquina', 'Costas'),
    ('pullover-maquina', 'Pullover', 'Máquina', 'Costas'),
    ('barra-fixa', 'Barra Fixa', 'Peso Corporal', 'Costas'),
    ('levantamento-terra', 'Levantamento Terra', 'Barra-Livre', 'Costas'),

    -- Pernas
    ('agachamento-barra-livre', 'Agachamento', 'Barra-Livre', 'Pernas'),
    ('agachamento-smith', 'Agachamento', 'Smith', 'Pernas'),
    ('agachamento-pendulo', 'Agachamento Pêndulo', 'Máquina', 'Pernas'),
    ('agachamento-hack', 'Agachamento Hack', 'Máquina', 'Pernas'),
    ('belt-squat', 'Belt Squat', 'Máquina', 'Pernas'),
    ('leg-press-45', 'Leg Press 45', 'Máquina', 'Pernas'),
    ('leg-press-articulado', 'Leg Press Articulado', 'Máquina', 'Pernas'),
    ('leg-press-horizontal', 'Leg Press Horizontal', 'Máquina', 'Pernas'),
    ('cadeira-extensora', 'Cadeira Extensora', 'Máquina', 'Pernas'),
    ('cadeira-extensora-unilateral', 'Cadeira Extensora Unilateral', 'Máquina', 'Pernas'),
    ('mesa-flexora', 'Mesa Flexora', 'Máquina', 'Pernas'),
    ('cadeira-flexora', 'Cadeira Flexora', 'Máquina', 'Pernas'),
    ('cadeira-flexora-unilateral', 'Cadeira Flexora Unilateral', 'Máquina', 'Pernas'),
    ('stiff-barra-livre', 'Stiff', 'Barra-Livre', 'Pernas'),
    ('stiff-smith', 'Stiff', 'Smith', 'Pernas'),
    ('levantamento-romeno', 'Levantamento Romeno', 'Barra-Livre', 'Pernas'),
    ('agachamento-bulgaro-barra-livre', 'Agachamento Búlgaro', 'Barra-Livre', 'Pernas'),
    ('agachamento-bulgaro-halter', 'Agachamento Búlgaro', 'Halter', 'Pernas'),
    ('agachamento-bulgaro-maquina', 'Agachamento Búlgaro', 'Máquina', 'Pernas'),
    ('passada', 'Passada', 'Halter', 'Pernas'),
    ('afundo', 'Afundo', 'Barra-Livre', 'Pernas'),
    ('elevacao-pelvica-barra-livre', 'Elevação Pélvica', 'Barra-Livre', 'Pernas'),
    ('elevacao-pelvica-maquina', 'Elevação Pélvica', 'Máquina', 'Pernas'),
    ('panturrilha-em-pe', 'Panturrilha em Pé', 'Máquina', 'Pernas'),
    ('panturrilha-sentado', 'Panturrilha Sentado', 'Máquina', 'Pernas'),
    ('cadeira-adutora', 'Cadeira Adutora', 'Máquina', 'Pernas'),
    ('cadeira-abdutora', 'Cadeira Abdutora', 'Máquina', 'Pernas'),

    -- Ombros
    ('desenvolvimento-halter', 'Desenvolvimento', 'Halter', 'Ombros'),
    ('desenvolvimento-maquina', 'Desenvolvimento', 'Máquina', 'Ombros'),
    ('desenvolvimento-smith', 'Desenvolvimento', 'Smith', 'Ombros'),
    ('desenvolvimento-arnold', 'Desenvolvimento Arnold', 'Halter', 'Ombros'),
    ('elevacao-lateral-halter', 'Elevação Lateral', 'Halter', 'Ombros'),
    ('elevacao-lateral-cabo', 'Elevação Lateral', 'Cabo', 'Ombros'),
    ('elevacao-lateral-maquina', 'Elevação Lateral', 'Máquina', 'Ombros'),
    ('elevacao-frontal', 'Elevação Frontal', 'Halter', 'Ombros'),

    -- Bíceps
    ('rosca-direta-barra', 'Rosca Direta', 'Barra', 'Bíceps'),
    ('rosca-direta-cabo', 'Rosca Direta', 'Cabo', 'Bíceps'),
    ('rosca-alternada', 'Rosca Alternada', 'Halter', 'Bíceps'),
    ('rosca-martelo-halter', 'Rosca Martelo', 'Halter', 'Bíceps'),
    ('rosca-martelo-cabo', 'Rosca Martelo', 'Cabo', 'Bíceps'),
    ('rosca-bayesian', 'Rosca Bayesian', 'Cabo', 'Bíceps'),
    ('rosca-banco-inclinado', 'Rosca Banco Inclinado', 'Halter', 'Bíceps'),
    ('rosca-scott-halter', 'Rosca Scott', 'Halter', 'Bíceps'),
    ('rosca-scott-maquina', 'Rosca Scott', 'Máquina', 'Bíceps'),
    ('rosca-scott-barra-livre', 'Rosca Scott', 'Barra-Livre', 'Bíceps'),
    ('rosca-scott-unilateral-halter', 'Rosca Scott Unilateral', 'Halter', 'Bíceps'),
    ('rosca-scott-unilateral-maquina', 'Rosca Scott Unilateral', 'Máquina', 'Bíceps'),
    ('rosca-concentrada', 'Rosca Concentrada', 'Halter', 'Bíceps'),

    -- Tríceps
    ('triceps-testa', 'Tríceps Testa', 'Barra', 'Tríceps'),
    ('triceps-corda', 'Tríceps Corda', 'Cabo', 'Tríceps'),
    ('triceps-pulley', 'Tríceps Pulley', 'Cabo', 'Tríceps'),
    ('triceps-frances-halter', 'Tríceps Francês', 'Halter', 'Tríceps'),
    ('triceps-frances-cabo', 'Tríceps Francês', 'Cabo', 'Tríceps'),
    ('triceps-unilateral', 'Tríceps Unilateral', 'Cabo', 'Tríceps'),

    -- Abdominais
    ('abdominal-supra-peso-corporal', 'Abdominal Supra', 'Peso Corporal', 'Abdominais'),
    ('abdominal-supra-maquina', 'Abdominal Supra', 'Máquina', 'Abdominais'),
    ('abdominal-supra-cabo', 'Abdominal Supra', 'Cabo', 'Abdominais'),
    ('abdominal-infra-elevacao-de-pernas', 'Abdominal Infra (Elevação de Pernas)', 'Barra Fixa', 'Abdominais'),
    ('abdominal-infra-peso-corporal', 'Abdominal Infra', 'Peso Corporal', 'Abdominais'),
    ('abdominal-obliquo-peso-corporal', 'Abdominal Oblíquo', 'Peso Corporal', 'Abdominais'),
    ('abdominal-obliquo-cabo', 'Abdominal Oblíquo', 'Cabo', 'Abdominais'),
    ('prancha-isometrica', 'Prancha Isométrica', 'Peso Corporal', 'Abdominais'),
    ('abdominal-roda', 'Abdominal Roda (Ab Wheel)', 'Peso Corporal', 'Abdominais'),
    ('abdominal-remador', 'Abdominal Remador', 'Peso Corporal', 'Abdominais'),

    -- Trapézio
    ('encolhimento-halter', 'Encolhimento', 'Halter', 'Trapézio'),
    ('encolhimento-barra-livre', 'Encolhimento', 'Barra-Livre', 'Trapézio'),
    ('encolhimento-smith', 'Encolhimento', 'Smith', 'Trapézio'),
    ('encolhimento-maquina', 'Encolhimento', 'Máquina', 'Trapézio'),
    ('remada-alta-barra-livre', 'Remada Alta', 'Barra-Livre', 'Trapézio'),
    ('remada-alta-polia', 'Remada Alta', 'Polia', 'Trapézio'),

    -- Antebraços
    ('rosca-inversa-barra', 'Rosca Inversa', 'Barra', 'Antebraços'),
    ('rosca-inversa-polia', 'Rosca Inversa', 'Polia', 'Antebraços'),
    ('rosca-punho-barra', 'Rosca Punho', 'Barra', 'Antebraços'),
    ('rosca-punho-halter', 'Rosca Punho', 'Halter', 'Antebraços'),
    ('rosca-punho-polia', 'Rosca Punho', 'Polia', 'Antebraços'),
    ('rosca-punho-inversa-barra', 'Rosca Punho Inversa', 'Barra', 'Antebraços'),
    ('rosca-punho-inversa-halter', 'Rosca Punho Inversa', 'Halter', 'Antebraços')
;

-- Reaproveita linhas legadas do catálogo quando elas já existem no banco,
-- mas ainda não possuem `system_key`.
UPDATE public.exercises AS exercise
SET
  system_key = seed.system_key,
  user_id = NULL,
  name = seed.name,
  is_system = TRUE,
  modality = seed.modality,
  muscle_group = seed.muscle_group,
  archived_at = NULL
FROM tmp_system_exercise_seed AS seed
WHERE exercise.system_key IS NULL
  AND (exercise.user_id IS NULL OR exercise.is_system = TRUE)
  AND lower(btrim(exercise.name)) = lower(btrim(seed.name))
  AND lower(btrim(COALESCE(exercise.modality, ''))) = lower(btrim(COALESCE(seed.modality, '')));

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
  system_key,
  NULL,
  name,
  TRUE,
  modality,
  muscle_group,
  NULL
FROM tmp_system_exercise_seed
ON CONFLICT (system_key) DO UPDATE SET
  user_id = NULL,
  name = EXCLUDED.name,
  is_system = TRUE,
  modality = EXCLUDED.modality,
  muscle_group = EXCLUDED.muscle_group,
  archived_at = NULL;

COMMIT;


-- ============================================================
-- END consolidated source: 20260406_seed_system_exercises_catalog.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260407_repair_legacy_system_catalog_aliases.sql
-- ============================================================

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


-- ============================================================
-- END consolidated source: 20260407_repair_legacy_system_catalog_aliases.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260408_reconcile_remaining_legacy_system_exercises.sql
-- ============================================================

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


-- ============================================================
-- END consolidated source: 20260408_reconcile_remaining_legacy_system_exercises.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260409_add_cardio_and_session_exercise_skips.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.workout_cardio_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_duration_minutes INT CHECK (
    target_duration_minutes IS NULL
    OR target_duration_minutes BETWEEN 1 AND 1440
  ),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_cardio_blocks
  ADD CONSTRAINT workout_cardio_blocks_workout_id_name_key
  UNIQUE (workout_id, name);

ALTER TABLE public.workout_cardio_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout cardio blocks"
  ON public.workout_cardio_blocks FOR SELECT
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own workout cardio blocks"
  ON public.workout_cardio_blocks FOR INSERT
  WITH CHECK (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own workout cardio blocks"
  ON public.workout_cardio_blocks FOR UPDATE
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own workout cardio blocks"
  ON public.workout_cardio_blocks FOR DELETE
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.session_exercise_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, exercise_id)
);

ALTER TABLE public.session_exercise_skips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session exercise skips"
  ON public.session_exercise_skips FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own session exercise skips"
  ON public.session_exercise_skips FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own session exercise skips"
  ON public.session_exercise_skips FOR DELETE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.session_cardio_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  workout_cardio_block_id UUID NOT NULL REFERENCES public.workout_cardio_blocks(id) ON DELETE CASCADE,
  total_duration_minutes INT CHECK (
    total_duration_minutes IS NULL
    OR total_duration_minutes BETWEEN 1 AND 1440
  ),
  total_distance_km DECIMAL(6,2) CHECK (
    total_distance_km IS NULL
    OR total_distance_km >= 0
  ),
  skipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, workout_cardio_block_id)
);

ALTER TABLE public.session_cardio_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session cardio logs"
  ON public.session_cardio_logs FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own session cardio logs"
  ON public.session_cardio_logs FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own session cardio logs"
  ON public.session_cardio_logs FOR UPDATE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own session cardio logs"
  ON public.session_cardio_logs FOR DELETE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.session_cardio_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cardio_log_id UUID NOT NULL REFERENCES public.session_cardio_logs(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  speed_kmh DECIMAL(5,2) CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
  repeat_count INT NOT NULL DEFAULT 1 CHECK (repeat_count BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_cardio_intervals
  ADD CONSTRAINT session_cardio_intervals_cardio_log_id_display_order_key
  UNIQUE (cardio_log_id, display_order);

ALTER TABLE public.session_cardio_intervals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session cardio intervals"
  ON public.session_cardio_intervals FOR SELECT
  USING (
    cardio_log_id IN (
      SELECT scl.id
      FROM public.session_cardio_logs scl
      JOIN public.workout_sessions ws ON ws.id = scl.session_id
      WHERE ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session cardio intervals"
  ON public.session_cardio_intervals FOR INSERT
  WITH CHECK (
    cardio_log_id IN (
      SELECT scl.id
      FROM public.session_cardio_logs scl
      JOIN public.workout_sessions ws ON ws.id = scl.session_id
      WHERE ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own session cardio intervals"
  ON public.session_cardio_intervals FOR UPDATE
  USING (
    cardio_log_id IN (
      SELECT scl.id
      FROM public.session_cardio_logs scl
      JOIN public.workout_sessions ws ON ws.id = scl.session_id
      WHERE ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own session cardio intervals"
  ON public.session_cardio_intervals FOR DELETE
  USING (
    cardio_log_id IN (
      SELECT scl.id
      FROM public.session_cardio_logs scl
      JOIN public.workout_sessions ws ON ws.id = scl.session_id
      WHERE ws.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_workout_cardio_blocks_workout_order
  ON public.workout_cardio_blocks(workout_id, display_order);

CREATE INDEX IF NOT EXISTS idx_session_exercise_skips_session
  ON public.session_exercise_skips(session_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_skips_exercise
  ON public.session_exercise_skips(exercise_id);

CREATE INDEX IF NOT EXISTS idx_session_cardio_logs_session
  ON public.session_cardio_logs(session_id);

CREATE INDEX IF NOT EXISTS idx_session_cardio_logs_block
  ON public.session_cardio_logs(workout_cardio_block_id);

CREATE INDEX IF NOT EXISTS idx_session_cardio_intervals_log_order
  ON public.session_cardio_intervals(cardio_log_id, display_order);

COMMIT;


-- ============================================================
-- END consolidated source: 20260409_add_cardio_and_session_exercise_skips.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260410_add_admin_access_manual_billing.sql
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paid_until DATE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.profiles
SET
  role = CASE
    WHEN lower(btrim(COALESCE(role, ''))) = 'admin' THEN 'admin'
    WHEN lower(btrim(COALESCE(role, ''))) IN (
      'member',
      'user',
      'aluno',
      'client',
      'cliente'
    ) THEN 'member'
    ELSE 'member'
  END,
  access_status = CASE
    WHEN lower(btrim(COALESCE(access_status, ''))) IN (
      'blocked',
      'inactive',
      'disabled',
      'suspended',
      'bloqueado',
      'inativo'
    ) THEN 'blocked'
    ELSE 'active'
  END,
  paid_until = COALESCE(paid_until, CURRENT_DATE + INTERVAL '365 days'),
  must_change_password = COALESCE(must_change_password, FALSE),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  paid_until IS NULL
  OR role IS NULL
  OR lower(btrim(COALESCE(role, ''))) NOT IN ('member', 'admin')
  OR access_status IS NULL
  OR lower(btrim(COALESCE(access_status, ''))) NOT IN ('active', 'blocked')
  OR must_change_password IS NULL
  OR updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('member', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_access_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_status_check
      CHECK (access_status IN ('active', 'blocked'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE INDEX IF NOT EXISTS idx_profiles_role_access
  ON public.profiles (role, access_status);

CREATE INDEX IF NOT EXISTS idx_profiles_paid_until
  ON public.profiles (paid_until);

CREATE TABLE IF NOT EXISTS public.manual_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_billing_events_user_month_key UNIQUE (user_id, reference_month)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manual_billing_events_status_check'
  ) THEN
    ALTER TABLE public.manual_billing_events
      ADD CONSTRAINT manual_billing_events_status_check
      CHECK (status IN ('paid', 'unpaid', 'waived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manual_billing_events_reference_month_check'
  ) THEN
    ALTER TABLE public.manual_billing_events
      ADD CONSTRAINT manual_billing_events_reference_month_check
      CHECK (
        reference_month = date_trunc('month', reference_month::timestamp)::date
      );
  END IF;
END $$;

ALTER TABLE public.manual_billing_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_manual_billing_events_user_month
  ON public.manual_billing_events (user_id, reference_month DESC);

CREATE INDEX IF NOT EXISTS idx_manual_billing_events_recorded_by
  ON public.manual_billing_events (recorded_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_audit_log_entity_type_check'
  ) THEN
    ALTER TABLE public.admin_audit_log
      ADD CONSTRAINT admin_audit_log_entity_type_check
      CHECK (entity_type IN ('user', 'exercise', 'billing', 'access', 'auth', 'system'));
  END IF;
END $$;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON public.admin_audit_log (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_manual_billing_events_updated_at ON public.manual_billing_events;
CREATE TRIGGER set_manual_billing_events_updated_at
  BEFORE UPDATE ON public.manual_billing_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_exercise_overrides_updated_at ON public.exercise_overrides;
CREATE TRIGGER set_exercise_overrides_updated_at
  BEFORE UPDATE ON public.exercise_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;


-- ============================================================
-- END consolidated source: 20260410_add_admin_access_manual_billing.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260411_repair_profile_defaults_and_auth_trigger.sql
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'member',
  ALTER COLUMN access_status SET DEFAULT 'active',
  ALTER COLUMN must_change_password SET DEFAULT FALSE,
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE public.profiles
SET
  role = CASE
    WHEN lower(btrim(COALESCE(role, ''))) = 'admin' THEN 'admin'
    ELSE 'member'
  END,
  access_status = CASE
    WHEN lower(btrim(COALESCE(access_status, ''))) = 'blocked' THEN 'blocked'
    ELSE 'active'
  END,
  must_change_password = COALESCE(must_change_password, FALSE),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  role IS NULL
  OR lower(btrim(COALESCE(role, ''))) NOT IN ('member', 'admin')
  OR access_status IS NULL
  OR lower(btrim(COALESCE(access_status, ''))) NOT IN ('active', 'blocked')
  OR must_change_password IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  DROP CONSTRAINT IF EXISTS profiles_access_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('member', 'admin')),
  ADD CONSTRAINT profiles_access_status_check
    CHECK (access_status IN ('active', 'blocked'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
      id,
      display_name,
      role,
      access_status,
      paid_until,
      must_change_password,
      created_by_admin_id,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1), 'User'),
      CASE
        WHEN lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'member')) = 'admin' THEN 'admin'
        ELSE 'member'
      END,
      CASE
        WHEN lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'access_status', ''), 'active')) = 'blocked' THEN 'blocked'
        ELSE 'active'
      END,
      CURRENT_DATE + INTERVAL '365 days',
      FALSE,
      NULL,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;


-- ============================================================
-- END consolidated source: 20260411_repair_profile_defaults_and_auth_trigger.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260412_add_member_access_modes_and_trial_support.sql
-- ============================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_access_mode TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS billing_day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS billing_grace_business_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ends_at DATE;

UPDATE public.profiles
SET
  member_access_mode = CASE
    WHEN role = 'admin' THEN 'internal'
    ELSE 'internal'
  END,
  billing_grace_business_days = COALESCE(billing_grace_business_days, 0)
WHERE
  member_access_mode IS NULL
  OR member_access_mode NOT IN ('internal', 'billable', 'trial')
  OR billing_grace_business_days IS NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_member_access_mode_check,
  DROP CONSTRAINT IF EXISTS profiles_billing_day_of_month_check,
  DROP CONSTRAINT IF EXISTS profiles_billing_grace_business_days_check,
  DROP CONSTRAINT IF EXISTS profiles_trial_configuration_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_member_access_mode_check
    CHECK (member_access_mode IN ('internal', 'billable', 'trial')),
  ADD CONSTRAINT profiles_billing_day_of_month_check
    CHECK (billing_day_of_month IS NULL OR billing_day_of_month BETWEEN 1 AND 31),
  ADD CONSTRAINT profiles_billing_grace_business_days_check
    CHECK (billing_grace_business_days >= 0 AND billing_grace_business_days <= 10),
  ADD CONSTRAINT profiles_trial_configuration_check
    CHECK (
      (member_access_mode = 'trial' AND trial_ends_at IS NOT NULL)
      OR (member_access_mode <> 'trial')
    );

CREATE INDEX IF NOT EXISTS idx_profiles_member_access_mode
  ON public.profiles (member_access_mode, access_status);

CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at
  ON public.profiles (trial_ends_at)
  WHERE member_access_mode = 'trial';

COMMIT;


-- ============================================================
-- END consolidated source: 20260412_add_member_access_modes_and_trial_support.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260413_add_session_exercise_substitutions.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_exercise_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  original_exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  replacement_exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, original_exercise_id),
  CHECK (original_exercise_id <> replacement_exercise_id)
);

ALTER TABLE public.session_exercise_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session exercise substitutions"
  ON public.session_exercise_substitutions FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own session exercise substitutions"
  ON public.session_exercise_substitutions FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own session exercise substitutions"
  ON public.session_exercise_substitutions FOR UPDATE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own session exercise substitutions"
  ON public.session_exercise_substitutions FOR DELETE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_session_exercise_substitutions_session
  ON public.session_exercise_substitutions(session_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_substitutions_original
  ON public.session_exercise_substitutions(original_exercise_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_substitutions_replacement
  ON public.session_exercise_substitutions(replacement_exercise_id);

COMMIT;


-- ============================================================
-- END consolidated source: 20260413_add_session_exercise_substitutions.sql
-- ============================================================

-- ============================================================
-- BEGIN consolidated source: 20260419_add_session_exercise_targets.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_exercise_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  valid_sets INT NOT NULL CHECK (valid_sets BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, exercise_id)
);

ALTER TABLE public.session_exercise_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session exercise targets"
  ON public.session_exercise_targets FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own session exercise targets"
  ON public.session_exercise_targets FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own session exercise targets"
  ON public.session_exercise_targets FOR UPDATE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own session exercise targets"
  ON public.session_exercise_targets FOR DELETE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_session_exercise_targets_session
  ON public.session_exercise_targets(session_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_targets_exercise
  ON public.session_exercise_targets(exercise_id);

COMMIT;


-- ============================================================
-- END consolidated source: 20260419_add_session_exercise_targets.sql
-- ============================================================
