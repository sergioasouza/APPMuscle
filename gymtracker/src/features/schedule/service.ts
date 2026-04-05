import 'server-only'

import {
    assignWorkoutToDayRepository,
    clearScheduleDayRepository,
    clearScheduleRotationRepository,
    clearRotationWeekRepository,
    createRotationWeekFromBaseRepository,
    getSchedulePageDataRepository,
    updateRotationAnchorDateRepository,
    upsertScheduleRotationRepository,
} from '@/features/schedule/repository'

export async function getSchedulePageData() {
    return getSchedulePageDataRepository()
}

export async function assignWorkoutToDay(dayOfWeek: number, workoutId: string) {
    if (dayOfWeek < 0 || dayOfWeek > 6 || !workoutId) {
        throw new Error('Invalid schedule assignment')
    }

    return assignWorkoutToDayRepository(dayOfWeek, workoutId)
}

export async function clearScheduleDay(dayOfWeek: number) {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('Invalid schedule day')
    }

    await clearScheduleDayRepository(dayOfWeek)
}

export async function upsertScheduleRotation(dayOfWeek: number, rotationIndex: number, workoutId: string) {
    if (dayOfWeek < 0 || dayOfWeek > 6 || rotationIndex < 2 || !workoutId) {
        throw new Error('Invalid schedule rotation')
    }

    return upsertScheduleRotationRepository(dayOfWeek, rotationIndex, workoutId)
}

export async function clearScheduleRotation(dayOfWeek: number, rotationIndex: number) {
    if (dayOfWeek < 0 || dayOfWeek > 6 || rotationIndex < 2) {
        throw new Error('Invalid schedule rotation')
    }

    await clearScheduleRotationRepository(dayOfWeek, rotationIndex)
}

export async function updateRotationAnchorDate(rotationAnchorDate: string) {
    if (!rotationAnchorDate) {
        throw new Error('Rotation anchor date is required')
    }

    await updateRotationAnchorDateRepository(rotationAnchorDate)
}

export async function createRotationWeekFromBase(rotationIndex: number) {
    if (rotationIndex < 2 || rotationIndex > 12) {
        throw new Error('Invalid rotation week')
    }

    const rows = await createRotationWeekFromBaseRepository(rotationIndex)

    if (rows.length === 0) {
        throw new Error('Set up week 1 before adding another week')
    }

    return rows
}

export async function clearRotationWeek(rotationIndex: number) {
    if (rotationIndex < 2 || rotationIndex > 12) {
        throw new Error('Invalid rotation week')
    }

    await clearRotationWeekRepository(rotationIndex)
}
