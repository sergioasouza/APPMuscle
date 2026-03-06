import 'server-only'

import { getAuthenticatedServerContext } from '@/lib/supabase/auth'
import type { SetLog, WorkoutExerciseWithExercise, WorkoutSession } from '@/lib/types'

export async function getWorkoutAnalyticsRepository(workoutId: string) {
    const { supabase, user } = await getAuthenticatedServerContext()

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
