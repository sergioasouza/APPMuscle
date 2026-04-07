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
