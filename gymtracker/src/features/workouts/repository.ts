import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import {
  requireOwnedExercise,
  requireOwnedWorkout,
  requireOwnedWorkoutExercise,
} from "@/lib/supabase/ownership";
import type { Exercise, Workout } from "@/lib/types";
import type {
  ExerciseLinkedWorkout,
} from "@/features/workouts/types";
import type {
  WorkoutEditorData,
  WorkoutEditorExercise,
  WorkoutListItem,
} from "@/features/workouts/types";
import type {
  ExerciseLogSummaryRow,
  ExerciseWorkoutLinkRow,
} from "@/features/workouts/library";

type WorkoutLinkQueryRow = {
  exercise_id: string;
  workouts: Pick<Workout, "id" | "name"> | null;
};

type ExerciseLogQueryRow = {
  exercise_id: string;
  session_id: string;
  weight_kg: number;
  reps: number;
  workout_sessions: { performed_at: string } | null;
};

function getSharedExercisePeerUserIds(currentUserId: string): string[] {
  const raw = process.env.SHARED_EXERCISE_USER_IDS;

  if (!raw) {
    return [];
  }

  const configuredIds = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredIds.length !== 2 || !configuredIds.includes(currentUserId)) {
    return [];
  }

  return configuredIds.filter((id) => id !== currentUserId);
}

export async function listWorkoutsRepository(): Promise<WorkoutListItem[]> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listExerciseLibraryRepository(): Promise<{
  exercises: Exercise[];
  workoutLinks: ExerciseWorkoutLinkRow[];
  logRows: ExerciseLogSummaryRow[];
}> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [exerciseResult, workoutLinksResult, logsResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("workout_exercises")
      .select("exercise_id, workouts!inner(id, name, user_id)")
      .eq("workouts.user_id", user.id),
    supabase
      .from("set_logs")
      .select("exercise_id, session_id, weight_kg, reps, workout_sessions!inner(performed_at, user_id)")
      .eq("workout_sessions.user_id", user.id),
  ]);

  if (exerciseResult.error) {
    throw new Error(exerciseResult.error.message);
  }

  if (workoutLinksResult.error) {
    throw new Error(workoutLinksResult.error.message);
  }

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const workoutLinks = ((workoutLinksResult.data as WorkoutLinkQueryRow[] | null) ?? [])
    .flatMap((row) => row.workouts == null
      ? []
      : [{
        exerciseId: row.exercise_id,
        workoutId: row.workouts.id,
        workoutName: row.workouts.name,
      }]);

  const logRows = ((logsResult.data as ExerciseLogQueryRow[] | null) ?? [])
    .flatMap((row) => row.workout_sessions == null
      ? []
      : [{
        exerciseId: row.exercise_id,
        sessionId: row.session_id,
        performedAt: row.workout_sessions.performed_at,
        weightKg: Number(row.weight_kg),
        reps: row.reps,
      }]);

  return {
    exercises: exerciseResult.data ?? [],
    workoutLinks,
    logRows,
  };
}

export async function getWorkoutEditorDataRepository(
  workoutId: string,
): Promise<WorkoutEditorData | null> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [workoutResult, workoutExercisesResult] = await Promise.all([
    supabase
      .from("workouts")
      .select("*")
      .eq("id", workoutId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("workout_exercises")
      .select("*, exercises(*)")
      .eq("workout_id", workoutId)
      .order("display_order"),
  ]);

  if (workoutResult.error) {
    if (workoutResult.error.code === "PGRST116") {
      return null;
    }

    throw new Error(workoutResult.error.message);
  }

  if (workoutExercisesResult.error) {
    throw new Error(workoutExercisesResult.error.message);
  }

  return {
    workout: workoutResult.data,
    workoutExercises:
      (workoutExercisesResult.data as WorkoutEditorExercise[] | null) ?? [],
  };
}

export async function listAvailableExercisesRepository(
  workoutId: string,
): Promise<Exercise[]> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  const [exerciseResult, workoutExerciseResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("workout_exercises")
      .select("exercise_id")
      .eq("workout_id", workoutId),
  ]);

  if (exerciseResult.error) {
    throw new Error(exerciseResult.error.message);
  }

  if (workoutExerciseResult.error) {
    throw new Error(workoutExerciseResult.error.message);
  }

  const usedExerciseIds = new Set(
    (workoutExerciseResult.data ?? []).map((item) => item.exercise_id),
  );

  // Filter out both already-added exercises and archived ones.
  // archived_at IS NULL means active; archived exercises are hidden from
  // the picker but their history is preserved in set_logs.
  return (exerciseResult.data ?? []).filter(
    (exercise) =>
      !usedExerciseIds.has(exercise.id) &&
      (exercise as Exercise & { archived_at: string | null }).archived_at ===
        null,
  );
}

