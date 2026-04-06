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
