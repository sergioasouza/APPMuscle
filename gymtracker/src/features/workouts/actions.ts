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
import type { WorkoutEditorExercise, WorkoutListItem } from '@/features/workouts/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import type { Exercise } from '@/lib/types'

export async function createWorkoutAction(name: string): Promise<ActionResult<WorkoutListItem>> {
    try {
        const workout = await createWorkout(name)
        revalidatePath('/workouts')

        return okResult(workout)
    } catch (error) {
        return errorResult(error)
    }
}

export async function deleteWorkoutAction(workoutId: string): Promise<ActionResult<null>> {
    try {
        await deleteWorkout(workoutId)
        revalidatePath('/workouts')

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function updateWorkoutNameAction(workoutId: string, name: string): Promise<ActionResult<WorkoutListItem>> {
    try {
        const workout = await updateWorkoutName(workoutId, name)
        revalidatePath('/workouts')
        revalidatePath(`/workouts/${workoutId}`)

        return okResult(workout)
    } catch (error) {
        return errorResult(error)
    }
}

export async function listAvailableExercisesAction(workoutId: string): Promise<ActionResult<Exercise[]>> {
    try {
        const exercises = await listAvailableExercises(workoutId)
        return okResult(exercises)
    } catch (error) {
        return errorResult(error)
    }
}

export async function addExistingExerciseToWorkoutAction(
    workoutId: string,
    exerciseId: string
): Promise<ActionResult<WorkoutEditorExercise>> {
    try {
        const workoutExercise = await addExistingExerciseToWorkout(workoutId, exerciseId)
        revalidatePath(`/workouts/${workoutId}`)

        return okResult(workoutExercise)
    } catch (error) {
        return errorResult(error)
    }
}

export async function createExerciseAndAddToWorkoutAction(
    workoutId: string,
    exerciseName: string
): Promise<ActionResult<WorkoutEditorExercise>> {
    try {
        const { workoutExercise } = await createExerciseAndAddToWorkout(workoutId, exerciseName)
        revalidatePath(`/workouts/${workoutId}`)

        return okResult(workoutExercise)
    } catch (error) {
        return errorResult(error)
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

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function deleteWorkoutExerciseAction(
    workoutId: string,
    workoutExerciseId: string
): Promise<ActionResult<null>> {
    try {
        await deleteWorkoutExercise(workoutExerciseId)
        revalidatePath(`/workouts/${workoutId}`)

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function reorderWorkoutExercisesAction(
    workoutId: string,
    orderedWorkoutExerciseIds: string[]
): Promise<ActionResult<null>> {
    try {
        await reorderWorkoutExercises(workoutId, orderedWorkoutExerciseIds)
        revalidatePath(`/workouts/${workoutId}`)

        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