export async function createWorkoutRepository(
  name: string,
): Promise<WorkoutListItem> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { data, error } = await supabase
    .from("workouts")
    .insert({ user_id: user.id, name })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteWorkoutRepository(
  workoutId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { error } = await supabase
    .from("workouts")
    .delete()
    .eq("id", workoutId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateWorkoutNameRepository(
  workoutId: string,
  name: string,
): Promise<WorkoutListItem> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { data, error } = await supabase
    .from("workouts")
    .update({ name })
    .eq("id", workoutId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function addExerciseToWorkoutRepository(
  workoutId: string,
  exerciseId: string,
  targetSets: number,
): Promise<WorkoutEditorExercise> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await Promise.all([
    requireOwnedWorkout(supabase, user.id, workoutId),
    requireOwnedExercise(supabase, user.id, exerciseId),
  ]);

  const { count, error: countError } = await supabase
    .from("workout_exercises")
    .select("*", { count: "exact", head: true })
    .eq("workout_id", workoutId);

  if (countError) {
    throw new Error(countError.message);
  }

  const { data, error } = await supabase
    .from("workout_exercises")
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      target_sets: targetSets,
      display_order: count ?? 0,
    })
    .select("*, exercises(*)")
    .single();

  if (error) {
    // 23505 = unique_violation: this exercise is already in this workout
    if (error.code === "23505") {
      throw new Error("This exercise is already in this workout");
    }
    throw new Error(error.message);
  }

  return data as WorkoutEditorExercise;
}

export async function createExerciseRepository(
  name: string,
): Promise<Exercise> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const peerUserIds = getSharedExercisePeerUserIds(user.id);

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: user.id,
      name,
    })
    .select("*")
    .single();

  if (error) {
    // 23505 = unique_violation: idx_exercises_user_name_unique prevents
    // two exercises with the same (case-insensitive, trimmed) name per user
    if (error.code === "23505") {
      throw new Error(
        `An exercise named "${name}" already exists in your library`,
      );
    }
    throw new Error(error.message);
  }

  if (peerUserIds.length > 0) {
    for (const peerUserId of peerUserIds) {
      const { error: peerInsertError } = await supabase.from("exercises").insert({
        user_id: peerUserId,
        name,
      });

      // Ignore duplicate-name conflicts on peer account to keep idempotent behavior.
      if (peerInsertError && peerInsertError.code !== "23505") {
        throw new Error(peerInsertError.message);
      }
    }
  }

  return data;
}

export async function getExerciseDetailRepository(
  exerciseId: string,
): Promise<{
  exercise: Exercise;
  linkedWorkouts: ExerciseLinkedWorkout[];
  logRows: ExerciseLogSummaryRow[];
} | null> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [exerciseResult, linkedWorkoutsResult, logsResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workout_exercises")
      .select("exercise_id, workouts!inner(id, name, user_id)")
      .eq("exercise_id", exerciseId)
      .eq("workouts.user_id", user.id),
    supabase
      .from("set_logs")
      .select("exercise_id, session_id, weight_kg, reps, workout_sessions!inner(performed_at, user_id)")
      .eq("exercise_id", exerciseId)
      .eq("workout_sessions.user_id", user.id),
  ]);

  if (exerciseResult.error) {
    throw new Error(exerciseResult.error.message);
  }

  if (!exerciseResult.data) {
    return null;
  }

  if (linkedWorkoutsResult.error) {
    throw new Error(linkedWorkoutsResult.error.message);
  }

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const linkedWorkouts = ((linkedWorkoutsResult.data as WorkoutLinkQueryRow[] | null) ?? [])
    .flatMap((row) => row.workouts == null
      ? []
      : [{
        id: row.workouts.id,
        name: row.workouts.name,
      }])
    .filter((workout, index, items) => items.findIndex((candidate) => candidate.id === workout.id) === index);

  const logRows = ((logsResult.data as ExerciseLogQueryRow[] | null) ?? [])
    .flatMap((row) => row.workout_sessions == null
      ? []
      : [{
        exerciseId: row.exercise_id,
        sessionId: row.session_id,
        performedAt: row.workout_sessions.performed_at,
        weightKg: Number(row.weight_kg),
        reps: row.reps,
      }]);

  return {
    exercise: exerciseResult.data,
    linkedWorkouts,
    logRows,
  };
}

