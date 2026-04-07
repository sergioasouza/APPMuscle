import { describe, expect, it } from "vitest";

import { getCompletedExerciseSetCount } from "@/features/today/progress";
import type { ExerciseLogState } from "@/features/today/types";

function buildExerciseLog(overrides: Partial<ExerciseLogState>): ExerciseLogState {
  return {
    exerciseId: "replacement",
    originalExerciseId: "original",
    exerciseName: "Crucifixo",
    originalExerciseName: "Voador",
    substitution: null,
    targetSets: 3,
    previousSets: [],
    skipped: false,
    sets: [
      { weight: "10", reps: "12", saved: true },
      { weight: "10", reps: "10", saved: true },
      { weight: "", reps: "", saved: false },
    ],
    ...overrides,
  };
}

describe("today progress", () => {
  it("counts only saved sets for normal exercises", () => {
    expect(getCompletedExerciseSetCount(buildExerciseLog({}))).toBe(2);
  });

  it("does not count target sets for skipped exercises", () => {
    expect(getCompletedExerciseSetCount(buildExerciseLog({ skipped: true }))).toBe(0);
  });
});
