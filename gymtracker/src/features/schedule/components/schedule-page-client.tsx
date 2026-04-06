'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import {
    assignWorkoutToDayAction,
    clearRotationWeekAction,
    clearScheduleDayAction,
    clearScheduleRotationAction,
    createRotationWeekFromBaseAction,
    updateRotationAnchorDateAction,
    upsertScheduleRotationAction,
} from '@/features/schedule/actions'
import { buildScheduleDayPlan } from '@/features/schedule/rotation'
import type { ScheduleEntry, ScheduleRotationEntry } from '@/features/schedule/types'
import type { Workout } from '@/lib/types'
import { getLocalizedWeekdayNames } from '@/lib/utils'

interface SchedulePageClientProps {
    initialWorkouts: Workout[]
    initialSchedule: ScheduleEntry[]
    initialRotations: ScheduleRotationEntry[]
    initialRotationAnchorDate: string | null
    initialRotationCycleLength: number
    initialPreviewDateISO: string
    rotationSupportEnabled: boolean
}

function createClientMutationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getDayOfWeekFromIsoDate(dateISO: string) {
    const [year, month, day] = dateISO.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()
}

export function SchedulePageClient({
    initialWorkouts,
    initialSchedule,
    initialRotations,
    initialRotationAnchorDate,
    initialRotationCycleLength,
    initialPreviewDateISO,
    rotationSupportEnabled,
}: SchedulePageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()
    const dayNames = getLocalizedWeekdayNames(locale)
    const todayIso = useMemo(() => initialPreviewDateISO, [initialPreviewDateISO])

    const [editingDay, setEditingDay] = useState<number | null>(null)
    const [schedule, setSchedule] = useState<ScheduleEntry[]>(initialSchedule)
    const [rotations, setRotations] = useState<ScheduleRotationEntry[]>(initialRotations)
    const [rotationAnchorDate, setRotationAnchorDate] = useState(initialRotationAnchorDate ?? todayIso)
    const [rotationWeekCount, setRotationWeekCount] = useState(Math.max(initialRotationCycleLength, 1))
    const [savingAnchorDate, setSavingAnchorDate] = useState(false)
    const [pendingDays, setPendingDays] = useState<Record<number, boolean>>({})
    const [updatingCycle, setUpdatingCycle] = useState(false)
    const latestMutationByDayRef = useRef<Record<number, string>>({})

    const workouts = useMemo(() => initialWorkouts, [initialWorkouts])
    const dayPlans = useMemo(
        () =>
            Array.from({ length: 7 }, (_, dayOfWeek) =>
                buildScheduleDayPlan({
                    dayOfWeek,
                    dateISO: todayIso,
                    anchorDateISO: rotationAnchorDate,
                    baseEntry: schedule.find((item) => item.day_of_week === dayOfWeek),
                    extraRotations: rotations.filter((item) => item.day_of_week === dayOfWeek),
                    cycleLength: rotationSupportEnabled ? rotationWeekCount : 1,
                })
            ),
        [rotationAnchorDate, rotationSupportEnabled, rotationWeekCount, rotations, schedule, todayIso]
    )

    function getScheduleForDay(day: number) {
        return schedule.find((item) => item.day_of_week === day) ?? null
    }

    function getRotationEntry(day: number, rotationIndex: number) {
        return rotations.find((item) => item.day_of_week === day && item.rotation_index === rotationIndex) ?? null
    }

    function getWorkoutIdForWeek(day: number, rotationIndex: number) {
        if (rotationIndex === 1) {
            return getScheduleForDay(day)?.workout_id ?? ''
        }

        return getRotationEntry(day, rotationIndex)?.workout_id ?? getScheduleForDay(day)?.workout_id ?? ''
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
            setSchedule((prev) =>
                [...prev.filter((item) => item.day_of_week !== dayOfWeek), result.data!].sort(
                    (a, b) => a.day_of_week - b.day_of_week
                )
            )
        } finally {
            if (latestMutationByDayRef.current[dayOfWeek] === clientMutationId) {
                setPendingDays((prev) => ({ ...prev, [dayOfWeek]: false }))
            }
        }
    }

    async function handleClearDay(dayOfWeek: number) {
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
            setSchedule((prev) => prev.filter((item) => item.day_of_week !== dayOfWeek))
            setRotations((prev) => prev.filter((item) => item.day_of_week !== dayOfWeek))
        } finally {
            if (latestMutationByDayRef.current[dayOfWeek] === clientMutationId) {
                setPendingDays((prev) => ({ ...prev, [dayOfWeek]: false }))
            }
        }
    }

    async function handleAssignWeek(dayOfWeek: number, rotationIndex: number, workoutId: string) {
        if (rotationIndex === 1) {
            await handleAssignWorkout(dayOfWeek, workoutId)
            return
        }

        if (pendingDays[dayOfWeek]) {
            return
        }

        const clientMutationId = createClientMutationId()
        latestMutationByDayRef.current[dayOfWeek] = clientMutationId
        setPendingDays((prev) => ({ ...prev, [dayOfWeek]: true }))

        try {
            const result = await upsertScheduleRotationAction(dayOfWeek, rotationIndex, workoutId)

            if (latestMutationByDayRef.current[dayOfWeek] !== clientMutationId) {
                return
            }

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to save rotation', 'error')
                return
            }

            setRotations((prev) =>
                [...prev.filter((item) => !(item.day_of_week === dayOfWeek && item.rotation_index === rotationIndex)), result.data!]
                    .sort((a, b) => a.day_of_week - b.day_of_week || a.rotation_index - b.rotation_index)
            )
            showToast(t('Schedule.toastWeekSaved', { week: rotationIndex }))
        } finally {
            if (latestMutationByDayRef.current[dayOfWeek] === clientMutationId) {
                setPendingDays((prev) => ({ ...prev, [dayOfWeek]: false }))
            }
        }
    }

    async function handleInheritWeekOne(dayOfWeek: number, rotationIndex: number) {
        if (rotationIndex === 1) {
            return
        }

        const result = await clearScheduleRotationAction(dayOfWeek, rotationIndex)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to reset week', 'error')
            return
        }

        setRotations((prev) =>
            prev.filter((item) => !(item.day_of_week === dayOfWeek && item.rotation_index === rotationIndex))
        )
        showToast(t('Schedule.toastWeekInherited', { week: rotationIndex }))
    }

    async function handleSaveAnchorDate() {
        try {
            setSavingAnchorDate(true)
            const result = await updateRotationAnchorDateAction(rotationAnchorDate)

            if (!result.ok) {
                showToast(result.message ?? 'Unable to save rotation anchor date', 'error')
                return
            }

            showToast(t('Schedule.toastRotationStartSaved'))
        } finally {
            setSavingAnchorDate(false)
        }
    }

    async function handleAddWeek() {
        const nextWeek = rotationWeekCount + 1
        if (nextWeek > 12) {
            return
        }

        setUpdatingCycle(true)
        try {
            const result = await createRotationWeekFromBaseAction(nextWeek)
            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to add a new week', 'error')
                return
            }

            setRotations((prev) =>
                [...prev, ...result.data!].sort((a, b) => a.day_of_week - b.day_of_week || a.rotation_index - b.rotation_index)
            )
            setRotationWeekCount(nextWeek)
            showToast(t('Schedule.toastWeekAdded', { week: nextWeek }))
        } finally {
            setUpdatingCycle(false)
        }
    }

    async function handleRemoveLastWeek() {
        if (rotationWeekCount <= 1) {
            return
        }

        setUpdatingCycle(true)
        try {
            const result = await clearRotationWeekAction(rotationWeekCount)
            if (!result.ok) {
                showToast(result.message ?? 'Unable to remove the week', 'error')
                return
            }

            setRotations((prev) => prev.filter((item) => item.rotation_index !== rotationWeekCount))
            setRotationWeekCount((prev) => Math.max(prev - 1, 1))
            showToast(t('Schedule.toastWeekRemoved', { week: rotationWeekCount }))
        } finally {
            setUpdatingCycle(false)
        }
    }

    const today = useMemo(() => getDayOfWeekFromIsoDate(todayIso), [todayIso])

    return (
        <div className="px-4 pt-6 pb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">{t('Schedule.title')}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('Schedule.subtitle')}</p>

            <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800/50 dark:bg-zinc-900">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t('Schedule.rotationTitle')}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {rotationSupportEnabled ? t('Schedule.rotationDescription') : t('Schedule.rotationUnavailable')}
                            </p>
                        </div>
                        {rotationSupportEnabled && (
                            <div className="flex flex-col gap-2 sm:items-end">
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('Schedule.rotationStart')}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={rotationAnchorDate}
                                        onChange={(event) => setRotationAnchorDate(event.target.value)}
                                        className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                    />
                                    <button
                                        onClick={handleSaveAnchorDate}
                                        disabled={savingAnchorDate}
                                        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                                    >
                                        {t('Common.save')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {rotationSupportEnabled && (
                        <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                        {t('Schedule.cycleWeeksTitle', { count: rotationWeekCount })}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {t('Schedule.cycleWeeksDescription')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleRemoveLastWeek}
                                        disabled={updatingCycle || rotationWeekCount <= 1}
                                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                    >
                                        {t('Schedule.removeWeek')}
                                    </button>
                                    <button
                                        onClick={handleAddWeek}
                                        disabled={updatingCycle || rotationWeekCount >= 12}
                                        className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                                    >
                                        {t('Schedule.addWeek')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {workouts.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-1">{t('Schedule.noWorkouts')}</p>
                    <p className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-xs">{t('Schedule.goToWorkouts')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {dayNames.map((dayName, dayIndex) => {
                        const baseSlot = getScheduleForDay(dayIndex)
                        const dayPlan = dayPlans[dayIndex]
                        const isToday = dayIndex === today
                        const isEditing = editingDay === dayIndex
                        const isPending = !!pendingDays[dayIndex]

                        return (
                            <div key={dayIndex}>
                                <button
                                    disabled={isPending}
                                    onClick={() => setEditingDay(isEditing ? null : dayIndex)}
                                    className={`w-full text-left rounded-2xl p-4 transition-all ${
                                        isToday
                                            ? 'bg-violet-600/10 border-2 border-violet-600/30'
                                            : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-700'
                                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-base font-semibold ${isToday ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-900 dark:text-white'}`}>
                                                    {dayName}
                                                </span>
                                                {isToday && (
                                                    <span className="text-[10px] bg-violet-600 text-white px-1.5 py-0.5 rounded-md font-semibold uppercase">
                                                        {t('Schedule.todayText')}
                                                    </span>
                                                )}
                                                {rotationSupportEnabled && rotationWeekCount > 1 && dayPlan.activeRotationIndex && (
                                                    <span className="text-[10px] rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-semibold uppercase text-emerald-600 dark:text-emerald-300">
                                                        {t('Schedule.activeWeekBadge', {
                                                            week: dayPlan.activeRotationIndex,
                                                            count: rotationWeekCount,
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm mt-0.5 ${dayPlan.activeVariant ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-500'}`}>
                                                {dayPlan.activeVariant ? dayPlan.activeVariant.workout.name : t('Schedule.restDay')}
                                            </p>
                                            {rotationSupportEnabled && rotationWeekCount > 1 && (
                                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                    {t('Schedule.cycleWeeksLabel', { count: rotationWeekCount })}
                                                </p>
                                            )}
                                        </div>
                                        <svg
                                            className={`w-4 h-4 text-zinc-500 transition-transform ${isEditing ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth={2}
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                        </svg>
                                    </div>
                                </button>

                                {isEditing && (
                                    <div className="mt-1 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                                        <div className="space-y-4">
                                            {Array.from({ length: rotationSupportEnabled ? rotationWeekCount : 1 }, (_, index) => {
                                                const weekNumber = index + 1
                                                const currentWorkoutId = getWorkoutIdForWeek(dayIndex, weekNumber)
                                                const canEditWeek = weekNumber === 1 || !!baseSlot

                                                return (
                                                    <div key={`${dayIndex}-${weekNumber}`} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                                                        <div className="mb-2 flex items-center justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                                                    {t('Schedule.weekLabel', { week: weekNumber })}
                                                                </p>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                                    {weekNumber === 1
                                                                        ? t('Schedule.weekOneDescription')
                                                                        : t('Schedule.weekVariantDescription')}
                                                                </p>
                                                            </div>
                                                            {weekNumber === 1 ? (
                                                                baseSlot && (
                                                                    <button
                                                                        disabled={isPending}
                                                                        onClick={() => handleClearDay(dayIndex)}
                                                                        className="text-xs font-medium text-red-500 hover:text-red-400 disabled:opacity-50"
                                                                    >
                                                                        {t('Schedule.clearDay')}
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <button
                                                                    disabled={isPending || !baseSlot}
                                                                    onClick={() => handleInheritWeekOne(dayIndex, weekNumber)}
                                                                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-white"
                                                                >
                                                                    {t('Schedule.inheritWeekOne')}
                                                                </button>
                                                            )}
                                                        </div>

                                                        <select
                                                            disabled={isPending || !canEditWeek}
                                                            value={currentWorkoutId}
                                                            onChange={(event) => event.target.value && handleAssignWeek(dayIndex, weekNumber, event.target.value)}
                                                            className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                                        >
                                                            <option value="" disabled>
                                                                {weekNumber === 1 ? t('Schedule.selectWorkout') : t('Schedule.selectWeekWorkout')}
                                                            </option>
                                                            {workouts.map((workout) => (
                                                                <option key={workout.id} value={workout.id}>
                                                                    {workout.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {!canEditWeek && (
                                                            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                                                {t('Schedule.defineWeekOneFirst')}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
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
