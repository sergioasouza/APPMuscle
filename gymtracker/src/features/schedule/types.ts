import type { Schedule, ScheduleRotation, Workout } from '@/lib/types'
import type { ScheduleDayPlan } from '@/features/schedule/rotation'

export type ScheduleEntry = Schedule & { workouts: Workout }
export type ScheduleRotationEntry = ScheduleRotation & { workouts: Workout }

export interface SchedulePageData {
    workouts: Workout[]
    schedule: ScheduleEntry[]
    rotations: ScheduleRotationEntry[]
    rotationAnchorDate: string | null
    rotationCycleLength: number
    previewDateISO: string
    dayPlans: ScheduleDayPlan[]
    rotationSupportEnabled: boolean
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
