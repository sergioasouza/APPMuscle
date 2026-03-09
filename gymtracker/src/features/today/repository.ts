import 'server-only'

import { getAuthenticatedServerContext } from '@/lib/supabase/auth'
import type { Exercise, SetLog, Workout, WorkoutExercise, WorkoutSession } from '@/lib/types'

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: Exercise }
type ScheduleWithWorkout = { workouts: Workout }
type SessionWithWorkout = WorkoutSession & { workouts: Workout }

export async function getTodayViewRepository(dateISO: string, dayOfWeek: number) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule')
        .select('*, workouts(*)')
        .eq('day_of_week', dayOfWeek)
        .eq('user_id', user.id)
        .order('id', { ascending: false })
        .limit(1)

    if (scheduleError) {
        throw new Error(scheduleError.message)
    }

    const scheduledWorkout = ((scheduleData?.[0] as ScheduleWithWorkout | undefined)?.workouts) ?? null

    const { data: existingSessions, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('*, workouts(*)')
        .eq('performed_at', dateISO)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

    if (sessionError) {
        throw new Error(sessionError.message)
    }

    const existingSession = ((existingSessions?.[0] as SessionWithWorkout | undefined) ?? null)

    let activeWorkout = scheduledWorkout
    let session = existingSession as WorkoutSession | null
    let existingSessionHasLogs = false
    const existingSessionNotes = existingSession?.notes ?? ''
    const existingSessionIsSkipped = existingSessionNotes.startsWith('[SKIPPED]')

    if (existingSession) {
        const { count, error: countError } = await supabase
            .from('set_logs')
            .select('id', { head: true, count: 'exact' })
            .eq('session_id', existingSession.id)

        if (countError) {
            throw new Error(countError.message)
        }

        existingSessionHasLogs = (count ?? 0) > 0
    }

    if (existingSession && scheduledWorkout && !existingSessionIsSkipped && existingSession.workout_id !== scheduledWorkout.id) {
        activeWorkout = (existingSession as SessionWithWorkout).workouts
    } else if (existingSession && !scheduledWorkout && !existingSessionIsSkipped && existingSessionHasLogs) {
        activeWorkout = (existingSession as SessionWithWorkout).workouts
    }

    if (!session && activeWorkout) {
        const { data: newSession, error } = await supabase
            .from('workout_sessions')
            .insert({
                user_id: user.id,
                workout_id: activeWorkout.id,
                performed_at: dateISO,
            })
            .select('*')
            .single()

        if (error) {
            const shouldFallbackWithoutSession = error.code === '23503' || error.code === '42501'

            if (!shouldFallbackWithoutSession) {
                throw new Error(error.message)
            }

            session = null
        } else {
            session = newSession
        }
    }

    let workoutExercises: WorkoutExerciseWithExercise[] = []

    if (activeWorkout) {
        const { data, error } = await supabase
            .from('workout_exercises')
            .select('*, exercises(*)')
            .eq('workout_id', activeWorkout.id)
            .order('display_order')

        if (error) {
            throw new Error(error.message)
        }

        workoutExercises = ((data as WorkoutExerciseWithExercise[] | null) ?? []).filter((we) => we.exercises != null)
    }

    let setLogs: SetLog[] = []

    if (session) {
        const { data, error } = await supabase
            .from('set_logs')
            .select('*')
            .eq('session_id', session.id)
            .order('set_number')

        if (error) {
            throw new Error(error.message)
        }

        setLogs = data ?? []
    }

    return {
        workout: activeWorkout,
        session,
        workoutExercises,
        setLogs,
        notes: session?.notes ?? '',
    }
}

export async function listUserWorkoutsRepository() {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

    if (error) {
        throw new Error(error.message)
    }

    return data ?? []
}

