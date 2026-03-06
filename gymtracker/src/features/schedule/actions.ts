'use server'

import { assignWorkoutToDay, clearScheduleDay } from '@/features/schedule/service'
import type { ScheduleEntry } from '@/features/schedule/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'

export async function assignWorkoutToDayAction(
    dayOfWeek: number,
    workoutId: string
): Promise<ActionResult<ScheduleEntry>> {
    try {
        const data = await assignWorkoutToDay(dayOfWeek, workoutId)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function clearScheduleDayAction(dayOfWeek: number): Promise<ActionResult<null>> {
    try {
        await clearScheduleDay(dayOfWeek)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
