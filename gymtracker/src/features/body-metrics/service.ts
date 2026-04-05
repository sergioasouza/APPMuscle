import 'server-only'

import {
    deleteBodyMeasurementRepository,
    listBodyMetricPerformanceRepository,
    listBodyMeasurementsRepository,
    upsertBodyMeasurementRepository,
} from '@/features/body-metrics/repository'
import type {
    BodyMeasurementInput,
    BodyMetricsPerformanceSnapshot,
} from '@/features/body-metrics/types'
import type { BodyMeasurement, SetLog, WorkoutSession } from '@/lib/types'
import { isAnalyticsExcludedWorkoutSession } from '@/lib/workout-session-status'

const NUMERIC_FIELDS: (keyof Omit<BodyMeasurementInput, 'measuredAt' | 'notes'>)[] = [
    'height_cm',
    'weight_kg',
    'body_fat_pct',
    'chest_cm',
    'waist_cm',
    'hips_cm',
    'left_arm_cm',
    'right_arm_cm',
    'left_thigh_cm',
    'right_thigh_cm',
    'left_calf_cm',
    'right_calf_cm',
]

const PERFORMANCE_WINDOW_DAYS = 21

function shiftIsoDate(dateISO: string, days: number) {
    const date = new Date(`${dateISO}T12:00:00`)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
}

function estimated1RM(weight: number, reps: number) {
    if (weight <= 0 || reps <= 0) {
        return 0
    }

    if (reps === 1) {
        return weight
    }

    return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export function buildBodyMetricsPerformanceSnapshots(
    entries: BodyMeasurement[],
    sessions: WorkoutSession[],
    setLogs: SetLog[],
): BodyMetricsPerformanceSnapshot[] {
    const validSessions = sessions
        .filter((session) => !isAnalyticsExcludedWorkoutSession(session.notes))
        .map((session) => {
            const sessionSetLogs = setLogs.filter((setLog) => setLog.session_id === session.id)
            const peakEstimated1RM = sessionSetLogs.reduce((best, setLog) => {
                const current = estimated1RM(Number(setLog.weight_kg), setLog.reps)
                return current > best ? current : best
            }, 0)

            return {
                ...session,
                totalVolume: sessionSetLogs.reduce((sum, setLog) => sum + Number(setLog.weight_kg) * setLog.reps, 0),
                peakEstimated1RM: peakEstimated1RM > 0 ? peakEstimated1RM : null,
            }
        })
        .sort((left, right) => left.performed_at.localeCompare(right.performed_at))

    return [...entries]
        .sort((left, right) => left.measured_at.localeCompare(right.measured_at))
        .map((entry) => {
            const windowStartISO = shiftIsoDate(entry.measured_at, -(PERFORMANCE_WINDOW_DAYS - 1))
            const windowSessions = validSessions.filter(
                (session) => session.performed_at >= windowStartISO && session.performed_at <= entry.measured_at,
            )
            const totalVolume = windowSessions.reduce((sum, session) => sum + session.totalVolume, 0)
            const peakEstimated1RM = windowSessions.reduce((best, session) => {
                const current = session.peakEstimated1RM ?? 0
                return current > best ? current : best
            }, 0)

            return {
                measuredAt: entry.measured_at,
                sessionCount: windowSessions.length,
                totalVolume,
                averageSessionVolume: windowSessions.length > 0
                    ? Math.round((totalVolume / windowSessions.length) * 10) / 10
                    : null,
                peakEstimated1RM: peakEstimated1RM > 0 ? peakEstimated1RM : null,
            }
        })
}

export async function getBodyMetricsSectionData() {
    const bodyMeasurements = await listBodyMeasurementsRepository()

    if (!bodyMeasurements.enabled || bodyMeasurements.entries.length === 0) {
        return {
            ...bodyMeasurements,
            performanceSnapshots: [],
        }
    }

    const oldestEntry = [...bodyMeasurements.entries].sort((left, right) =>
        left.measured_at.localeCompare(right.measured_at),
    )[0]
    const windowStartISO = shiftIsoDate(oldestEntry.measured_at, -(PERFORMANCE_WINDOW_DAYS - 1))
    const performanceData = await listBodyMetricPerformanceRepository(windowStartISO)

    return {
        ...bodyMeasurements,
        performanceSnapshots: buildBodyMetricsPerformanceSnapshots(
            bodyMeasurements.entries,
            performanceData.sessions,
            performanceData.setLogs,
        ),
    }
}

export async function saveBodyMeasurement(input: BodyMeasurementInput) {
    const hasAtLeastOneMetric = NUMERIC_FIELDS.some((field) => input[field] != null)

    if (!hasAtLeastOneMetric) {
        throw new Error('At least one body metric is required')
    }

    return upsertBodyMeasurementRepository(input)
}

export async function deleteBodyMeasurement(id: string) {
    if (!id) {
        throw new Error('Measurement id is required')
    }

    await deleteBodyMeasurementRepository(id)
}
