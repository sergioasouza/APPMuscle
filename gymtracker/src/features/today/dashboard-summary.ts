import "server-only";

import {
  buildScheduleDayPlan,
  getRotationCycleLength,
  type BaseScheduleLike,
  type ExtraRotationLike,
} from "@/features/schedule/rotation";
import {
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/supabase/schema-compat";
import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import type { Exercise } from "@/lib/types";

type ActivitySessionRow = {
  id: string;
  performed_at: string;
};

type CardioLogRow = {
  id: string;
  session_id: string;
  total_duration_minutes: number | null;
  total_distance_km: number | null;
  skipped_at: string | null;
};

type PersonalRecordRow = {
  exercise_id: string;
  weight_kg: number;
  reps: number;
  exercises: Pick<Exercise, "name"> | null;
  workout_sessions: {
    performed_at: string;
  } | null;
};

export interface TodayDashboardSummary {
  streak: number;
  adherence: {
    completed: number;
    planned: number;
    percentage: number;
  };
  nextWorkout: {
    name: string;
    dateISO: string;
    isToday: boolean;
  } | null;
  recentPrs: Array<{
    exerciseName: string;
    estimated1RM: number;
    performedAt: string;
  }>;
}

function shiftDateISO(dateISO: string, offset: number) {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12, 0, 0));

  return date.toISOString().slice(0, 10);
}

