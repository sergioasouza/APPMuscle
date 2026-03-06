-- ============================================================
-- GymTracker — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

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


-- 2. Exercises
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view exercises"
  ON public.exercises FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own exercises"
  ON public.exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercises"
  ON public.exercises FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercises"
  ON public.exercises FOR DELETE
  USING (auth.uid() = user_id);


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
  target_sets INT NOT NULL DEFAULT 3,
  display_order INT NOT NULL DEFAULT 0
);

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
  set_number INT NOT NULL,
  weight_kg DECIMAL(5,1) NOT NULL,
  reps INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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


-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_exercises_user ON public.exercises(user_id);
CREATE INDEX idx_workouts_user ON public.workouts(user_id);
CREATE INDEX idx_schedule_user ON public.schedule(user_id);
CREATE INDEX idx_workout_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON public.workout_sessions(performed_at);
CREATE INDEX idx_set_logs_session ON public.set_logs(session_id);
CREATE INDEX idx_set_logs_exercise ON public.set_logs(exercise_id);
