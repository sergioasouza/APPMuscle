'use server'

import { getCalendarMonth, getSessionSets } from '@/features/calendar/service'
import type { CalendarMonthData, SetLogWithExercise } from '@/features/calendar/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'

export async function getCalendarMonthAction(year: number, month: number): Promise<ActionResult<CalendarMonthData>> {
    try {
        const data = await getCalendarMonth(year, month)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function getSessionSetsAction(sessionId: string): Promise<ActionResult<SetLogWithExercise[]>> {
    try {
        const data = await getSessionSets(sessionId)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}
