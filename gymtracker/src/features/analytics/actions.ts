"use server";

import {
  getExerciseGlobalAnalytics,
  getWorkoutAnalytics,
} from "@/features/analytics/service";
import type {
  ExerciseGlobalAnalyticsData,
  WorkoutAnalyticsData,
} from "@/features/analytics/types";
import { errorResult, okResult } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";

export async function getWorkoutAnalyticsAction(
  workoutId: string,
): Promise<ActionResult<WorkoutAnalyticsData>> {
  try {
    const data = await getWorkoutAnalytics(workoutId);
    return okResult(data);
  } catch (error) {
    return errorResult(error);
  }
}

export async function getExerciseGlobalAnalyticsAction(
  exerciseId: string,
): Promise<ActionResult<ExerciseGlobalAnalyticsData>> {
  try {
    const data = await getExerciseGlobalAnalytics(exerciseId);
    return okResult(data);
  } catch (error) {
    return errorResult(error);
  }
}
