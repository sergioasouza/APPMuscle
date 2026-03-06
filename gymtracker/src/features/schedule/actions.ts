'use server'

import { assignWorkoutToDay, clearScheduleDay } from '@/features/schedule/service'
import type { ActionResult, ScheduleEntry } from '@/features/schedule/types'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error'
}

export async function assignWorkoutToDayAction(
    dayOfWeek: number,
    workoutId: string
): Promise<ActionResult<ScheduleEntry>> {
    try {
        const data = await assignWorkoutToDay(dayOfWeek, workoutId)
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function clearScheduleDayAction(dayOfWeek: number): Promise<ActionResult<null>> {
    try {
        await clearScheduleDay(dayOfWeek)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
