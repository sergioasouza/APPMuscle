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