export async function switchWorkoutForDayRepository(dateISO: string, workoutId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const { data: existingSession, error: existingSessionError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('performed_at', dateISO)
        .eq('user_id', user.id)
        .maybeSingle()

    if (existingSessionError) {
        throw new Error(existingSessionError.message)
    }

    if (!existingSession) {
        const { error } = await supabase.from('workout_sessions').insert({
            user_id: user.id,
            workout_id: workoutId,
            performed_at: dateISO,
        })

        if (error) {
            throw new Error(error.message)
        }

        return
    }

    const { error: deleteError } = await supabase
        .from('set_logs')
        .delete()
        .eq('session_id', existingSession.id)

    if (deleteError) {
        throw new Error(deleteError.message)
    }

    const { error: updateError } = await supabase
        .from('workout_sessions')
        .update({ workout_id: workoutId })
        .eq('id', existingSession.id)

    if (updateError) {
        throw new Error(updateError.message)
    }
}

export async function skipWorkoutRepository(sessionId: string, notes: string | null) {
    const { supabase } = await getAuthenticatedServerContext()

    const { error: deleteError } = await supabase
        .from('set_logs')
        .delete()
        .eq('session_id', sessionId)

    if (deleteError) {
        throw new Error(deleteError.message)
    }

    const { error: updateError } = await supabase
        .from('workout_sessions')
        .update({ notes: `[SKIPPED] ${notes ?? ''}`.trimEnd() })
        .eq('id', sessionId)

    if (updateError) {
        throw new Error(updateError.message)
    }
}

export async function undoSkipWorkoutRepository(sessionId: string, notes: string | null) {
    const { supabase } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('workout_sessions')
        .update({ notes: notes?.replace('[SKIPPED] ', '') || null })
        .eq('id', sessionId)

    if (error) {
        throw new Error(error.message)
    }
}

export async function rescheduleWorkoutRepository(
    dateISO: string,
    todayDayOfWeek: number,
    targetDay: number,
    workoutId: string,
    sessionId: string | null,
    dayNames: string[]
) {
    const { supabase, user } = await getAuthenticatedServerContext()

    const today = new Date(`${dateISO}T00:00:00`)
    const targetDate = new Date(today)
    let diff = targetDay - today.getDay()
    if (diff <= 0) diff += 7
    targetDate.setDate(today.getDate() + diff)
    const targetDateISO = targetDate.toISOString().slice(0, 10)

    if (sessionId) {
        const { error: deleteError } = await supabase.from('set_logs').delete().eq('session_id', sessionId)
        if (deleteError) {
            throw new Error(deleteError.message)
        }

        const { error: updateError } = await supabase
            .from('workout_sessions')
            .update({ notes: `[RESCHEDULED TO ${dayNames[targetDay]}]` })
            .eq('id', sessionId)

        if (updateError) {
            throw new Error(updateError.message)
        }
    } else {
        const { error } = await supabase.from('workout_sessions').insert({
            user_id: user.id,
            workout_id: workoutId,
            performed_at: dateISO,
            notes: `[RESCHEDULED TO ${dayNames[targetDay]}]`,
        })

        if (error) {
            throw new Error(error.message)
        }
    }

    const { error: removeTargetError } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('performed_at', targetDateISO)
        .eq('user_id', user.id)

    if (removeTargetError) {
        throw new Error(removeTargetError.message)
    }

    const { error: insertTargetError } = await supabase.from('workout_sessions').insert({
        user_id: user.id,
        workout_id: workoutId,
        performed_at: targetDateISO,
        notes: `[RESCHEDULED FROM ${dayNames[todayDayOfWeek]}]`,
    })

    if (insertTargetError) {
        throw new Error(insertTargetError.message)
    }
}

export async function saveSetRepository(input: {
    sessionId: string
    exerciseId: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}) {
    const { supabase } = await getAuthenticatedServerContext()

    if (input.setLogId) {
        const { data, error } = await supabase
            .from('set_logs')
            .update({ weight_kg: input.weight, reps: input.reps })
            .eq('id', input.setLogId)
            .select('*')
            .single()

        if (error) {
            throw new Error(error.message)
        }

        return data
    }

    const { data, error } = await supabase
        .from('set_logs')
        .insert({
            session_id: input.sessionId,
            exercise_id: input.exerciseId,
            set_number: input.setNumber,
            weight_kg: input.weight,
            reps: input.reps,
        })
        .select('*')
        .single()

    if (error) {
        throw new Error(error.message)
    }

    return data
}

export async function saveSessionNotesRepository(sessionId: string, notes: string) {
    const { supabase } = await getAuthenticatedServerContext()

    const { error } = await supabase
        .from('workout_sessions')
        .update({ notes: notes.trim() || null })
        .eq('id', sessionId)

    if (error) {
        throw new Error(error.message)
    }
}
