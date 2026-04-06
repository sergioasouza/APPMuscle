import "server-only";

import {
  addExerciseToWorkoutRepository,
  archiveExerciseRepository,
  deleteExerciseRepository,
  deleteWorkoutCardioBlockRepository,
  checkExerciseHasLogsRepository,
  createExerciseRepository,
  createWorkoutCardioBlockRepository,
  createWorkoutRepository,
  deleteWorkoutExerciseRepository,
  deleteWorkoutRepository,
  getExerciseDetailRepository,
  getWorkoutEditorDataRepository,
  listAvailableExercisesRepository,
  listExerciseLibraryRepository,
  listWorkoutsRepository,
  reorderWorkoutExercisesRepository,
  unarchiveExerciseRepository,
  updateExerciseRepository,
  updateWorkoutCardioBlockRepository,
  updateWorkoutExerciseTargetSetsRepository,
  updateWorkoutNameRepository,
} from "@/features/workouts/repository";
import {
  buildExerciseDetailData,
  buildExerciseLibraryItems,
} from "@/features/workouts/library";
import { getExerciseGlobalAnalytics } from "@/features/analytics/service";
import { normalizeExerciseText } from "@/lib/exercise-resolution";
import type {
  ExerciseDraftInput,
  ExerciseLibraryFilter,
  ExerciseLibrarySourceFilter,
  WorkoutCardioDraftInput,
} from "@/features/workouts/types";

export const EXERCISE_LIBRARY_PAGE_SIZE_OPTIONS = [10, 20, 30] as const;
export const DEFAULT_EXERCISE_LIBRARY_PAGE_SIZE =
  EXERCISE_LIBRARY_PAGE_SIZE_OPTIONS[0];

function normalizeExerciseLibraryFilter(
  value: string | undefined,
): ExerciseLibraryFilter {
  return value === "archived" || value === "all" ? value : "active";
}

function normalizeExerciseLibrarySourceFilter(
  value: string | undefined,
): ExerciseLibrarySourceFilter {
  return value === "custom" || value === "system" ? value : "all";
}

function normalizePositiveInteger(value: string | number | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

function normalizeExerciseLibraryPageSize(value: string | number | undefined) {
  const parsed = normalizePositiveInteger(value);

  return EXERCISE_LIBRARY_PAGE_SIZE_OPTIONS.includes(
    parsed as (typeof EXERCISE_LIBRARY_PAGE_SIZE_OPTIONS)[number],
  )
    ? parsed
    : DEFAULT_EXERCISE_LIBRARY_PAGE_SIZE;
}

function normalizeExerciseInput(input: ExerciseDraftInput): ExerciseDraftInput {
  return {
    name: input.name.trim(),
    modality: normalizeExerciseText(input.modality),
    muscleGroup: normalizeExerciseText(input.muscleGroup),
  };
}

function normalizeWorkoutCardioInput(
  input: WorkoutCardioDraftInput,
): WorkoutCardioDraftInput {
  return {
    name: input.name.trim(),
    targetDurationMinutes:
      input.targetDurationMinutes == null ? null : input.targetDurationMinutes,
  };
}

export async function listWorkouts() {
  return listWorkoutsRepository();
}

export async function listExerciseLibrary(input?: {
  search?: string;
  statusFilter?: string;
  sourceFilter?: string;
  page?: string | number;
  pageSize?: string | number;
}) {
  const search = input?.search?.trim() ?? "";
  const statusFilter = normalizeExerciseLibraryFilter(input?.statusFilter);
  const sourceFilter = normalizeExerciseLibrarySourceFilter(input?.sourceFilter);
  const page = normalizePositiveInteger(input?.page);
  const pageSize = normalizeExerciseLibraryPageSize(input?.pageSize);
  const data = await listExerciseLibraryRepository({
    search,
    statusFilter,
    sourceFilter,
    page,
    pageSize,
  });
  const totalPages =
    data.totalItems === 0 ? 1 : Math.ceil(data.totalItems / data.pageSize);

  return {
    items: buildExerciseLibraryItems(data),
    stats: data.stats,
    pagination: {
      page: data.page,
      pageSize: data.pageSize,
      totalItems: data.totalItems,
      totalPages,
      hasPreviousPage: data.page > 1,
      hasNextPage: data.page < totalPages,
    },
    query: {
      search,
      statusFilter,
      sourceFilter,
      page: data.page,
      pageSize: data.pageSize,
    },
  };
}

export async function getWorkoutEditorData(workoutId: string) {
  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  return getWorkoutEditorDataRepository(workoutId);
}

export async function listAvailableExercises(workoutId: string) {
  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  return listAvailableExercisesRepository(workoutId);
}

export async function getExerciseDetail(exerciseId: string) {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  const detail = await getExerciseDetailRepository(exerciseId);

  if (!detail) {
    return null;
  }

  const globalAnalytics = await getExerciseGlobalAnalytics(exerciseId);

  return buildExerciseDetailData({
    exercise: detail.exercise,
    linkedWorkouts: detail.linkedWorkouts,
    logRows: detail.logRows,
    globalAnalytics,
  });
}

export async function createWorkout(name: string) {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Workout name is required");
  }

  return createWorkoutRepository(normalizedName);
}

export async function createExercise(name: string) {
  return createExerciseFromInput({ name });
}

