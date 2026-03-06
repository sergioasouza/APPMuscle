import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { SetLog, WorkoutExerciseWithExercise, WorkoutSession } from '@/lib/types'

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

export async function getWorkoutAnalyticsRepository(workoutId: string) {
    const { supabase, user } = await getAuthenticatedContext()

    const [workoutExercisesResult, sessionsResult] = await Promise.all([
        supabase
            .from('workout_exercises')
            .select('*, exercises(*)')
            .eq('workout_id', workoutId)
            .order('display_order'),
        supabase
            .from('workout_sessions')
            .select('*')
            .eq('workout_id', workoutId)
            .eq('user_id', user.id)
            .order('performed_at', { ascending: false }),
    ])

    if (workoutExercisesResult.error) {
        throw new Error(workoutExercisesResult.error.message)
    }

    if (sessionsResult.error) {
        throw new Error(sessionsResult.error.message)
    }

    const sessions = (sessionsResult.data as WorkoutSession[] | null) ?? []
    const sessionIds = sessions.map((session) => session.id)

    let setLogs: SetLog[] = []

    if (sessionIds.length > 0) {
        const { data, error } = await supabase
            .from('set_logs')
            .select('*')
            .in('session_id', sessionIds)

        if (error) {
            throw new Error(error.message)
        }

        setLogs = data ?? []
    }

    return {
        workoutExercises: (workoutExercisesResult.data as WorkoutExerciseWithExercise[] | null) ?? [],
        sessions,
        setLogs,
    }
}
