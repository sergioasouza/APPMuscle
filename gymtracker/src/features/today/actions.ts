'use server'

import { revalidateTodaySurfaces } from '@/lib/revalidate-app-routes'
import {
    getTodayView,
    listTodayExerciseOptions,
    listUserWorkouts,
    rescheduleWorkout,
    saveCardioLog,
    saveExerciseTargetSets,
    saveSessionNotes,
    saveSet,
    skipCardio,
    skipExercise,
    skipWorkout,
    substituteExercise,
    switchWorkoutForDay,
    undoExerciseSubstitution,
    undoSkipCardio,
    undoSkipExercise,
    undoSkipWorkout,
} from '@/features/today/service'
import type { SaveCardioLogInput, TodayExerciseOption, TodayViewData } from '@/features/today/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import type { SessionCardioLog, SetLog, Workout } from '@/lib/types'
import {
    assertFiniteNumber,
    assertIntegerInRange,
    assertIsoDate,
    assertOptionalUuid,
    assertPositiveInteger,
    assertStringArray,
    assertUuid,
} from '@/lib/validation'

export async function getTodayViewAction(dateISO: string, dayOfWeek: number): Promise<ActionResult<TodayViewData>> {
    try {
        assertIsoDate(dateISO, 'Date')
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        const data = await getTodayView(dateISO, dayOfWeek)
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function listUserWorkoutsAction(): Promise<ActionResult<Workout[]>> {
    try {
        const workouts = await listUserWorkouts()
        return okResult(workouts)
    } catch (error) {
        return errorResult(error)
    }
}

export async function listTodayExerciseOptionsAction(): Promise<ActionResult<TodayExerciseOption[]>> {
    try {
        const exercises = await listTodayExerciseOptions()
        return okResult(exercises)
    } catch (error) {
        return errorResult(error)
    }
}

export async function switchWorkoutForDayAction(dateISO: string, workoutId: string): Promise<ActionResult<null>> {
    try {
        assertIsoDate(dateISO, 'Date')
        assertUuid(workoutId, 'Workout id')
        await switchWorkoutForDay(dateISO, workoutId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await skipWorkout(sessionId, notes)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await undoSkipWorkout(sessionId, notes)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function rescheduleWorkoutAction(
    dateISO: string,
    dayOfWeek: number,
    targetDay: number,
    workoutId: string,
    sessionId: string | null,
    dayNames: string[]
): Promise<ActionResult<null>> {
    try {
        assertIsoDate(dateISO, 'Date')
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        assertIntegerInRange(targetDay, 'Target day', 0, 6)
        assertUuid(workoutId, 'Workout id')
        assertOptionalUuid(sessionId, 'Session id')
        assertStringArray(dayNames, 'Day names', 7)
        await rescheduleWorkout(dateISO, dayOfWeek, targetDay, workoutId, sessionId, dayNames)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function saveSetAction(input: {
    sessionId: string
    exerciseId: string
    originalExerciseId?: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}): Promise<ActionResult<SetLog>> {
    try {
        assertUuid(input.sessionId, 'Session id')
        assertUuid(input.exerciseId, 'Exercise id')
        assertOptionalUuid(input.originalExerciseId, 'Original exercise id')
        assertOptionalUuid(input.setLogId, 'Set log id')
        assertPositiveInteger(input.setNumber, 'Set number')
        assertFiniteNumber(input.weight, 'Weight', 0)
        assertFiniteNumber(input.reps, 'Reps', 1)
        const data = await saveSet(
            input.sessionId,
            input.exerciseId,
            input.originalExerciseId,
            input.setNumber,
            input.weight,
            input.reps,
            input.setLogId
        )
        revalidateTodaySurfaces()
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function saveExerciseTargetSetsAction(input: {
    sessionId: string
    exerciseId: string
    validSets: number
}): Promise<ActionResult<null>> {
    try {
        assertUuid(input.sessionId, 'Session id')
        assertUuid(input.exerciseId, 'Exercise id')
        assertPositiveInteger(input.validSets, 'Valid sets')
        await saveExerciseTargetSets(input.sessionId, input.exerciseId, input.validSets)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function saveSessionNotesAction(sessionId: string, notes: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await saveSessionNotes(sessionId, notes)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipExerciseAction(sessionId: string, exerciseId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        assertUuid(exerciseId, 'Exercise id')
        await skipExercise(sessionId, exerciseId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipExerciseAction(sessionId: string, exerciseId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        assertUuid(exerciseId, 'Exercise id')
        await undoSkipExercise(sessionId, exerciseId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function substituteExerciseAction(input: {
    sessionId: string
    originalExerciseId: string
    replacementExerciseId: string
}): Promise<ActionResult<null>> {
    try {
        assertUuid(input.sessionId, 'Session id')
        assertUuid(input.originalExerciseId, 'Original exercise id')
        assertUuid(input.replacementExerciseId, 'Replacement exercise id')
        await substituteExercise(input.sessionId, input.originalExerciseId, input.replacementExerciseId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoExerciseSubstitutionAction(
    sessionId: string,
    originalExerciseId: string,
): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        assertUuid(originalExerciseId, 'Original exercise id')
        await undoExerciseSubstitution(sessionId, originalExerciseId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

function assertSaveCardioLogInput(input: SaveCardioLogInput) {
    assertUuid(input.sessionId, 'Session id')
    assertUuid(input.cardioBlockId, 'Cardio block id')

    if (input.totalDurationMinutes != null) {
        assertPositiveInteger(input.totalDurationMinutes, 'Total duration minutes')
    }

    if (input.totalDistanceKm != null) {
        assertFiniteNumber(input.totalDistanceKm, 'Total distance km', 0)
    }

    if (!Array.isArray(input.intervals)) {
        throw new Error('Intervals must be an array')
    }

    for (const interval of input.intervals) {
        assertPositiveInteger(interval.durationMinutes, 'Interval duration minutes')
        assertPositiveInteger(interval.repeatCount, 'Interval repeat count')

        if (interval.speedKmh != null) {
            assertFiniteNumber(interval.speedKmh, 'Interval speed km/h', 0)
        }

        if (interval.id) {
            assertUuid(interval.id, 'Interval id')
        }
    }
}

export async function saveCardioLogAction(
    input: SaveCardioLogInput,
): Promise<ActionResult<SessionCardioLog>> {
    try {
        assertSaveCardioLogInput(input)
        const data = await saveCardioLog(input)
        revalidateTodaySurfaces()
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipCardioAction(sessionId: string, cardioBlockId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        assertUuid(cardioBlockId, 'Cardio block id')
        await skipCardio(sessionId, cardioBlockId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipCardioAction(sessionId: string, cardioBlockId: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        assertUuid(cardioBlockId, 'Cardio block id')
        await undoSkipCardio(sessionId, cardioBlockId)
        revalidateTodaySurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