function getDayOfWeekFromISO(dateISO: string) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export async function getTodayDashboardSummary(input: {
  dateISO: string;
  currentWorkoutName: string | null;
}): Promise<TodayDashboardSummary> {
  const { supabase, user } = await getAuthenticatedServerContext();
  const lookbackStartISO = shiftDateISO(input.dateISO, -45);

  const [profileResult, scheduleResult, rotationsResult, sessionsResult, personalRecordsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("rotation_anchor_date")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("schedule")
        .select("day_of_week, workout_id, workouts(id, name)")
        .eq("user_id", user.id),
      supabase
        .from("schedule_rotations")
        .select("id, day_of_week, rotation_index, workout_id, workouts(id, name)")
        .eq("user_id", user.id),
      supabase
        .from("workout_sessions")
        .select("id, performed_at")
        .eq("user_id", user.id)
        .gte("performed_at", lookbackStartISO)
        .lte("performed_at", input.dateISO),
      supabase
        .from("set_logs")
        .select(
          "exercise_id, weight_kg, reps, exercises(name), workout_sessions!inner(performed_at, user_id)",
        )
        .eq("workout_sessions.user_id", user.id),
    ]);

  const rotationAnchorDateAvailable = !isMissingColumnError(
    profileResult.error,
    "rotation_anchor_date",
  );
  if (profileResult.error && rotationAnchorDateAvailable) {
    throw new Error(profileResult.error.message);
  }

  if (scheduleResult.error) {
    throw new Error(scheduleResult.error.message);
  }

  const rotationTableAvailable = !isMissingTableError(
    rotationsResult.error,
    "schedule_rotations",
  );
  if (rotationsResult.error && rotationTableAvailable) {
    throw new Error(rotationsResult.error.message);
  }

  if (sessionsResult.error) {
    throw new Error(sessionsResult.error.message);
  }

  if (personalRecordsResult.error) {
    throw new Error(personalRecordsResult.error.message);
  }

  const sessions = (sessionsResult.data as ActivitySessionRow[] | null) ?? [];
  const sessionIds = sessions.map((session) => session.id);
  let setLogRows: Array<{ session_id: string }> = [];
  let cardioLogs: CardioLogRow[] = [];
  let cardioIntervals: Array<{ cardio_log_id: string }> = [];
  let exerciseSkipRows: Array<{ session_id: string }> = [];

  if (sessionIds.length > 0) {
    const [setLogsActivityResult, cardioLogsResult, exerciseSkipsResult] =
      await Promise.all([
        supabase.from("set_logs").select("session_id").in("session_id", sessionIds),
        supabase
          .from("session_cardio_logs")
          .select("id, session_id, total_duration_minutes, total_distance_km, skipped_at")
          .in("session_id", sessionIds),
        supabase
          .from("session_exercise_skips")
          .select("session_id")
          .in("session_id", sessionIds),
      ]);

    if (setLogsActivityResult.error) {
      throw new Error(setLogsActivityResult.error.message);
    }

    if (cardioLogsResult.error) {
      throw new Error(cardioLogsResult.error.message);
    }

    if (exerciseSkipsResult.error) {
      throw new Error(exerciseSkipsResult.error.message);
    }

    setLogRows = (setLogsActivityResult.data ?? []) as Array<{ session_id: string }>;
    cardioLogs = (cardioLogsResult.data as CardioLogRow[] | null) ?? [];
    exerciseSkipRows = (exerciseSkipsResult.data ?? []) as Array<{
      session_id: string;
    }>;

    const cardioLogIds = cardioLogs.map((row) => row.id);

    if (cardioLogIds.length > 0) {
      const cardioIntervalsResult = await supabase
        .from("session_cardio_intervals")
        .select("cardio_log_id")
        .in("cardio_log_id", cardioLogIds);

      if (cardioIntervalsResult.error) {
        throw new Error(cardioIntervalsResult.error.message);
      }

      cardioIntervals =
        (cardioIntervalsResult.data ?? []) as Array<{ cardio_log_id: string }>;
    }
  }

  const cardioLogIdsWithIntervals = new Set(
    cardioIntervals.map((interval) => interval.cardio_log_id),
  );
  const activeSessionIds = new Set<string>();

  for (const row of setLogRows) {
    activeSessionIds.add(row.session_id);
  }

  for (const row of exerciseSkipRows) {
    activeSessionIds.add(row.session_id);
  }

  for (const row of cardioLogs) {
    const hasCardioMetrics =
      row.total_duration_minutes != null ||
      row.total_distance_km != null ||
      cardioLogIdsWithIntervals.has(row.id);

    if (hasCardioMetrics && row.skipped_at == null) {
      activeSessionIds.add(row.session_id);
    }
  }

  const completedDates = new Set(
    sessions
      .filter((session) => activeSessionIds.has(session.id))
      .map((session) => session.performed_at),
  );

  let streak = 0;
  for (let offset = 0; offset < 45; offset += 1) {
    const candidateDate = shiftDateISO(input.dateISO, -offset);
    if (!completedDates.has(candidateDate)) {
      break;
    }

    streak += 1;
  }

  const scheduleRows =
    ((scheduleResult.data as BaseScheduleLike[] | null) ?? []) as BaseScheduleLike[];
  const rotationRows =
    ((rotationTableAvailable
      ? (rotationsResult.data as ExtraRotationLike[] | null)
      : []) ?? []) as ExtraRotationLike[];
  const anchorDateISO = rotationAnchorDateAvailable
    ? profileResult.data?.rotation_anchor_date ?? null
    : null;
  const cycleLength = getRotationCycleLength(rotationRows);

  let plannedDays = 0;
  let completedPlannedDays = 0;

  for (let offset = 6; offset >= 0; offset -= 1) {
    const candidateDate = shiftDateISO(input.dateISO, -offset);
    const candidateDayOfWeek = getDayOfWeekFromISO(candidateDate);
    const dayPlan = buildScheduleDayPlan({
      dayOfWeek: candidateDayOfWeek,
      dateISO: candidateDate,
      anchorDateISO,
      baseEntry:
        scheduleRows.find((row) => row.day_of_week === candidateDayOfWeek) ?? null,
      extraRotations: rotationRows.filter(
        (row) => row.day_of_week === candidateDayOfWeek,
      ),
      cycleLength,
    });

    if (dayPlan.activeVariant?.workout) {
      plannedDays += 1;

      if (completedDates.has(candidateDate)) {
        completedPlannedDays += 1;
      }
    }
  }

  let nextWorkout: TodayDashboardSummary["nextWorkout"] = input.currentWorkoutName
    ? {
        name: input.currentWorkoutName,
        dateISO: input.dateISO,
        isToday: true,
      }
    : null;

  if (!nextWorkout) {
    for (let offset = 0; offset < 7; offset += 1) {
      const candidateDate = shiftDateISO(input.dateISO, offset);
      const candidateDayOfWeek = getDayOfWeekFromISO(candidateDate);
      const dayPlan = buildScheduleDayPlan({
        dayOfWeek: candidateDayOfWeek,
        dateISO: candidateDate,
        anchorDateISO,
        baseEntry:
          scheduleRows.find((row) => row.day_of_week === candidateDayOfWeek) ?? null,
        extraRotations: rotationRows.filter(
          (row) => row.day_of_week === candidateDayOfWeek,
        ),
        cycleLength,
      });

      if (dayPlan.activeVariant?.workout) {
        nextWorkout = {
          name: dayPlan.activeVariant.workout.name,
          dateISO: candidateDate,
          isToday: offset === 0,
        };
        break;
      }
    }
  }

  const personalRecordMap = new Map<
    string,
    {
      exerciseName: string;
      estimated1RM: number;
      performedAt: string;
    }
  >();

  for (const row of (personalRecordsResult.data as PersonalRecordRow[] | null) ?? []) {
    if (!row.exercises || !row.workout_sessions) {
      continue;
    }

    const estimated1RM = Number((row.weight_kg * (1 + row.reps / 30)).toFixed(1));
    const current = personalRecordMap.get(row.exercise_id);

    if (
      !current ||
      estimated1RM > current.estimated1RM ||
      (estimated1RM === current.estimated1RM &&
        row.workout_sessions.performed_at > current.performedAt)
    ) {
      personalRecordMap.set(row.exercise_id, {
        exerciseName: row.exercises.name,
        estimated1RM,
        performedAt: row.workout_sessions.performed_at,
      });
    }
  }

  const recentPrs = [...personalRecordMap.values()]
    .sort((first, second) => second.performedAt.localeCompare(first.performedAt))
    .slice(0, 3);

  return {
    streak,
    adherence: {
      completed: completedPlannedDays,
      planned: plannedDays,
      percentage:
        plannedDays === 0
          ? 0
          : Math.round((completedPlannedDays / plannedDays) * 100),
    },
    nextWorkout,
    recentPrs,
  };
}
