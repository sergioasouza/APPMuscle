import type { Workout, WorkoutSession } from '@/lib/types'

export interface ExerciseLogSetState {
    weight: string
    reps: string
    saved: boolean
    id?: string
    saving?: boolean
    pendingSync?: boolean
}

export interface PreviousSetMark {
    weight: number
    reps: number
}

export interface ExerciseLogState {
    exerciseId: string
    exerciseName: string
    targetSets: number
    sets: ExerciseLogSetState[]
    previousSets: PreviousSetMark[]
}

export interface TodayViewData {
    workout: Workout | null
    session: WorkoutSession | null
    exerciseLogs: ExerciseLogState[]
    notes: string
    rotation: {
        activeRotationIndex: number | null
        totalVariants: number
    }
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}

export interface SaveSetInput {
    sessionId: string
    exerciseId: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}
