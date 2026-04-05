import {
  buildExerciseDetailData,
  buildExerciseLibraryItems,
  buildExerciseUsageSummary,
  filterExerciseLibraryItems,
} from "@/features/workouts/library";
import type { ExerciseGlobalAnalyticsData } from "@/features/analytics/types";
import type { Exercise } from "@/lib/types";

const exerciseA: Exercise = {
  id: "exercise-a",
  user_id: "user-1",
  name: "Bench Press",
  archived_at: null,
  created_at: "2026-04-01T08:00:00.000Z",
};

const exerciseB: Exercise = {
  id: "exercise-b",
  user_id: "user-1",
  name: "Cable Fly",
  archived_at: "2026-04-03T08:00:00.000Z",
  created_at: "2026-04-02T08:00:00.000Z",
};

const emptyAnalytics: ExerciseGlobalAnalyticsData = {
  exerciseId: exerciseA.id,
  exerciseName: exerciseA.name,
  evolution: [],
  summary: null,
};

describe("workouts library helpers", () => {
  it("marks an exercise as deletable only when it has no logs and no linked workouts", () => {
    expect(
      buildExerciseUsageSummary({
        linkedWorkoutCount: 0,
        logRows: [],
      }).canDelete,
    ).toBe(true);

    expect(
      buildExerciseUsageSummary({
        linkedWorkoutCount: 1,
        logRows: [],
      }).canDelete,
    ).toBe(false);

    expect(
      buildExerciseUsageSummary({
        linkedWorkoutCount: 0,
        logRows: [
          {
            exerciseId: exerciseA.id,
            sessionId: "session-1",
            performedAt: "2026-04-05",
            weightKg: 80,
            reps: 8,
          },
        ],
      }).canDelete,
    ).toBe(false);
  });

  it("derives library metrics from linked workouts and set logs", () => {
    const items = buildExerciseLibraryItems({
      exercises: [exerciseA],
      workoutLinks: [
        {
          exerciseId: exerciseA.id,
          workoutId: "workout-1",
          workoutName: "Push",
        },
        {
          exerciseId: exerciseA.id,
          workoutId: "workout-1",
          workoutName: "Push",
        },
      ],
      logRows: [
        {
          exerciseId: exerciseA.id,
          sessionId: "session-1",
          performedAt: "2026-04-05",
          weightKg: 80,
          reps: 8,
        },
        {
          exerciseId: exerciseA.id,
          sessionId: "session-1",
          performedAt: "2026-04-05",
          weightKg: 85,
          reps: 6,
        },
        {
          exerciseId: exerciseA.id,
          sessionId: "session-2",
          performedAt: "2026-04-10",
          weightKg: 90,
          reps: 5,
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: exerciseA.id,
      linkedWorkoutCount: 1,
      loggedSessionCount: 2,
      totalSetCount: 3,
      totalVolume: 1600,
      lastPerformedAt: "2026-04-10",
      canDelete: false,
    });
  });

  it("builds detail data with sorted linked workouts and propagated analytics", () => {
    const detail = buildExerciseDetailData({
      exercise: exerciseA,
      linkedWorkouts: [
        { id: "workout-b", name: "Upper B" },
        { id: "workout-a", name: "Upper A" },
      ],
      logRows: [
        {
          exerciseId: exerciseA.id,
          sessionId: "session-1",
          performedAt: "2026-04-05",
          weightKg: 80,
          reps: 8,
        },
      ],
      globalAnalytics: emptyAnalytics,
    });

    expect(detail.linkedWorkouts.map((workout) => workout.name)).toEqual([
      "Upper A",
      "Upper B",
    ]);
    expect(detail.usageSummary).toMatchObject({
      linkedWorkoutCount: 2,
      loggedSessionCount: 1,
      totalSetCount: 1,
      totalVolume: 640,
      lastPerformedAt: "2026-04-05",
      canDelete: false,
    });
    expect(detail.globalAnalytics).toBe(emptyAnalytics);
  });

  it("filters active, archived, and searched library items", () => {
    const items = buildExerciseLibraryItems({
      exercises: [exerciseA, exerciseB],
      workoutLinks: [],
      logRows: [],
    });

    expect(filterExerciseLibraryItems(items, "", "active")).toHaveLength(1);
    expect(filterExerciseLibraryItems(items, "", "archived")).toHaveLength(1);
    expect(
      filterExerciseLibraryItems(items, "bench", "all").map((item) => item.id),
    ).toEqual([exerciseA.id]);
  });
});
