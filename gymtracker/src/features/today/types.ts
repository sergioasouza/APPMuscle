import type { Workout, WorkoutSession } from '@/lib/types'

export interface TodayExerciseOption {
    id: string
    displayName: string
    source: 'system' | 'custom'
    modality: string | null
    muscleGroup: string | null
}

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
    originalExerciseId: string
    exerciseName: string
    originalExerciseName: string
    substitution: {
        replacementExerciseId: string
                replacementExerciseName: string
    } | null
    targetSets: number
    plannedTargetSets: number
    sets: ExerciseLogSetState[]
    previousSets: PreviousSetMark[]
    skipped: boolean
}

export interface CardioIntervalState {
    id?: string
    durationMinutes: string
    speedKmh: string
    repeatCount: string
}

export interface CardioLogState {
    cardioBlockId: string
    cardioName: string
    targetDurationMinutes: number | null
    totalDurationMinutes: string
    totalDistanceKm: string
    intervals: CardioIntervalState[]
    skipped: boolean
    saved: boolean
}

export interface TodayViewData {
    workout: Workout | null
    session: WorkoutSession | null
    exerciseLogs: ExerciseLogState[]
    cardioLogs: CardioLogState[]
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
    originalExerciseId?: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}

export interface SaveCardioIntervalInput {
    id?: string
    durationMinutes: number
    speedKmh?: number | null
    repeatCount: number
}

export interface SaveCardioLogInput {
    sessionId: string
    cardioBlockId: string
    totalDurationMinutes?: number | null
    totalDistanceKm?: number | null
    intervals: SaveCardioIntervalInput[]
}
