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
import type { ActionResult, TodayViewData } from '@/features/today/types'
import type { SetLog, Workout } from '@/lib/types'

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        if (error.message === 'Invalid set values') {
            return 'Invalid set values'
        }

        return error.message
    }

    return 'Unexpected error'
}

export async function getTodayViewAction(dateISO: string, dayOfWeek: number): Promise<ActionResult<TodayViewData>> {
    try {
        const data = await getTodayView(dateISO, dayOfWeek)
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function listUserWorkoutsAction(): Promise<ActionResult<Workout[]>> {
    try {
        const workouts = await listUserWorkouts()
        return { ok: true, data: workouts }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function switchWorkoutForDayAction(dateISO: string, workoutId: string): Promise<ActionResult<null>> {
    try {
        await switchWorkoutForDay(dateISO, workoutId)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function skipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        await skipWorkout(sessionId, notes)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function undoSkipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        await undoSkipWorkout(sessionId, notes)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
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
        await rescheduleWorkout(dateISO, dayOfWeek, targetDay, workoutId, sessionId, dayNames)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
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
        const data = await saveSet(
            input.sessionId,
            input.exerciseId,
            input.setNumber,
            input.weight,
            input.reps,
            input.setLogId
        )
        return { ok: true, data }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}

export async function saveSessionNotesAction(sessionId: string, notes: string): Promise<ActionResult<null>> {
    try {
        await saveSessionNotes(sessionId, notes)
        return { ok: true, data: null }
    } catch (error) {
        return { ok: false, message: getErrorMessage(error) }
    }
}
