import type { ResolvedExercise, Schedule, ScheduleRotation, SetLog, Workout, WorkoutSession } from '@/lib/types'

export type SessionWithDetails = WorkoutSession & {
    workouts: Workout
}

export type ScheduleEntry = Schedule & {
    workouts: Workout
}

export type ScheduleRotationEntry = ScheduleRotation & {
    workouts: Workout
}

export type SetLogWithExercise = SetLog & {
    exercises: ResolvedExercise
}

export interface CalendarSessionMetrics {
    setCount: number
    totalVolume: number
    exerciseCount: number
    cardioCount: number
}

export interface CalendarWeekSummary {
    weekIndex: number
    weekStartISO: string
    weekEndISO: string
    scheduledCount: number
    elapsedScheduledCount: number
    completedCount: number
    skippedCount: number
    pendingCount: number
    upcomingCount: number
    movedCount: number
    totalVolume: number
    completedSessionCount: number
    adherenceRate: number | null
}

export interface CalendarMonthData {
    sessions: SessionWithDetails[]
    schedule: ScheduleEntry[]
    rotations: ScheduleRotationEntry[]
    rotationAnchorDate: string | null
    rotationCycleLength: number
    rotationSupportEnabled: boolean
    sessionMetricsById: Record<string, CalendarSessionMetrics>
    weeklySummaries: CalendarWeekSummary[]
    todayISO: string
}

export interface ActionResult<T> {
    ok: boolean
    data?: T
    message?: string
}
