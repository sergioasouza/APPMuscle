import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Exercise, SetLog, Workout, WorkoutExercise, WorkoutSession } from '@/lib/types'

type WorkoutExerciseWithExercise = WorkoutExercise & { exercises: Exercise }
type ScheduleWithWorkout = { workouts: Workout }
type SessionWithWorkout = WorkoutSession & { workouts: Workout }

async function getAuthenticatedContext() {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error) {
        throw new Error(error.message)
    }

    if (!user) {
        throw new Error('Unauthorized')
    }

    return { supabase, user }
}

export async function getTodayViewRepository(dateISO: string, dayOfWeek: number) {
    const { supabase, user } = await getAuthenticatedContext()

    const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule')
        .select('*, workouts(*)')
        .eq('day_of_week', dayOfWeek)
        .eq('user_id', user.id)
        .maybeSingle()

    if (scheduleError) {
        throw new Error(scheduleError.message)
    }

    const scheduledWorkout = (scheduleData as ScheduleWithWorkout | null)?.workouts ?? null

    const { data: existingSession, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('*, workouts(*)')
        .eq('performed_at', dateISO)
        .eq('user_id', user.id)
        .maybeSingle()

    if (sessionError) {
        throw new Error(sessionError.message)
    }

    let activeWorkout = scheduledWorkout
    let session = existingSession as WorkoutSession | null

    if (existingSession && scheduledWorkout && existingSession.workout_id !== scheduledWorkout.id) {
        activeWorkout = (existingSession as SessionWithWorkout).workouts
    } else if (existingSession && !scheduledWorkout) {
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
            throw new Error(error.message)
        }

        session = newSession
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

        workoutExercises = (data as WorkoutExerciseWithExercise[] | null) ?? []
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
    const { supabase, user } = await getAuthenticatedContext()

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
    const { supabase, user } = await getAuthenticatedContext()

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
    const { supabase } = await getAuthenticatedContext()

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
    const { supabase } = await getAuthenticatedContext()

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
    const { supabase, user } = await getAuthenticatedContext()

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
    const { supabase } = await getAuthenticatedContext()

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
    const { supabase } = await getAuthenticatedContext()

    const { error } = await supabase
        .from('workout_sessions')
        .update({ notes: notes.trim() || null })
        .eq('id', sessionId)

    if (error) {
        throw new Error(error.message)
    }
}
