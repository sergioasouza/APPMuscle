import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import {
  buildExerciseConflictLabel,
  isExerciseAvailableForPicker,
  resolveExerciseForUser,
} from "@/lib/exercise-resolution";
import {
  buildAccessibleExercisesFilter,
  getAccessibleExerciseRecord,
  resolveExercisesForUser,
} from "@/lib/supabase/exercises";
import {
  requireAccessibleExercise,
  requireOwnedWorkout,
  requireOwnedWorkoutCardioBlock,
  requireOwnedWorkoutExercise,
} from "@/lib/supabase/ownership";
import type {
  Exercise,
  ExerciseOverride,
  ResolvedExercise,
  Workout,
  WorkoutCardioBlock,
  WorkoutExercise,
} from "@/lib/types";
import type {
  ExerciseDraftInput,
  ExerciseLibraryFilter,
  ExerciseLibrarySourceFilter,
  ExerciseLinkedWorkout,
  WorkoutCardioDraftInput,
  WorkoutEditorCardioBlock,
  WorkoutEditorData,
  WorkoutEditorExercise,
  WorkoutListItem,
} from "@/features/workouts/types";
import type {
  ExerciseLogSummaryRow,
  ExerciseWorkoutLinkRow,
} from "@/features/workouts/library";
import {
  buildExerciseLibraryStats,
  filterResolvedExercisesForLibrary,
  sortResolvedExercisesForLibrary,
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

type WorkoutExerciseQueryRow = WorkoutExercise & {
  exercises: Exercise | null;
};

function buildExerciseAlreadyExistsMessage(input: {
  name: string;
  modality?: string | null;
}) {
  return `An exercise named "${buildExerciseConflictLabel(input)}" already exists in your library`;
}

function isOverrideEmpty(override: {
  custom_name?: string | null;
  custom_modality?: string | null;
  custom_muscle_group?: string | null;
  archived_at?: string | null;
  hidden_at?: string | null;
}) {
  return (
    override.custom_name == null &&
    override.custom_modality == null &&
    override.custom_muscle_group == null &&
    override.archived_at == null &&
    override.hidden_at == null
  );
}

async function listAccessibleExerciseRows(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  userId: string,
) {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .or(buildAccessibleExercisesFilter(userId))
    .order("is_system", { ascending: false })
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data as Exercise[] | null) ?? [];
}

async function resolveWorkoutExerciseRowsForUser(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  workoutExerciseRows: WorkoutExerciseQueryRow[],
  userId: string,
) {
  const baseExercises = workoutExerciseRows.flatMap((row) =>
    row.exercises == null ? [] : [row.exercises],
  );
  const resolvedExercises = await resolveExercisesForUser(
    supabase,
    userId,
    baseExercises,
  );
  const resolvedById = resolvedExercises.reduce<Map<string, ResolvedExercise>>(
    (accumulator, exercise) => {
      accumulator.set(exercise.id, exercise);
      return accumulator;
    },
    new Map(),
  );

  return workoutExerciseRows.flatMap((row) => {
    const resolvedExercise = resolvedById.get(row.exercise_id);

    if (!resolvedExercise) {
      return [];
    }

    return [{ ...row, exercises: resolvedExercise }];
  });
}

