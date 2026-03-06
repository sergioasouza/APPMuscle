import type { SetLog, WorkoutExerciseWithExercise, WorkoutSession } from '@/lib/types'

export type SessionWithTotals = WorkoutSession & {
    totalVolume: number
    totalSets: number
}

export interface WorkoutAnalyticsData {
    workoutExercises: WorkoutExerciseWithExercise[]
    sessions: SessionWithTotals[]
    setLogs: SetLog[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
