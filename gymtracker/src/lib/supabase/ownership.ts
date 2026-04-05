import 'server-only'

import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface QueryResult<T> {
    data: T | null
    error: { message: string } | null
}

interface OwnedWorkoutRow {
    id: string
}

interface OwnedExerciseRow {
    id: string
    name: string
}

interface OwnedWorkoutSessionRow {
    id: string
    workout_id: string
    performed_at: string
    notes: string | null
}

interface OwnedWorkoutExerciseRow {
    id: string
    workout_id: string
    exercise_id: string
    workouts: { user_id: string }
}

interface OwnedSetLogRow {
    id: string
    session_id: string
    exercise_id: string
    workout_sessions: { user_id: string }
}

async function requireOwnedResult<T>(
    resultPromise: PromiseLike<QueryResult<T>>,
    resourceLabel: string,
) {
    const { data, error } = await resultPromise

    if (error) {
        throw new Error(error.message)
    }

    if (!data) {
        throw new Error(`${resourceLabel} not found`)
    }

    return data
}

export async function requireOwnedWorkout(
    supabase: SupabaseServerClient,
    userId: string,
    workoutId: string,
): Promise<OwnedWorkoutRow> {
    return requireOwnedResult(
        supabase
            .from('workouts')
            .select('id')
            .eq('id', workoutId)
            .eq('user_id', userId)
            .maybeSingle(),
        'Workout',
    )
}

export async function requireOwnedExercise(
    supabase: SupabaseServerClient,
    userId: string,
    exerciseId: string,
): Promise<OwnedExerciseRow> {
    return requireOwnedResult(
        supabase
            .from('exercises')
            .select('id, name')
            .eq('id', exerciseId)
            .eq('user_id', userId)
            .maybeSingle(),
        'Exercise',
    )
}

export async function requireOwnedWorkoutSession(
    supabase: SupabaseServerClient,
    userId: string,
    sessionId: string,
): Promise<OwnedWorkoutSessionRow> {
    return requireOwnedResult(
        supabase
            .from('workout_sessions')
            .select('id, workout_id, performed_at, notes')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .maybeSingle(),
        'Workout session',
    )
}

export async function requireOwnedWorkoutExercise(
    supabase: SupabaseServerClient,
    userId: string,
    workoutExerciseId: string,
): Promise<OwnedWorkoutExerciseRow> {
    return requireOwnedResult(
        supabase
            .from('workout_exercises')
            .select('id, workout_id, exercise_id, workouts!inner(user_id)')
            .eq('id', workoutExerciseId)
            .eq('workouts.user_id', userId)
            .maybeSingle(),
        'Workout exercise',
    )
}

export async function requireOwnedSetLog(
    supabase: SupabaseServerClient,
    userId: string,
    setLogId: string,
): Promise<OwnedSetLogRow> {
    return requireOwnedResult(
        supabase
            .from('set_logs')
            .select('id, session_id, exercise_id, workout_sessions!inner(user_id)')
            .eq('id', setLogId)
            .eq('workout_sessions.user_id', userId)
            .maybeSingle(),
        'Set log',
    )
}
