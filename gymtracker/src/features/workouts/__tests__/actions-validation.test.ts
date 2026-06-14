import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
    addExistingExerciseToWorkout: vi.fn(),
    archiveExercise: vi.fn(),
    checkExerciseHasLogs: vi.fn(),
    createExerciseAndAddToWorkout: vi.fn(),
    createExerciseFromInput: vi.fn(),
    createWorkout: vi.fn(),
    createWorkoutCardioBlock: vi.fn(),
    deleteExercise: vi.fn(),
    deleteWorkout: vi.fn(),
    deleteWorkoutCardioBlock: vi.fn(),
    deleteWorkoutExercise: vi.fn(),
    duplicateWorkout: vi.fn(),
    listAvailableExercises: vi.fn(),
    reorderWorkoutExercises: vi.fn(),
    unarchiveExercise: vi.fn(),
    updateExercise: vi.fn(),
    updateWorkoutCardioBlock: vi.fn(),
    updateWorkoutExerciseTargetSets: vi.fn(),
    updateWorkoutExerciseSetPrescriptions: vi.fn(),
    updateWorkoutName: vi.fn(),
}))

vi.mock('@/features/workouts/service', () => serviceMocks)

vi.mock('@/lib/revalidate-app-routes', () => ({
    revalidateExerciseLibrarySurfaces: vi.fn(),
    revalidateWorkoutSurfaces: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import {
    deleteWorkoutAction,
    updateWorkoutExerciseSetPrescriptionsAction,
    updateWorkoutExerciseTargetSetsAction,
} from '@/features/workouts/actions'
import { createDefaultSetPrescription } from '@/lib/set-methods'

const workoutId = '11111111-1111-4111-8111-111111111111'
const workoutExerciseId = '22222222-2222-4222-8222-222222222222'

describe('workout action validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects invalid workout ids before deleting workouts', async () => {
        const result = await deleteWorkoutAction('not-a-uuid')

        expect(result.ok).toBe(false)
        expect(result.message).toContain('Workout id must be a valid UUID')
        expect(serviceMocks.deleteWorkout).not.toHaveBeenCalled()
    })

    it('rejects non-integer target set ranges before updating workouts', async () => {
        const result = await updateWorkoutExerciseTargetSetsAction(
            workoutId,
            workoutExerciseId,
            2.5,
        )

        expect(result.ok).toBe(false)
        expect(result.message).toContain('Target sets must be an integer between 1 and 20')
        expect(serviceMocks.updateWorkoutExerciseTargetSets).not.toHaveBeenCalled()
    })

    it('rejects duplicate prescription ids before updating workouts', async () => {
        const prescription = createDefaultSetPrescription('straight', 1)
        const result = await updateWorkoutExerciseSetPrescriptionsAction(
            workoutId,
            workoutExerciseId,
            [
                prescription,
                { ...prescription, position: 2 },
            ],
        )

        expect(result.ok).toBe(false)
        expect(result.message).toContain('ids must be unique')
        expect(serviceMocks.updateWorkoutExerciseSetPrescriptions).not.toHaveBeenCalled()
    })
})
