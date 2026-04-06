import "server-only";

import { getAuthenticatedServerContext } from "@/lib/supabase/auth";
import {
  buildScheduleDayPlan,
  getRotationCycleLength,
  type ExtraRotationLike,
} from "@/features/schedule/rotation";
import {
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/supabase/schema-compat";
import {
  requireAccessibleExercise,
  requireOwnedWorkoutCardioBlock,
  requireOwnedSetLog,
  requireOwnedWorkout,
  requireOwnedWorkoutSession,
} from "@/lib/supabase/ownership";
import { resolveExercisesForUser } from "@/lib/supabase/exercises";
import {
  buildWorkoutSessionNotesWithStatus,
  clearWorkoutSessionStatus,
  buildRescheduledFromWorkoutSessionNote,
  buildRescheduledToWorkoutSessionNote,
  buildSkippedWorkoutSessionNote,
  isAnalyticsExcludedWorkoutSession,
  parseWorkoutSessionStatus,
  removeSkippedWorkoutSessionNote,
} from "@/lib/workout-session-status";
import {
  buildSessionActivityCountBySessionId,
  decideWorkoutSwitchStrategy,
  findReusablePlaceholderForScheduledWorkout,
  selectActiveTodaySession,
  type TodaySessionCandidate,
} from "@/features/today/session-resolution";
import type {
  Exercise,
  ResolvedExercise,
  Schedule,
  ScheduleRotation,
  SetLog,
  SessionCardioInterval,
  SessionCardioLog,
  SessionExerciseSkip,
  Workout,
  WorkoutCardioBlock,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/types";

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: ResolvedExercise };
type WorkoutCardioBlockWithSessionLog = WorkoutCardioBlock;
type ScheduleWithWorkout = Schedule & { workouts: Workout | null };
type ScheduleRotationWithWorkout = ScheduleRotation & { workouts: Workout | null };
type SessionWithWorkout = WorkoutSession & { workouts: Workout };

async function listSetLogsForSessions(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("set_logs")
    .select("*")
    .in("session_id", sessionIds)
    .order("set_number");

  if (error) {
    throw new Error(error.message);
  }

  return (data as SetLog[] | null) ?? [];
}

async function listWorkoutCardioBlocksForWorkout(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  workoutId: string | null,
) {
  if (!workoutId) {
    return [];
  }

  const { data, error } = await supabase
    .from("workout_cardio_blocks")
    .select("*")
    .eq("workout_id", workoutId)
    .order("display_order");

  if (error) {
    throw new Error(error.message);
  }

  return (data as WorkoutCardioBlock[] | null) ?? [];
}

async function listSessionExerciseSkipsForSession(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  sessionId: string | null,
) {
  if (!sessionId) {
    return [];
  }

  const { data, error } = await supabase
    .from("session_exercise_skips")
    .select("*")
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SessionExerciseSkip[] | null) ?? [];
}

async function listSessionExerciseSkipsForSessions(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("session_exercise_skips")
    .select("*")
    .in("session_id", sessionIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SessionExerciseSkip[] | null) ?? [];
}

async function listSessionCardioLogsForSession(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  sessionId: string | null,
) {
  if (!sessionId) {
    return {
      logs: [] as SessionCardioLog[],
      intervals: [] as SessionCardioInterval[],
    };
  }

  const { data: logs, error: logsError } = await supabase
    .from("session_cardio_logs")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");

  if (logsError) {
    throw new Error(logsError.message);
  }

  const cardioLogs = (logs as SessionCardioLog[] | null) ?? [];
  const cardioLogIds = cardioLogs.map((log) => log.id);

  if (cardioLogIds.length === 0) {
    return {
      logs: cardioLogs,
      intervals: [] as SessionCardioInterval[],
    };
  }

  const { data: intervals, error: intervalsError } = await supabase
    .from("session_cardio_intervals")
    .select("*")
    .in("cardio_log_id", cardioLogIds)
    .order("display_order");

  if (intervalsError) {
    throw new Error(intervalsError.message);
  }

  return {
    logs: cardioLogs,
    intervals: (intervals as SessionCardioInterval[] | null) ?? [],
  };
}

