'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { assignWorkoutToDayAction, clearScheduleDayAction } from '@/features/schedule/actions'
import type { ScheduleEntry } from '@/features/schedule/types'
import type { Workout } from '@/lib/types'
import { getLocalizedWeekdayNames } from '@/lib/utils'

interface SchedulePageClientProps {
    initialWorkouts: Workout[]
    initialSchedule: ScheduleEntry[]
}

function createClientMutationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function SchedulePageClient({ initialWorkouts, initialSchedule }: SchedulePageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()
    const dayNames = getLocalizedWeekdayNames(locale)

    const [editingDay, setEditingDay] = useState<number | null>(null)
    const [schedule, setSchedule] = useState<ScheduleEntry[]>(initialSchedule)
    const [pendingDays, setPendingDays] = useState<Record<number, boolean>>({})
    const latestMutationByDayRef = useRef<Record<number, string>>({})

    const workouts = useMemo(() => initialWorkouts, [initialWorkouts])

    function getScheduleForDay(day: number) {
        return schedule.find((item) => item.day_of_week === day)
    }

    async function handleAssignWorkout(dayOfWeek: number, workoutId: string) {
        if (pendingDays[dayOfWeek]) {
            return
        }

        const clientMutationId = createClientMutationId()
        latestMutationByDayRef.current[dayOfWeek] = clientMutationId
        setPendingDays((prev) => ({ ...prev, [dayOfWeek]: true }))

        try {
            const result = await assignWorkoutToDayAction(dayOfWeek, workoutId)

            if (latestMutationByDayRef.current[dayOfWeek] !== clientMutationId) {
                return
            }

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to update schedule', 'error')
                return
            }

            showToast(t('Schedule.toastUpdated'))
            setEditingDay(null)
            setSchedule((prev) => [
                ...prev.filter((item) => item.day_of_week !== dayOfWeek),
                result.data!,
            ].sort((a, b) => a.day_of_week - b.day_of_week))
        } finally {
            if (latestMutationByDayRef.current[dayOfWeek] === clientMutationId) {
                setPendingDays((prev) => ({ ...prev, [dayOfWeek]: false }))
            }
        }
    }

    async function handleUnlink(dayOfWeek: number) {
        const existing = getScheduleForDay(dayOfWeek)
        if (!existing) {
            return
        }

        if (pendingDays[dayOfWeek]) {
            return
        }

        const clientMutationId = createClientMutationId()
        latestMutationByDayRef.current[dayOfWeek] = clientMutationId
        setPendingDays((prev) => ({ ...prev, [dayOfWeek]: true }))

        try {
            const result = await clearScheduleDayAction(dayOfWeek)

            if (latestMutationByDayRef.current[dayOfWeek] !== clientMutationId) {
                return
            }

            if (!result.ok) {
                showToast(result.message ?? 'Unable to clear schedule', 'error')
                return
            }

            showToast(t('Schedule.toastCleared'))
            setEditingDay(null)
            setSchedule((prev) => prev.filter((item) => item.day_of_week !== dayOfWeek))
        } finally {
            if (latestMutationByDayRef.current[dayOfWeek] === clientMutationId) {
                setPendingDays((prev) => ({ ...prev, [dayOfWeek]: false }))
            }
        }
    }

    const today = new Date().getDay()

    return (
        <div className="px-4 pt-6 pb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{t('Schedule.title')}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('Schedule.subtitle')}</p>

            {workouts.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-1">{t('Schedule.noWorkouts')}</p>
                    <p className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-xs">{t('Schedule.goToWorkouts')}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {dayNames.map((dayName, dayIndex) => {
                        const slot = getScheduleForDay(dayIndex)
                        const isToday = dayIndex === today
                        const isEditing = editingDay === dayIndex
                        const isPending = !!pendingDays[dayIndex]

                        return (
                            <div key={dayIndex}>
                                <button
                                    disabled={isPending}
                                    onClick={() => setEditingDay(isEditing ? null : dayIndex)}
                                    className={`w-full text-left rounded-2xl p-4 transition-all ${isToday
                                        ? 'bg-violet-600/10 border-2 border-violet-600/30'
                                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-700'
                                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-base font-semibold ${isToday ? 'text-violet-300' : 'text-zinc-900 dark:text-white'}`}>
                                                    {dayName}
                                                </span>
                                                {isToday && (
                                                    <span className="text-[10px] bg-violet-600 text-zinc-900 dark:text-white px-1.5 py-0.5 rounded-md font-semibold uppercase">
                                                        {t('Schedule.todayText')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm mt-0.5 ${slot ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600'}`}>
                                                {slot ? slot.workouts.name : t('Schedule.restDay')}
                                            </p>
                                        </div>
                                        <svg
                                            className={`w-4 h-4 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                                            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </div>
                                </button>

                                {isEditing && (
                                    <div className="mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 animate-[slideDown_0.15s_ease-out]">
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {workouts.map((workout) => (
                                                <button
                                                    key={workout.id}
                                                    disabled={isPending}
                                                    onClick={() => handleAssignWorkout(dayIndex, workout.id)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${slot?.workout_id === workout.id
                                                        ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-800'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {workout.name}
                                                    {slot?.workout_id === workout.id && (
                                                        <span className="text-xs text-violet-400 ml-2">• {t('Schedule.current')}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        {slot && (
                                            <button
                                                disabled={isPending}
                                                onClick={() => handleUnlink(dayIndex)}
                                                className="w-full mt-2 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t('Schedule.clearDay')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
