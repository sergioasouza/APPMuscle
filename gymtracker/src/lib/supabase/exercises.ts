import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveExerciseForUser } from "@/lib/exercise-resolution";
import type { Exercise, ExerciseOverride, ResolvedExercise } from "@/lib/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export function buildAccessibleExercisesFilter(userId: string) {
  return `user_id.eq.${userId},is_system.eq.true`;
}

export async function listExerciseOverridesByIds(
  supabase: SupabaseServerClient,
  userId: string,
  exerciseIds: string[],
): Promise<ExerciseOverride[]> {
  if (exerciseIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("exercise_overrides")
    .select("*")
    .eq("user_id", userId)
    .in("exercise_id", exerciseIds);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function resolveExercisesForUser(
  supabase: SupabaseServerClient,
  userId: string,
  exercises: Exercise[],
): Promise<ResolvedExercise[]> {
  const overrides = await listExerciseOverridesByIds(
    supabase,
    userId,
    exercises.filter((exercise) => exercise.is_system).map((exercise) => exercise.id),
  );
  const overridesByExerciseId = overrides.reduce<Map<string, ExerciseOverride>>(
    (accumulator, override) => {
      accumulator.set(override.exercise_id, override);
      return accumulator;
    },
    new Map(),
  );

  return exercises.map((exercise) =>
    resolveExerciseForUser(exercise, overridesByExerciseId.get(exercise.id)),
  );
}

export function mapResolvedExercisesById(exercises: ResolvedExercise[]) {
  return exercises.reduce<Map<string, ResolvedExercise>>((accumulator, exercise) => {
    accumulator.set(exercise.id, exercise);
    return accumulator;
  }, new Map());
}

export async function getAccessibleExerciseRecord(
  supabase: SupabaseServerClient,
  userId: string,
  exerciseId: string,
): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .or(buildAccessibleExercisesFilter(userId))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getResolvedAccessibleExercise(
  supabase: SupabaseServerClient,
  userId: string,
  exerciseId: string,
): Promise<ResolvedExercise | null> {
  const exercise = await getAccessibleExerciseRecord(supabase, userId, exerciseId);

  if (!exercise) {
    return null;
  }

  const resolvedExercises = await resolveExercisesForUser(supabase, userId, [exercise]);
  return resolvedExercises[0] ?? null;
}
