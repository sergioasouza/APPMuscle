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
  requireOwnedExercise,
  requireOwnedSetLog,
  requireOwnedWorkout,
  requireOwnedWorkoutSession,
} from "@/lib/supabase/ownership";
import {
  buildWorkoutSessionNotesWithStatus,
  buildRescheduledFromWorkoutSessionNote,
  buildRescheduledToWorkoutSessionNote,
  buildSkippedWorkoutSessionNote,
  isAnalyticsExcludedWorkoutSession,
  parseWorkoutSessionStatus,
  removeSkippedWorkoutSessionNote,
} from "@/lib/workout-session-status";
import type {
  Exercise,
  Schedule,
  ScheduleRotation,
  SetLog,
  Workout,
  WorkoutExercise,
  WorkoutSession,
} from "@/lib/types";

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: Exercise };
type ScheduleWithWorkout = Schedule & { workouts: Workout | null };
type ScheduleRotationWithWorkout = ScheduleRotation & { workouts: Workout | null };
type SessionWithWorkout = WorkoutSession & { workouts: Workout };

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
    .order("created_at", { ascending: false })
    .limit(1);

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const existingSession =
    (existingSessions?.[0] as SessionWithWorkout | undefined) ?? null;

  let activeWorkout = scheduledWorkout;
  let session = existingSession as WorkoutSession | null;
  let existingSessionHasLogs = false;
  const existingSessionStatus = parseWorkoutSessionStatus(existingSession?.notes);
  const existingSessionIsSkipped = existingSessionStatus.kind === "skipped";

  if (existingSession) {
    const { count, error: countError } = await supabase
      .from("set_logs")
      .select("id", { head: true, count: "exact" })
      .eq("session_id", existingSession.id);

    if (countError) {
      throw new Error(countError.message);
    }

    existingSessionHasLogs = (count ?? 0) > 0;
  }

  if (
    existingSession &&
    scheduledWorkout &&
    !existingSessionIsSkipped &&
    existingSession.workout_id !== scheduledWorkout.id
  ) {
    activeWorkout = (existingSession as SessionWithWorkout).workouts;
  } else if (
    existingSession &&
    !scheduledWorkout &&
    !existingSessionIsSkipped &&
    existingSessionHasLogs
  ) {
    activeWorkout = (existingSession as SessionWithWorkout).workouts;
  }

  if (!session && activeWorkout) {
    const { data: newSession, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        workout_id: activeWorkout.id,
        performed_at: dateISO,
      })
      .select("*")
      .single();

    if (error) {
      // 23503: FK violation (workout was deleted)
      // 42501: RLS policy rejected the insert
      const shouldFallbackWithoutSession =
        error.code === "23503" || error.code === "42501";

      // 23505: unique_violation — session already exists for this
      // (user_id, workout_id, performed_at) combination.  This can
      // happen in a race condition where two requests try to create
      // the session at the same time.  Recover by fetching the row
      // that is already there instead of failing.
      const isDuplicate = error.code === "23505";

      if (shouldFallbackWithoutSession) {
        session = null;
      } else if (isDuplicate) {
        const { data: existingSession } = await supabase
          .from("workout_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("workout_id", activeWorkout.id)
          .eq("performed_at", dateISO)
          .maybeSingle();

        session = existingSession;
      } else {
        throw new Error(error.message);
      }
    } else {
      session = newSession;
    }
  }

  let workoutExercises: WorkoutExerciseWithExercise[] = [];

  if (activeWorkout) {
    const { data, error } = await supabase
      .from("workout_exercises")
      .select("*, exercises(*)")
      .eq("workout_id", activeWorkout.id)
      .order("display_order");

    if (error) {
      throw new Error(error.message);
    }

    workoutExercises = (
      (data as WorkoutExerciseWithExercise[] | null) ?? []
    ).filter((we) => we.exercises != null);
  }

  let setLogs: SetLog[] = [];

  if (session) {
    const { data, error } = await supabase
      .from("set_logs")
      .select("*")
      .eq("session_id", session.id)
      .order("set_number");

    if (error) {
      throw new Error(error.message);
    }

    setLogs = data ?? [];
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
    setLogs,
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
    .select("*")
    .eq("performed_at", dateISO)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingSessionError) {
    throw new Error(existingSessionError.message);
  }

  const existingSession = existingSessions?.[0] ?? null;

  if (!existingSession) {
    const { error } = await supabase.from("workout_sessions").insert({
      user_id: user.id,
      workout_id: workoutId,
      performed_at: dateISO,
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const { error: deleteError } = await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", existingSession.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: updateError } = await supabase
    .from("workout_sessions")
    .update({ workout_id: workoutId })
    .eq("id", existingSession.id)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function skipWorkoutRepository(
  sessionId: string,
  notes: string | null,
) {
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutSession(supabase, user.id, sessionId);

  const { error: deleteError } = await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", sessionId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: updateError } = await supabase
    .from("workout_sessions")
    .update({ notes: buildSkippedWorkoutSessionNote(notes) })
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
  const { supabase, user } = await getAuthenticatedServerContext();
  await requireOwnedWorkoutSession(supabase, user.id, sessionId);

  const { error } = await supabase
    .from("workout_sessions")
    .update({ notes: removeSkippedWorkoutSessionNote(notes) })
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

    return data;
  }

  await Promise.all([
    requireOwnedWorkoutSession(supabase, user.id, input.sessionId),
    requireOwnedExercise(supabase, user.id, input.exerciseId),
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
