'use server'

import { revalidatePath } from 'next/cache'
import {
    addExistingExerciseToWorkout,
    createExerciseAndAddToWorkout,
    createWorkout,
    deleteWorkout,
    deleteWorkoutExercise,
    listAvailableExercises,
    reorderWorkoutExercises,
    updateWorkoutExerciseTargetSets,
    updateWorkoutName,
} from '@/features/workouts/service'
import type { ActionResult, WorkoutEditorExercise, WorkoutListItem } from '@/features/workouts/types'
import type { Exercise } from '@/lib/types'

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error'
}

export async function createWorkoutAction(name: string): Promise<ActionResult<WorkoutListItem>> {
    try {
        const workout = await createWorkout(name)
        revalidatePath('/workouts')

        return { ok: true, data: workout }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function deleteWorkoutAction(workoutId: string): Promise<ActionResult<null>> {
    try {
        await deleteWorkout(workoutId)
        revalidatePath('/workouts')

        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function updateWorkoutNameAction(workoutId: string, name: string): Promise<ActionResult<WorkoutListItem>> {
    try {
        const workout = await updateWorkoutName(workoutId, name)
        revalidatePath('/workouts')
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: workout }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function listAvailableExercisesAction(workoutId: string): Promise<ActionResult<Exercise[]>> {
    try {
        const exercises = await listAvailableExercises(workoutId)
        return { ok: true, data: exercises }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function addExistingExerciseToWorkoutAction(
    workoutId: string,
    exerciseId: string
): Promise<ActionResult<WorkoutEditorExercise>> {
    try {
        const workoutExercise = await addExistingExerciseToWorkout(workoutId, exerciseId)
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: workoutExercise }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function createExerciseAndAddToWorkoutAction(
    workoutId: string,
    exerciseName: string
): Promise<ActionResult<WorkoutEditorExercise>> {
    try {
        const { workoutExercise } = await createExerciseAndAddToWorkout(workoutId, exerciseName)
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: workoutExercise }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function updateWorkoutExerciseTargetSetsAction(
    workoutId: string,
    workoutExerciseId: string,
    targetSets: number
): Promise<ActionResult<null>> {
    try {
        await updateWorkoutExerciseTargetSets(workoutExerciseId, targetSets)
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function deleteWorkoutExerciseAction(
    workoutId: string,
    workoutExerciseId: string
): Promise<ActionResult<null>> {
    try {
        await deleteWorkoutExercise(workoutExerciseId)
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function reorderWorkoutExercisesAction(
    workoutId: string,
    orderedWorkoutExerciseIds: string[]
): Promise<ActionResult<null>> {
    try {
        await reorderWorkoutExercises(workoutId, orderedWorkoutExerciseIds)
        revalidatePath(`/workouts/${workoutId}`)

        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
