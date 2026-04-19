-- ============================================================
-- GymTracker — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  rotation_anchor_date DATE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'blocked')),
  paid_until DATE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.manual_billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'unpaid', 'waived')),
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_billing_events_user_month_key UNIQUE (user_id, reference_month)
);

ALTER TABLE public.manual_billing_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'exercise', 'billing', 'access', 'auth', 'system')),
  entity_id TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;


-- 2. Exercises
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_key TEXT UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  modality TEXT,
  muscle_group TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

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

CREATE UNIQUE INDEX idx_exercises_user_name_modality_unique
ON public.exercises (
  user_id,
  lower(btrim(name)),
  lower(btrim(COALESCE(modality, '')))
)
WHERE user_id IS NOT NULL;

CREATE INDEX idx_exercises_active_user
ON public.exercises (user_id, lower(btrim(name)))
WHERE user_id IS NOT NULL AND archived_at IS NULL;

CREATE INDEX idx_exercises_system_catalog
ON public.exercises (lower(btrim(name)), lower(btrim(COALESCE(modality, ''))))
WHERE is_system = TRUE;

CREATE TABLE public.exercise_overrides (
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

CREATE INDEX idx_exercise_overrides_user
ON public.exercise_overrides (user_id, exercise_id);

CREATE INDEX idx_exercise_overrides_visible
ON public.exercise_overrides (user_id, hidden_at, archived_at);


-- 3. Workouts
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workouts"
  ON public.workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts"
  ON public.workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
  ON public.workouts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON public.workouts FOR DELETE
  USING (auth.uid() = user_id);


-- 4. Workout Exercises (junction)
CREATE TABLE public.workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  target_sets INT NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 20),
  display_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_workout_id_exercise_id_key
  UNIQUE (workout_id, exercise_id);

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout_exercises"
  ON public.workout_exercises FOR SELECT
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own workout_exercises"
  ON public.workout_exercises FOR INSERT
  WITH CHECK (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own workout_exercises"
  ON public.workout_exercises FOR UPDATE
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own workout_exercises"
  ON public.workout_exercises FOR DELETE
  USING (
    workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid())
  );


-- 5. Schedule
CREATE TABLE public.schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule"
  ON public.schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule"
  ON public.schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule"
  ON public.schedule FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule"
  ON public.schedule FOR DELETE
  USING (auth.uid() = user_id);


-- 5b. Schedule Rotations (rotation 2+; base week remains in schedule)
CREATE TABLE public.schedule_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  rotation_index INT NOT NULL CHECK (rotation_index BETWEEN 2 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_of_week, rotation_index)
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


-- 6. Workout Sessions
CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.workout_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.workout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.workout_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.workout_sessions FOR DELETE
  USING (auth.uid() = user_id);


-- 7. Set Logs
CREATE TABLE public.set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number INT NOT NULL CHECK (set_number > 0),
  weight_kg DECIMAL(5,1) NOT NULL CHECK (weight_kg >= 0),
  reps INT NOT NULL CHECK (reps > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.set_logs
  ADD CONSTRAINT set_logs_session_id_exercise_id_set_number_key
  UNIQUE (session_id, exercise_id, set_number);

ALTER TABLE public.set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own set_logs"
  ON public.set_logs FOR SELECT
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own set_logs"
  ON public.set_logs FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own set_logs"
  ON public.set_logs FOR UPDATE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own set_logs"
  ON public.set_logs FOR DELETE
  USING (
    session_id IN (SELECT id FROM public.workout_sessions WHERE user_id = auth.uid())
  );

-- 8. Workout Cardio Blocks
CREATE TABLE public.workout_cardio_blocks (
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

-- 9. Session Exercise Skips
CREATE TABLE public.session_exercise_skips (
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

-- 10. Session Exercise Targets
CREATE TABLE public.session_exercise_targets (
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

-- 11. Session Cardio Logs
CREATE TABLE public.session_cardio_logs (
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

-- 12. Session Cardio Intervals
CREATE TABLE public.session_cardio_intervals (
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

-- 13. Body Measurements
CREATE TABLE public.body_measurements (
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
  UNIQUE(user_id, measured_at)
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


-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_exercises_user ON public.exercises(user_id);
CREATE INDEX idx_workouts_user ON public.workouts(user_id);
CREATE INDEX idx_schedule_user ON public.schedule(user_id);
CREATE INDEX idx_schedule_rotations_user_day ON public.schedule_rotations(user_id, day_of_week, rotation_index);
CREATE INDEX idx_workout_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON public.workout_sessions(performed_at);
CREATE INDEX idx_workout_sessions_user_date ON public.workout_sessions(user_id, performed_at DESC);
CREATE INDEX idx_workout_exercises_workout_order ON public.workout_exercises(workout_id, display_order);
CREATE INDEX idx_workout_cardio_blocks_workout_order ON public.workout_cardio_blocks(workout_id, display_order);
CREATE INDEX idx_set_logs_session ON public.set_logs(session_id);
CREATE INDEX idx_set_logs_exercise ON public.set_logs(exercise_id);
CREATE INDEX idx_set_logs_session_exercise ON public.set_logs(session_id, exercise_id, set_number);
CREATE INDEX idx_session_exercise_skips_session ON public.session_exercise_skips(session_id);
CREATE INDEX idx_session_exercise_skips_exercise ON public.session_exercise_skips(exercise_id);
CREATE INDEX idx_session_exercise_targets_session ON public.session_exercise_targets(session_id);
CREATE INDEX idx_session_exercise_targets_exercise ON public.session_exercise_targets(exercise_id);
CREATE INDEX idx_session_cardio_logs_session ON public.session_cardio_logs(session_id);
CREATE INDEX idx_session_cardio_logs_block ON public.session_cardio_logs(workout_cardio_block_id);
CREATE INDEX idx_session_cardio_intervals_log_order ON public.session_cardio_intervals(cardio_log_id, display_order);
CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, measured_at DESC);
