'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import {
    deleteWorkoutSessionFromCalendarAction,
    getCalendarMonthAction,
    getSessionSetsAction,
    skipWorkoutFromCalendarAction,
    undoSkipFromCalendarAction,
} from '@/features/calendar/actions'
import { buildCalendarWeeklySummaries } from '@/features/calendar/metrics'
import type {
    CalendarSessionMetrics,
    ScheduleEntry,
    ScheduleRotationEntry,
    SessionWithDetails,
    SetLogWithExercise,
} from '@/features/calendar/types'
import { buildScheduleDayPlan } from '@/features/schedule/rotation'
import {
    buildSkippedWorkoutSessionNote,
    parseWorkoutSessionStatus,
    removeSkippedWorkoutSessionNote,
} from '@/lib/workout-session-status'
import { formatMonthYear, getLocalizedWeekdayNames } from '@/lib/utils'

interface CalendarPageClientProps {
    initialDate: string
    initialSessions: SessionWithDetails[]
    initialSchedule: ScheduleEntry[]
    initialRotations: ScheduleRotationEntry[]
    initialRotationAnchorDate: string | null
    initialRotationCycleLength: number
    rotationSupportEnabled: boolean
    initialSessionMetricsById: Record<string, CalendarSessionMetrics>
    initialTodayISO: string
}

const EMPTY_SESSION_METRICS: CalendarSessionMetrics = {
    setCount: 0,
    totalVolume: 0,
    exerciseCount: 0,
    cardioCount: 0,
}

function formatCalendarRangeLabel(startISO: string, endISO: string, locale: string) {
    const start = new Date(`${startISO}T00:00:00`)
    const end = new Date(`${endISO}T00:00:00`)
    const formatter = new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'short',
    })

    if (startISO === endISO) {
        return formatter.format(start)
    }

    return `${formatter.format(start)} - ${formatter.format(end)}`
}

function formatSessionDateLabel(dateISO: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(`${dateISO}T00:00:00`))
}

