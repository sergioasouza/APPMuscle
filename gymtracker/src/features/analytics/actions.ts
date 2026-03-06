'use server'

import { getWorkoutAnalytics } from '@/features/analytics/service'
import type { ActionResult, WorkoutAnalyticsData } from '@/features/analytics/types'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error'
}

export async function getWorkoutAnalyticsAction(workoutId: string): Promise<ActionResult<WorkoutAnalyticsData>> {
    try {
        const data = await getWorkoutAnalytics(workoutId)
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
