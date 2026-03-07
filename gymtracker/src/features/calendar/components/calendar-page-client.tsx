'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import {
    getCalendarMonthAction,
    getSessionSetsAction,
    skipWorkoutFromCalendarAction,
    undoSkipFromCalendarAction,
} from '@/features/calendar/actions'
import type { ScheduleEntry, SessionWithDetails, SetLogWithExercise } from '@/features/calendar/types'
import { formatDateISO, formatMonthYear, getLocalizedWeekdayNames } from '@/lib/utils'

interface CalendarPageClientProps {
    initialDate: string
    initialSessions: SessionWithDetails[]
    initialSchedule: ScheduleEntry[]
}

export function CalendarPageClient({ initialDate, initialSessions, initialSchedule }: CalendarPageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()

    const [currentDate, setCurrentDate] = useState(new Date(`${initialDate}T00:00:00`))
    const [sessions, setSessions] = useState<SessionWithDetails[]>(initialSessions)
    const [schedule, setSchedule] = useState<ScheduleEntry[]>(initialSchedule)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [sessionSets, setSessionSets] = useState<SetLogWithExercise[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingSets, setLoadingSets] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const selectedSession = useMemo(
        () => (selectedDate ? sessions.find((item) => item.performed_at === selectedDate) ?? null : null),
        [selectedDate, sessions]
    )

    const selectedDayOfWeek = useMemo(() => {
        if (!selectedDate) return null
        return new Date(`${selectedDate}T00:00:00`).getDay()
    }, [selectedDate])

    const scheduledWorkoutForSelectedDay = useMemo(() => {
        if (selectedDayOfWeek === null) return null
        const entry = schedule.find((s) => s.day_of_week === selectedDayOfWeek)
        return entry?.workouts ?? null
    }, [selectedDayOfWeek, schedule])

    const isSelectedDateSkipped = useMemo(() => {
        return selectedSession?.notes?.startsWith('[SKIPPED]') ?? false
    }, [selectedSession])

    const isSelectedDateRescheduled = useMemo(() => {
        return selectedSession?.notes?.startsWith('[RESCHEDULED') ?? false
    }, [selectedSession])

    const shouldLoadSets = !!selectedSession && !isSelectedDateSkipped && !isSelectedDateRescheduled

    useEffect(() => {
        if (!shouldLoadSets || !selectedSession) {
            return
        }

        const session = selectedSession

        let cancelled = false

        async function loadSessionSets() {
            setSessionSets([])
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
    }, [shouldLoadSets, selectedSession, showToast])

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
        setSchedule(result.data.schedule)
    }

    async function handleSkip() {
        if (!selectedSession || actionLoading) return
        setActionLoading(true)
        const result = await skipWorkoutFromCalendarAction(selectedSession.id)
        setActionLoading(false)

        if (!result.ok) {
            showToast(result.message ?? 'Error', 'error')
            return
        }

        showToast(t('Calendar.workoutSkipped'))
        setSessions((prev) =>
            prev.map((s) =>
                s.id === selectedSession.id ? { ...s, notes: '[SKIPPED]' } : s
            )
        )
        setSessionSets([])
    }

    async function handleUndoSkip() {
        if (!selectedSession || actionLoading) return
        setActionLoading(true)
        const result = await undoSkipFromCalendarAction(selectedSession.id)
        setActionLoading(false)

        if (!result.ok) {
            showToast(result.message ?? 'Error', 'error')
            return
        }

        showToast(t('Calendar.skipUndone'))
        setSessions((prev) =>
            prev.map((s) =>
                s.id === selectedSession.id ? { ...s, notes: null } : s
            )
        )
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

    function getScheduleForDayOfWeek(dayOfWeek: number) {
        return schedule.find((s) => s.day_of_week === dayOfWeek) ?? null
    }

    const groupedSets = useMemo(
        () => sessionSets.reduce<Record<string, { name: string; sets: SetLogWithExercise[] }>>((accumulator, setLog) => {
            const exName = setLog.exercises?.name ?? '(deleted)'
            if (!accumulator[setLog.exercise_id]) {
                accumulator[setLog.exercise_id] = { name: exName, sets: [] }
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

    function renderSelectedDayPanel() {
        if (!selectedDate) return null

        // Has existing session
        if (selectedSession) {
            // Session was skipped
            if (isSelectedDateSkipped) {
                return (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">🛋️</span>
                        </div>
                        <h3 className="text-base font-semibold text-zinc-500 dark:text-zinc-400 line-through mb-1">{selectedSession.workouts?.name ?? t('Calendar.workout')}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t('Calendar.workoutWasSkipped')}</p>
                        <button
                            onClick={handleUndoSkip}
                            disabled={actionLoading}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                        >
                            {actionLoading ? t('Common.loading') : t('Calendar.undoSkip')}
                        </button>
                    </div>
                )
            }

            // Session was rescheduled
            if (isSelectedDateRescheduled) {
                return (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">📅</span>
                        </div>
                        <h3 className="text-base font-semibold text-zinc-600 dark:text-zinc-400 mb-1">{selectedSession.workouts?.name ?? t('Calendar.workout')}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedSession.notes?.replace('[RESCHEDULED ', '').replace(']', '') ?? t('Calendar.rescheduled')}</p>
                    </div>
                )
            }

            // Normal session with (possibly empty) logs
            const hasLogs = Object.keys(groupedSets).length > 0
            return (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{selectedSession.workouts?.name ?? t('Calendar.workout')}</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{selectedDate}</p>
                        </div>
                        <Link
                            href={`/today?date=${selectedDate}`}
                            className="px-3 py-1.5 bg-violet-600/15 text-violet-500 text-xs font-semibold rounded-lg hover:bg-violet-600/25 transition-colors"
                        >
                            {hasLogs ? t('Calendar.editSession') : t('Calendar.fillSession')}
                        </Link>
                    </div>

                    {loadingSets ? (
                        <div className="p-4 space-y-2">
                            {[1, 2].map((index) => (
                                <div key={index} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : !hasLogs ? (
                        <div className="p-6 text-center">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t('Calendar.noSetsLogged')}</p>
                            <div className="flex items-center justify-center gap-2">
                                <Link
                                    href={`/today?date=${selectedDate}`}
                                    className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                                >
                                    {t('Calendar.fillSession')}
                                </Link>
                                <button
                                    onClick={handleSkip}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? '...' : t('Calendar.markNotDone')}
                                </button>
                            </div>
                        </div>
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

                    {selectedSession.notes && !isSelectedDateSkipped && !isSelectedDateRescheduled && (
                        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-semibold">{t('Calendar.notes')}</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">{selectedSession.notes}</p>
                        </div>
                    )}

                    {hasLogs && (
                        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50">
                            <button
                                onClick={handleSkip}
                                disabled={actionLoading}
                                className="w-full py-2 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                                {actionLoading ? '...' : t('Calendar.markNotDone')}
                            </button>
                        </div>
                    )}
                </div>
            )
        }

        // No session exists for this day
        const isRestDay = !scheduledWorkoutForSelectedDay
        const isFutureDate = selectedDate > todayISO

        if (isRestDay) {
            return (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                    <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">😴</span>
                    </div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">{t('Calendar.restDayTitle')}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t('Calendar.restDayDesc')}</p>
                    {!isFutureDate && (
                        <Link
                            href={`/today?date=${selectedDate}`}
                            className="inline-block px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                        >
                            {t('Calendar.logWorkoutAnyway')}
                        </Link>
                    )}
                </div>
            )
        }

        // Scheduled training day but no session yet
        return (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-violet-600/15 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🏋️</span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">{scheduledWorkoutForSelectedDay.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {isFutureDate ? t('Calendar.scheduledForThisDay') : t('Calendar.notFilledYet')}
                </p>
                {!isFutureDate && (
                    <div className="flex items-center justify-center gap-2">
                        <Link
                            href={`/today?date=${selectedDate}`}
                            className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                        >
                            {t('Calendar.fillSession')}
                        </Link>
                        <Link
                            href={`/today?date=${selectedDate}`}
                            className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                            {t('Calendar.markNotDone')}
                        </Link>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-24">
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
                        const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay()
                        const scheduledEntry = getScheduleForDayOfWeek(dayOfWeek)
                        const isToday = dateStr === todayISO
                        const isSelected = dateStr === selectedDate
                        const isSkipped = session?.notes?.startsWith('[SKIPPED]')
                        const isRescheduled = session?.notes?.startsWith('[RESCHEDULED')
                        const hasWorkoutDone = session && !isSkipped && !isRescheduled
                        const isScheduledNoSession = !session && scheduledEntry

                        return (
                            <button
                                key={index}
                                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all relative ${isSelected
                                    ? 'bg-violet-600 text-white'
                                    : isToday
                                        ? 'bg-violet-600/20 text-violet-600 dark:text-violet-300'
                                        : hasWorkoutDone
                                            ? 'text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                            : isSkipped
                                                ? 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                : isScheduledNoSession
                                                    ? 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    : 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                {day}
                                {!isSelected && hasWorkoutDone && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute bottom-1" />
                                )}
                                {!isSelected && isSkipped && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 absolute bottom-1" />
                                )}
                                {!isSelected && isScheduledNoSession && !isToday && dateStr < todayISO && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute bottom-1" />
                                )}
                                {!isSelected && isScheduledNoSession && (dateStr >= todayISO || isToday) && !isToday && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400/50 absolute bottom-1" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-4 px-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('Calendar.legendDone')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('Calendar.legendMissed')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('Calendar.legendSkipped')}</span>
                </div>
            </div>

            {selectedDate && (
                <div className="animate-[slideDown_0.2s_ease-out]">
                    {renderSelectedDayPanel()}
                </div>
            )}
        </div>
    )
}
