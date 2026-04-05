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
