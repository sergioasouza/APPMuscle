import type { Exercise, SetLog, Workout, WorkoutSession } from '@/lib/types'

export type SessionWithDetails = WorkoutSession & {
    workouts: Workout
}

export type SetLogWithExercise = SetLog & {
    exercises: Exercise
}

export interface CalendarMonthData {
    sessions: SessionWithDetails[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
