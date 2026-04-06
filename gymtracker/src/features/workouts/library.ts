import type { ExerciseGlobalAnalyticsData } from '@/features/analytics/types'
import { buildExerciseDisplayName } from '@/lib/exercise-resolution'
import type { ResolvedExercise } from '@/lib/types'
import type {
    ExerciseDetailData,
    ExerciseLibraryFilter,
    ExerciseLibraryItem,
    ExerciseLibrarySourceFilter,
    ExerciseLibraryStats,
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

export function buildExerciseUsageSummary(input: {
    exercise: ResolvedExercise
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
    const deleteMode = input.exercise.source === 'system'
        ? 'hide'
        : input.linkedWorkoutCount === 0 && loggedSessionIds.size === 0
            ? 'hard'
            : 'blocked'

    return {
        linkedWorkoutCount: input.linkedWorkoutCount,
        loggedSessionCount: loggedSessionIds.size,
        totalSetCount: input.logRows.length,
        totalVolume,
        lastPerformedAt,
        canArchive: true,
        canDelete: deleteMode !== 'blocked',
        deleteMode,
    }
}

function matchesExerciseLibraryFilter(
    archivedAt: string | null,
    statusFilter: ExerciseLibraryFilter,
) {
    return statusFilter === 'all'
        ? true
        : statusFilter === 'active'
            ? archivedAt == null
            : archivedAt != null
}

function matchesExerciseLibrarySearch(
    fields: Array<string | null | undefined>,
    search: string,
) {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
        return true
    }

    return fields.some((value) =>
        (value ?? '').toLowerCase().includes(normalizedSearch),
    )
}

export function filterResolvedExercisesForLibrary(
    exercises: ResolvedExercise[],
    search: string,
    statusFilter: ExerciseLibraryFilter,
    sourceFilter: ExerciseLibrarySourceFilter,
) {
    return exercises.filter((exercise) => {
        if (exercise.hidden_at != null) {
            return false
        }

        if (!matchesExerciseLibraryFilter(exercise.archived_at, statusFilter)) {
            return false
        }

        if (
            sourceFilter !== 'all' &&
            exercise.source !== sourceFilter
        ) {
            return false
        }

        return matchesExerciseLibrarySearch(
            [
                exercise.name,
                exercise.display_name,
                exercise.modality,
                exercise.muscle_group,
            ],
            search,
        )
    })
}

export function sortResolvedExercisesForLibrary(exercises: ResolvedExercise[]) {
    return [...exercises].sort((left, right) => {
        const archivedComparison =
            Number(left.archived_at != null) - Number(right.archived_at != null)

        if (archivedComparison !== 0) {
            return archivedComparison
        }

        return left.display_name.localeCompare(right.display_name)
    })
}

export function buildExerciseLibraryStats(
    exercises: ResolvedExercise[],
): ExerciseLibraryStats {
    const visibleExercises = exercises.filter((exercise) => exercise.hidden_at == null)
    const activeCount = visibleExercises.filter(
        (exercise) => exercise.archived_at == null,
    ).length

    return {
        totalCount: visibleExercises.length,
        systemCount: visibleExercises.filter((exercise) => exercise.source === 'system')
            .length,
        activeCount,
        archivedCount: visibleExercises.length - activeCount,
    }
}

export function buildExerciseLibraryItems(input: {
    exercises: ResolvedExercise[]
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
                exercise,
                linkedWorkoutCount: new Set(
                    (linksByExerciseId.get(exercise.id) ?? []).map((row) => row.workoutId),
                ).size,
                logRows: logsByExerciseId.get(exercise.id) ?? [],
            })

            return {
                id: exercise.id,
                name: exercise.name,
                displayName: exercise.display_name,
                modality: exercise.modality,
                muscleGroup: exercise.muscle_group,
                archivedAt: exercise.archived_at,
                hiddenAt: exercise.hidden_at,
                source: exercise.source,
                isCustomized: exercise.is_customized,
                linkedWorkoutCount: usageSummary.linkedWorkoutCount,
                loggedSessionCount: usageSummary.loggedSessionCount,
                totalSetCount: usageSummary.totalSetCount,
                totalVolume: usageSummary.totalVolume,
                lastPerformedAt: usageSummary.lastPerformedAt,
                canArchive: usageSummary.canArchive,
                deleteMode: usageSummary.deleteMode,
                canDelete: usageSummary.canDelete,
            }
        })
}

export function filterExerciseLibraryItems(
    items: ExerciseLibraryItem[],
    search: string,
    statusFilter: ExerciseLibraryFilter,
    sourceFilter: ExerciseLibrarySourceFilter,
) {
    return items.filter((item) => {
        if (!matchesExerciseLibraryFilter(item.archivedAt, statusFilter)) {
            return false
        }

        if (sourceFilter !== 'all' && item.source !== sourceFilter) {
            return false
        }

        return matchesExerciseLibrarySearch(
            [
                item.name,
                item.displayName,
                item.modality,
                item.muscleGroup,
            ],
            search,
        )
    })
}

export function buildExerciseDetailData(input: {
    exercise: ResolvedExercise
    linkedWorkouts: ExerciseLinkedWorkout[]
    logRows: ExerciseLogSummaryRow[]
    globalAnalytics: ExerciseGlobalAnalyticsData
}): ExerciseDetailData {
    const usageSummary = buildExerciseUsageSummary({
        exercise: input.exercise,
        linkedWorkoutCount: input.linkedWorkouts.length,
        logRows: input.logRows,
    })

    return {
        exercise: input.exercise,
        usageSummary,
        linkedWorkouts: [...input.linkedWorkouts].sort((left, right) => left.name.localeCompare(right.name)),
        globalAnalytics: {
            ...input.globalAnalytics,
            exerciseName: buildExerciseDisplayName({
                name: input.exercise.name,
                modality: input.exercise.modality,
            }),
        },
    }
}
