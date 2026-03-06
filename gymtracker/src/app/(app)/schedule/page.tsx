'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { DAY_NAMES } from '@/lib/utils'
import { useLanguage } from '@/components/language-provider'
import type { Workout, Schedule } from '@/lib/types'

export default function SchedulePage() {
    const { t } = useLanguage()
    const [workouts, setWorkouts] = useState<Workout[]>([])
    const [schedule, setSchedule] = useState<(Schedule & { workouts: Workout })[]>([])
    const [loading, setLoading] = useState(true)
    const [editingDay, setEditingDay] = useState<number | null>(null)
    const supabase = useSupabase()
    const { showToast } = useToast()

    const fetchData = useCallback(async () => {
        const [workoutsRes, scheduleRes] = await Promise.all([
            supabase.from('workouts').select('*').order('name'),
            supabase.from('schedule').select('*, workouts(*)').order('day_of_week'),
        ])
        setWorkouts(workoutsRes.data || [])
        setSchedule((scheduleRes.data as (Schedule & { workouts: Workout })[]) || [])
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    function getScheduleForDay(day: number) {
        return schedule.find((s) => s.day_of_week === day)
    }

    async function handleAssignWorkout(dayOfWeek: number, workoutId: string) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const existing = getScheduleForDay(dayOfWeek)

        // Delete existing schedule for this day (if any), then insert new one
        if (existing) {
            await supabase.from('schedule').delete().eq('id', existing.id)
        }

        const { error } = await supabase.from('schedule').insert({
            user_id: user.id,
            workout_id: workoutId,
            day_of_week: dayOfWeek,
        })
        if (error) {
            showToast(error.message, 'error')
            return
        }

        showToast(t('Schedule.toastUpdated'))
        setEditingDay(null)
        fetchData()
    }

    async function handleUnlink(dayOfWeek: number) {
        const existing = getScheduleForDay(dayOfWeek)
        if (!existing) return

        const { error } = await supabase.from('schedule').delete().eq('id', existing.id)
        if (error) {
            showToast(error.message, 'error')
        } else {
            showToast(t('Schedule.toastCleared'))
            setEditingDay(null)
            fetchData()
        }
    }

    const today = new Date().getDay()

    if (loading) {
        return (
            <div className="px-4 pt-6">
                <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className="h-16 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

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
                    {DAY_NAMES.map((dayName, dayIndex) => {
                        const slot = getScheduleForDay(dayIndex)
                        const isToday = dayIndex === today
                        const isEditing = editingDay === dayIndex

                        return (
                            <div key={dayIndex}>
                                <button
                                    onClick={() => setEditingDay(isEditing ? null : dayIndex)}
                                    className={`w-full text-left rounded-2xl p-4 transition-all ${isToday
                                        ? 'bg-violet-600/10 border-2 border-violet-600/30'
                                        : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-700'
                                        }`}
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

                                {/* Editing dropdown */}
                                {isEditing && (
                                    <div className="mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3
                    animate-[slideDown_0.15s_ease-out]">
                                        <div className="space-y-1 max-h-48 overflow-y-auto">
                                            {workouts.map((w) => (
                                                <button
                                                    key={w.id}
                                                    onClick={() => handleAssignWorkout(dayIndex, w.id)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${slot?.workout_id === w.id
                                                        ? 'bg-violet-600/20 text-violet-300 border border-violet-600/30'
                                                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-800'
                                                        }`}
                                                >
                                                    {w.name}
                                                    {slot?.workout_id === w.id && (
                                                        <span className="text-xs text-violet-400 ml-2">• {t('Schedule.current')}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        {slot && (
                                            <button
                                                onClick={() => handleUnlink(dayIndex)}
                                                className="w-full mt-2 py-2.5 text-sm text-red-400 hover:bg-red-500/10
                          rounded-xl transition-colors font-medium"
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
