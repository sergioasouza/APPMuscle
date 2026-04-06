import { parseWorkoutSessionStatus } from "@/lib/workout-session-status";
import type { SessionCardioLog, SessionExerciseSkip, SetLog, Workout, WorkoutSession } from "@/lib/types";

export type TodaySessionCandidate = WorkoutSession & {
  workouts: Workout | null;
};

export function buildSetCountBySessionId(
  setLogs: Pick<SetLog, "session_id">[],
): Record<string, number> {
  return setLogs.reduce<Record<string, number>>((accumulator, setLog) => {
    accumulator[setLog.session_id] = (accumulator[setLog.session_id] ?? 0) + 1;
    return accumulator;
  }, {});
}

export function buildSessionActivityCountBySessionId(input: {
  setLogs: Pick<SetLog, "session_id">[];
  cardioLogs?: Pick<SessionCardioLog, "session_id" | "skipped_at">[];
  exerciseSkips?: Pick<SessionExerciseSkip, "session_id">[];
}) {
  const counts = buildSetCountBySessionId(input.setLogs);

  for (const cardioLog of input.cardioLogs ?? []) {
    if (cardioLog.skipped_at != null || cardioLog.session_id) {
      counts[cardioLog.session_id] = (counts[cardioLog.session_id] ?? 0) + 1;
    }
  }

  for (const exerciseSkip of input.exerciseSkips ?? []) {
    counts[exerciseSkip.session_id] = (counts[exerciseSkip.session_id] ?? 0) + 1;
  }

  return counts;
}

function getSetCount(
  session: TodaySessionCandidate,
  setCountBySessionId: Record<string, number>,
) {
  return setCountBySessionId[session.id] ?? 0;
}

function sortByCreatedDesc(left: TodaySessionCandidate, right: TodaySessionCandidate) {
  return right.created_at.localeCompare(left.created_at);
}

export function isReusableTodayPlaceholder(
  session: TodaySessionCandidate,
  setCountBySessionId: Record<string, number>,
) {
  return (
    parseWorkoutSessionStatus(session.notes).kind === "normal" &&
    getSetCount(session, setCountBySessionId) === 0
  );
}

export function findReusablePlaceholderForScheduledWorkout(input: {
  scheduledWorkoutId: string | null;
  sessions: TodaySessionCandidate[];
  setCountBySessionId: Record<string, number>;
}) {
  if (!input.scheduledWorkoutId) {
    return null;
  }

  const hasScheduledSession = input.sessions.some(
    (session) => session.workout_id === input.scheduledWorkoutId,
  );

  if (hasScheduledSession) {
    return null;
  }

  return (
    [...input.sessions]
      .filter((session) =>
        isReusableTodayPlaceholder(session, input.setCountBySessionId),
      )
      .sort(sortByCreatedDesc)[0] ?? null
  );
}

export function decideWorkoutSwitchStrategy(input: {
  targetWorkoutId: string;
  sessions: TodaySessionCandidate[];
  setCountBySessionId: Record<string, number>;
}) {
  const targetSession = [...input.sessions]
    .filter((session) => session.workout_id === input.targetWorkoutId)
    .sort(sortByCreatedDesc)[0];

  if (targetSession) {
    return {
      type: "reuse-target" as const,
      sessionId: targetSession.id,
    };
  }

  const reusablePlaceholder = [...input.sessions]
    .filter((session) =>
      isReusableTodayPlaceholder(session, input.setCountBySessionId),
    )
    .sort(sortByCreatedDesc)[0];

  if (reusablePlaceholder) {
    return {
      type: "reuse-placeholder" as const,
      sessionId: reusablePlaceholder.id,
    };
  }

  return {
    type: "create-new" as const,
    sessionId: null,
  };
}

export function selectActiveTodaySession(input: {
  scheduledWorkoutId: string | null;
  sessions: TodaySessionCandidate[];
  setCountBySessionId: Record<string, number>;
}) {
  if (input.sessions.length === 0) {
    return null;
  }

  const sortedSessions = [...input.sessions].sort(sortByCreatedDesc);
  const latestSession = sortedSessions[0];
  const latestRealSession =
    sortedSessions.find((session) => {
      const status = parseWorkoutSessionStatus(session.notes).kind;
      return status !== "skipped" && status !== "rescheduled_to";
    }) ?? null;

  if (!input.scheduledWorkoutId) {
    return latestRealSession ?? latestSession;
  }

  const latestScheduledSession =
    sortedSessions.find(
      (session) => session.workout_id === input.scheduledWorkoutId,
    ) ?? null;
  const latestNonScheduledRealSession =
    sortedSessions.find((session) => {
      const status = parseWorkoutSessionStatus(session.notes).kind;
      return (
        session.workout_id !== input.scheduledWorkoutId &&
        status !== "skipped" &&
        status !== "rescheduled_to"
      );
    }) ?? null;

  if (
    latestScheduledSession &&
    latestNonScheduledRealSession &&
    isReusableTodayPlaceholder(
      latestScheduledSession,
      input.setCountBySessionId,
    ) &&
    (
      getSetCount(latestNonScheduledRealSession, input.setCountBySessionId) > 0 ||
      latestNonScheduledRealSession.created_at > latestScheduledSession.created_at
    )
  ) {
    return latestNonScheduledRealSession;
  }

  if (
    latestScheduledSession &&
    latestNonScheduledRealSession &&
    latestNonScheduledRealSession.created_at > latestScheduledSession.created_at
  ) {
    return latestNonScheduledRealSession;
  }

  if (latestScheduledSession) {
    return latestScheduledSession;
  }

  return latestRealSession ?? latestSession;
}
