import 'server-only'

import {
    buildCalendarSessionMetrics,
    buildCalendarWeeklySummaries,
    enrichCalendarSessionMetricsWithExerciseCounts,
} from '@/features/calendar/metrics'
import {
    deleteWorkoutSessionRepository,
    getCalendarMonthRepository,
    getSessionSetsRepository,
} from '@/features/calendar/repository'
import { getTodayInTimezone } from '@/lib/utils'

export async function getCalendarMonth(year: number, month: number) {
    if (month < 0 || month > 11) {
        throw new Error('Invalid month')
    }

    const data = await getCalendarMonthRepository(year, month)
    const timezone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo'
    const todayISO = getTodayInTimezone(timezone).dateISO
    const sessionMetricsById = enrichCalendarSessionMetricsWithExerciseCounts(
        buildCalendarSessionMetrics(data.sessionSetLogs),
        data.sessionSetLogs,
    )

    return {
        sessions: data.sessions,
        schedule: data.schedule,
        rotations: data.rotations,
        rotationAnchorDate: data.rotationAnchorDate,
        rotationCycleLength: data.rotationCycleLength,
        rotationSupportEnabled: data.rotationSupportEnabled,
        sessionMetricsById,
        weeklySummaries: buildCalendarWeeklySummaries({
            year,
            month,
            todayISO,
            sessions: data.sessions,
            schedule: data.schedule,
            rotations: data.rotations,
            rotationAnchorDate: data.rotationAnchorDate,
            rotationCycleLength: data.rotationCycleLength,
            rotationSupportEnabled: data.rotationSupportEnabled,
            sessionMetricsById,
        }),
        todayISO,
    }
}

export async function getSessionSets(sessionId: string) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    return getSessionSetsRepository(sessionId)
}

export async function deleteWorkoutSession(sessionId: string) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    await deleteWorkoutSessionRepository(sessionId)
}
