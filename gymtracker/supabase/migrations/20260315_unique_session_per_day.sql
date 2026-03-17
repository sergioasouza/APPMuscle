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
