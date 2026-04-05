import { buildCalendarWeeklySummaries } from '@/features/calendar/metrics'
import type { ScheduleEntry, SessionWithDetails } from '@/features/calendar/types'
import { buildRescheduledFromWorkoutSessionNote, buildRescheduledToWorkoutSessionNote } from '@/lib/workout-session-status'
import type { Workout } from '@/lib/types'

const workout: Workout = {
    id: 'workout-1',
    user_id: 'user-1',
    name: 'Push',
    created_at: '2026-04-01T08:00:00.000Z',
}

function createScheduleEntry(dayOfWeek: number): ScheduleEntry {
    return {
        id: `schedule-${dayOfWeek}`,
        user_id: 'user-1',
        workout_id: workout.id,
        day_of_week: dayOfWeek,
        workouts: workout,
    }
}

function createSession(params: {
    id: string
    performedAt: string
    notes?: string | null
}): SessionWithDetails {
    return {
        id: params.id,
        user_id: 'user-1',
        workout_id: workout.id,
        performed_at: params.performedAt,
        notes: params.notes ?? null,
        created_at: `${params.performedAt}T08:00:00.000Z`,
        workouts: workout,
    }
}

describe('buildCalendarWeeklySummaries', () => {
    it('credits a completed rescheduled destination session to the planned source day', () => {
        const sourceSession = createSession({
            id: 'session-source',
            performedAt: '2026-04-06',
            notes: buildRescheduledToWorkoutSessionNote({
                targetDateISO: '2026-04-07',
                targetLabel: 'Tuesday',
            }),
        })
        const targetSession = createSession({
            id: 'session-target',
            performedAt: '2026-04-07',
            notes: buildRescheduledFromWorkoutSessionNote({
                sourceDateISO: '2026-04-06',
                sourceLabel: 'Monday',
            }),
        })

        const summaries = buildCalendarWeeklySummaries({
            year: 2026,
            month: 3,
            todayISO: '2026-04-07',
            sessions: [sourceSession, targetSession],
            schedule: [createScheduleEntry(1)],
            rotations: [],
            rotationAnchorDate: null,
            rotationCycleLength: 1,
            rotationSupportEnabled: false,
            sessionMetricsById: {
                'session-source': { setCount: 0, totalVolume: 0, exerciseCount: 0 },
                'session-target': { setCount: 3, totalVolume: 1220, exerciseCount: 1 },
            },
        })

        const week = summaries.find(
            (summary) => summary.weekStartISO <= '2026-04-06' && summary.weekEndISO >= '2026-04-06',
        )

        expect(week).toMatchObject({
            completedCount: 1,
            skippedCount: 0,
            pendingCount: 0,
            movedCount: 1,
            totalVolume: 1220,
            adherenceRate: 1,
        })
    })

    it('separates elapsed planned sessions from upcoming ones within the same week', () => {
        const summaries = buildCalendarWeeklySummaries({
            year: 2026,
            month: 3,
            todayISO: '2026-04-07',
            sessions: [],
            schedule: [createScheduleEntry(1), createScheduleEntry(4)],
            rotations: [],
            rotationAnchorDate: null,
            rotationCycleLength: 1,
            rotationSupportEnabled: false,
            sessionMetricsById: {},
        })

        const week = summaries.find(
            (summary) => summary.weekStartISO <= '2026-04-06' && summary.weekEndISO >= '2026-04-09',
        )

        expect(week).toMatchObject({
            scheduledCount: 2,
            elapsedScheduledCount: 1,
            completedCount: 0,
            pendingCount: 1,
            upcomingCount: 1,
        })
    })
})
