import 'server-only'

import { getWorkoutAnalyticsRepository } from '@/features/analytics/repository'
import type { WorkoutAnalyticsData } from '@/features/analytics/types'

export async function getWorkoutAnalytics(workoutId: string): Promise<WorkoutAnalyticsData> {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    const { workoutExercises, sessions, setLogs } = await getWorkoutAnalyticsRepository(workoutId)

    const enrichedSessions = sessions.map((session) => {
        const sessionSets = setLogs.filter((setLog) => setLog.session_id === session.id)

        return {
            ...session,
            totalVolume: sessionSets.reduce((sum, setLog) => sum + setLog.weight_kg * setLog.reps, 0),
            totalSets: sessionSets.length,
        }
    })

    return {
        workoutExercises,
        sessions: enrichedSessions,
        setLogs,
    }
}