export function CalendarPageClient({
    initialDate,
    initialSessions,
    initialSchedule,
    initialRotations,
    initialRotationAnchorDate,
    initialRotationCycleLength,
    rotationSupportEnabled,
    initialSessionMetricsById,
    initialTodayISO,
}: CalendarPageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()

    const [currentDate, setCurrentDate] = useState(new Date(`${initialDate}T00:00:00`))
    const [sessions, setSessions] = useState<SessionWithDetails[]>(initialSessions)
    const [schedule, setSchedule] = useState<ScheduleEntry[]>(initialSchedule)
    const [rotations, setRotations] = useState<ScheduleRotationEntry[]>(initialRotations)
    const [rotationAnchorDate, setRotationAnchorDate] = useState<string | null>(initialRotationAnchorDate)
    const [rotationCycleLength, setRotationCycleLength] = useState(initialRotationCycleLength)
    const [todayISO, setTodayISO] = useState(initialTodayISO)
    const [sessionMetricsById, setSessionMetricsById] = useState<Record<string, CalendarSessionMetrics>>(initialSessionMetricsById)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [sessionSets, setSessionSets] = useState<SetLogWithExercise[]>([])
    const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadingSets, setLoadingSets] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const dayNamesShort = getLocalizedWeekdayNames(locale, 'short')
    const monthName = formatMonthYear(currentDate, locale)

    const sessionsByDate = useMemo(
        () =>
            sessions.reduce<Map<string, SessionWithDetails[]>>((accumulator, session) => {
                const currentSessions = accumulator.get(session.performed_at) ?? []
                currentSessions.push(session)
                currentSessions.sort((left, right) => right.created_at.localeCompare(left.created_at))
                accumulator.set(session.performed_at, currentSessions)
                return accumulator
            }, new Map()),
        [sessions]
    )

    const getSessionMetrics = useCallback(
        (sessionId: string) => sessionMetricsById[sessionId] ?? EMPTY_SESSION_METRICS,
        [sessionMetricsById]
    )

    const getDayPlanForDate = useCallback((dateISO: string) => {
        const dayOfWeek = new Date(`${dateISO}T00:00:00`).getDay()
        return buildScheduleDayPlan({
            dayOfWeek,
            dateISO,
            anchorDateISO: rotationSupportEnabled ? rotationAnchorDate : null,
            baseEntry: schedule.find((entry) => entry.day_of_week === dayOfWeek),
            extraRotations: rotationSupportEnabled
                ? rotations.filter((entry) => entry.day_of_week === dayOfWeek)
                : [],
            cycleLength: rotationSupportEnabled ? rotationCycleLength : 1,
        })
    }, [rotationAnchorDate, rotationCycleLength, rotationSupportEnabled, rotations, schedule])

    const weeklySummaries = useMemo(
        () =>
            buildCalendarWeeklySummaries({
                year,
                month,
                todayISO,
                sessions,
                schedule,
                rotations,
                rotationAnchorDate,
                rotationCycleLength,
                rotationSupportEnabled,
                sessionMetricsById,
            }),
        [
            month,
            rotationAnchorDate,
            rotationCycleLength,
            rotationSupportEnabled,
            rotations,
            schedule,
            sessionMetricsById,
            sessions,
            todayISO,
            year,
        ]
    )

    const selectedDateSessions = useMemo(() => {
        if (!selectedDate) {
            return []
        }

        return sessionsByDate.get(selectedDate) ?? []
    }, [selectedDate, sessionsByDate])

    const resolvedSelectedSessionId = useMemo(() => {
        if (selectedDateSessions.length === 0) {
            return null
        }

        if (selectedSessionId && selectedDateSessions.some((session) => session.id === selectedSessionId)) {
            return selectedSessionId
        }

        return (
            selectedDateSessions.find((session) => {
                const metrics = getSessionMetrics(session.id)
                return metrics.setCount > 0 || metrics.cardioCount > 0
            })
            ?? selectedDateSessions[0]
        ).id
    }, [getSessionMetrics, selectedDateSessions, selectedSessionId])

    const selectedSession = useMemo(
        () => selectedDateSessions.find((session) => session.id === resolvedSelectedSessionId) ?? null,
        [resolvedSelectedSessionId, selectedDateSessions]
    )

    const selectedSessionStatus = useMemo(
        () => parseWorkoutSessionStatus(selectedSession?.notes),
        [selectedSession?.notes]
    )

    const selectedSessionMetrics = useMemo(
        () => (selectedSession ? getSessionMetrics(selectedSession.id) : EMPTY_SESSION_METRICS),
        [getSessionMetrics, selectedSession]
    )

    const shouldLoadSets = !!selectedSession
        && selectedSessionMetrics.setCount > 0
        && selectedSessionStatus.kind !== 'skipped'
        && selectedSessionStatus.kind !== 'rescheduled_to'

    const visibleSessionSets = useMemo(
        () => (selectedSession && shouldLoadSets && loadedSessionId === selectedSession.id ? sessionSets : []),
        [loadedSessionId, selectedSession, sessionSets, shouldLoadSets]
    )

    const scheduledWorkoutForSelectedDay = useMemo(() => {
        if (!selectedDate) {
            return null
        }

        return getDayPlanForDate(selectedDate).activeVariant?.workout ?? null
    }, [getDayPlanForDate, selectedDate])

    useEffect(() => {
        if (!shouldLoadSets || !selectedSession) {
            return
        }

        const session = selectedSession
        let cancelled = false

        async function loadSessionSets() {
            setLoadingSets(true)
            setLoadedSessionId(null)
            const result = await getSessionSetsAction(session.id)
            if (cancelled) {
                return
            }

            setLoadingSets(false)

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to load session details', 'error')
                return
            }

            setLoadedSessionId(session.id)
            setSessionSets(result.data)
        }

        void loadSessionSets()

        return () => {
            cancelled = true
        }
    }, [selectedSession, shouldLoadSets, showToast])

    const groupedSets = useMemo(
        () =>
            visibleSessionSets.reduce<Record<string, { name: string; sets: SetLogWithExercise[] }>>((accumulator, setLog) => {
      const exerciseName = setLog.exercises?.display_name ?? '(deleted)'
                const currentGroup = accumulator[setLog.exercise_id]

                if (!currentGroup) {
                    accumulator[setLog.exercise_id] = {
                        name: exerciseName,
                        sets: [setLog],
                    }
                    return accumulator
                }

                currentGroup.sets.push(setLog)
                return accumulator
            }, {}),
        [visibleSessionSets]
    )

    async function goToMonth(nextDate: Date) {
        setLoading(true)
        const result = await getCalendarMonthAction(nextDate.getFullYear(), nextDate.getMonth())
        setLoading(false)

        if (!result.ok || !result.data) {
            showToast(result.message ?? 'Unable to load calendar', 'error')
            return
        }

        setSelectedDate(null)
        setSelectedSessionId(null)
        setSessionSets([])
        setLoadedSessionId(null)
        setLoadingSets(false)
        setCurrentDate(nextDate)
        setSessions(result.data.sessions)
        setSchedule(result.data.schedule)
        setRotations(result.data.rotations)
        setRotationAnchorDate(result.data.rotationAnchorDate)
        setRotationCycleLength(result.data.rotationCycleLength)
        setTodayISO(result.data.todayISO)
        setSessionMetricsById(result.data.sessionMetricsById)
    }

    async function handleSkip() {
        if (!selectedSession || actionLoading) {
            return
        }

        setActionLoading(true)
        const result = await skipWorkoutFromCalendarAction(selectedSession.id)
        setActionLoading(false)

        if (!result.ok) {
            showToast(result.message ?? 'Error', 'error')
            return
        }

        showToast(t('Calendar.workoutSkipped'))
        setSessions((prev) =>
            prev.map((session) =>
                session.id === selectedSession.id
                    ? { ...session, notes: buildSkippedWorkoutSessionNote(session.notes) }
                    : session
            )
        )
        setSessionMetricsById((prev) => ({
            ...prev,
            [selectedSession.id]: EMPTY_SESSION_METRICS,
        }))
        setSessionSets([])
        setLoadedSessionId(null)
        setLoadingSets(false)
    }

    async function handleUndoSkip() {
        if (!selectedSession || actionLoading) {
            return
        }

        setActionLoading(true)
        const result = await undoSkipFromCalendarAction(selectedSession.id)
        setActionLoading(false)

        if (!result.ok) {
            showToast(result.message ?? 'Error', 'error')
            return
        }

        showToast(t('Calendar.skipUndone'))
        setSessions((prev) =>
            prev.map((session) =>
                session.id === selectedSession.id
                    ? { ...session, notes: removeSkippedWorkoutSessionNote(session.notes) }
                    : session
            )
        )
    }

    async function handleDeleteSession() {
        if (!selectedSession) {
            return
        }

        setActionLoading(true)
        const result = await deleteWorkoutSessionFromCalendarAction(selectedSession.id)
        setActionLoading(false)

        if (!result.ok) {
            showToast(result.message ?? 'Unable to delete session', 'error')
            return
        }

        setShowDeleteDialog(false)
        setSessions((prev) => prev.filter((session) => session.id !== selectedSession.id))
        setSessionMetricsById((prev) => {
            const nextMetrics = { ...prev }
            delete nextMetrics[selectedSession.id]
            return nextMetrics
        })
        setSessionSets([])
        setLoadedSessionId(null)
        setLoadingSets(false)
        showToast(t('Calendar.workoutDeleted'))
    }

    function prevMonth() {
        void goToMonth(new Date(year, month - 1, 1))
    }

    function nextMonth() {
        void goToMonth(new Date(year, month + 1, 1))
    }

    function getSessionsForDate(dateISO: string) {
        return sessionsByDate.get(dateISO) ?? []
    }

    function renderHistoricalActions(hasLogs: boolean) {
        if (!selectedDate || !selectedSession) {
            return null
        }

        return (
            <div className="flex flex-wrap gap-2">
                <Link
                    href={`/today?date=${selectedDate}`}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                >
                    {hasLogs ? t('Calendar.editSession') : t('Calendar.fillSession')}
                </Link>
                <button
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-500/10 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                    {t('Calendar.deleteSession')}
                </button>
            </div>
        )
    }

    function renderSessionSwitcher() {
        if (selectedDateSessions.length <= 1) {
            return null
        }

        return (
            <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedDateSessions.map((session, index) => {
                    const sessionStatus = parseWorkoutSessionStatus(session.notes)
                    const isActive = session.id === selectedSession?.id
                    const metrics = getSessionMetrics(session.id)
                    const statusLabel =
                        sessionStatus.kind === 'skipped'
                            ? t('Calendar.legendSkipped')
                            : sessionStatus.kind === 'rescheduled_to'
                                ? t('Calendar.legendRescheduled')
                                : metrics.setCount > 0
                                    ? `${metrics.setCount} ${t('Calendar.totalSets').toLowerCase()}`
                                    : t('Calendar.pendingSession')

                    return (
                        <button
                            key={session.id}
                            onClick={() => setSelectedSessionId(session.id)}
                            className={`min-w-[180px] rounded-2xl border px-3 py-2 text-left transition-colors ${
                                isActive
                                    ? 'border-violet-500/50 bg-violet-600/10'
                                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
                            }`}
                        >
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                {session.workouts?.name ?? `${t('Calendar.workout')} ${index + 1}`}
                            </p>
                            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{statusLabel}</p>
                        </button>
                    )
                })}
            </div>
        )
    }

    function renderSelectedDayPanel() {
        if (!selectedDate) {
            return null
        }

        if (selectedSession) {
            const displayNotes =
                selectedSessionStatus.kind === 'normal'
                    ? selectedSession.notes
                    : selectedSessionStatus.details
            const hasStrengthLogs = selectedSessionMetrics.setCount > 0
            const hasLogs = hasStrengthLogs || selectedSessionMetrics.cardioCount > 0

            return (
                <div className="space-y-3">
                    {renderSessionSwitcher()}

                    {selectedSessionStatus.kind === 'skipped' ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">🛋️</span>
                            </div>
                            <h3 className="text-base font-semibold text-zinc-500 dark:text-zinc-400 line-through mb-1">
                                {selectedSession.workouts?.name ?? t('Calendar.workout')}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{t('Calendar.workoutWasSkipped')}</p>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={handleUndoSkip}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                >
                                    {actionLoading ? t('Common.loading') : t('Calendar.undoSkip')}
                                </button>
                                <button
                                    onClick={() => setShowDeleteDialog(true)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-500/10 text-red-500 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                >
                                    {t('Calendar.deleteSession')}
                                </button>
                            </div>
                        </div>
                    ) : selectedSessionStatus.kind === 'rescheduled_to' ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">📅</span>
                            </div>
                            <h3 className="text-base font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                                {selectedSession.workouts?.name ?? t('Calendar.workout')}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                                {t('Calendar.rescheduledToDay', {
                                    day: selectedSessionStatus.label ?? t('Calendar.rescheduled'),
                                })}
                            </p>
                            {selectedSessionStatus.dateISO && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                                    {t('Calendar.rescheduledTargetDate', { date: selectedSessionStatus.dateISO })}
                                </p>
                            )}
                            {displayNotes && (
                                <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{displayNotes}</p>
                            )}
                            {renderHistoricalActions(false)}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                                            {selectedSession.workouts?.name ?? t('Calendar.workout')}
                                        </h3>
                                        {selectedSessionStatus.kind === 'rescheduled_from' && (
                                            <span className="rounded-md bg-violet-600/10 px-2 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                                                {t('Calendar.rescheduledFromDay', {
                                                    day: selectedSessionStatus.label ?? t('Calendar.rescheduled'),
                                                })}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {formatSessionDateLabel(selectedDate, locale)}
                                    </p>
                                </div>
                                {rotationSupportEnabled && scheduledWorkoutForSelectedDay && (
                                    <span className="rounded-md bg-violet-600/10 px-2 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300">
                                        {t('Calendar.scheduledWorkoutLabel', { workout: scheduledWorkoutForSelectedDay.name })}
                                    </span>
                                )}
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
                                        {renderHistoricalActions(false)}
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
                                <>
                                    <div className={`grid gap-3 px-4 py-4 border-b border-zinc-200 dark:border-zinc-800/50 ${selectedSessionMetrics.cardioCount > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.totalSets')}</p>
                                            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{selectedSessionMetrics.setCount}</p>
                                        </div>
                                        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.totalExercises')}</p>
                                            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{selectedSessionMetrics.exerciseCount}</p>
                                        </div>
                                        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.totalVolume')}</p>
                                            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                                                {selectedSessionMetrics.totalVolume.toLocaleString()}
                                            </p>
                                        </div>
                                        {selectedSessionMetrics.cardioCount > 0 && (
                                            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.totalCardio')}</p>
                                                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{selectedSessionMetrics.cardioCount}</p>
                                            </div>
                                        )}
                                    </div>

                                    {!hasStrengthLogs && selectedSessionMetrics.cardioCount > 0 ? (
                                        <div className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                            {t('Calendar.cardioLogged')}
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
                                                                <span className="text-zinc-600 dark:text-zinc-400 mx-1">x</span>
                                                                <span className="text-zinc-900 dark:text-white font-semibold">{setLog.reps}</span>
                                                                <span className="text-zinc-500 dark:text-zinc-400">{t('Calendar.reps')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {displayNotes && (
                                <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50">
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 font-semibold">{t('Calendar.notes')}</p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{displayNotes}</p>
                                </div>
                            )}

                            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50 flex flex-wrap gap-2">
                                {renderHistoricalActions(hasLogs)}
                                {hasLogs && (
                                    <button
                                        onClick={handleSkip}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-red-500/10 text-red-400 text-sm font-semibold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? '...' : t('Calendar.markNotDone')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
        }

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
                    <Link
                        href={`/today?date=${selectedDate}`}
                        className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                    >
                        {t('Calendar.fillSession')}
                    </Link>
                )}
            </div>
        )
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const calendarDays: (number | null)[] = []
    for (let index = 0; index < firstDayOfMonth; index += 1) {
        calendarDays.push(null)
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        calendarDays.push(day)
    }

    if (loading) {
        return (
            <div className="px-4 pt-6 pb-8">
                <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-4" />
                <div className="h-72 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
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

            <div className="mb-4 space-y-3">
                {weeklySummaries.map((summary) => {
                    const adherencePercentage = summary.adherenceRate == null
                        ? null
                        : Math.round(summary.adherenceRate * 100)

                    return (
                        <div key={summary.weekIndex} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                        {t('Calendar.weekSummaryTitle', { week: summary.weekIndex + 1 })}
                                    </p>
                                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                                        {formatCalendarRangeLabel(summary.weekStartISO, summary.weekEndISO, locale)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-zinc-900 dark:text-white">
                                        {adherencePercentage == null ? '—' : `${adherencePercentage}%`}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.adherence')}</p>
                                </div>
                            </div>

                            <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-violet-500"
                                    style={{ width: `${adherencePercentage ?? 0}%` }}
                                />
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.completedPlanned')}</p>
                                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                                        {summary.completedCount}/{summary.elapsedScheduledCount || summary.scheduledCount}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t('Calendar.weeklyVolume')}</p>
                                    <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                                        {summary.totalVolume.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                                <span>{t('Calendar.pendingCount', { count: summary.pendingCount })}</span>
                                <span>{t('Calendar.skippedCount', { count: summary.skippedCount })}</span>
                                <span>{t('Calendar.upcomingCount', { count: summary.upcomingCount })}</span>
                                <span>{t('Calendar.movedCount', { count: summary.movedCount })}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-3 mb-4">
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {dayNamesShort.map((dayName) => (
                        <div key={dayName} className="text-center text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 py-1">
                            {dayName}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        if (day === null) {
                            return <div key={index} />
                        }

                        const dateISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const daySessions = getSessionsForDate(dateISO)
                        const dayPlan = getDayPlanForDate(dateISO)
                        const scheduledWorkout = dayPlan.activeVariant?.workout ?? null
                        const isToday = dateISO === todayISO
                        const isSelected = dateISO === selectedDate
                        const hasCompletedSession = daySessions.some((session) => {
                            const status = parseWorkoutSessionStatus(session.notes)
                            return status.kind !== 'skipped'
                                && status.kind !== 'rescheduled_to'
                                && getSessionMetrics(session.id).setCount > 0
                        })
                        const hasSkippedSession = !hasCompletedSession && daySessions.some((session) => parseWorkoutSessionStatus(session.notes).kind === 'skipped')
                        const hasRescheduledSource = !hasCompletedSession && daySessions.some((session) => parseWorkoutSessionStatus(session.notes).kind === 'rescheduled_to')
                        const hasPendingActionableSession = daySessions.some((session) => {
                            const status = parseWorkoutSessionStatus(session.notes)
                            return status.kind !== 'skipped'
                                && status.kind !== 'rescheduled_to'
                                && getSessionMetrics(session.id).setCount === 0
                        })
                        const isScheduledNoSession = daySessions.length === 0 && !!scheduledWorkout
                        const isMissed = !hasCompletedSession
                            && !hasSkippedSession
                            && !hasRescheduledSource
                            && (isScheduledNoSession || hasPendingActionableSession)
                            && !isToday
                            && dateISO < todayISO
                        const isFuturePlanned = !hasCompletedSession
                            && !hasSkippedSession
                            && (isScheduledNoSession || hasPendingActionableSession)
                            && dateISO > todayISO

                        return (
                            <button
                                key={index}
                                onClick={() => {
                                    setSelectedDate(dateISO === selectedDate ? null : dateISO)
                                    if (dateISO !== selectedDate) {
                                        setSelectedSessionId(null)
                                    }
                                }}
                                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium transition-all relative ${
                                    isSelected
                                        ? 'bg-violet-600 text-white'
                                        : isToday
                                            ? 'bg-violet-600/20 text-violet-600 dark:text-violet-300'
                                            : hasCompletedSession
                                                ? 'text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                : hasSkippedSession
                                                    ? 'text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                    : isMissed
                                                        ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {day}
                                {daySessions.length > 1 && !isSelected && (
                                    <span className="absolute top-1 right-1 rounded-full bg-zinc-900/80 px-1 py-0.5 text-[9px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                                        {daySessions.length}
                                    </span>
                                )}
                                {!isSelected && hasCompletedSession && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute bottom-1" />
                                )}
                                {!isSelected && hasSkippedSession && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 absolute bottom-1" />
                                )}
                                {!isSelected && hasRescheduledSource && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 absolute bottom-1" />
                                )}
                                {!isSelected && isMissed && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute bottom-1" />
                                )}
                                {!isSelected && isFuturePlanned && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 absolute bottom-1" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

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
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('Calendar.legendRescheduled')}</span>
                </div>
            </div>

            {selectedDate && (
                <div className="animate-[slideDown_0.2s_ease-out]">
                    {renderSelectedDayPanel()}
                </div>
            )}

            <ConfirmDialog
                open={showDeleteDialog}
                title={t('Calendar.deleteSessionTitle')}
                description={t('Calendar.deleteSessionDescription')}
                confirmLabel={t('Common.delete')}
                variant="danger"
                onConfirm={handleDeleteSession}
                onCancel={() => setShowDeleteDialog(false)}
            />
        </div>
    )
}
