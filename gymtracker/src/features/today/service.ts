import 'server-only'

import {
    getTodayViewRepository,
    listTodayExerciseOptionsRepository,
    listUserWorkoutsRepository,
    rescheduleWorkoutRepository,
    saveCardioLogRepository,
    saveExerciseTargetSetsRepository,
    saveSessionNotesRepository,
    saveSetLogRepository,
    saveSetRepository,
    skipCardioRepository,
    skipExerciseRepository,
    skipWorkoutRepository,
    substituteExerciseRepository,
    switchWorkoutForDayRepository,
    undoSkipCardioRepository,
    undoExerciseSubstitutionRepository,
    undoSkipExerciseRepository,
    undoSkipWorkoutRepository,
} from '@/features/today/repository'
import type { SaveCardioLogInput, TodayExerciseOption, TodayViewData } from '@/features/today/types'
import {
    buildSetSegments,
    normalizeSetLogSegments,
    normalizeSetPrescriptions,
    type SetLogPayload,
} from '@/lib/set-methods'

export async function getTodayView(dateISO: string, dayOfWeek: number): Promise<TodayViewData> {
    const data = await getTodayViewRepository(dateISO, dayOfWeek)
    const skippedExerciseIds = new Set(data.sessionExerciseSkips.map((skip) => skip.exercise_id))
    const validTargetByExerciseId = data.sessionExerciseTargets.reduce<Map<string, number>>((accumulator, target) => {
        accumulator.set(target.exercise_id, target.valid_sets)
        return accumulator
    }, new Map())
    const substitutionByOriginalExerciseId = data.sessionExerciseSubstitutions.reduce<Map<string, typeof data.sessionExerciseSubstitutions[number]>>((accumulator, substitution) => {
        accumulator.set(substitution.original_exercise_id, substitution)
        return accumulator
    }, new Map())
    const cardioLogByBlockId = data.sessionCardioLogs.reduce<Map<string, typeof data.sessionCardioLogs[number]>>((accumulator, cardioLog) => {
        accumulator.set(cardioLog.workout_cardio_block_id, cardioLog)
        return accumulator
    }, new Map())
    const intervalsByCardioLogId = data.sessionCardioIntervals.reduce<Map<string, typeof data.sessionCardioIntervals>>((accumulator, interval) => {
        const current = accumulator.get(interval.cardio_log_id) ?? []
        current.push(interval)
        accumulator.set(interval.cardio_log_id, current)
        return accumulator
    }, new Map())

    const exerciseLogs = data.workoutExercises.map((workoutExercise) => {
        const substitution = substitutionByOriginalExerciseId.get(workoutExercise.exercise_id)
        const effectiveExerciseId = substitution?.replacement_exercise_id ?? workoutExercise.exercise_id
        const effectiveExerciseName = substitution?.replacement.display_name ?? workoutExercise.exercises?.display_name ?? '(deleted)'
        const originalExerciseName = workoutExercise.exercises?.display_name ?? '(deleted)'
        const existingSets = data.setLogs.filter((setLog) => setLog.exercise_id === effectiveExerciseId)
        const prevSetsForExercise = data.previousSetLogs.filter((setLog) => setLog.exercise_id === effectiveExerciseId)
        const prescriptions = normalizeSetPrescriptions(
            workoutExercise.set_prescriptions,
            workoutExercise.target_sets,
        )
        const savedSetCount = existingSets.filter((setLog) => setLog.state === 'completed').length
        const desiredTargetSets = validTargetByExerciseId.get(workoutExercise.exercise_id) ?? workoutExercise.target_sets
        const effectiveTargetSets = Math.min(
            prescriptions.length,
            Math.max(desiredTargetSets, savedSetCount || 1)
        )

        return {
            exerciseId: effectiveExerciseId,
            originalExerciseId: workoutExercise.exercise_id,
            exerciseName: effectiveExerciseName,
            originalExerciseName,
            substitution: substitution
                ? {
                    replacementExerciseId: substitution.replacement_exercise_id,
                    replacementExerciseName: substitution.replacement.display_name,
                }
                : null,
            targetSets: effectiveTargetSets,
            plannedTargetSets: prescriptions.length,
            sets: prescriptions.map((prescription, index) => {
                const existingSet = existingSets.find((setLog) =>
                    setLog.prescription_id === prescription.id
                    || (!setLog.prescription_id && setLog.set_number === index + 1)
                )
                const segments = existingSet
                    ? normalizeSetLogSegments(existingSet)
                    : buildSetSegments(prescription)

                return {
                    prescription,
                    segments: segments.map((segment) => ({
                        ...segment,
                        weight: segment.weightKg == null ? '' : String(segment.weightKg),
                        reps: segment.reps == null ? '' : String(segment.reps),
                    })),
                    actualRir: existingSet?.actual_rir == null ? '' : String(existingSet.actual_rir),
                    state: existingSet?.state ?? 'in_progress',
                    saved: existingSet?.state === 'completed',
                    started: !!existingSet,
                    id: existingSet?.id,
                }
            }),
            previousSets: prevSetsForExercise.map((setLog) => ({
                method: setLog.set_method,
                segments: normalizeSetLogSegments(setLog),
                actualRir: setLog.actual_rir,
            })),
            skipped: skippedExerciseIds.has(workoutExercise.exercise_id),
        }
    })

    const cardioLogs = data.cardioBlocks.map((cardioBlock) => {
        const cardioLog = cardioLogByBlockId.get(cardioBlock.id)
        const intervals = cardioLog ? (intervalsByCardioLogId.get(cardioLog.id) ?? []) : []

        return {
            cardioBlockId: cardioBlock.id,
            cardioName: cardioBlock.name,
            targetDurationMinutes: cardioBlock.target_duration_minutes,
            totalDurationMinutes: cardioLog?.total_duration_minutes != null ? String(cardioLog.total_duration_minutes) : '',
            totalDistanceKm: cardioLog?.total_distance_km != null ? String(cardioLog.total_distance_km) : '',
            intervals: intervals.map((interval) => ({
                id: interval.id,
                durationMinutes: String(interval.duration_minutes),
                speedKmh: interval.speed_kmh != null ? String(interval.speed_kmh) : '',
                repeatCount: String(interval.repeat_count),
            })),
            skipped: cardioLog?.skipped_at != null,
            saved: cardioLog != null && (
                cardioLog.skipped_at != null
                || cardioLog.total_duration_minutes != null
                || cardioLog.total_distance_km != null
                || intervals.length > 0
            ),
        }
    })

    return {
        workout: data.workout,
        session: data.session,
        exerciseLogs,
        cardioLogs,
        notes: data.notes,
        rotation: data.rotation,
    }
}

