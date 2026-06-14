import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
    getTodayView: vi.fn(),
    listTodayExerciseOptions: vi.fn(),
    listUserWorkouts: vi.fn(),
    rescheduleWorkout: vi.fn(),
    saveCardioLog: vi.fn(),
    saveExerciseTargetSets: vi.fn(),
    saveSessionNotes: vi.fn(),
    saveSet: vi.fn(),
    saveSetLog: vi.fn(),
    skipCardio: vi.fn(),
    skipExercise: vi.fn(),
    skipWorkout: vi.fn(),
    substituteExercise: vi.fn(),
    switchWorkoutForDay: vi.fn(),
    undoExerciseSubstitution: vi.fn(),
    undoSkipCardio: vi.fn(),
    undoSkipExercise: vi.fn(),
    undoSkipWorkout: vi.fn(),
}))

vi.mock('@/features/today/service', () => serviceMocks)

vi.mock('@/lib/revalidate-app-routes', () => ({
    revalidateTodaySurfaces: vi.fn(),
}))

import { saveCardioLogAction, saveSetAction, saveSetLogAction } from '@/features/today/actions'
import { buildSetSegments, createDefaultSetPrescription } from '@/lib/set-methods'

const sessionId = '11111111-1111-4111-8111-111111111111'
const exerciseId = '22222222-2222-4222-8222-222222222222'
const cardioBlockId = '33333333-3333-4333-8333-333333333333'

describe('today action validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects non-integer reps before saving a set', async () => {
        const result = await saveSetAction({
            sessionId,
            exerciseId,
            setNumber: 1,
            weight: 42.5,
            reps: 8.5,
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('Reps must be an integer')
        expect(serviceMocks.saveSet).not.toHaveBeenCalled()
    })

    it('rejects cardio totals beyond database limits', async () => {
        const result = await saveCardioLogAction({
            sessionId,
            cardioBlockId,
            totalDurationMinutes: 1441,
            totalDistanceKm: 3,
            intervals: [],
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('Total duration minutes')
        expect(serviceMocks.saveCardioLog).not.toHaveBeenCalled()
    })

    it('rejects cardio intervals beyond database limits', async () => {
        const result = await saveCardioLogAction({
            sessionId,
            cardioBlockId,
            totalDurationMinutes: 30,
            totalDistanceKm: 3,
            intervals: [
                {
                    durationMinutes: 10,
                    repeatCount: 101,
                    speedKmh: 12,
                },
            ],
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('Interval repeat count')
        expect(serviceMocks.saveCardioLog).not.toHaveBeenCalled()
    })

    it('rejects a completed segmented set when a segment is incomplete', async () => {
        const prescription = createDefaultSetPrescription('cluster', 1)
        const result = await saveSetLogAction({
            sessionId,
            exerciseId,
            prescriptionId: prescription.id,
            setNumber: 1,
            setMethod: prescription.method,
            prescriptionSnapshot: prescription,
            segments: buildSetSegments(prescription).map((segment) => ({
                ...segment,
                completed: true,
            })),
            actualRir: null,
            state: 'completed',
        })

        expect(result.ok).toBe(false)
        expect(result.message).toContain('needs weight and reps')
        expect(serviceMocks.saveSetLog).not.toHaveBeenCalled()
    })
})
