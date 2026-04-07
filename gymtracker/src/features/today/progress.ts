import type { ExerciseLogState } from "@/features/today/types";

export function getCompletedExerciseSetCount(exerciseLog: ExerciseLogState) {
  if (exerciseLog.skipped) {
    return 0;
  }

  return exerciseLog.sets.filter((set) => set.saved).length;
}
