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
