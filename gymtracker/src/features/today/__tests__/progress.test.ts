import { describe, expect, it } from "vitest";

import { getCompletedExerciseSetCount } from "@/features/today/progress";
import type { ExerciseLogState } from "@/features/today/types";
import {
  buildSetSegments,
  createDefaultSetPrescription,
  type SetLogState,
} from "@/lib/set-methods";

function buildSet(state: SetLogState) {
  const prescription = createDefaultSetPrescription("straight");
  return {
    prescription,
    segments: buildSetSegments(prescription).map((segment) => ({
      ...segment,
      weight: state === "in_progress" ? "" : "10",
      reps: state === "in_progress" ? "" : "10",
      completed: state !== "in_progress",
    })),
    actualRir: "",
    state,
    saved: state !== "in_progress",
    started: state !== "in_progress",
  };
}

function buildExerciseLog(overrides: Partial<ExerciseLogState>): ExerciseLogState {
  return {
    exerciseId: "replacement",
    originalExerciseId: "original",
    exerciseName: "Crucifixo",
    originalExerciseName: "Voador",
    substitution: null,
    targetSets: 3,
    plannedTargetSets: 3,
    previousSets: [],
    skipped: false,
    sets: [
      buildSet("completed"),
      buildSet("stopped"),
      buildSet("in_progress"),
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

  it("does not count more saved sets than the valid target for the session", () => {
    expect(
      getCompletedExerciseSetCount(
        buildExerciseLog({
          targetSets: 1,
          sets: [
            buildSet("completed"),
            buildSet("completed"),
            buildSet("in_progress"),
          ],
        }),
      ),
    ).toBe(1);
  });
});
