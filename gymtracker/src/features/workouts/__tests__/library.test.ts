import {
  buildExerciseLibraryStats,
  buildExerciseDetailData,
  buildExerciseLibraryItems,
  buildExerciseUsageSummary,
  filterExerciseLibraryItems,
  filterResolvedExercisesForLibrary,
  sortResolvedExercisesForLibrary,
} from "@/features/workouts/library";
import type { ExerciseGlobalAnalyticsData } from "@/features/analytics/types";
import type { ResolvedExercise } from "@/lib/types";

const exerciseA: ResolvedExercise = {
  id: "exercise-a",
  user_id: null,
  name: "Supino Reto",
  system_key: "supino-reto-smith",
  is_system: true,
  modality: "Smith",
  muscle_group: "Peito",
  archived_at: null,
  created_at: "2026-04-01T08:00:00.000Z",
  source: "system",
  display_name: "Supino Reto (Smith)",
  hidden_at: null,
  is_customized: false,
  base_name: "Supino Reto",
  base_modality: "Smith",
  base_muscle_group: "Peito",
};

const exerciseB: ResolvedExercise = {
  id: "exercise-b",
  user_id: "user-1",
  name: "Cable Fly",
  system_key: null,
  is_system: false,
  modality: "Cabo",
  muscle_group: "Peito",
  archived_at: "2026-04-03T08:00:00.000Z",
  created_at: "2026-04-02T08:00:00.000Z",
  source: "custom",
  display_name: "Cable Fly (Cabo)",
  hidden_at: null,
  is_customized: false,
  base_name: "Cable Fly",
  base_modality: "Cabo",
  base_muscle_group: "Peito",
};

const emptyAnalytics: ExerciseGlobalAnalyticsData = {
  exerciseId: exerciseA.id,
  exerciseName: exerciseA.display_name,
  evolution: [],
  summary: null,
};

describe("workouts library helpers", () => {
  it("marks a system exercise as hide-only and a custom one as hard-deletable", () => {
    expect(
      buildExerciseUsageSummary({
        exercise: exerciseA,
        linkedWorkoutCount: 0,
        logRows: [],
      }),
    ).toMatchObject({
      canDelete: true,
      deleteMode: "hide",
    });

    expect(
      buildExerciseUsageSummary({
        exercise: exerciseB,
        linkedWorkoutCount: 0,
        logRows: [],
      }),
    ).toMatchObject({
      canDelete: true,
      deleteMode: "hard",
    });
  });

  it("blocks hard deletion for custom exercises that have logs or linked workouts", () => {
    expect(
      buildExerciseUsageSummary({
        exercise: exerciseB,
        linkedWorkoutCount: 1,
        logRows: [],
      }).deleteMode,
    ).toBe("blocked");

    expect(
      buildExerciseUsageSummary({
        exercise: exerciseB,
        linkedWorkoutCount: 0,
        logRows: [
          {
            exerciseId: exerciseB.id,
            sessionId: "session-1",
            performedAt: "2026-04-05",
            weightKg: 30,
            reps: 12,
          },
        ],
      }).deleteMode,
    ).toBe("blocked");
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
      displayName: "Supino Reto (Smith)",
      source: "system",
      linkedWorkoutCount: 1,
      loggedSessionCount: 2,
      totalSetCount: 3,
      totalVolume: 1600,
      lastPerformedAt: "2026-04-10",
      deleteMode: "hide",
      canDelete: true,
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
      deleteMode: "hide",
    });
    expect(detail.globalAnalytics.exerciseName).toBe("Supino Reto (Smith)");
  });

  it("filters active, archived, and searched library items", () => {
    const items = buildExerciseLibraryItems({
      exercises: [exerciseA, exerciseB],
      workoutLinks: [],
      logRows: [],
    });

    expect(filterExerciseLibraryItems(items, "", "active", "all")).toHaveLength(
      1,
    );
    expect(
      filterExerciseLibraryItems(items, "", "archived", "all"),
    ).toHaveLength(1);
    expect(
      filterExerciseLibraryItems(items, "smith", "all", "all").map(
        (item) => item.id,
      ),
    ).toEqual([exerciseA.id]);
    expect(
      filterExerciseLibraryItems(items, "", "all", "custom").map(
        (item) => item.id,
      ),
    ).toEqual([exerciseB.id]);
  });

  it("filters and sorts resolved exercises for paginated library queries", () => {
    const exercises = sortResolvedExercisesForLibrary(
      filterResolvedExercisesForLibrary(
        [exerciseB, exerciseA],
        "peito",
        "all",
        "all",
      ),
    );

    expect(exercises.map((exercise) => exercise.id)).toEqual([
      exerciseA.id,
      exerciseB.id,
    ]);
  });

  it("can filter only personal exercises in resolved library queries", () => {
    const exercises = filterResolvedExercisesForLibrary(
      [exerciseA, exerciseB],
      "",
      "all",
      "custom",
    );

    expect(exercises.map((exercise) => exercise.id)).toEqual([exerciseB.id]);
  });

  it("builds library stats from visible resolved exercises", () => {
    expect(
      buildExerciseLibraryStats([
        exerciseA,
        exerciseB,
        {
          ...exerciseA,
          id: "exercise-hidden",
          hidden_at: "2026-04-06T08:00:00.000Z",
        },
      ]),
    ).toEqual({
      totalCount: 2,
      systemCount: 1,
      activeCount: 1,
      archivedCount: 1,
    });
  });
});
