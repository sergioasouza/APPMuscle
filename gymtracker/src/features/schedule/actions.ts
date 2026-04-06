'use server'

import { revalidateScheduleSurfaces } from '@/lib/revalidate-app-routes'
import {
    assignWorkoutToDay,
    clearRotationWeek,
    clearScheduleDay,
    clearScheduleRotation,
    createRotationWeekFromBase,
    updateRotationAnchorDate,
    upsertScheduleRotation,
} from '@/features/schedule/service'
import type { ScheduleEntry, ScheduleRotationEntry } from '@/features/schedule/types'
import { errorResult, okResult } from '@/lib/action-result'
import type { ActionResult } from '@/lib/action-result'
import { assertIntegerInRange, assertIsoDate, assertUuid } from '@/lib/validation'

export async function assignWorkoutToDayAction(
    dayOfWeek: number,
    workoutId: string
): Promise<ActionResult<ScheduleEntry>> {
    try {
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        assertUuid(workoutId, 'Workout id')
        const data = await assignWorkoutToDay(dayOfWeek, workoutId)
        revalidateScheduleSurfaces()
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function clearScheduleDayAction(dayOfWeek: number): Promise<ActionResult<null>> {
    try {
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        await clearScheduleDay(dayOfWeek)
        revalidateScheduleSurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function upsertScheduleRotationAction(
    dayOfWeek: number,
    rotationIndex: number,
    workoutId: string
): Promise<ActionResult<ScheduleRotationEntry>> {
    try {
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        assertIntegerInRange(rotationIndex, 'Rotation index', 2, 12)
        assertUuid(workoutId, 'Workout id')
        const data = await upsertScheduleRotation(dayOfWeek, rotationIndex, workoutId)
        revalidateScheduleSurfaces()
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function clearScheduleRotationAction(dayOfWeek: number, rotationIndex: number): Promise<ActionResult<null>> {
    try {
        assertIntegerInRange(dayOfWeek, 'Day of week', 0, 6)
        assertIntegerInRange(rotationIndex, 'Rotation index', 2, 12)
        await clearScheduleRotation(dayOfWeek, rotationIndex)
        revalidateScheduleSurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function updateRotationAnchorDateAction(rotationAnchorDate: string): Promise<ActionResult<null>> {
    try {
        assertIsoDate(rotationAnchorDate, 'Rotation anchor date')
        await updateRotationAnchorDate(rotationAnchorDate)
        revalidateScheduleSurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}

export async function createRotationWeekFromBaseAction(rotationIndex: number): Promise<ActionResult<ScheduleRotationEntry[]>> {
    try {
        assertIntegerInRange(rotationIndex, 'Rotation index', 2, 12)
        const data = await createRotationWeekFromBase(rotationIndex)
        revalidateScheduleSurfaces()
        return okResult(data)
    } catch (error) {
        return errorResult(error)
    }
}

export async function clearRotationWeekAction(rotationIndex: number): Promise<ActionResult<null>> {
    try {
        assertIntegerInRange(rotationIndex, 'Rotation index', 2, 12)
        await clearRotationWeek(rotationIndex)
        revalidateScheduleSurfaces()
        return okResult(null)
    } catch (error) {
        return errorResult(error)
    }
}