async function getExerciseOverrideRepository(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  userId: string,
  exerciseId: string,
): Promise<ExerciseOverride | null> {
  const { data, error } = await supabase
    .from("exercise_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function upsertExerciseOverrideRepository(input: {
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"];
  userId: string;
  exerciseId: string;
  customName?: string | null;
  customModality?: string | null;
  customMuscleGroup?: string | null;
  archivedAt?: string | null;
  hiddenAt?: string | null;
}) {
  const now = new Date().toISOString();

  const { error } = await input.supabase.from("exercise_overrides").upsert(
    {
      user_id: input.userId,
      exercise_id: input.exerciseId,
      custom_name: input.customName ?? null,
      custom_modality: input.customModality ?? null,
      custom_muscle_group: input.customMuscleGroup ?? null,
      archived_at: input.archivedAt ?? null,
      hidden_at: input.hiddenAt ?? null,
      updated_at: now,
    },
    { onConflict: "user_id,exercise_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function deleteExerciseOverrideRepository(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  userId: string,
  exerciseId: string,
) {
  const { error } = await supabase
    .from("exercise_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateSystemExerciseOverrideRepository(input: {
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"];
  userId: string;
  exercise: Exercise;
  draft: ExerciseDraftInput;
}) {
  const currentOverride = await getExerciseOverrideRepository(
    input.supabase,
    input.userId,
    input.exercise.id,
  );
  const nextOverride = {
    custom_name:
      input.draft.name === input.exercise.name ? null : input.draft.name,
    custom_modality:
      input.draft.modality === input.exercise.modality
        ? null
        : input.draft.modality ?? null,
    custom_muscle_group:
      input.draft.muscleGroup === input.exercise.muscle_group
        ? null
        : input.draft.muscleGroup ?? null,
    archived_at: currentOverride?.archived_at ?? null,
    hidden_at: currentOverride?.hidden_at ?? null,
  };

  if (isOverrideEmpty(nextOverride)) {
    await deleteExerciseOverrideRepository(
      input.supabase,
      input.userId,
      input.exercise.id,
    );
    return resolveExerciseForUser(input.exercise, null);
  }

  await upsertExerciseOverrideRepository({
    supabase: input.supabase,
    userId: input.userId,
    exerciseId: input.exercise.id,
    customName: nextOverride.custom_name,
    customModality: nextOverride.custom_modality,
    customMuscleGroup: nextOverride.custom_muscle_group,
    archivedAt: nextOverride.archived_at,
    hiddenAt: nextOverride.hidden_at,
  });

  return resolveExerciseForUser(input.exercise, {
    ...(currentOverride ?? {
      id: "",
      user_id: input.userId,
      exercise_id: input.exercise.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    custom_name: nextOverride.custom_name,
    custom_modality: nextOverride.custom_modality,
    custom_muscle_group: nextOverride.custom_muscle_group,
    archived_at: nextOverride.archived_at,
    hidden_at: nextOverride.hidden_at,
  });
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

export async function listExerciseLibraryRepository(input: {
  search: string;
  statusFilter: ExerciseLibraryFilter;
  sourceFilter: ExerciseLibrarySourceFilter;
  page: number;
  pageSize: number;
}): Promise<{
  exercises: ResolvedExercise[];
  workoutLinks: ExerciseWorkoutLinkRow[];
  logRows: ExerciseLogSummaryRow[];
  stats: {
    totalCount: number;
    systemCount: number;
    activeCount: number;
    archivedCount: number;
  };
  totalItems: number;
  page: number;
  pageSize: number;
}> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const exerciseRows = await listAccessibleExerciseRows(supabase, user.id);

  const resolvedExercises = (await resolveExercisesForUser(
    supabase,
    user.id,
    exerciseRows,
  )).filter((exercise) => exercise.hidden_at == null);

  const stats = buildExerciseLibraryStats(resolvedExercises);
  const filteredExercises = sortResolvedExercisesForLibrary(
    filterResolvedExercisesForLibrary(
      resolvedExercises,
      input.search,
      input.statusFilter,
      input.sourceFilter,
    ),
  );
  const totalItems = filteredExercises.length;
  const totalPages =
    totalItems === 0 ? 1 : Math.ceil(totalItems / input.pageSize);
  const page = Math.min(Math.max(input.page, 1), totalPages);
  const startIndex = (page - 1) * input.pageSize;
  const pageExercises = filteredExercises.slice(
    startIndex,
    startIndex + input.pageSize,
  );
  const pageExerciseIds = pageExercises.map((exercise) => exercise.id);

  if (pageExerciseIds.length === 0) {
    return {
      exercises: [],
      workoutLinks: [],
      logRows: [],
      stats,
      totalItems,
      page,
      pageSize: input.pageSize,
    };
  }

  const [workoutLinksResult, logsResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("exercise_id, workouts!inner(id, name, user_id)")
      .eq("workouts.user_id", user.id)
      .in("exercise_id", pageExerciseIds),
    supabase
      .from("set_logs")
      .select(
        "exercise_id, session_id, weight_kg, reps, workout_sessions!inner(performed_at, user_id)",
      )
      .eq("workout_sessions.user_id", user.id)
      .in("exercise_id", pageExerciseIds),
  ]);

  if (workoutLinksResult.error) {
    throw new Error(workoutLinksResult.error.message);
  }

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const workoutLinks = (
    (workoutLinksResult.data as WorkoutLinkQueryRow[] | null) ?? []
  ).flatMap((row) =>
    row.workouts == null
      ? []
      : [
          {
            exerciseId: row.exercise_id,
            workoutId: row.workouts.id,
            workoutName: row.workouts.name,
          },
        ],
  );

  const logRows = ((logsResult.data as ExerciseLogQueryRow[] | null) ?? []).flatMap(
    (row) =>
      row.workout_sessions == null
        ? []
        : [
            {
              exerciseId: row.exercise_id,
              sessionId: row.session_id,
              performedAt: row.workout_sessions.performed_at,
              weightKg: Number(row.weight_kg),
              reps: row.reps,
            },
          ],
  );

  return {
    exercises: pageExercises,
    workoutLinks,
    logRows,
    stats,
    totalItems,
    page,
    pageSize: input.pageSize,
  };
}

export async function getWorkoutEditorDataRepository(
  workoutId: string,
): Promise<WorkoutEditorData | null> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [workoutResult, workoutExercisesResult, cardioBlocksResult] = await Promise.all([
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
    supabase
      .from("workout_cardio_blocks")
      .select("*")
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

  if (cardioBlocksResult.error) {
    throw new Error(cardioBlocksResult.error.message);
  }

  const workoutExercises = await resolveWorkoutExerciseRowsForUser(
    supabase,
    (workoutExercisesResult.data as WorkoutExerciseQueryRow[] | null) ?? [],
    user.id,
  );

  return {
    workout: workoutResult.data,
    workoutExercises,
    cardioBlocks:
      (cardioBlocksResult.data as WorkoutEditorCardioBlock[] | null) ?? [],
  };
}

export async function listAvailableExercisesRepository(
  workoutId: string,
): Promise<ResolvedExercise[]> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  const [exerciseRows, workoutExerciseResult] = await Promise.all([
    listAccessibleExerciseRows(supabase, user.id),
    supabase
      .from("workout_exercises")
      .select("exercise_id")
      .eq("workout_id", workoutId),
  ]);

  if (workoutExerciseResult.error) {
    throw new Error(workoutExerciseResult.error.message);
  }

  const usedExerciseIds = new Set(
    (workoutExerciseResult.data ?? []).map((item) => item.exercise_id),
  );
  const resolvedExercises = await resolveExercisesForUser(
    supabase,
    user.id,
    exerciseRows,
  );

  return resolvedExercises.filter(
    (exercise) =>
      !usedExerciseIds.has(exercise.id) && isExerciseAvailableForPicker(exercise),
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
    requireAccessibleExercise(supabase, user.id, exerciseId),
  ]);

  const resolvedExercise = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!resolvedExercise) {
    throw new Error("Exercise not found");
  }

  const [resolvedCandidate] = await resolveExercisesForUser(
    supabase,
    user.id,
    [resolvedExercise],
  );

  if (!resolvedCandidate || !isExerciseAvailableForPicker(resolvedCandidate)) {
    throw new Error("This exercise is not available to add right now");
  }

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
    if (error.code === "23505") {
      throw new Error("This exercise is already in this workout");
    }

    throw new Error(error.message);
  }

  const [resolvedWorkoutExercise] = await resolveWorkoutExerciseRowsForUser(
    supabase,
    [data as WorkoutExerciseQueryRow],
    user.id,
  );

  if (!resolvedWorkoutExercise) {
    throw new Error("Exercise could not be resolved after insertion");
  }

  return resolvedWorkoutExercise;
}

