'use server'

import { deleteWorkoutSession, getCalendarMonth, getSessionSets } from '@/features/calendar/service'
import { skipWorkout } from '@/features/today/service'
import type { CalendarMonthData, SetLogWithExercise } from '@/features/calendar/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import { assertIntegerInRange, assertUuid } from '@/lib/validation'

export async function getCalendarMonthAction(year: number, month: number): Promise<ActionResult<CalendarMonthData>> {
    try {
        assertIntegerInRange(month, 'Month', 0, 11)
        const data = await getCalendarMonth(year, month)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function getSessionSetsAction(sessionId: string): Promise<ActionResult<SetLogWithExercise[]>> {
    try {
        assertUuid(sessionId, 'Session id')
        const data = await getSessionSets(sessionId)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipWorkoutFromCalendarAction(sessionId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await skipWorkout(sessionId, null)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipFromCalendarAction(sessionId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        const { undoSkipWorkout } = await import('@/features/today/service')
        await undoSkipWorkout(sessionId, null)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function deleteWorkoutSessionFromCalendarAction(sessionId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await deleteWorkoutSession(sessionId)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
