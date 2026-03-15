import 'server-only'

import { getWorkoutAnalyticsRepository } from '@/features/analytics/repository'
import type { EvolutionPoint, ExerciseSummary, WorkoutAnalyticsData } from '@/features/analytics/types'
import type { SetLog, WorkoutSession } from '@/lib/types'

/** Epley formula: estimated 1RM = weight × (1 + reps / 30) */
function estimated1RM(weight: number, reps: number): number {
    if (reps <= 0 || weight <= 0) return 0
    if (reps === 1) return weight
    return Math.round(weight * (1 + reps / 30) * 10) / 10
}

/**
 * For a given exercise in a given session, find the "best" set.
 * Best = highest estimated 1RM (heaviest effective effort).
 */
function findBestSet(setLogs: SetLog[], sessionId: string, exerciseId: string): SetLog | null {
    const sets = setLogs.filter(
        (s) => s.session_id === sessionId && s.exercise_id === exerciseId && s.weight_kg > 0 && s.reps > 0,
    )
    if (sets.length === 0) return null

    return sets.reduce((best, current) => {
        const bestE1RM = estimated1RM(best.weight_kg, best.reps)
        const currentE1RM = estimated1RM(current.weight_kg, current.reps)
        return currentE1RM > bestE1RM ? current : best
    })
}

function buildEvolution(
    sessions: WorkoutSession[],
    setLogs: SetLog[],
    exerciseId: string,
): EvolutionPoint[] {
    // Sessions ordered oldest → newest
    const sorted = [...sessions].sort((a, b) => a.performed_at.localeCompare(b.performed_at))

    const points: EvolutionPoint[] = []

    for (const session of sorted) {
        const best = findBestSet(setLogs, session.id, exerciseId)
        if (!best) continue

        points.push({
            date: session.performed_at,
            weight: best.weight_kg,
            reps: best.reps,
            estimated1RM: estimated1RM(best.weight_kg, best.reps),
        })
    }

    return points
}

function buildSummary(points: EvolutionPoint[]): ExerciseSummary | null {
    if (points.length === 0) return null

    // PR = highest estimated 1RM across all sessions
    const prPoint = points.reduce((best, current) =>
        current.estimated1RM > best.estimated1RM ? current : best,
    )

    // Last = most recent session
    const lastPoint = points[points.length - 1]

    // Trend: compare avg 1RM of last 3 vs previous 3
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (points.length >= 2) {
        const recent = points.slice(-3)
        const previous = points.slice(-6, -3)

        const avgRecent = recent.reduce((sum, p) => sum + p.estimated1RM, 0) / recent.length

        if (previous.length > 0) {
            const avgPrevious = previous.reduce((sum, p) => sum + p.estimated1RM, 0) / previous.length
            const diff = ((avgRecent - avgPrevious) / avgPrevious) * 100

            if (diff > 2) trend = 'up'
            else if (diff < -2) trend = 'down'
        } else {
            // Only have ≤3 sessions, compare first vs last
            const first = points[0]
            if (lastPoint.estimated1RM > first.estimated1RM * 1.02) trend = 'up'
            else if (lastPoint.estimated1RM < first.estimated1RM * 0.98) trend = 'down'
        }
    }

    return {
        prEstimated1RM: prPoint.estimated1RM,
        prWeight: prPoint.weight,
        prReps: prPoint.reps,
        prDate: prPoint.date,
        lastWeight: lastPoint.weight,
        lastReps: lastPoint.reps,
        lastDate: lastPoint.date,
        trend,
    }
}

export async function getWorkoutAnalytics(workoutId: string): Promise<WorkoutAnalyticsData> {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    const { workoutExercises, sessions, setLogs } = await getWorkoutAnalyticsRepository(workoutId)

    // Filter out skipped / rescheduled sessions
    const validSessions = sessions.filter(
        (session) =>
            !(session.notes ?? '').startsWith('[SKIPPED]') &&
            !(session.notes ?? '').startsWith('[RESCHEDULED'),
    )

    const enrichedSessions = validSessions.map((session) => {
        const sessionSets = setLogs.filter((setLog) => setLog.session_id === session.id)
        return {
            ...session,
            totalVolume: sessionSets.reduce((sum, setLog) => sum + setLog.weight_kg * setLog.reps, 0),
            totalSets: sessionSets.length,
        }
    })

    // Pre-compute evolution & summaries per exercise
    const evolution: Record<string, EvolutionPoint[]> = {}
    const summaries: Record<string, ExerciseSummary> = {}

    for (const we of workoutExercises) {
        const exId = we.exercise_id
        const points = buildEvolution(validSessions, setLogs, exId)
        evolution[exId] = points

        const summary = buildSummary(points)
        if (summary) {
            summaries[exId] = summary
        }
    }

    return {
        workoutExercises,
        sessions: enrichedSessions,
        setLogs,
        evolution,
        summaries,
    }
}
