import { buildBodyMetricsPerformanceSnapshots } from '@/features/body-metrics/service'
import { buildRescheduledFromWorkoutSessionNote, buildRescheduledToWorkoutSessionNote } from '@/lib/workout-session-status'
import type { BodyMeasurement, SetLog, WorkoutSession } from '@/lib/types'

function createMeasurement(params: {
    id: string
    measuredAt: string
    weightKg?: number | null
    bodyFatPct?: number | null
}): BodyMeasurement {
    return {
        id: params.id,
        user_id: 'user-1',
        measured_at: params.measuredAt,
        height_cm: null,
        weight_kg: params.weightKg ?? null,
        body_fat_pct: params.bodyFatPct ?? null,
        chest_cm: null,
        waist_cm: null,
        hips_cm: null,
        left_arm_cm: null,
        right_arm_cm: null,
        left_thigh_cm: null,
        right_thigh_cm: null,
        left_calf_cm: null,
        right_calf_cm: null,
        notes: null,
        created_at: `${params.measuredAt}T08:00:00.000Z`,
    }
}

function createSession(params: {
    id: string
    performedAt: string
    notes?: string | null
}): WorkoutSession {
    return {
        id: params.id,
        user_id: 'user-1',
        workout_id: 'workout-1',
        performed_at: params.performedAt,
        notes: params.notes ?? null,
        created_at: `${params.performedAt}T08:00:00.000Z`,
    }
}

function createSetLog(params: {
    id: string
    sessionId: string
    weightKg: number
    reps: number
}): SetLog {
    return {
        id: params.id,
        session_id: params.sessionId,
        exercise_id: 'exercise-1',
        set_number: 1,
        weight_kg: params.weightKg,
        reps: params.reps,
        created_at: '2026-04-01T08:00:00.000Z',
    }
}

describe('buildBodyMetricsPerformanceSnapshots', () => {
    it('includes real rescheduled sessions and ignores skipped placeholders in the 21-day window', () => {
        const entries = [
            createMeasurement({ id: 'measurement-1', measuredAt: '2026-04-10', weightKg: 82, bodyFatPct: 15 }),
            createMeasurement({ id: 'measurement-2', measuredAt: '2026-04-20', weightKg: 81.5, bodyFatPct: 14.5 }),
        ]

        const sessions = [
            createSession({ id: 'session-early', performedAt: '2026-03-15' }),
            createSession({ id: 'session-normal', performedAt: '2026-04-05' }),
            createSession({
                id: 'session-rescheduled-target',
                performedAt: '2026-04-09',
                notes: buildRescheduledFromWorkoutSessionNote({
                    sourceDateISO: '2026-04-08',
                    sourceLabel: 'Wednesday',
                }),
            }),
            createSession({
                id: 'session-rescheduled-source',
                performedAt: '2026-04-08',
                notes: buildRescheduledToWorkoutSessionNote({
                    targetDateISO: '2026-04-09',
                    targetLabel: 'Thursday',
                }),
            }),
        ]

        const setLogs = [
            createSetLog({ id: 'set-early', sessionId: 'session-early', weightKg: 200, reps: 2 }),
            createSetLog({ id: 'set-normal', sessionId: 'session-normal', weightKg: 100, reps: 5 }),
            createSetLog({ id: 'set-target', sessionId: 'session-rescheduled-target', weightKg: 90, reps: 8 }),
            createSetLog({ id: 'set-source', sessionId: 'session-rescheduled-source', weightKg: 140, reps: 3 }),
        ]

        const snapshots = buildBodyMetricsPerformanceSnapshots(entries, sessions, setLogs)

        expect(snapshots[0]).toEqual({
            measuredAt: '2026-04-10',
            sessionCount: 2,
            totalVolume: 1220,
            averageSessionVolume: 610,
            peakEstimated1RM: 116.7,
        })

        expect(snapshots[1]).toEqual({
            measuredAt: '2026-04-20',
            sessionCount: 2,
            totalVolume: 1220,
            averageSessionVolume: 610,
            peakEstimated1RM: 116.7,
        })
    })

    it('returns null averages and peaks when the measurement window has no valid sessions', () => {
        const snapshots = buildBodyMetricsPerformanceSnapshots(
            [createMeasurement({ id: 'measurement-empty', measuredAt: '2026-04-10' })],
            [createSession({ id: 'session-old', performedAt: '2026-03-01' })],
            [createSetLog({ id: 'set-old', sessionId: 'session-old', weightKg: 100, reps: 5 })],
        )

        expect(snapshots).toEqual([
            {
                measuredAt: '2026-04-10',
                sessionCount: 0,
                totalVolume: 0,
                averageSessionVolume: null,
                peakEstimated1RM: null,
            },
        ])
    })
})
