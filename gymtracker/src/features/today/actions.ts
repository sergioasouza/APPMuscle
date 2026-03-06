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

export async function getTodayViewAction(dateISO: string, dayOfWeek: number): Promise<ActionResult<TodayViewData>> {
    try {
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
        await switchWorkoutForDay(dateISO, workoutId)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function skipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
        await skipWorkout(sessionId, notes)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function undoSkipWorkoutAction(sessionId: string, notes: string | null): Promise<ActionResult<null>> {
    try {
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
        await saveSessionNotes(sessionId, notes)
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
