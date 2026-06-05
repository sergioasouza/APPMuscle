import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getAuthenticatedServerContext: vi.fn(),
    getAccessibleExerciseRecord: vi.fn(),
    requireOwnedWorkout: vi.fn(),
    resolveExercisesForUser: vi.fn(),
}))

vi.mock('@/lib/supabase/auth', () => ({
    getAuthenticatedServerContext: mocks.getAuthenticatedServerContext,
}))

vi.mock('@/lib/supabase/exercises', () => ({
    getAccessibleExerciseRecord: mocks.getAccessibleExerciseRecord,
    resolveExercisesForUser: mocks.resolveExercisesForUser,
}))

vi.mock('@/lib/supabase/ownership', () => ({
    requireOwnedWorkout: mocks.requireOwnedWorkout,
}))

import { getWorkoutAnalyticsRepository } from '@/features/analytics/repository'

function createDeferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve
        reject = promiseReject
    })

    return { promise, resolve, reject }
}

function createSelectQuery(result: unknown) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => Promise.resolve(result)),
    }

    return query
}

describe('analytics repository', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('requires workout ownership before querying workout analytics data', async () => {
        const workoutId = '11111111-1111-4111-8111-111111111111'
        const userId = '22222222-2222-4222-8222-222222222222'
        const ownership = createDeferred<{ id: string }>()
        const from = vi.fn((table: string) => {
            if (table === 'workout_exercises') {
                return createSelectQuery({ data: [], error: null })
            }

            if (table === 'workout_sessions') {
                return createSelectQuery({ data: [], error: null })
            }

            throw new Error(`Unexpected table ${table}`)
        })
        const supabase = { from }

        mocks.getAuthenticatedServerContext.mockResolvedValue({
            supabase,
            user: { id: userId },
        })
        mocks.requireOwnedWorkout.mockReturnValue(ownership.promise)
        mocks.resolveExercisesForUser.mockResolvedValue([])

        const analyticsPromise = getWorkoutAnalyticsRepository(workoutId)

        await Promise.resolve()
        await Promise.resolve()

        expect(mocks.requireOwnedWorkout).toHaveBeenCalledWith(
            supabase,
            userId,
            workoutId,
        )
        expect(from).not.toHaveBeenCalled()

        ownership.resolve({ id: workoutId })

        await expect(analyticsPromise).resolves.toEqual({
            workoutExercises: [],
            sessions: [],
            setLogs: [],
        })
        expect(from.mock.calls.map(([table]) => table)).toEqual([
            'workout_exercises',
            'workout_sessions',
        ])
    })
})
