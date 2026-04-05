'use server'

import {
    getTodayView,
    listUserWorkouts,
    rescheduleWorkout,
    saveSessionNotes,
    saveSet,
    skipWorkout,
    switchWorkoutForDay,
    undoSkipWorkout,
} from '@/features/today/service'
import type { TodayViewData } from '@/features/today/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import type { SetLog, Workout } from '@/lib/types'
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

export async function switchWorkoutForDayAction(dateISO: string, workoutId: string): Promise<ActionResult<null>> {
    try {
        assertIsoDate(dateISO, 'Date')
        assertUuid(workoutId, 'Workout id')
        await switchWorkoutForDay(dateISO, workoutId)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await skipWorkout(sessionId, notes)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await undoSkipWorkout(sessionId, notes)
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
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function saveSetAction(input: {
    sessionId: string
    exerciseId: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}): Promise<ActionResult<SetLog>> {
    try {
        assertUuid(input.sessionId, 'Session id')
        assertUuid(input.exerciseId, 'Exercise id')
        assertOptionalUuid(input.setLogId, 'Set log id')
        assertPositiveInteger(input.setNumber, 'Set number')
        assertFiniteNumber(input.weight, 'Weight', 0)
        assertFiniteNumber(input.reps, 'Reps', 1)
        const data = await saveSet(
            input.sessionId,
            input.exerciseId,
            input.setNumber,
            input.weight,
            input.reps,
            input.setLogId
        )
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function saveSessionNotesAction(sessionId: string, notes: string): Promise<ActionResult<null>> {
    try {
        assertUuid(sessionId, 'Session id')
        await saveSessionNotes(sessionId, notes)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
