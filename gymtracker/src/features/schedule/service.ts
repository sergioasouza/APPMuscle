import 'server-only'

import {
    assignWorkoutToDayRepository,
    clearScheduleDayRepository,
    getSchedulePageDataRepository,
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
