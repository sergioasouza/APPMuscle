import 'server-only'

import {
    addExerciseToWorkoutRepository,
    createExerciseRepository,
    createWorkoutRepository,
    deleteWorkoutExerciseRepository,
    deleteWorkoutRepository,
    getWorkoutEditorDataRepository,
    listAvailableExercisesRepository,
    listWorkoutsRepository,
    reorderWorkoutExercisesRepository,
    updateWorkoutExerciseTargetSetsRepository,
    updateWorkoutNameRepository,
} from '@/features/workouts/repository'

export async function listWorkouts() {
    return listWorkoutsRepository()
}

export async function getWorkoutEditorData(workoutId: string) {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    return getWorkoutEditorDataRepository(workoutId)
}

export async function listAvailableExercises(workoutId: string) {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    return listAvailableExercisesRepository(workoutId)
}

export async function createWorkout(name: string) {
    const normalizedName = name.trim()

    if (!normalizedName) {
        throw new Error('Workout name is required')
    }

    return createWorkoutRepository(normalizedName)
}

export async function deleteWorkout(workoutId: string) {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    await deleteWorkoutRepository(workoutId)
}

export async function updateWorkoutName(workoutId: string, name: string) {
    const normalizedName = name.trim()

    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    if (!normalizedName) {
        throw new Error('Workout name is required')
    }

    return updateWorkoutNameRepository(workoutId, normalizedName)
}

export async function addExistingExerciseToWorkout(workoutId: string, exerciseId: string) {
    if (!workoutId || !exerciseId) {
        throw new Error('Workout and exercise are required')
    }

    return addExerciseToWorkoutRepository(workoutId, exerciseId, 3)
}

export async function createExerciseAndAddToWorkout(workoutId: string, exerciseName: string) {
    const normalizedName = exerciseName.trim()

    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    if (!normalizedName) {
        throw new Error('Exercise name is required')
    }

    const exercise = await createExerciseRepository(normalizedName)
    const workoutExercise = await addExerciseToWorkoutRepository(workoutId, exercise.id, 3)

    return {
        exercise,
        workoutExercise,
    }
}

export async function updateWorkoutExerciseTargetSets(workoutExerciseId: string, targetSets: number) {
    if (!workoutExerciseId) {
        throw new Error('Workout exercise id is required')
    }

    if (targetSets < 1 || targetSets > 20) {
        throw new Error('Target sets must be between 1 and 20')
    }

    await updateWorkoutExerciseTargetSetsRepository(workoutExerciseId, targetSets)
}

export async function deleteWorkoutExercise(workoutExerciseId: string) {
    if (!workoutExerciseId) {
        throw new Error('Workout exercise id is required')
    }

    await deleteWorkoutExerciseRepository(workoutExerciseId)
}

export async function reorderWorkoutExercises(workoutId: string, orderedWorkoutExerciseIds: string[]) {
    if (!workoutId) {
        throw new Error('Workout id is required')
    }

    if (orderedWorkoutExerciseIds.length === 0) {
        return
    }

    await reorderWorkoutExercisesRepository(workoutId, orderedWorkoutExerciseIds)
}
