import 'server-only'

import { getCalendarMonthRepository, getSessionSetsRepository } from '@/features/calendar/repository'

export async function getCalendarMonth(year: number, month: number) {
    if (month < 0 || month > 11) {
        throw new Error('Invalid month')
    }

    return {
        sessions: await getCalendarMonthRepository(year, month),
    }
}

export async function getSessionSets(sessionId: string) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    return getSessionSetsRepository(sessionId)
}
