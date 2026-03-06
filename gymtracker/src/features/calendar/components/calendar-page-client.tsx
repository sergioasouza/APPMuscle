'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { getCalendarMonthAction, getSessionSetsAction } from '@/features/calendar/actions'
import type { SessionWithDetails, SetLogWithExercise } from '@/features/calendar/types'
import { formatDateISO, formatMonthYear, getLocalizedWeekdayNames } from '@/lib/utils'

interface CalendarPageClientProps {
    initialDate: string
    initialSessions: SessionWithDetails[]
}

export function CalendarPageClient({ initialDate, initialSessions }: CalendarPageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()

    const [currentDate, setCurrentDate] = useState(new Date(`${initialDate}T00:00:00`))
    const [sessions, setSessions] = useState<SessionWithDetails[]>(initialSessions)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [sessionSets, setSessionSets] = useState<SetLogWithExercise[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingSets, setLoadingSets] = useState(false)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const selectedSession = useMemo(
        () => (selectedDate ? sessions.find((item) => item.performed_at === selectedDate) ?? null : null),
        [selectedDate, sessions]
    )

    useEffect(() => {
        if (!selectedSession) {
            return
        }

        const session = selectedSession

        let cancelled = false

        async function loadSessionSets() {
            setLoadingSets(true)
            const result = await getSessionSetsAction(session.id)
            if (cancelled) {
                return
            }

            setLoadingSets(false)

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to load session details', 'error')
                return
            }

            setSessionSets(result.data)
        }

        void loadSessionSets()

        return () => {
            cancelled = true
        }
    }, [selectedSession, showToast])

    async function goToMonth(nextDate: Date) {
        setLoading(true)
        const result = await getCalendarMonthAction(nextDate.getFullYear(), nextDate.getMonth())
        setLoading(false)

        if (!result.ok || !result.data) {
            showToast(result.message ?? 'Unable to load calendar', 'error')
            return
        }

        setSelectedDate(null)
        setSessionSets([])
        setCurrentDate(nextDate)
        setSessions(result.data.sessions)
    }

    function prevMonth() {
        void goToMonth(new Date(year, month - 1, 1))
    }

    function nextMonth() {
        void goToMonth(new Date(year, month + 1, 1))
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const todayISO = formatDateISO(new Date())

    const calendarDays: (number | null)[] = []
    for (let index = 0; index < firstDayOfMonth; index += 1) calendarDays.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) calendarDays.push(day)

    function getSessionForDay(day: number) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        return sessions.find((session) => session.performed_at === dateStr)
    }

    const groupedSets = useMemo(
        () => sessionSets.reduce<Record<string, { name: string; sets: SetLogWithExercise[] }>>((accumulator, setLog) => {
            if (!accumulator[setLog.exercise_id]) {
                accumulator[setLog.exercise_id] = { name: setLog.exercises.name, sets: [] }
            }
            accumulator[setLog.exercise_id].sets.push(setLog)
            return accumulator
        }, {}),
        [sessionSets]
    )

    const monthName = formatMonthYear(currentDate, locale)
    const dayNamesShort = getLocalizedWeekdayNames(locale, 'short')

    if (loading) {
        return (
            <div className="px-4 pt-6 pb-8">
                <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-4" />
                <div className="h-72 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">{t('Calendar.title')}</h1>

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

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-3 mb-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {dayNamesShort.map((dayName) => (
                        <div key={dayName} className="text-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 py-1">
                            {dayName}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        if (day === null) return <div key={index} />
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const session = getSessionForDay(day)
                        const isToday = dateStr === todayISO
                        const isSelected = dateStr === selectedDate

                        return (
                            <button
                                key={index}
                                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all relative ${isSelected
                                    ? 'bg-violet-600 text-zinc-900 dark:text-white'
                                    : isToday
                                        ? 'bg-violet-600/20 text-violet-300'
                                        : session
                                            ? 'text-zinc-900 dark:text-white hover:bg-zinc-800'
                                            : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:bg-zinc-800'
                                    }`}
                            >
                                {day}
                                {session && !isSelected && <div className="w-1 h-1 rounded-full bg-emerald-400 absolute bottom-1.5" />}
                            </button>
                        )
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="animate-[slideDown_0.2s_ease-out]">
                    {selectedSession ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50">
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{selectedSession.workouts.name}</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedDate}</p>
                            </div>

                            {loadingSets ? (
                                <div className="p-4 space-y-2">
                                    {[1, 2].map((index) => (
                                        <div key={index} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : Object.keys(groupedSets).length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 dark:text-zinc-400 text-sm">{t('Calendar.noSetsLogged')}</div>
                            ) : (
                                <div className="divide-y divide-zinc-800/30">
                                    {Object.entries(groupedSets).map(([exerciseId, group]) => (
                                        <div key={exerciseId} className="px-4 py-3">
                                            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{group.name}</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {group.sets.map((setLog) => (
                                                    <div key={setLog.id} className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono">
                                                        <span className="text-zinc-900 dark:text-white font-semibold">{setLog.weight_kg}</span>
                                                        <span className="text-zinc-500 dark:text-zinc-400">{t('Calendar.kg')}</span>
                                                        <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mx-1">×</span>
                                                        <span className="text-zinc-900 dark:text-white font-semibold">{setLog.reps}</span>
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
                            <Link href={`/today?date=${selectedDate}`} className="inline-block px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                                {t('Calendar.logWorkoutForDate')}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
