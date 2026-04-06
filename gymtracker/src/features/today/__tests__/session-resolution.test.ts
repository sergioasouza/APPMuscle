import {
  buildSetCountBySessionId,
  decideWorkoutSwitchStrategy,
  findReusablePlaceholderForScheduledWorkout,
  selectActiveTodaySession,
  type TodaySessionCandidate,
} from "@/features/today/session-resolution";
import { buildRescheduledToWorkoutSessionNote } from "@/lib/workout-session-status";
import type { Workout } from "@/lib/types";

const workoutA: Workout = {
  id: "workout-a",
  user_id: "user-1",
  name: "Lower",
  created_at: "2026-04-01T08:00:00.000Z",
};

const workoutB: Workout = {
  id: "workout-b",
  user_id: "user-1",
  name: "Upper",
  created_at: "2026-04-01T08:00:00.000Z",
};

function createSession(input: {
  id: string;
  workout: Workout;
  createdAt: string;
  notes?: string | null;
}): TodaySessionCandidate {
  return {
    id: input.id,
    user_id: "user-1",
    workout_id: input.workout.id,
    performed_at: "2026-04-05",
    notes: input.notes ?? null,
    created_at: input.createdAt,
    workouts: input.workout,
  };
}

describe("today session resolution", () => {
  it("prefers the scheduled workout session when it exists", () => {
    const selected = selectActiveTodaySession({
      scheduledWorkoutId: workoutA.id,
      sessions: [
        createSession({
          id: "session-a",
          workout: workoutA,
          createdAt: "2026-04-05T09:00:00.000Z",
        }),
        createSession({
          id: "session-b",
          workout: workoutB,
          createdAt: "2026-04-05T08:00:00.000Z",
        }),
      ],
      setCountBySessionId: {},
    });

    expect(selected?.id).toBe("session-a");
  });

  it("prefers the latest real session after a manual switch", () => {
    const selected = selectActiveTodaySession({
      scheduledWorkoutId: workoutA.id,
      sessions: [
        createSession({
          id: "session-a",
          workout: workoutA,
          createdAt: "2026-04-05T09:00:00.000Z",
        }),
        createSession({
          id: "session-b",
          workout: workoutB,
          createdAt: "2026-04-05T10:00:00.000Z",
        }),
      ],
      setCountBySessionId: {},
    });

    expect(selected?.id).toBe("session-b");
  });

  it("does not let an empty scheduled placeholder hide an older real session", () => {
    const selected = selectActiveTodaySession({
      scheduledWorkoutId: workoutA.id,
      sessions: [
        createSession({
          id: "session-a",
          workout: workoutA,
          createdAt: "2026-04-05T10:00:00.000Z",
        }),
        createSession({
          id: "session-b",
          workout: workoutB,
          createdAt: "2026-04-05T09:00:00.000Z",
        }),
      ],
      setCountBySessionId: {
        "session-b": 4,
      },
    });

    expect(selected?.id).toBe("session-b");
  });

  it("shows a manual session on a rest day instead of rest", () => {
    const selected = selectActiveTodaySession({
      scheduledWorkoutId: null,
      sessions: [
        createSession({
          id: "session-b",
          workout: workoutB,
          createdAt: "2026-04-05T10:00:00.000Z",
        }),
      ],
      setCountBySessionId: {},
    });

    expect(selected?.workout_id).toBe(workoutB.id);
  });

  it("can realign a reusable placeholder when the schedule changes", () => {
    const placeholder = createSession({
      id: "session-a",
      workout: workoutA,
      createdAt: "2026-04-05T08:00:00.000Z",
    });
    const setCountBySessionId = buildSetCountBySessionId([]);

    const reusable = findReusablePlaceholderForScheduledWorkout({
      scheduledWorkoutId: workoutB.id,
      sessions: [placeholder],
      setCountBySessionId,
    });

    expect(reusable?.id).toBe(placeholder.id);
  });

  it("does not reuse a placeholder with special status", () => {
    const placeholder = createSession({
      id: "session-a",
      workout: workoutA,
      createdAt: "2026-04-05T08:00:00.000Z",
      notes: buildRescheduledToWorkoutSessionNote({
        targetDateISO: "2026-04-06",
        targetLabel: "Monday",
      }),
    });
    const setCountBySessionId = buildSetCountBySessionId([]);

    const reusable = findReusablePlaceholderForScheduledWorkout({
      scheduledWorkoutId: workoutB.id,
      sessions: [placeholder],
      setCountBySessionId,
    });

    expect(reusable).toBeNull();
  });

  it("chooses the safest non-destructive switch strategy", () => {
    const placeholder = createSession({
      id: "session-a",
      workout: workoutA,
      createdAt: "2026-04-05T08:00:00.000Z",
    });
    const target = createSession({
      id: "session-b",
      workout: workoutB,
      createdAt: "2026-04-05T09:00:00.000Z",
    });

    expect(
      decideWorkoutSwitchStrategy({
        targetWorkoutId: workoutB.id,
        sessions: [placeholder, target],
        setCountBySessionId: buildSetCountBySessionId([]),
      }),
    ).toEqual({
      type: "reuse-target",
      sessionId: target.id,
    });

    expect(
      decideWorkoutSwitchStrategy({
        targetWorkoutId: workoutB.id,
        sessions: [placeholder],
        setCountBySessionId: buildSetCountBySessionId([]),
      }),
    ).toEqual({
      type: "reuse-placeholder",
      sessionId: placeholder.id,
    });

    expect(
      decideWorkoutSwitchStrategy({
        targetWorkoutId: workoutB.id,
        sessions: [
          createSession({
            id: "session-c",
            workout: workoutA,
            createdAt: "2026-04-05T08:00:00.000Z",
          }),
        ],
        setCountBySessionId: {
          "session-c": 3,
        },
      }),
    ).toEqual({
      type: "create-new",
      sessionId: null,
    });
  });
});
