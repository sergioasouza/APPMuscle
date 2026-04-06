"use server";

import { revalidatePath } from "next/cache";
import {
  addExistingExerciseToWorkout,
  archiveExercise,
  checkExerciseHasLogs,
  createExerciseAndAddToWorkout,
  createExerciseFromInput,
  createWorkoutCardioBlock,
  createWorkout,
  deleteWorkoutCardioBlock,
  deleteExercise,
  deleteWorkout,
  deleteWorkoutExercise,
  listAvailableExercises,
  reorderWorkoutExercises,
  unarchiveExercise,
  updateExercise,
  updateWorkoutCardioBlock,
  updateWorkoutExerciseTargetSets,
  updateWorkoutName,
} from "@/features/workouts/service";
import type {
  ExerciseDraftInput,
  WorkoutEditorCardioBlock,
  WorkoutCardioDraftInput,
  WorkoutEditorExercise,
  WorkoutListItem,
} from "@/features/workouts/types";

import { errorResult, okResult } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import {
  revalidateExerciseLibrarySurfaces,
  revalidateWorkoutSurfaces,
} from "@/lib/revalidate-app-routes";
import type { ResolvedExercise } from "@/lib/types";

export async function createWorkoutAction(
  name: string,
): Promise<ActionResult<WorkoutListItem>> {
  try {
    const workout = await createWorkout(name);
    revalidateWorkoutSurfaces();

    return okResult(workout);
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteWorkoutAction(
  workoutId: string,
): Promise<ActionResult<null>> {
  try {
    await deleteWorkout(workoutId);
    revalidateWorkoutSurfaces();

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateWorkoutNameAction(
  workoutId: string,
  name: string,
): Promise<ActionResult<WorkoutListItem>> {
  try {
    const workout = await updateWorkoutName(workoutId, name);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(workout);
  } catch (error) {
    return errorResult(error);
  }
}

export async function listAvailableExercisesAction(
  workoutId: string,
): Promise<ActionResult<ResolvedExercise[]>> {
  try {
    const exercises = await listAvailableExercises(workoutId);
    return okResult(exercises);
  } catch (error) {
    return errorResult(error);
  }
}

export async function addExistingExerciseToWorkoutAction(
  workoutId: string,
  exerciseId: string,
): Promise<ActionResult<WorkoutEditorExercise>> {
  try {
    const workoutExercise = await addExistingExerciseToWorkout(
      workoutId,
      exerciseId,
    );
    revalidateExerciseLibrarySurfaces(exerciseId);
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(workoutExercise);
  } catch (error) {
    return errorResult(error);
  }
}

export async function createExerciseAndAddToWorkoutAction(
  workoutId: string,
  exerciseInput: string | ExerciseDraftInput,
): Promise<ActionResult<WorkoutEditorExercise>> {
  try {
    const { exercise, workoutExercise } = await createExerciseAndAddToWorkout(
      workoutId,
      exerciseInput,
    );
    revalidateExerciseLibrarySurfaces(exercise.id);
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(workoutExercise);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateWorkoutExerciseTargetSetsAction(
  workoutId: string,
  workoutExerciseId: string,
  targetSets: number,
): Promise<ActionResult<null>> {
  try {
    await updateWorkoutExerciseTargetSets(workoutExerciseId, targetSets);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteWorkoutExerciseAction(
  workoutId: string,
  workoutExerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await deleteWorkoutExercise(workoutExerciseId);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function reorderWorkoutExercisesAction(
  workoutId: string,
  orderedWorkoutExerciseIds: string[],
): Promise<ActionResult<null>> {
  try {
    await reorderWorkoutExercises(workoutId, orderedWorkoutExerciseIds);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Returns true if the exercise has any recorded set_logs across all sessions.
 * Called before showing the remove-exercise dialog to decide whether to offer
 * an "Archive" option that preserves history instead of silently keeping data.
 */
export async function checkExerciseHasLogsAction(
  exerciseId: string,
): Promise<ActionResult<boolean>> {
  try {
    const hasLogs = await checkExerciseHasLogs(exerciseId);
    return okResult(hasLogs);
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Archives an exercise: sets archived_at = NOW() so it disappears from all
 * exercise pickers while its set_log history remains intact in the database.
 */
export async function archiveExerciseAction(
  exerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await archiveExercise(exerciseId);
    revalidateExerciseLibrarySurfaces(exerciseId);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function createExerciseAction(
  input: ExerciseDraftInput,
): Promise<ActionResult<ResolvedExercise>> {
  try {
    const exercise = await createExerciseFromInput(input);
    revalidateExerciseLibrarySurfaces();

    return okResult(exercise);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateExerciseAction(
  exerciseId: string,
  input: ExerciseDraftInput,
): Promise<ActionResult<ResolvedExercise>> {
  try {
    const exercise = await updateExercise(exerciseId, input);
    revalidateExerciseLibrarySurfaces(exerciseId);

    return okResult(exercise);
  } catch (error) {
    return errorResult(error);
  }
}

export async function unarchiveExerciseAction(
  exerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await unarchiveExercise(exerciseId);
    revalidateExerciseLibrarySurfaces(exerciseId);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteExerciseAction(
  exerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await deleteExercise(exerciseId);
    revalidateExerciseLibrarySurfaces();

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function createWorkoutCardioBlockAction(
  workoutId: string,
  input: WorkoutCardioDraftInput,
): Promise<ActionResult<WorkoutEditorCardioBlock>> {
  try {
    const cardioBlock = await createWorkoutCardioBlock(workoutId, input);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(cardioBlock);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateWorkoutCardioBlockAction(
  workoutId: string,
  workoutCardioBlockId: string,
  input: WorkoutCardioDraftInput,
): Promise<ActionResult<WorkoutEditorCardioBlock>> {
  try {
    const cardioBlock = await updateWorkoutCardioBlock(workoutCardioBlockId, input);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(cardioBlock);
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteWorkoutCardioBlockAction(
  workoutId: string,
  workoutCardioBlockId: string,
): Promise<ActionResult<null>> {
  try {
    await deleteWorkoutCardioBlock(workoutCardioBlockId);
    revalidateWorkoutSurfaces();
    revalidatePath(`/workouts/${workoutId}`);

    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}
