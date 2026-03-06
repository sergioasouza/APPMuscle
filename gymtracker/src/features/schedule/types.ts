import type { Schedule, Workout } from '@/lib/types'

export type ScheduleEntry = Schedule & { workouts: Workout }

export interface SchedulePageData {
    workouts: Workout[]
    schedule: ScheduleEntry[]
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
