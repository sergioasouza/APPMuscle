import 'server-only'

import { getRotationCycleLength } from '@/features/schedule/rotation'
import { formatDateISO } from '@/lib/utils'
import { getAuthenticatedServerContext } from '@/lib/supabase/auth'
import { resolveExercisesForUser } from '@/lib/supabase/exercises'
import { requireOwnedWorkoutSession } from '@/lib/supabase/ownership'
import { isMissingColumnError, isMissingTableError } from '@/lib/supabase/schema-compat'
import type { ScheduleEntry, ScheduleRotationEntry } from '@/features/calendar/types'
import type { Exercise, SetLog } from '@/lib/types'

export async function getCalendarMonthRepository(year: number, month: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0)

    const [sessionsResult, scheduleResult, rotationsResult, profileResult] = await Promise.all([
        supabase
            .from('workout_sessions')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .gte('performed_at', formatDateISO(startOfMonth))
            .lte('performed_at', formatDateISO(endOfMonth))
            .order('performed_at'),
        supabase
            .from('schedule')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .order('day_of_week'),
        supabase
            .from('schedule_rotations')
            .select('*, workouts(*)')
            .eq('user_id', user.id)
            .order('day_of_week')
            .order('rotation_index'),
        supabase
            .from('profiles')
            .select('rotation_anchor_date')
            .eq('id', user.id)
            .maybeSingle(),
    ])

    if (sessionsResult.error) {
        throw new Error(sessionsResult.error.message)
    }

    if (scheduleResult.error) {
        throw new Error(scheduleResult.error.message)
    }

    const rotationSupportEnabled = !isMissingTableError(rotationsResult.error, 'schedule_rotations')

    if (rotationsResult.error && rotationSupportEnabled) {
        throw new Error(rotationsResult.error.message)
    }

    const rotationAnchorColumnAvailable = !isMissingColumnError(profileResult.error, 'rotation_anchor_date')

    if (profileResult.error && rotationAnchorColumnAvailable) {
        throw new Error(profileResult.error.message)
    }

    const rotations = rotationSupportEnabled ? (rotationsResult.data as ScheduleRotationEntry[] | null) ?? [] : []
    const sessions = sessionsResult.data ?? []
    const sessionIds = sessions.map((session) => session.id)
    let sessionSetLogs: Pick<SetLog, 'session_id' | 'exercise_id' | 'weight_kg' | 'reps'>[] = []
    let sessionCardioLogs: Array<{ session_id: string }> = []

    if (sessionIds.length > 0) {
        const [setLogsResult, cardioLogsResult] = await Promise.all([
            supabase
                .from('set_logs')
                .select('session_id, exercise_id, weight_kg, reps')
                .in('session_id', sessionIds),
            supabase
                .from('session_cardio_logs')
                .select('session_id')
                .in('session_id', sessionIds)
                .is('skipped_at', null),
        ])

        if (setLogsResult.error) {
            throw new Error(setLogsResult.error.message)
        }

        if (cardioLogsResult.error) {
            throw new Error(cardioLogsResult.error.message)
        }

        sessionSetLogs = setLogsResult.data ?? []
        sessionCardioLogs = cardioLogsResult.data ?? []
    }

    return {
        sessions,
        schedule: (scheduleResult.data as ScheduleEntry[] | null) ?? [],
        rotations,
        rotationAnchorDate: rotationAnchorColumnAvailable ? profileResult.data?.rotation_anchor_date ?? null : null,
        rotationCycleLength: getRotationCycleLength(rotations),
        rotationSupportEnabled: rotationSupportEnabled && rotationAnchorColumnAvailable,
        sessionSetLogs,
        sessionCardioLogs,
    }
}

export async function getSessionSetsRepository(sessionId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()
    await requireOwnedWorkoutSession(supabase, user.id, sessionId)

    const { data, error } = await supabase
        .from('set_logs')
        .select('*, exercises(*)')
        .eq('session_id', sessionId)
        .order('exercise_id')
        .order('set_number')

    if (error) {
        throw new Error(error.message)
    }

    const setLogs = (data as (SetLog & { exercises: Exercise | null })[] | null) ?? []
    const resolvedExercises = await resolveExercisesForUser(
        supabase,
        user.id,
        setLogs.flatMap((setLog) => setLog.exercises == null ? [] : [setLog.exercises]),
    )
    const resolvedById = resolvedExercises.reduce<Map<string, typeof resolvedExercises[number]>>((accumulator, exercise) => {
        accumulator.set(exercise.id, exercise)
        return accumulator
    }, new Map())

    return setLogs.flatMap((setLog) => {
        const resolvedExercise = resolvedById.get(setLog.exercise_id)

        if (!resolvedExercise) {
            return []
        }

        return [{ ...setLog, exercises: resolvedExercise }]
    })
}

export async function deleteWorkoutSessionRepository(sessionId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()
    await requireOwnedWorkoutSession(supabase, user.id, sessionId)

    const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id)

    if (error) {
        throw new Error(error.message)
    }
}
