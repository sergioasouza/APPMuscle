import { buildScheduleDayPlan } from '@/features/schedule/rotation'
import type {
    CalendarSessionMetrics,
    CalendarWeekSummary,
    ScheduleEntry,
    ScheduleRotationEntry,
    SessionWithDetails,
} from '@/features/calendar/types'
import { parseWorkoutSessionStatus } from '@/lib/workout-session-status'

interface SessionSetLogSummary {
    session_id: string
    exercise_id: string
    weight_kg: number
    reps: number
}

function formatDayISO(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildWeekDateGroups(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const weekCount = Math.ceil((firstDayOfMonth + daysInMonth) / 7)

    return Array.from({ length: weekCount }, (_, weekIndex) => {
        const dates: string[] = []
        const startCell = weekIndex * 7

        for (let offset = 0; offset < 7; offset += 1) {
            const day = startCell + offset - firstDayOfMonth + 1
            if (day < 1 || day > daysInMonth) {
                continue
            }

            dates.push(formatDayISO(year, month, day))
        }

        return dates
    }).filter((dates) => dates.length > 0)
}

function buildScheduledObligationId(dateISO: string) {
    return `scheduled:${dateISO}`
}

export function buildCalendarSessionMetrics(
    setLogs: SessionSetLogSummary[],
): Record<string, CalendarSessionMetrics> {
    return setLogs.reduce<Record<string, CalendarSessionMetrics>>((accumulator, setLog) => {
        const current = accumulator[setLog.session_id] ?? {
            setCount: 0,
            totalVolume: 0,
            exerciseCount: 0,
        }

        accumulator[setLog.session_id] = {
            setCount: current.setCount + 1,
            totalVolume: current.totalVolume + Number(setLog.weight_kg) * setLog.reps,
            exerciseCount: current.exerciseCount,
        }

        return accumulator
    }, {})
}

export function enrichCalendarSessionMetricsWithExerciseCounts(
    metricsById: Record<string, CalendarSessionMetrics>,
    setLogs: SessionSetLogSummary[],
) {
    const exerciseIdsBySession = new Map<string, Set<string>>()

    for (const setLog of setLogs) {
        const current = exerciseIdsBySession.get(setLog.session_id) ?? new Set<string>()
        current.add(setLog.exercise_id)
        exerciseIdsBySession.set(setLog.session_id, current)
    }

    return Object.fromEntries(
        Object.entries(metricsById).map(([sessionId, metrics]) => [
            sessionId,
            {
                ...metrics,
                exerciseCount: exerciseIdsBySession.get(sessionId)?.size ?? 0,
            },
        ]),
    )
}

export function buildCalendarWeeklySummaries(input: {
    year: number
    month: number
    todayISO: string
    sessions: SessionWithDetails[]
    schedule: ScheduleEntry[]
    rotations: ScheduleRotationEntry[]
    rotationAnchorDate: string | null
    rotationCycleLength: number
    rotationSupportEnabled: boolean
    sessionMetricsById: Record<string, CalendarSessionMetrics>
}): CalendarWeekSummary[] {
    const sessionsByDate = input.sessions.reduce<Map<string, SessionWithDetails[]>>((accumulator, session) => {
        const current = accumulator.get(session.performed_at) ?? []
        current.push(session)
        accumulator.set(session.performed_at, current)
        return accumulator
    }, new Map())

    const weekDateGroups = buildWeekDateGroups(input.year, input.month)

    return weekDateGroups.map((dates, weekIndex) => {
        const scheduledDates = dates.filter((dateISO) => {
            const dayOfWeek = new Date(`${dateISO}T00:00:00`).getDay()
            const dayPlan = buildScheduleDayPlan({
                dayOfWeek,
                dateISO,
                anchorDateISO: input.rotationSupportEnabled ? input.rotationAnchorDate : null,
                baseEntry: input.schedule.find((entry) => entry.day_of_week === dayOfWeek),
                extraRotations: input.rotationSupportEnabled
                    ? input.rotations.filter((entry) => entry.day_of_week === dayOfWeek)
                    : [],
                cycleLength: input.rotationSupportEnabled ? input.rotationCycleLength : 1,
            })

            return !!dayPlan.activeVariant
        })

        const elapsedScheduledDates = scheduledDates.filter((dateISO) => dateISO <= input.todayISO)
        const completedObligations = new Set<string>()
        const skippedObligations = new Set<string>()
        let movedCount = 0
        let totalVolume = 0
        let completedSessionCount = 0

        for (const dateISO of dates) {
            const sessionsForDate = sessionsByDate.get(dateISO) ?? []

            for (const session of sessionsForDate) {
                const status = parseWorkoutSessionStatus(session.notes)
                const metrics = input.sessionMetricsById[session.id] ?? {
                    setCount: 0,
                    totalVolume: 0,
                    exerciseCount: 0,
                }
                const hasCompletedLogs = metrics.setCount > 0

                if (hasCompletedLogs) {
                    totalVolume += metrics.totalVolume
                    completedSessionCount += 1
                }

                if (status.kind === 'rescheduled_to') {
                    movedCount += 1
                }

                if (status.kind === 'skipped' && scheduledDates.includes(dateISO)) {
                    skippedObligations.add(buildScheduledObligationId(dateISO))
                }

                const obligationId = status.kind === 'rescheduled_from' && status.dateISO
                    ? buildScheduledObligationId(status.dateISO)
                    : scheduledDates.includes(dateISO) && status.kind !== 'rescheduled_to'
                        ? buildScheduledObligationId(dateISO)
                        : null

                if (hasCompletedLogs && obligationId) {
                    completedObligations.add(obligationId)
                }
            }
        }

        const completedCount = elapsedScheduledDates.filter((dateISO) =>
            completedObligations.has(buildScheduledObligationId(dateISO)),
        ).length
        const skippedCount = elapsedScheduledDates.filter((dateISO) =>
            skippedObligations.has(buildScheduledObligationId(dateISO))
            && !completedObligations.has(buildScheduledObligationId(dateISO)),
        ).length
        const pendingCount = Math.max(elapsedScheduledDates.length - completedCount - skippedCount, 0)
        const upcomingCount = scheduledDates.length - elapsedScheduledDates.length

        return {
            weekIndex,
            weekStartISO: dates[0],
            weekEndISO: dates[dates.length - 1],
            scheduledCount: scheduledDates.length,
            elapsedScheduledCount: elapsedScheduledDates.length,
            completedCount,
            skippedCount,
            pendingCount,
            upcomingCount,
            movedCount,
            totalVolume,
            completedSessionCount,
            adherenceRate: elapsedScheduledDates.length > 0 ? completedCount / elapsedScheduledDates.length : null,
        }
    })
}
