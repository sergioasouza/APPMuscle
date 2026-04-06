import "server-only";

import { revalidatePath } from "next/cache";

function revalidatePaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateScheduleSurfaces() {
  revalidatePaths(["/schedule", "/today", "/calendar"]);
}

export function revalidateTodaySurfaces() {
  revalidatePaths(["/today", "/calendar", "/analytics"]);
}

export function revalidateWorkoutSurfaces() {
  revalidatePaths(["/workouts", "/schedule", "/today", "/calendar", "/analytics"]);
}

export function revalidateExerciseLibrarySurfaces(exerciseId?: string) {
  revalidateWorkoutSurfaces();
  revalidatePaths(["/workouts/exercises"]);

  if (exerciseId) {
    revalidatePath(`/workouts/exercises/${exerciseId}`);
  }
}