export async function updateExerciseNameRepository(
  exerciseId: string,
  name: string,
): Promise<Exercise> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedExercise(supabase, user.id, exerciseId);

  const { data, error } = await supabase
    .from("exercises")
    .update({ name })
    .eq("id", exerciseId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        `An exercise named "${name}" already exists in your library`,
      );
    }

    throw new Error(error.message);
  }

  return data;
}

export async function updateWorkoutExerciseTargetSetsRepository(
  workoutExerciseId: string,
  targetSets: number,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutExercise(supabase, user.id, workoutExerciseId);

  const { error } = await supabase
    .from("workout_exercises")
    .update({ target_sets: targetSets })
    .eq("id", workoutExerciseId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteWorkoutExerciseRepository(
  workoutExerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutExercise(supabase, user.id, workoutExerciseId);

  const { error } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("id", workoutExerciseId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Checks whether an exercise has any set_logs recorded across all sessions.
 * Used before removing an exercise to decide whether to offer archive instead.
 */
export async function checkExerciseHasLogsRepository(
  exerciseId: string,
): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedExercise(supabase, user.id, exerciseId);

  const { count, error } = await supabase
    .from("set_logs")
    .select("id", { head: true, count: "exact" })
    .eq("exercise_id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

/**
 * Archives an exercise by setting archived_at = NOW().
 * Archived exercises are hidden from the picker but their set_log history
 * is preserved and still visible in analytics.
 */
export async function archiveExerciseRepository(
  exerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const peerUserIds = getSharedExercisePeerUserIds(user.id);

  const { data: sourceExercise, error: sourceExerciseError } = await supabase
    .from("exercises")
    .select("id, name")
    .eq("id", exerciseId)
    .eq("user_id", user.id)
    .single();

  if (sourceExerciseError) {
    throw new Error(sourceExerciseError.message);
  }

  const { error } = await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", exerciseId)
    .eq("user_id", user.id); // ownership guard (belt-and-suspenders on top of RLS)

  if (error) {
    throw new Error(error.message);
  }

  if (peerUserIds.length > 0) {
    for (const peerUserId of peerUserIds) {
      const { error: peerArchiveError } = await supabase
        .from("exercises")
        .update({ archived_at: new Date().toISOString() })
        .eq("user_id", peerUserId)
        .eq("name", sourceExercise.name)
        .is("archived_at", null);

      if (peerArchiveError) {
        throw new Error(peerArchiveError.message);
      }
    }
  }
}

export async function unarchiveExerciseRepository(
  exerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedExercise(supabase, user.id, exerciseId);

  const { error } = await supabase
    .from("exercises")
    .update({ archived_at: null })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteExerciseRepository(
  exerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedExercise(supabase, user.id, exerciseId);

  const [linkedWorkoutCountResult, logCountResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("id", { head: true, count: "exact" })
      .eq("exercise_id", exerciseId),
    supabase
      .from("set_logs")
      .select("id", { head: true, count: "exact" })
      .eq("exercise_id", exerciseId),
  ]);

  if (linkedWorkoutCountResult.error) {
    throw new Error(linkedWorkoutCountResult.error.message);
  }

  if (logCountResult.error) {
    throw new Error(logCountResult.error.message);
  }

  if ((linkedWorkoutCountResult.count ?? 0) > 0 || (logCountResult.count ?? 0) > 0) {
    throw new Error("Exercise cannot be deleted because it still has history or linked workouts");
  }

  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function reorderWorkoutExercisesRepository(
  workoutId: string,
  orderedWorkoutExerciseIds: string[],
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  for (const [
    index,
    workoutExerciseId,
  ] of orderedWorkoutExerciseIds.entries()) {
    const { error } = await supabase
      .from("workout_exercises")
      .update({ display_order: index })
      .eq("id", workoutExerciseId)
      .eq("workout_id", workoutId);

    if (error) {
      throw new Error(error.message);
    }
  }
}
