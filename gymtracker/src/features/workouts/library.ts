import type { ExerciseGlobalAnalyticsData } from '@/features/analytics/types'
import type { Exercise } from '@/lib/types'
import type {
    ExerciseDetailData,
    ExerciseLibraryFilter,
    ExerciseLibraryItem,
    ExerciseLinkedWorkout,
    ExerciseUsageSummary,
} from '@/features/workouts/types'

export interface ExerciseWorkoutLinkRow {
    exerciseId: string
    workoutId: string
    workoutName: string
}

export interface ExerciseLogSummaryRow {
    exerciseId: string
    sessionId: string
    performedAt: string
    weightKg: number
    reps: number
}

function compareNullableDatesDesc(left: string | null, right: string | null) {
    if (left == null && right == null) {
        return 0
    }

    if (left == null) {
        return 1
    }

    if (right == null) {
        return -1
    }

    return right.localeCompare(left)
}

export function buildExerciseUsageSummary(input: {
    linkedWorkoutCount: number
    logRows: ExerciseLogSummaryRow[]
}): ExerciseUsageSummary {
    const loggedSessionIds = new Set(input.logRows.map((row) => row.sessionId))
    const lastPerformedAt = input.logRows.reduce<string | null>((latest, row) => {
        if (latest == null || row.performedAt > latest) {
            return row.performedAt
        }

        return latest
    }, null)
    const totalVolume = input.logRows.reduce(
        (sum, row) => sum + row.weightKg * row.reps,
        0,
    )

    return {
        linkedWorkoutCount: input.linkedWorkoutCount,
        loggedSessionCount: loggedSessionIds.size,
        totalSetCount: input.logRows.length,
        totalVolume,
        lastPerformedAt,
        canDelete: input.linkedWorkoutCount === 0 && loggedSessionIds.size === 0,
    }
}

export function buildExerciseLibraryItems(input: {
    exercises: Exercise[]
    workoutLinks: ExerciseWorkoutLinkRow[]
    logRows: ExerciseLogSummaryRow[]
}): ExerciseLibraryItem[] {
    const linksByExerciseId = input.workoutLinks.reduce<Map<string, ExerciseWorkoutLinkRow[]>>((accumulator, row) => {
        const current = accumulator.get(row.exerciseId) ?? []
        current.push(row)
        accumulator.set(row.exerciseId, current)
        return accumulator
    }, new Map())

    const logsByExerciseId = input.logRows.reduce<Map<string, ExerciseLogSummaryRow[]>>((accumulator, row) => {
        const current = accumulator.get(row.exerciseId) ?? []
        current.push(row)
        accumulator.set(row.exerciseId, current)
        return accumulator
    }, new Map())

    return [...input.exercises]
        .map((exercise) => {
            const usageSummary = buildExerciseUsageSummary({
                linkedWorkoutCount: new Set(
                    (linksByExerciseId.get(exercise.id) ?? []).map((row) => row.workoutId),
                ).size,
                logRows: logsByExerciseId.get(exercise.id) ?? [],
            })

            return {
                id: exercise.id,
                name: exercise.name,
                archivedAt: exercise.archived_at,
                linkedWorkoutCount: usageSummary.linkedWorkoutCount,
                loggedSessionCount: usageSummary.loggedSessionCount,
                totalSetCount: usageSummary.totalSetCount,
                totalVolume: usageSummary.totalVolume,
                lastPerformedAt: usageSummary.lastPerformedAt,
                canDelete: usageSummary.canDelete,
            }
        })
        .sort((left, right) => {
            const archivedComparison = Number(left.archivedAt != null) - Number(right.archivedAt != null)
            if (archivedComparison !== 0) {
                return archivedComparison
            }

            const dateComparison = compareNullableDatesDesc(left.lastPerformedAt, right.lastPerformedAt)
            if (dateComparison !== 0) {
                return dateComparison
            }

            return left.name.localeCompare(right.name)
        })
}

export function filterExerciseLibraryItems(
    items: ExerciseLibraryItem[],
    search: string,
    statusFilter: ExerciseLibraryFilter,
) {
    const normalizedSearch = search.trim().toLowerCase()

    return items.filter((item) => {
        const matchesFilter = statusFilter === 'all'
            ? true
            : statusFilter === 'active'
                ? item.archivedAt == null
                : item.archivedAt != null

        if (!matchesFilter) {
            return false
        }

        if (!normalizedSearch) {
            return true
        }

        return item.name.toLowerCase().includes(normalizedSearch)
    })
}

export function buildExerciseDetailData(input: {
    exercise: Exercise
    linkedWorkouts: ExerciseLinkedWorkout[]
    logRows: ExerciseLogSummaryRow[]
    globalAnalytics: ExerciseGlobalAnalyticsData
}): ExerciseDetailData {
    const usageSummary = buildExerciseUsageSummary({
        linkedWorkoutCount: input.linkedWorkouts.length,
        logRows: input.logRows,
    })

    return {
        exercise: input.exercise,
        usageSummary,
        linkedWorkouts: [...input.linkedWorkouts].sort((left, right) => left.name.localeCompare(right.name)),
        globalAnalytics: input.globalAnalytics,
    }
}
