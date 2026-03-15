import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import type { Exercise } from "@/lib/types";
import type {
  WorkoutEditorData,
  WorkoutEditorExercise,
  WorkoutListItem,
} from "@/features/workouts/types";

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
    supabase.from("exercises").select("*").eq("user_id", user.id).order("name"),
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

  return (exerciseResult.data ?? []).filter(
    (exercise) => !usedExerciseIds.has(exercise.id),
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