async function listSessionCardioLogsForSessions(
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"],
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("session_cardio_logs")
    .select("*")
    .in("session_id", sessionIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data as SessionCardioLog[] | null) ?? [];
}

export async function getTodayViewRepository(
  dateISO: string,
  dayOfWeek: number,
) {
  const { supabase, user } = await getAuthenticatedServerContext();

  const [scheduleRes, rotationsRes, profileRes] = await Promise.all([
    supabase
      .from("schedule")
      .select("*, workouts(*)")
      .eq("day_of_week", dayOfWeek)
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(1),
    supabase
      .from("schedule_rotations")
      .select("*, workouts(*)")
      .eq("day_of_week", dayOfWeek)
      .eq("user_id", user.id)
      .order("rotation_index"),
    supabase
      .from("profiles")
      .select("rotation_anchor_date")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (scheduleRes.error) {
    throw new Error(scheduleRes.error.message);
  }

  const rotationSupportEnabled = !isMissingTableError(
    rotationsRes.error,
    "schedule_rotations",
  );

  if (rotationsRes.error && rotationSupportEnabled) {
    throw new Error(rotationsRes.error.message);
  }

  const rotationAnchorColumnAvailable = !isMissingColumnError(
    profileRes.error,
    "rotation_anchor_date",
  );

  if (profileRes.error && rotationAnchorColumnAvailable) {
    throw new Error(profileRes.error.message);
  }

  const dayPlan = buildScheduleDayPlan({
    dayOfWeek,
    dateISO,
    anchorDateISO: rotationAnchorColumnAvailable
      ? profileRes.data?.rotation_anchor_date ?? null
      : null,
    baseEntry: scheduleRes.data?.[0] as ScheduleWithWorkout | undefined,
    extraRotations: (rotationSupportEnabled
      ? ((rotationsRes.data as ScheduleRotationWithWorkout[] | null) ?? [])
      : []) as ExtraRotationLike[],
    cycleLength: rotationSupportEnabled
      ? getRotationCycleLength(
          (((rotationsRes.data as ScheduleRotationWithWorkout[] | null) ?? []) as ExtraRotationLike[]),
        )
      : 1,
  });

  const scheduledWorkout = dayPlan.activeVariant?.workout ?? null;

  const { data: existingSessions, error: sessionError } = await supabase
    .from("workout_sessions")
    .select("*, workouts(*)")
    .eq("performed_at", dateISO)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  let sessions = ((existingSessions as SessionWithWorkout[] | null) ?? []).map(
    (session) => ({ ...session }),
  );
  const initialSessionIds = sessions.map((session) => session.id);
  let allSetLogs = await listSetLogsForSessions(supabase, initialSessionIds);
  let allSessionCardioLogs = await listSessionCardioLogsForSessions(
    supabase,
    initialSessionIds,
  );
  let allSessionExerciseSkips = await listSessionExerciseSkipsForSessions(
    supabase,
    initialSessionIds,
  );
  let setCountBySessionId = buildSessionActivityCountBySessionId({
    setLogs: allSetLogs,
    cardioLogs: allSessionCardioLogs,
    exerciseSkips: allSessionExerciseSkips,
  });

  const reusablePlaceholder = findReusablePlaceholderForScheduledWorkout({
    scheduledWorkoutId: scheduledWorkout?.id ?? null,
    sessions: sessions as TodaySessionCandidate[],
    setCountBySessionId,
  });

  if (scheduledWorkout && reusablePlaceholder) {
    const { error: realignError } = await supabase
      .from("workout_sessions")
      .update({ workout_id: scheduledWorkout.id })
      .eq("id", reusablePlaceholder.id)
      .eq("user_id", user.id);

    if (realignError) {
      throw new Error(realignError.message);
    }

    sessions = sessions.map((session) =>
      session.id === reusablePlaceholder.id
        ? {
            ...session,
            workout_id: scheduledWorkout.id,
            workouts: scheduledWorkout,
          }
        : session,
    );
  }

  if (scheduledWorkout && sessions.length === 0) {
    const { data: newSession, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_id: scheduledWorkout.id,
        performed_at: dateISO,
      })
      .select("*, workouts(*)")
      .single();

    if (error) {
      const shouldFallbackWithoutSession =
        error.code === "23503" || error.code === "42501";
      const isDuplicate = error.code === "23505";

      if (!shouldFallbackWithoutSession) {
        if (isDuplicate) {
          const { data: duplicateSession, error: duplicateSessionError } =
            await supabase
              .from("workout_sessions")
              .select("*, workouts(*)")
              .eq("user_id", user.id)
              .eq("workout_id", scheduledWorkout.id)
              .eq("performed_at", dateISO)
              .maybeSingle();

          if (duplicateSessionError) {
            throw new Error(duplicateSessionError.message);
          }

          if (duplicateSession) {
            sessions = [duplicateSession as SessionWithWorkout];
          }
        } else {
          throw new Error(error.message);
        }
      }
    } else if (newSession) {
      sessions = [newSession as SessionWithWorkout];
    }

    allSetLogs = await listSetLogsForSessions(
      supabase,
      sessions.map((session) => session.id),
    );
    allSessionCardioLogs = await listSessionCardioLogsForSessions(
      supabase,
      sessions.map((session) => session.id),
    );
    allSessionExerciseSkips = await listSessionExerciseSkipsForSessions(
      supabase,
      sessions.map((session) => session.id),
    );
    setCountBySessionId = buildSessionActivityCountBySessionId({
      setLogs: allSetLogs,
      cardioLogs: allSessionCardioLogs,
      exerciseSkips: allSessionExerciseSkips,
    });
  }

  const activeSession = selectActiveTodaySession({
    scheduledWorkoutId: scheduledWorkout?.id ?? null,
    sessions: sessions as TodaySessionCandidate[],
    setCountBySessionId,
  }) as SessionWithWorkout | null;
  const activeWorkout = activeSession?.workouts ?? scheduledWorkout;
  const session = activeSession as WorkoutSession | null;

  let workoutExercises: WorkoutExerciseWithExercise[] = [];
  let cardioBlocks: WorkoutCardioBlockWithSessionLog[] = [];

  if (activeWorkout) {
    const [workoutExercisesResult, cardioBlocksResult] = await Promise.all([
      supabase
        .from("workout_exercises")
        .select("*, exercises(*)")
        .eq("workout_id", activeWorkout.id)
        .order("display_order"),
      listWorkoutCardioBlocksForWorkout(supabase, activeWorkout.id),
    ]);

    if (workoutExercisesResult.error) {
      throw new Error(workoutExercisesResult.error.message);
    }

    const rawWorkoutExercises = (
      ((workoutExercisesResult.data as (WorkoutExercise & { exercises: Exercise | null })[] | null) ?? [])
    ).filter((we) => we.exercises != null) as WorkoutExerciseWithExercise[];
    const resolvedExercises = await resolveExercisesForUser(
      supabase,
      user.id,
      rawWorkoutExercises.map((workoutExercise) => workoutExercise.exercises),
    );
    const resolvedById = resolvedExercises.reduce<Map<string, typeof resolvedExercises[number]>>(
      (accumulator, exercise) => {
        accumulator.set(exercise.id, exercise);
        return accumulator;
      },
      new Map(),
    );

    workoutExercises = rawWorkoutExercises.flatMap((workoutExercise) => {
      const resolvedExercise = resolvedById.get(workoutExercise.exercise_id);

      if (!resolvedExercise) {
        return [];
      }

      return [{ ...workoutExercise, exercises: resolvedExercise }];
    });

    cardioBlocks = cardioBlocksResult;
  }

  let setLogs: SetLog[] = [];
  let sessionExerciseSkips: SessionExerciseSkip[] = [];
  let sessionCardioLogs: SessionCardioLog[] = [];
  let sessionCardioIntervals: SessionCardioInterval[] = [];

  if (session) {
    setLogs = allSetLogs.filter((setLog) => setLog.session_id === session.id);
    const [exerciseSkips, cardioData] = await Promise.all([
      listSessionExerciseSkipsForSession(supabase, session.id),
      listSessionCardioLogsForSession(supabase, session.id),
    ]);
    sessionExerciseSkips = exerciseSkips;
    sessionCardioLogs = cardioData.logs;
    sessionCardioIntervals = cardioData.intervals;
  }

  // Fetch previous session set_logs for the same workout (for "previous marks")
  let previousSetLogs: SetLog[] = [];

  if (activeWorkout) {
    const { data: prevSessions, error: prevSessionError } = await supabase
      .from("workout_sessions")
      .select("id, notes")
      .eq("user_id", user.id)
      .eq("workout_id", activeWorkout.id)
      .neq("performed_at", dateISO)
      .order("performed_at", { ascending: false })
      .limit(8);

    const previousSession = !prevSessionError
      ? prevSessions?.find((candidate) => !isAnalyticsExcludedWorkoutSession(candidate.notes)) ?? null
      : null;

    if (previousSession) {
      const { data: prevLogs, error: prevLogsError } = await supabase
        .from("set_logs")
        .select("*")
        .eq("session_id", previousSession.id)
        .order("set_number");

      if (!prevLogsError && prevLogs) {
        previousSetLogs = prevLogs;
      }
    }
  }

  return {
    workout: activeWorkout,
    session,
    workoutExercises,
    cardioBlocks,
    setLogs,
    sessionExerciseSkips,
    sessionCardioLogs,
    sessionCardioIntervals,
    previousSetLogs,
    notes: parseWorkoutSessionStatus(session?.notes).details ?? "",
    rotation: {
      activeRotationIndex: dayPlan.activeRotationIndex,
      totalVariants: dayPlan.variants.length,
    },
  };
}

export async function listUserWorkoutsRepository() {
  const { supabase, user } = await getAuthenticatedServerContext();

  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function switchWorkoutForDayRepository(
  dateISO: string,
  workoutId: string,
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  const { data: existingSessions, error: existingSessionError } = await supabase
    .from("workout_sessions")
    .select("*, workouts(*)")
    .eq("performed_at", dateISO)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (existingSessionError) {
    throw new Error(existingSessionError.message);
  }

  const sessions =
    ((existingSessions as SessionWithWorkout[] | null) ?? []) as TodaySessionCandidate[];
  const sessionIds = sessions.map((session) => session.id);
  const [setLogs, cardioLogs, exerciseSkips] = await Promise.all([
    listSetLogsForSessions(supabase, sessionIds),
    listSessionCardioLogsForSessions(supabase, sessionIds),
    listSessionExerciseSkipsForSessions(supabase, sessionIds),
  ]);
  const setCountBySessionId = buildSessionActivityCountBySessionId({
    setLogs,
    cardioLogs,
    exerciseSkips,
  });
  const decision = decideWorkoutSwitchStrategy({
    targetWorkoutId: workoutId,
    sessions,
    setCountBySessionId,
  });

  if (decision.type === "reuse-target") {
    const targetSession = sessions.find((session) => session.id === decision.sessionId);

    if (!targetSession) {
      throw new Error("Target session not found");
    }

    const nextNotes = clearWorkoutSessionStatus(targetSession.notes);
    if (nextNotes !== targetSession.notes) {
      const { error: updateError } = await supabase
        .from("workout_sessions")
        .update({ notes: nextNotes })
        .eq("id", targetSession.id)
        .eq("user_id", user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    return;
  }

  if (decision.type === "reuse-placeholder" && decision.sessionId) {
    const { error: updateError } = await supabase
      .from("workout_sessions")
      .update({ workout_id: workoutId })
      .eq("id", decision.sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: insertError } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_id: workoutId,
    performed_at: dateISO,
  });

  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }
}

export async function skipWorkoutRepository(
  sessionId: string,
  notes: string | null,
) {
  void notes;
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, sessionId);

  const { error: deleteError } = await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", sessionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const [{ error: deleteExerciseSkipsError }, { error: deleteCardioLogsError }] =
    await Promise.all([
      supabase
        .from("session_exercise_skips")
        .delete()
        .eq("session_id", sessionId),
      supabase
        .from("session_cardio_logs")
        .delete()
        .eq("session_id", sessionId),
    ]);

  if (deleteExerciseSkipsError) {
    throw new Error(deleteExerciseSkipsError.message);
  }

  if (deleteCardioLogsError) {
    throw new Error(deleteCardioLogsError.message);
  }

  const { error: updateError } = await supabase
    .from("workout_sessions")
    .update({ notes: buildSkippedWorkoutSessionNote(session.notes) })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function undoSkipWorkoutRepository(
  sessionId: string,
  notes: string | null,
) {
  void notes;
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, sessionId);

  const { error } = await supabase
    .from("workout_sessions")
    .update({ notes: removeSkippedWorkoutSessionNote(session.notes) })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function rescheduleWorkoutRepository(
  dateISO: string,
  todayDayOfWeek: number,
  targetDay: number,
  workoutId: string,
  sessionId: string | null,
  dayNames: string[],
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkout(supabase, user.id, workoutId);

  const today = new Date(`${dateISO}T00:00:00`);
  const targetDate = new Date(today);
  let diff = targetDay - today.getDay();
  if (diff <= 0) diff += 7;
  targetDate.setDate(today.getDate() + diff);
  const targetDateISO = targetDate.toISOString().slice(0, 10);

  if (sessionId) {
    const sourceSession = await requireOwnedWorkoutSession(
      supabase,
      user.id,
      sessionId,
    );

    const { error: updateError } = await supabase
      .from("workout_sessions")
      .update({
        notes: buildRescheduledToWorkoutSessionNote({
          targetDateISO,
          targetLabel: dayNames[targetDay],
          existingNotes: sourceSession?.notes ?? null,
        }),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { error } = await supabase.from("workout_sessions").insert({
      user_id: user.id,
      workout_id: workoutId,
      performed_at: dateISO,
      notes: buildRescheduledToWorkoutSessionNote({
        targetDateISO,
        targetLabel: dayNames[targetDay],
      }),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: existingTargetSession, error: existingTargetSessionError } = await supabase
    .from("workout_sessions")
    .select("id, notes")
    .eq("user_id", user.id)
    .eq("workout_id", workoutId)
    .eq("performed_at", targetDateISO)
    .maybeSingle();

  if (existingTargetSessionError) {
    throw new Error(existingTargetSessionError.message);
  }

  if (!existingTargetSession) {
    const { error: insertTargetError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_id: workoutId,
        performed_at: targetDateISO,
        notes: buildRescheduledFromWorkoutSessionNote({
          sourceDateISO: dateISO,
          sourceLabel: dayNames[todayDayOfWeek],
        }),
      });

    if (insertTargetError && insertTargetError.code !== "23505") {
      throw new Error(insertTargetError.message);
    }
  }
}

export async function saveSetRepository(input: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  setLogId?: string;
}) {
  const { supabase, user } = await getAuthenticatedServerContext();

  if (input.setLogId) {
    await requireOwnedSetLog(supabase, user.id, input.setLogId);

    const { data, error } = await supabase
      .from("set_logs")
      .update({ weight_kg: input.weight, reps: input.reps })
      .eq("id", input.setLogId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const { error: clearSkipError } = await supabase
      .from("session_exercise_skips")
      .delete()
      .eq("session_id", input.sessionId)
      .eq("exercise_id", input.exerciseId);

    if (clearSkipError) {
      throw new Error(clearSkipError.message);
    }

    return data;
  }

  await Promise.all([
    requireOwnedWorkoutSession(supabase, user.id, input.sessionId),
    requireAccessibleExercise(supabase, user.id, input.exerciseId),
  ]);

  const { data, error } = await supabase
    .from("set_logs")
    .insert({
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      set_number: input.setNumber,
      weight_kg: input.weight,
      reps: input.reps,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { error: clearSkipError } = await supabase
    .from("session_exercise_skips")
    .delete()
    .eq("session_id", input.sessionId)
    .eq("exercise_id", input.exerciseId);

  if (clearSkipError) {
    throw new Error(clearSkipError.message);
  }

  return data;
}

export async function saveSessionNotesRepository(
  sessionId: string,
  notes: string,
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  const existingSession = await requireOwnedWorkoutSession(
    supabase,
    user.id,
    sessionId,
  );

  const { error } = await supabase
    .from("workout_sessions")
    .update({ notes: buildWorkoutSessionNotesWithStatus(existingSession?.notes, notes) })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureExerciseBelongsToWorkoutSession(input: {
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"];
  workoutId: string;
  exerciseId: string;
}) {
  const { data, error } = await input.supabase
    .from("workout_exercises")
    .select("id")
    .eq("workout_id", input.workoutId)
    .eq("exercise_id", input.exerciseId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Exercise is not part of this workout");
  }
}

async function ensureCardioBlockBelongsToWorkoutSession(input: {
  supabase: Awaited<ReturnType<typeof getAuthenticatedServerContext>>["supabase"];
  session: Awaited<ReturnType<typeof requireOwnedWorkoutSession>>;
  cardioBlockId: string;
  userId: string;
}) {
  const cardioBlock = await requireOwnedWorkoutCardioBlock(
    input.supabase,
    input.userId,
    input.cardioBlockId,
  );

  if (cardioBlock.workout_id !== input.session.workout_id) {
    throw new Error("Cardio block is not part of this workout");
  }

  return cardioBlock;
}

export async function skipExerciseRepository(sessionId: string, exerciseId: string) {
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, sessionId);
  await Promise.all([
    requireAccessibleExercise(supabase, user.id, exerciseId),
    ensureExerciseBelongsToWorkoutSession({
      supabase,
      workoutId: session.workout_id,
      exerciseId,
    }),
  ]);

  const { count, error: setCountError } = await supabase
    .from("set_logs")
    .select("id", { head: true, count: "exact" })
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  if (setCountError) {
    throw new Error(setCountError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Exercise already has saved sets and cannot be skipped");
  }

  const { error } = await supabase
    .from("session_exercise_skips")
    .upsert(
      {
        session_id: sessionId,
        exercise_id: exerciseId,
        skipped_at: new Date().toISOString(),
      },
      { onConflict: "session_id,exercise_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function undoSkipExerciseRepository(
  sessionId: string,
  exerciseId: string,
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutSession(supabase, user.id, sessionId);
  await requireAccessibleExercise(supabase, user.id, exerciseId);

  const { error } = await supabase
    .from("session_exercise_skips")
    .delete()
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveCardioLogRepository(input: {
  sessionId: string;
  cardioBlockId: string;
  totalDurationMinutes?: number | null;
  totalDistanceKm?: number | null;
  intervals: Array<{
    id?: string;
    durationMinutes: number;
    speedKmh?: number | null;
    repeatCount: number;
  }>;
}) {
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, input.sessionId);
  await ensureCardioBlockBelongsToWorkoutSession({
    supabase,
    session,
    cardioBlockId: input.cardioBlockId,
    userId: user.id,
  });

  const hasMetrics =
    input.totalDurationMinutes != null ||
    input.totalDistanceKm != null ||
    input.intervals.length > 0;

  if (!hasMetrics) {
    throw new Error("At least one cardio metric is required");
  }

  const now = new Date().toISOString();

  const { data: upsertedCardioLog, error: upsertCardioLogError } = await supabase
    .from("session_cardio_logs")
    .upsert(
      {
        session_id: input.sessionId,
        workout_cardio_block_id: input.cardioBlockId,
        total_duration_minutes: input.totalDurationMinutes ?? null,
        total_distance_km: input.totalDistanceKm ?? null,
        skipped_at: null,
        updated_at: now,
      },
      { onConflict: "session_id,workout_cardio_block_id" },
    )
    .select("*")
    .single();

  if (upsertCardioLogError) {
    throw new Error(upsertCardioLogError.message);
  }

  const cardioLog = upsertedCardioLog as SessionCardioLog;

  const { error: deleteIntervalsError } = await supabase
    .from("session_cardio_intervals")
    .delete()
    .eq("cardio_log_id", cardioLog.id);

  if (deleteIntervalsError) {
    throw new Error(deleteIntervalsError.message);
  }

  if (input.intervals.length > 0) {
    const { error: insertIntervalsError } = await supabase
      .from("session_cardio_intervals")
      .insert(
        input.intervals.map((interval, index) => ({
          cardio_log_id: cardioLog.id,
          display_order: index,
          duration_minutes: interval.durationMinutes,
          speed_kmh: interval.speedKmh ?? null,
          repeat_count: interval.repeatCount,
        })),
      );

    if (insertIntervalsError) {
      throw new Error(insertIntervalsError.message);
    }
  }

  return cardioLog;
}

export async function skipCardioRepository(sessionId: string, cardioBlockId: string) {
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, sessionId);
  await ensureCardioBlockBelongsToWorkoutSession({
    supabase,
    session,
    cardioBlockId,
    userId: user.id,
  });

  const { data: existingLog, error: existingLogError } = await supabase
    .from("session_cardio_logs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("workout_cardio_block_id", cardioBlockId)
    .maybeSingle();

  if (existingLogError) {
    throw new Error(existingLogError.message);
  }

  if (existingLog) {
    const { count: intervalCount, error: intervalCountError } = await supabase
      .from("session_cardio_intervals")
      .select("id", { head: true, count: "exact" })
      .eq("cardio_log_id", existingLog.id);

    if (intervalCountError) {
      throw new Error(intervalCountError.message);
    }

    const hasSavedMetrics =
      existingLog.total_duration_minutes != null ||
      existingLog.total_distance_km != null ||
      (intervalCount ?? 0) > 0;

    if (hasSavedMetrics) {
      throw new Error("Cardio already has saved metrics and cannot be skipped");
    }
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("session_cardio_logs")
    .upsert(
      {
        session_id: sessionId,
        workout_cardio_block_id: cardioBlockId,
        total_duration_minutes: null,
        total_distance_km: null,
        skipped_at: now,
        updated_at: now,
      },
      { onConflict: "session_id,workout_cardio_block_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function undoSkipCardioRepository(
  sessionId: string,
  cardioBlockId: string,
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  const session = await requireOwnedWorkoutSession(supabase, user.id, sessionId);
  await ensureCardioBlockBelongsToWorkoutSession({
    supabase,
    session,
    cardioBlockId,
    userId: user.id,
  });

  const { data: existingLog, error: existingLogError } = await supabase
    .from("session_cardio_logs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("workout_cardio_block_id", cardioBlockId)
    .maybeSingle();

  if (existingLogError) {
    throw new Error(existingLogError.message);
  }

  if (!existingLog) {
    return;
  }

  const { count: intervalCount, error: intervalCountError } = await supabase
    .from("session_cardio_intervals")
    .select("id", { head: true, count: "exact" })
    .eq("cardio_log_id", existingLog.id);

  if (intervalCountError) {
    throw new Error(intervalCountError.message);
  }

  const hasSavedMetrics =
    existingLog.total_duration_minutes != null ||
    existingLog.total_distance_km != null ||
    (intervalCount ?? 0) > 0;

  if (!hasSavedMetrics) {
    const { error: deleteError } = await supabase
      .from("session_cardio_logs")
      .delete()
      .eq("id", existingLog.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return;
  }

  const { error: updateError } = await supabase
    .from("session_cardio_logs")
    .update({ skipped_at: null, updated_at: new Date().toISOString() })
    .eq("id", existingLog.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}