export async function createExerciseFromInput(input: ExerciseDraftInput) {
  const normalizedInput = normalizeExerciseInput(input);

  if (!normalizedInput.name) {
    throw new Error("Exercise name is required");
  }

  return createExerciseRepository(normalizedInput);
}

export async function deleteWorkout(workoutId: string) {
  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  await deleteWorkoutRepository(workoutId);
}

export async function updateWorkoutName(workoutId: string, name: string) {
  const normalizedName = name.trim();

  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  if (!normalizedName) {
    throw new Error("Workout name is required");
  }

  return updateWorkoutNameRepository(workoutId, normalizedName);
}

export async function updateExercise(
  exerciseId: string,
  input: ExerciseDraftInput,
) {
  const normalizedInput = normalizeExerciseInput(input);

  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  if (!normalizedInput.name) {
    throw new Error("Exercise name is required");
  }

  return updateExerciseRepository(exerciseId, normalizedInput);
}

export async function addExistingExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
) {
  if (!workoutId || !exerciseId) {
    throw new Error("Workout and exercise are required");
  }

  return addExerciseToWorkoutRepository(workoutId, exerciseId, 3);
}

export async function createExerciseAndAddToWorkout(
  workoutId: string,
  exerciseInput: string | ExerciseDraftInput,
) {
  const normalizedInput = normalizeExerciseInput(
    typeof exerciseInput === "string" ? { name: exerciseInput } : exerciseInput,
  );

  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  if (!normalizedInput.name) {
    throw new Error("Exercise name is required");
  }

  const exercise = await createExerciseRepository(normalizedInput);
  const workoutExercise = await addExerciseToWorkoutRepository(
    workoutId,
    exercise.id,
    3,
  );

  return {
    exercise,
    workoutExercise,
  };
}

export async function updateWorkoutExerciseTargetSets(
  workoutExerciseId: string,
  targetSets: number,
) {
  if (!workoutExerciseId) {
    throw new Error("Workout exercise id is required");
  }

  if (targetSets < 1 || targetSets > 20) {
    throw new Error("Target sets must be between 1 and 20");
  }

  await updateWorkoutExerciseTargetSetsRepository(
    workoutExerciseId,
    targetSets,
  );
}

export async function deleteWorkoutExercise(workoutExerciseId: string) {
  if (!workoutExerciseId) {
    throw new Error("Workout exercise id is required");
  }

  await deleteWorkoutExerciseRepository(workoutExerciseId);
}

export async function reorderWorkoutExercises(
  workoutId: string,
  orderedWorkoutExerciseIds: string[],
) {
  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  if (orderedWorkoutExerciseIds.length === 0) {
    return;
  }

  await reorderWorkoutExercisesRepository(workoutId, orderedWorkoutExerciseIds);
}

/**
 * Returns true if the exercise has any set_logs recorded in any session.
 * Used to decide whether to offer "Archive" instead of hard-delete.
 */
export async function checkExerciseHasLogs(
  exerciseId: string,
): Promise<boolean> {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  return checkExerciseHasLogsRepository(exerciseId);
}

/**
 * Archives an exercise by setting archived_at = NOW().
 * The exercise disappears from all pickers but its history is preserved.
 */
export async function archiveExercise(exerciseId: string): Promise<void> {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  await archiveExerciseRepository(exerciseId);
}

export async function unarchiveExercise(exerciseId: string): Promise<void> {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  await unarchiveExerciseRepository(exerciseId);
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  await deleteExerciseRepository(exerciseId);
}

export async function createWorkoutCardioBlock(
  workoutId: string,
  input: WorkoutCardioDraftInput,
) {
  const normalizedInput = normalizeWorkoutCardioInput(input);

  if (!workoutId) {
    throw new Error("Workout id is required");
  }

  if (!normalizedInput.name) {
    throw new Error("Cardio name is required");
  }

  if (
    normalizedInput.targetDurationMinutes != null &&
    (normalizedInput.targetDurationMinutes < 1 ||
      normalizedInput.targetDurationMinutes > 1440)
  ) {
    throw new Error("Cardio target duration must be between 1 and 1440 minutes");
  }

  return createWorkoutCardioBlockRepository(workoutId, normalizedInput);
}

export async function updateWorkoutCardioBlock(
  workoutCardioBlockId: string,
  input: WorkoutCardioDraftInput,
) {
  const normalizedInput = normalizeWorkoutCardioInput(input);

  if (!workoutCardioBlockId) {
    throw new Error("Workout cardio block id is required");
  }

  if (!normalizedInput.name) {
    throw new Error("Cardio name is required");
  }

  if (
    normalizedInput.targetDurationMinutes != null &&
    (normalizedInput.targetDurationMinutes < 1 ||
      normalizedInput.targetDurationMinutes > 1440)
  ) {
    throw new Error("Cardio target duration must be between 1 and 1440 minutes");
  }

  return updateWorkoutCardioBlockRepository(
    workoutCardioBlockId,
    normalizedInput,
  );
}

export async function deleteWorkoutCardioBlock(workoutCardioBlockId: string) {
  if (!workoutCardioBlockId) {
    throw new Error("Workout cardio block id is required");
  }

  await deleteWorkoutCardioBlockRepository(workoutCardioBlockId);
}
