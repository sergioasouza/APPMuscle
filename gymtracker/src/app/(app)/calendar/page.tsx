'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSupabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { DAY_NAMES_SHORT, formatDateISO } from '@/lib/utils'
import { useLanguage } from '@/components/language-provider'
import type { Workout, WorkoutSession, SetLog, Exercise } from '@/lib/types'

type SessionWithDetails = WorkoutSession & {
    workouts: Workout
}

type SetLogWithExercise = SetLog & {
    exercises: Exercise
}

export default function CalendarPage() {
    const { t } = useLanguage()
    const supabase = useSupabase()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [sessions, setSessions] = useState<SessionWithDetails[]>([])
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null)
    const [sessionSets, setSessionSets] = useState<SetLogWithExercise[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingSets, setLoadingSets] = useState(false)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const fetchSessions = useCallback(async () => {
        setLoading(true)
        const startOfMonth = new Date(year, month, 1)
        const endOfMonth = new Date(year, month + 1, 0)

        const { data } = await supabase
            .from('workout_sessions')
            .select('*, workouts(*)')
            .gte('performed_at', formatDateISO(startOfMonth))
            .lte('performed_at', formatDateISO(endOfMonth))
            .order('performed_at')

        setSessions((data as SessionWithDetails[]) || [])
        setLoading(false)
    }, [supabase, year, month])

    useEffect(() => {
        fetchSessions()
    }, [fetchSessions])

    useEffect(() => {
        if (selectedDate) {
            const session = sessions.find((s) => s.performed_at === selectedDate)
            if (session) {
                setSelectedSession(session)
                loadSessionSets(session.id)
            } else {
                setSelectedSession(null)
                setSessionSets([])
            }
        }
    }, [selectedDate, sessions])

    async function loadSessionSets(sessionId: string) {
        setLoadingSets(true)
        const { data } = await supabase
            .from('set_logs')
            .select('*, exercises(*)')
            .eq('session_id', sessionId)
            .order('exercise_id')
            .order('set_number')
        setSessionSets((data as SetLogWithExercise[]) || [])
        setLoadingSets(false)
    }

    function prevMonth() {
        setCurrentDate(new Date(year, month - 1, 1))
        setSelectedDate(null)
        setSelectedSession(null)
    }

    function nextMonth() {
        setCurrentDate(new Date(year, month + 1, 1))
        setSelectedDate(null)
        setSelectedSession(null)
    }

    // Calendar grid
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayISO = formatDateISO(new Date())

    const calendarDays: (number | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null)
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i)

    function getSessionForDay(day: number): SessionWithDetails | undefined {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return sessions.find((s) => s.performed_at === dateStr)
    }

    // Group set logs by exercise
    const groupedSets = sessionSets.reduce<Record<string, { name: string; sets: SetLogWithExercise[] }>>(
        (acc, sl) => {
            if (!acc[sl.exercise_id]) {
                acc[sl.exercise_id] = { name: sl.exercises.name, sets: [] }
            }
            acc[sl.exercise_id].sets.push(sl)
            return acc
        },
        {}
    )

    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
        <div className="px-4 pt-6 pb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{t('Calendar.title')}</h1>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{monthName}</h2>
                <button onClick={nextMonth} className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
            </div>

            {/* Calendar grid */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-3 mb-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAY_NAMES_SHORT.map((d) => (
                        <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                        if (day === null) return <div key={i} />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const session = getSessionForDay(day)
                        const isToday = dateStr === todayISO
                        const isSelected = dateStr === selectedDate

                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm
                  font-medium transition-all relative ${isSelected
                                        ? 'bg-violet-600 text-zinc-900 dark:text-white'
                                        : isToday
                                            ? 'bg-violet-600/20 text-violet-300'
                                            : session
                                                ? 'text-zinc-900 dark:text-white hover:bg-zinc-800'
                                                : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:bg-zinc-800'
                                    }`}
                            >
                                {day}
                                {session && !isSelected && (
                                    <div className="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1.5" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Selected date details */}
            {selectedDate && (
                <div className="animate-[slideDown_0.2s_ease-out]">
                    {selectedSession ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                                    {selectedSession.workouts.name}
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedDate}</p>
                            </div>

                            {loadingSets ? (
                                <div className="p-4 space-y-2">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : Object.keys(groupedSets).length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                                    {t('Calendar.noSetsLogged')}
                                </div>
                            ) : (
                                <div className="divide-y divide-zinc-800/30">
                                    {Object.entries(groupedSets).map(([exId, { name, sets }]) => (
                                        <div key={exId} className="px-4 py-3">
                                            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{name}</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {sets.map((s) => (
                                                    <div
                                                        key={s.id}
                                                        className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono"
                                                    >
                                                        <span className="text-zinc-900 dark:text-white font-semibold">{s.weight_kg}</span>
                                                        <span className="text-zinc-500 dark:text-zinc-400">{t('Calendar.kg')}</span>
                                                        <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mx-1">×</span>
                                                        <span className="text-zinc-900 dark:text-white font-semibold">{s.reps}</span>
                                                        <span className="text-zinc-500 dark:text-zinc-400">{t('Calendar.reps')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedSession.notes && (
                                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-semibold">{t('Calendar.notes')}</p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedSession.notes}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t('Calendar.noWorkoutRecorded')}</p>
                            <Link
                                href={`/today?date=${selectedDate}`}
                                className="inline-block px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                            >
                                {t('Calendar.logWorkoutForDate')}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
