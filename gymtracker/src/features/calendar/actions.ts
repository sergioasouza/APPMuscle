'use server'

import { getCalendarMonth, getSessionSets } from '@/features/calendar/service'
import type { ActionResult, CalendarMonthData, SetLogWithExercise } from '@/features/calendar/types'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error'
}

export async function getCalendarMonthAction(year: number, month: number): Promise<ActionResult<CalendarMonthData>> {
    try {
        const data = await getCalendarMonth(year, month)
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function getSessionSetsAction(sessionId: string): Promise<ActionResult<SetLogWithExercise[]>> {
    try {
        const data = await getSessionSets(sessionId)
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
