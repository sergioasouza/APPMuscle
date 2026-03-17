import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import type { Exercise } from "@/lib/types";
import type {
  WorkoutEditorData,
  WorkoutEditorExercise,
  WorkoutListItem,
} from "@/features/workouts/types";

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
  const { supabase } = await getAuthenticatedServerContext();

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

export async function updateWorkoutExerciseTargetSetsRepository(
  workoutExerciseId: string,
  targetSets: number,
): Promise<void> {
  const { supabase } = await getAuthenticatedServerContext();

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
  const { supabase } = await getAuthenticatedServerContext();

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
  const { supabase } = await getAuthenticatedServerContext();

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

export async function reorderWorkoutExercisesRepository(
  workoutId: string,
  orderedWorkoutExerciseIds: string[],
): Promise<void> {
  const { supabase } = await getAuthenticatedServerContext();

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
