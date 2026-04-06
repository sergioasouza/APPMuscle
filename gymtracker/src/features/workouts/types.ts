import type { ResolvedExercise, Workout, WorkoutCardioBlock, WorkoutExercise } from '@/lib/types'
import type { ExerciseGlobalAnalyticsData } from '@/features/analytics/types'

export type WorkoutListItem = Workout

export type WorkoutEditorExercise = WorkoutExercise & {
    exercises: ResolvedExercise
}

export type WorkoutCardioDraftInput = {
    name: string
    targetDurationMinutes?: number | null
}

export type WorkoutEditorCardioBlock = WorkoutCardioBlock

export interface ExerciseDraftInput {
    name: string
    modality?: string | null
    muscleGroup?: string | null
}

export interface ExerciseUsageSummary {
    linkedWorkoutCount: number
    loggedSessionCount: number
    totalSetCount: number
    totalVolume: number
    lastPerformedAt: string | null
    canArchive: boolean
    canDelete: boolean
    deleteMode: 'hard' | 'hide' | 'blocked'
}

export interface ExerciseLibraryItem {
    id: string
    name: string
    displayName: string
    modality: string | null
    muscleGroup: string | null
    archivedAt: string | null
    hiddenAt: string | null
    source: 'system' | 'custom'
    isCustomized: boolean
    linkedWorkoutCount: number
    loggedSessionCount: number
    totalSetCount: number
    totalVolume: number
    lastPerformedAt: string | null
    canArchive: boolean
    deleteMode: 'hard' | 'hide' | 'blocked'
    canDelete: boolean
}

export interface ExerciseLibraryStats {
    totalCount: number
    systemCount: number
    activeCount: number
    archivedCount: number
}

export interface ExerciseLibraryPagination {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
}

export interface ExerciseLibraryQuery {
    search: string
    statusFilter: ExerciseLibraryFilter
    sourceFilter: ExerciseLibrarySourceFilter
    page: number
    pageSize: number
}

export interface ExerciseLibraryData {
    items: ExerciseLibraryItem[]
    stats: ExerciseLibraryStats
    pagination: ExerciseLibraryPagination
    query: ExerciseLibraryQuery
}

export interface ExerciseLinkedWorkout {
    id: string
    name: string
}

export interface ExerciseDetailData {
    exercise: ResolvedExercise
    usageSummary: ExerciseUsageSummary
    linkedWorkouts: ExerciseLinkedWorkout[]
    globalAnalytics: ExerciseGlobalAnalyticsData
}

export type ExerciseLibraryFilter = 'active' | 'archived' | 'all'
export type ExerciseLibrarySourceFilter = 'all' | 'custom' | 'system'

export interface WorkoutEditorData {
    workout: Workout
    workoutExercises: WorkoutEditorExercise[]
    cardioBlocks: WorkoutEditorCardioBlock[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
