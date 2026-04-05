import type { Workout } from '@/lib/types'

export interface RotationWorkoutLike {
    id: string
    name: string
}

export interface BaseScheduleLike {
    day_of_week: number
    workout_id: string
    workouts: RotationWorkoutLike | null
}

export interface ExtraRotationLike {
    id: string
    day_of_week: number
    rotation_index: number
    workout_id: string
    workouts: RotationWorkoutLike | null
}

export interface ScheduleVariant<TWorkout extends RotationWorkoutLike = Workout> {
    rotationIndex: number
    workoutId: string
    workout: TWorkout
    source: 'base' | 'rotation'
    rotationId?: string
}

export interface ScheduleDayPlan<TWorkout extends RotationWorkoutLike = Workout> {
    dayOfWeek: number
    activeRotationIndex: number | null
    variants: ScheduleVariant<TWorkout>[]
    activeVariant: ScheduleVariant<TWorkout> | null
    cycleLength: number
}

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function parseIsoDateAtUtcNoon(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export function buildScheduleVariants<TWorkout extends RotationWorkoutLike = Workout>(
    baseEntry: BaseScheduleLike | null | undefined,
    extraRotations: ExtraRotationLike[],
): ScheduleVariant<TWorkout>[] {
    const variants: ScheduleVariant<TWorkout>[] = []

    if (baseEntry?.workouts) {
        variants.push({
            rotationIndex: 1,
            workoutId: baseEntry.workout_id,
            workout: baseEntry.workouts as TWorkout,
            source: 'base',
        })
    }

    for (const rotation of [...extraRotations].sort((a, b) => a.rotation_index - b.rotation_index)) {
        if (!rotation.workouts) {
            continue
        }

        variants.push({
            rotationIndex: rotation.rotation_index,
            workoutId: rotation.workout_id,
            workout: rotation.workouts as TWorkout,
            source: 'rotation',
            rotationId: rotation.id,
        })
    }

    return variants
}

export function getRotationCycleLength(rotations: ExtraRotationLike[]) {
    if (rotations.length === 0) {
        return 1
    }

    return Math.max(1, ...rotations.map((rotation) => rotation.rotation_index))
}

export function resolveWeeklyRotationIndex(dateISO: string, anchorDateISO: string | null, variantCount: number) {
    if (variantCount < 1) {
        return null
    }

    if (!anchorDateISO) {
        return 1
    }

    const currentDate = parseIsoDateAtUtcNoon(dateISO)
    const anchorDate = parseIsoDateAtUtcNoon(anchorDateISO)
    const diffInWeeks = Math.floor((currentDate.getTime() - anchorDate.getTime()) / MILLISECONDS_PER_WEEK)
    const normalizedWeekIndex = ((diffInWeeks % variantCount) + variantCount) % variantCount

    return normalizedWeekIndex + 1
}

export function buildScheduleDayPlan<TWorkout extends RotationWorkoutLike = Workout>(input: {
    dayOfWeek: number
    dateISO: string
    anchorDateISO: string | null
    baseEntry: BaseScheduleLike | null | undefined
    extraRotations: ExtraRotationLike[]
    cycleLength?: number
}): ScheduleDayPlan<TWorkout> {
    const variants = buildScheduleVariants<TWorkout>(input.baseEntry, input.extraRotations)
    const cycleLength = Math.max(input.cycleLength ?? variants.length ?? 1, variants.length > 0 ? 1 : 0)
    const activeRotationIndex = resolveWeeklyRotationIndex(input.dateISO, input.anchorDateISO, cycleLength)
    const baseVariant = variants.find((variant) => variant.rotationIndex === 1) ?? null
    const activeVariant =
        variants.find((variant) => variant.rotationIndex === activeRotationIndex)
        ?? baseVariant

    return {
        dayOfWeek: input.dayOfWeek,
        activeRotationIndex,
        variants,
        activeVariant,
        cycleLength,
    }
}