export async function createExerciseRepository(
  input: ExerciseDraftInput,
): Promise<ResolvedExercise> {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: user.id,
      name: input.name,
      modality: input.modality ?? null,
      muscle_group: input.muscleGroup ?? null,
      is_system: false,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(buildExerciseAlreadyExistsMessage(input));
    }

    throw new Error(error.message);
  }

  return resolveExerciseForUser(data, null);
}

export async function getExerciseDetailRepository(
  exerciseId: string,
): Promise<{
  exercise: ResolvedExercise;
  linkedWorkouts: ExerciseLinkedWorkout[];
  logRows: ExerciseLogSummaryRow[];
} | null> {
  const { supabase, user } = await getAuthenticatedServerContext();
  const exerciseRecord = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!exerciseRecord) {
    return null;
  }

  const [resolvedExercise] = await resolveExercisesForUser(
    supabase,
    user.id,
    [exerciseRecord],
  );

  if (!resolvedExercise) {
    throw new Error("Exercise could not be resolved");
  }

  const [linkedWorkoutsResult, logsResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("exercise_id, workouts!inner(id, name, user_id)")
      .eq("exercise_id", exerciseId)
      .eq("workouts.user_id", user.id),
    supabase
      .from("set_logs")
      .select(
        "exercise_id, session_id, weight_kg, reps, workout_sessions!inner(performed_at, user_id)",
      )
      .eq("exercise_id", exerciseId)
      .eq("workout_sessions.user_id", user.id),
  ]);

  if (linkedWorkoutsResult.error) {
    throw new Error(linkedWorkoutsResult.error.message);
  }

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const linkedWorkouts = (
    (linkedWorkoutsResult.data as WorkoutLinkQueryRow[] | null) ?? []
  )
    .flatMap((row) =>
      row.workouts == null
        ? []
        : [
            {
              id: row.workouts.id,
              name: row.workouts.name,
            },
          ],
    )
    .filter(
      (workout, index, items) =>
        items.findIndex((candidate) => candidate.id === workout.id) === index,
    );

  const logRows = ((logsResult.data as ExerciseLogQueryRow[] | null) ?? []).flatMap(
    (row) =>
      row.workout_sessions == null
        ? []
        : [
            {
              exerciseId: row.exercise_id,
              sessionId: row.session_id,
              performedAt: row.workout_sessions.performed_at,
              weightKg: Number(row.weight_kg),
              reps: row.reps,
            },
          ],
  );

  return {
    exercise: resolvedExercise,
    linkedWorkouts,
    logRows,
  };
}

