import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import type {
  Exercise,
  SetLog,
  WorkoutExerciseWithExercise,
  WorkoutSession,
} from "@/lib/types";

export async function getWorkoutAnalyticsRepository(workoutId: string) {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [workoutExercisesResult, sessionsResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("*, exercises(*)")
      .eq("workout_id", workoutId)
      .order("display_order"),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("workout_id", workoutId)
      .eq("user_id", user.id)
      .order("performed_at", { ascending: false }),
  ]);

  if (workoutExercisesResult.error) {
    throw new Error(workoutExercisesResult.error.message);
  }

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }

  const sessions = (sessionsResult.data as WorkoutSession[] | null) ?? [];
  const sessionIds = sessions.map((session) => session.id);

  let setLogs: SetLog[] = [];

  if (sessionIds.length > 0) {
    const { data, error } = await supabase
      .from("set_logs")
      .select("*")
      .in("session_id", sessionIds)
      .order("set_number");

    if (error) {
      throw new Error(error.message);
    }

    setLogs = data ?? [];
  }

  // Filter out workout_exercises whose exercise was deleted (exercises is null)
  const safeWorkoutExercises = (
    (workoutExercisesResult.data as WorkoutExerciseWithExercise[] | null) ?? []
  ).filter((we) => we.exercises != null);

  return {
    workoutExercises: safeWorkoutExercises,
    sessions,
    setLogs,
  };
}

/**
 * Fetches analytics data for a single exercise across ALL workouts.
 *
 * Unlike getWorkoutAnalyticsRepository (which filters sessions by workout_id),
 * this function returns every session where the user logged sets for the given
 * exercise, regardless of which workout the session belongs to.
 *
 * This enables the "Global" view in the analytics screen, showing true
 * long-term progress for an exercise even when it appears in multiple workouts.
 */
export async function getExerciseAnalyticsRepository(exerciseId: string) {
  const { supabase, user } = await getAuthenticatedServerContext();

  // 1. Fetch the exercise record (needed for the name and ownership check)
  const { data: exerciseData, error: exerciseError } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .eq("user_id", user.id) // RLS + ownership guard
    .single();

  if (exerciseError) {
    if (exerciseError.code === "PGRST116") {
      throw new Error("Exercise not found");
    }
    throw new Error(exerciseError.message);
  }

  // 2. Fetch all set_logs for this exercise across the user's sessions.
  //    We join via session_id → workout_sessions.user_id to avoid returning
  //    logs from other users' sessions (belt-and-suspenders alongside RLS).
  const { data: setLogsData, error: setLogsError } = await supabase
    .from("set_logs")
    .select("*, workout_sessions!inner(user_id)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", user.id)
    .order("set_number");

  if (setLogsError) {
    throw new Error(setLogsError.message);
  }

  const setLogs = (setLogsData ?? []).map((row) => {
    // Strip the joined workout_sessions field — callers expect plain SetLog rows
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { workout_sessions: _ws, ...setLog } = row as typeof row & {
      workout_sessions: unknown;
    };
    return setLog as SetLog;
  });

  // 3. Collect unique session IDs that have logs for this exercise
  const sessionIdsWithLogs = [...new Set(setLogs.map((sl) => sl.session_id))];

  let sessions: WorkoutSession[] = [];

  if (sessionIdsWithLogs.length > 0) {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("workout_sessions")
      .select("*")
      .in("id", sessionIdsWithLogs)
      .eq("user_id", user.id)
      .order("performed_at", { ascending: false });

    if (sessionsError) {
      throw new Error(sessionsError.message);
    }

    sessions = (sessionsData as WorkoutSession[] | null) ?? [];
  }

  return {
    exercise: exerciseData as Exercise,
    sessions,
    setLogs,
  };
}
