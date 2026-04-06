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