export async function updateExerciseRepository(
  exerciseId: string,
  input: ExerciseDraftInput,
): Promise<ResolvedExercise> {
  const { supabase, user } = await getAuthenticatedServerContext();
  const exerciseRecord = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!exerciseRecord) {
    throw new Error("Exercise not found");
  }

  if (exerciseRecord.is_system) {
    return updateSystemExerciseOverrideRepository({
      supabase,
      userId: user.id,
      exercise: exerciseRecord,
      draft: input,
    });
  }

  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: input.name,
      modality: input.modality ?? null,
      muscle_group: input.muscleGroup ?? null,
    })
    .eq("id", exerciseId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(buildExerciseAlreadyExistsMessage(input));
    }

    throw new Error(error.message);
  }

  return resolveExerciseForUser(data, null);
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

export async function checkExerciseHasLogsRepository(
  exerciseId: string,
): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireAccessibleExercise(supabase, user.id, exerciseId);

  const { count, error } = await supabase
    .from("set_logs")
    .select("id", { head: true, count: "exact" })
    .eq("exercise_id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }

  return (count ?? 0) > 0;
}

export async function archiveExerciseRepository(
  exerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  const exerciseRecord = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!exerciseRecord) {
    throw new Error("Exercise not found");
  }

  if (exerciseRecord.is_system) {
    const currentOverride = await getExerciseOverrideRepository(
      supabase,
      user.id,
      exerciseId,
    );
    await upsertExerciseOverrideRepository({
      supabase,
      userId: user.id,
      exerciseId,
      customName: currentOverride?.custom_name ?? null,
      customModality: currentOverride?.custom_modality ?? null,
      customMuscleGroup: currentOverride?.custom_muscle_group ?? null,
      archivedAt: new Date().toISOString(),
      hiddenAt: currentOverride?.hidden_at ?? null,
    });
    return;
  }

  const { error } = await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function unarchiveExerciseRepository(
  exerciseId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  const exerciseRecord = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!exerciseRecord) {
    throw new Error("Exercise not found");
  }

  if (exerciseRecord.is_system) {
    const currentOverride = await getExerciseOverrideRepository(
      supabase,
      user.id,
      exerciseId,
    );

    if (!currentOverride) {
      return;
    }

    const nextOverride = {
      custom_name: currentOverride.custom_name,
      custom_modality: currentOverride.custom_modality,
      custom_muscle_group: currentOverride.custom_muscle_group,
      archived_at: null,
      hidden_at: currentOverride.hidden_at,
    };

    if (isOverrideEmpty(nextOverride)) {
      await deleteExerciseOverrideRepository(supabase, user.id, exerciseId);
      return;
    }

    await upsertExerciseOverrideRepository({
      supabase,
      userId: user.id,
      exerciseId,
      customName: nextOverride.custom_name,
      customModality: nextOverride.custom_modality,
      customMuscleGroup: nextOverride.custom_muscle_group,
      archivedAt: null,
      hiddenAt: nextOverride.hidden_at,
    });
    return;
  }

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
  const exerciseRecord = await getAccessibleExerciseRecord(
    supabase,
    user.id,
    exerciseId,
  );

  if (!exerciseRecord) {
    throw new Error("Exercise not found");
  }

  if (exerciseRecord.is_system) {
    const currentOverride = await getExerciseOverrideRepository(
      supabase,
      user.id,
      exerciseId,
    );
    await upsertExerciseOverrideRepository({
      supabase,
      userId: user.id,
      exerciseId,
      customName: currentOverride?.custom_name ?? null,
      customModality: currentOverride?.custom_modality ?? null,
      customMuscleGroup: currentOverride?.custom_muscle_group ?? null,
      archivedAt: currentOverride?.archived_at ?? null,
      hiddenAt: new Date().toISOString(),
    });
    return;
  }

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

  if (
    (linkedWorkoutCountResult.count ?? 0) > 0 ||
    (logCountResult.count ?? 0) > 0
  ) {
    throw new Error(
      "Exercise cannot be deleted because it still has history or linked workouts",
    );
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

  for (const [index, workoutExerciseId] of orderedWorkoutExerciseIds.entries()) {
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

function normalizeWorkoutCardioBlockName(name: string) {
  return name.trim();
}

export async function createWorkoutCardioBlockRepository(
  workoutId: string,
  input: WorkoutCardioDraftInput,
): Promise<WorkoutCardioBlock> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  const normalizedName = normalizeWorkoutCardioBlockName(input.name);

  const { count, error: countError } = await supabase
    .from("workout_cardio_blocks")
    .select("*", { count: "exact", head: true })
    .eq("workout_id", workoutId);

  if (countError) {
    throw new Error(countError.message);
  }

  const { data, error } = await supabase
    .from("workout_cardio_blocks")
    .insert({
      workout_id: workoutId,
      name: normalizedName,
      target_duration_minutes: input.targetDurationMinutes ?? null,
      display_order: count ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A cardio block with this name already exists in this workout");
    }

    throw new Error(error.message);
  }

  return data;
}

export async function updateWorkoutCardioBlockRepository(
  workoutCardioBlockId: string,
  input: WorkoutCardioDraftInput,
): Promise<WorkoutCardioBlock> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutCardioBlock(supabase, user.id, workoutCardioBlockId);

  const normalizedName = normalizeWorkoutCardioBlockName(input.name);

  const { data, error } = await supabase
    .from("workout_cardio_blocks")
    .update({
      name: normalizedName,
      target_duration_minutes: input.targetDurationMinutes ?? null,
    })
    .eq("id", workoutCardioBlockId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A cardio block with this name already exists in this workout");
    }

    throw new Error(error.message);
  }

  return data;
}

export async function deleteWorkoutCardioBlockRepository(
  workoutCardioBlockId: string,
): Promise<void> {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutCardioBlock(supabase, user.id, workoutCardioBlockId);

  const { error } = await supabase
    .from("workout_cardio_blocks")
    .delete()
    .eq("id", workoutCardioBlockId);

  if (error) {
    throw new Error(error.message);
  }
}
