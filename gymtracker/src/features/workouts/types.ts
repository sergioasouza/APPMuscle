import type { Exercise, Workout, WorkoutExercise } from '@/lib/types'

export type WorkoutListItem = Workout

export type WorkoutEditorExercise = WorkoutExercise & {
    exercises: Exercise
}

export interface WorkoutEditorData {
    workout: Workout
    workoutExercises: WorkoutEditorExercise[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
