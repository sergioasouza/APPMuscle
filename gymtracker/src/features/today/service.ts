import 'server-only'

import {
    getTodayViewRepository,
    listUserWorkoutsRepository,
    rescheduleWorkoutRepository,
    saveSessionNotesRepository,
    saveSetRepository,
    skipWorkoutRepository,
    switchWorkoutForDayRepository,
    undoSkipWorkoutRepository,
} from '@/features/today/repository'
import type { TodayViewData } from '@/features/today/types'

export async function getTodayView(dateISO: string, dayOfWeek: number): Promise<TodayViewData> {
    const data = await getTodayViewRepository(dateISO, dayOfWeek)

    const exerciseLogs = data.workoutExercises.map((workoutExercise) => {
        const existingSets = data.setLogs.filter((setLog) => setLog.exercise_id === workoutExercise.exercise_id)

        return {
            exerciseId: workoutExercise.exercise_id,
            exerciseName: workoutExercise.exercises.name,
            targetSets: workoutExercise.target_sets,
            sets: Array.from({ length: workoutExercise.target_sets }, (_, index) => {
                const existingSet = existingSets.find((setLog) => setLog.set_number === index + 1)

                return {
                    weight: existingSet ? String(existingSet.weight_kg) : '',
                    reps: existingSet ? String(existingSet.reps) : '',
                    saved: !!existingSet,
                    id: existingSet?.id,
                }
            }),
        }
    })

    return {
        workout: data.workout,
        session: data.session,
        exerciseLogs,
        notes: data.notes,
    }
}

export async function listUserWorkouts() {
    return listUserWorkoutsRepository()
}

export async function switchWorkoutForDay(dateISO: string, workoutId: string) {
    if (!dateISO || !workoutId) {
        throw new Error('Date and workout are required')
    }

    await switchWorkoutForDayRepository(dateISO, workoutId)
}

export async function skipWorkout(sessionId: string, notes: string | null) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    await skipWorkoutRepository(sessionId, notes)
}

export async function undoSkipWorkout(sessionId: string, notes: string | null) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    await undoSkipWorkoutRepository(sessionId, notes)
}

export async function rescheduleWorkout(
    dateISO: string,
    todayDayOfWeek: number,
    targetDay: number,
    workoutId: string,
    sessionId: string | null,
    dayNames: string[]
) {
    if (!dateISO || !workoutId) {
        throw new Error('Date and workout are required')
    }

    await rescheduleWorkoutRepository(dateISO, todayDayOfWeek, targetDay, workoutId, sessionId, dayNames)
}

export async function saveSet(
    sessionId: string,
    exerciseId: string,
    setNumber: number,
    weight: number,
    reps: number,
    setLogId?: string
) {
    if (!sessionId || !exerciseId) {
        throw new Error('Session and exercise are required')
    }

    if (Number.isNaN(weight) || Number.isNaN(reps) || weight < 0 || reps < 1) {
        throw new Error('Invalid set values')
    }

    return saveSetRepository({ sessionId, exerciseId, setNumber, weight, reps, setLogId })
}

export async function saveSessionNotes(sessionId: string, notes: string) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    await saveSessionNotesRepository(sessionId, notes)
}