export async function listUserWorkouts() {
    return listUserWorkoutsRepository()
}

export async function listTodayExerciseOptions(): Promise<TodayExerciseOption[]> {
    const exercises = await listTodayExerciseOptionsRepository()

    return exercises.map((exercise) => ({
        id: exercise.id,
        displayName: exercise.display_name,
        source: exercise.source,
        modality: exercise.modality,
        muscleGroup: exercise.muscle_group,
    }))
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
    originalExerciseId: string | undefined,
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

    return saveSetRepository({ sessionId, exerciseId, originalExerciseId, setNumber, weight, reps, setLogId })
}

export async function saveSetLog(payload: SetLogPayload) {
    if (!payload.sessionId || !payload.exerciseId) {
        throw new Error('Session and exercise are required')
    }

    return saveSetLogRepository(payload)
}

export async function saveExerciseTargetSets(
    sessionId: string,
    exerciseId: string,
    validSets: number,
) {
    if (!sessionId || !exerciseId) {
        throw new Error('Session and exercise are required')
    }

    if (!Number.isInteger(validSets) || validSets < 1) {
        throw new Error('Invalid valid sets value')
    }

    await saveExerciseTargetSetsRepository({
        sessionId,
        exerciseId,
        validSets,
    })
}

export async function saveSessionNotes(sessionId: string, notes: string) {
    if (!sessionId) {
        throw new Error('Session id is required')
    }

    await saveSessionNotesRepository(sessionId, notes)
}

export async function skipExercise(sessionId: string, exerciseId: string) {
    if (!sessionId || !exerciseId) {
        throw new Error('Session and exercise are required')
    }

    await skipExerciseRepository(sessionId, exerciseId)
}

export async function undoSkipExercise(sessionId: string, exerciseId: string) {
    if (!sessionId || !exerciseId) {
        throw new Error('Session and exercise are required')
    }

    await undoSkipExerciseRepository(sessionId, exerciseId)
}

export async function substituteExercise(
    sessionId: string,
    originalExerciseId: string,
    replacementExerciseId: string,
) {
    if (!sessionId || !originalExerciseId || !replacementExerciseId) {
        throw new Error('Session and exercises are required')
    }

    await substituteExerciseRepository({
        sessionId,
        originalExerciseId,
        replacementExerciseId,
    })
}

export async function undoExerciseSubstitution(
    sessionId: string,
    originalExerciseId: string,
) {
    if (!sessionId || !originalExerciseId) {
        throw new Error('Session and exercise are required')
    }

    await undoExerciseSubstitutionRepository(sessionId, originalExerciseId)
}

export async function saveCardioLog(input: SaveCardioLogInput) {
    if (!input.sessionId || !input.cardioBlockId) {
        throw new Error('Session and cardio block are required')
    }

    const hasIntervals = input.intervals.length > 0
    const hasTotalDuration = input.totalDurationMinutes != null
    const hasDistance = input.totalDistanceKm != null

    if (!hasIntervals && !hasTotalDuration && !hasDistance) {
        throw new Error('At least one cardio metric is required')
    }

    return saveCardioLogRepository(input)
}

export async function skipCardio(sessionId: string, cardioBlockId: string) {
    if (!sessionId || !cardioBlockId) {
        throw new Error('Session and cardio block are required')
    }

    await skipCardioRepository(sessionId, cardioBlockId)
}

export async function undoSkipCardio(sessionId: string, cardioBlockId: string) {
    if (!sessionId || !cardioBlockId) {
        throw new Error('Session and cardio block are required')
    }

    await undoSkipCardioRepository(sessionId, cardioBlockId)
}
