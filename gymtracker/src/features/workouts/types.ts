import type { Exercise, Workout, WorkoutExercise } from '@/lib/types'
import type { ExerciseGlobalAnalyticsData } from '@/features/analytics/types'

export type WorkoutListItem = Workout

export type WorkoutEditorExercise = WorkoutExercise & {
    exercises: Exercise
}

export interface ExerciseUsageSummary {
    linkedWorkoutCount: number
    loggedSessionCount: number
    totalSetCount: number
    totalVolume: number
    lastPerformedAt: string | null
    canDelete: boolean
}

export interface ExerciseLibraryItem {
    id: string
    name: string
    archivedAt: string | null
    linkedWorkoutCount: number
    loggedSessionCount: number
    totalSetCount: number
    totalVolume: number
    lastPerformedAt: string | null
    canDelete: boolean
}

export interface ExerciseLibraryData {
    items: ExerciseLibraryItem[]
}

export interface ExerciseLinkedWorkout {
    id: string
    name: string
}

export interface ExerciseDetailData {
    exercise: Exercise
    usageSummary: ExerciseUsageSummary
    linkedWorkouts: ExerciseLinkedWorkout[]
    globalAnalytics: ExerciseGlobalAnalyticsData
}

export type ExerciseLibraryFilter = 'active' | 'archived' | 'all'

export interface WorkoutEditorData {
    workout: Workout
    workoutExercises: WorkoutEditorExercise[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
