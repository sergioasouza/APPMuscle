'use client'

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { getLocalizedWeekdayNames } from '@/lib/utils'
import {
    getTodayViewAction,
    listUserWorkoutsAction,
    rescheduleWorkoutAction,
    saveSessionNotesAction,
    saveSetAction,
    skipWorkoutAction,
    switchWorkoutForDayAction,
    undoSkipWorkoutAction,
} from '@/features/today/actions'
import type { Workout, WorkoutSession } from '@/lib/types'
import type { ExerciseLogSetState, ExerciseLogState, TodayViewData } from '@/features/today/types'

interface PendingSetQueueItem {
    clientId: string
    clientMutationId: string
    dateISO: string
    sessionId: string
    exerciseId: string
    setNumber: number
    weight: number
    reps: number
    setLogId?: string
}

interface SetPatchMutation {
    exerciseIndex: number
    setIndex: number
    patch: Partial<ExerciseLogSetState>
}

const PENDING_SET_QUEUE_KEY = 'gymtracker.pending-set-queue'

interface TodayPageClientProps {
    dateISO: string
    dayOfWeek: number
    isHistorical: boolean
    initialData: TodayViewData
}

function cloneLogs(logs: ExerciseLogState[]) {
    return logs.map((log) => ({
        ...log,
        sets: log.sets.map((set) => ({ ...set })),
    }))
}

function readPendingQueue(): PendingSetQueueItem[] {
    if (typeof window === 'undefined') {
        return []
    }

    try {
        const raw = window.localStorage.getItem(PENDING_SET_QUEUE_KEY)
        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
            return []
        }

        return parsed.map((item) => ({
            ...item,
            clientMutationId:
                typeof item?.clientMutationId === 'string'
                    ? item.clientMutationId
                    : `${item?.sessionId ?? 'unknown'}:${item?.exerciseId ?? 'unknown'}:${item?.setNumber ?? '0'}`,
        }))
    } catch {
        return []
    }
}

function writePendingQueue(queue: PendingSetQueueItem[]) {
    if (typeof window === 'undefined') {
        return
    }

    if (queue.length === 0) {
        window.localStorage.removeItem(PENDING_SET_QUEUE_KEY)
        return
    }

    window.localStorage.setItem(PENDING_SET_QUEUE_KEY, JSON.stringify(queue))
}

function upsertQueueItem(queue: PendingSetQueueItem[], item: PendingSetQueueItem) {
    const nextQueue = queue.filter((queueItem) => !(
        queueItem.sessionId === item.sessionId
        && queueItem.exerciseId === item.exerciseId
        && queueItem.setNumber === item.setNumber
    ))

    nextQueue.push(item)
    return nextQueue
}

function removeQueueItem(queue: PendingSetQueueItem[], item: PendingSetQueueItem) {
    return queue.filter((queueItem) => queueItem.clientId !== item.clientId)
}

function setMutationKey(exerciseId: string, setNumber: number) {
    return `${exerciseId}:${setNumber}`
}

function createClientMutationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isOfflineLikeError(message?: string) {
    if (!message) {
        return false
    }

    const normalized = message.toLowerCase()
    return normalized.includes('failed to fetch')
        || normalized.includes('networkerror')
        || normalized.includes('network request failed')
        || normalized.includes('fetch failed')
        || normalized.includes('load failed')
}

function applyPendingStateToLogsForSession(
    logs: ExerciseLogState[],
    queue: PendingSetQueueItem[],
    sessionId: string | null | undefined,
    dateISO: string
) {
    if (!sessionId) {
        return logs
    }

    const sessionQueue = queue.filter((item) => item.sessionId === sessionId && item.dateISO === dateISO)
    if (sessionQueue.length === 0) {
        return logs
    }

    return logs.map((log) => ({
        ...log,
        sets: log.sets.map((set, index) => {
            const match = sessionQueue.find((item) => item.exerciseId === log.exerciseId && item.setNumber === index + 1)
            if (!match) {
                return set
            }

            return {
                ...set,
                id: match.setLogId ?? set.id,
                weight: String(match.weight),
                reps: String(match.reps),
                saved: true,
                saving: false,
                pendingSync: true,
            }
        }),
    }))
}

function applySetPatch(
    logs: ExerciseLogState[],
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<ExerciseLogSetState>
) {
    return logs.map((log, logIndex) => {
        if (logIndex !== exerciseIndex) return log

        return {
            ...log,
            sets: log.sets.map((set, currentIndex): ExerciseLogSetState => {
                if (currentIndex !== setIndex) return set

                return {
                    ...set,
                    ...patch,
                }
            }),
        }
    })
}

export function TodayPageClient({ dateISO, dayOfWeek, isHistorical, initialData }: TodayPageClientProps) {
    const t = useTranslations()
    const locale = useLocale()
    const { showToast } = useToast()
    const dayNames = getLocalizedWeekdayNames(locale)

    const [loading, setLoading] = useState(false)
    const [workout, setWorkout] = useState<Workout | null>(initialData.workout)
    const [session, setSession] = useState<WorkoutSession | null>(initialData.session)
    const [pendingQueue, setPendingQueue] = useState<PendingSetQueueItem[]>(() => readPendingQueue())
    const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>(() => applyPendingStateToLogsForSession(
        initialData.exerciseLogs,
        readPendingQueue(),
        initialData.session?.id,
        dateISO
    ))
    const [notes, setNotes] = useState(initialData.notes)
    const [showOverrideModal, setShowOverrideModal] = useState(false)
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
    const [showRescheduleModal, setShowRescheduleModal] = useState(false)
    const [loadingWorkouts, setLoadingWorkouts] = useState(false)
    const latestMutationRef = useRef<Record<string, string>>({})
    const [optimisticExerciseLogs, addOptimisticSetPatch] = useOptimistic(
        exerciseLogs,
        (currentLogs, mutation: SetPatchMutation) =>
            applySetPatch(currentLogs, mutation.exerciseIndex, mutation.setIndex, mutation.patch)
    )

    const commitSetPatch = useCallback(
        (
            exerciseIndex: number,
            setIndex: number,
            patch: Partial<ExerciseLogSetState>,
            options?: { optimistic?: boolean }
        ) => {
            if (options?.optimistic !== false) {
                addOptimisticSetPatch({
                    exerciseIndex,
                    setIndex,
                    patch,
                })
            }

            setExerciseLogs((prev) => applySetPatch(prev, exerciseIndex, setIndex, patch))
        },
        [addOptimisticSetPatch]
    )

    const applyPendingStateToLogs = useCallback((logs: ExerciseLogState[], queue: PendingSetQueueItem[]) => {
        return applyPendingStateToLogsForSession(logs, queue, session?.id, dateISO)
    }, [dateISO, session])

    const processPendingQueue = useCallback(async (shouldNotifyOnSuccess = false) => {
        const queue = readPendingQueue()
        if (queue.length === 0) {
            setPendingQueue([])
            return
        }

        let nextQueue = [...queue]
        let syncedCount = 0

        for (const item of queue) {
            const result = await saveSetAction({
                sessionId: item.sessionId,
                exerciseId: item.exerciseId,
                setNumber: item.setNumber,
                weight: item.weight,
                reps: item.reps,
                setLogId: item.setLogId,
            })

            if (!result.ok || !result.data) {
                continue
            }

            syncedCount += 1
            nextQueue = removeQueueItem(nextQueue, item)

            const mutationKey = setMutationKey(item.exerciseId, item.setNumber)
            const latestMutationId = latestMutationRef.current[mutationKey]
            if (latestMutationId && latestMutationId !== item.clientMutationId) {
                continue
            }

            if (session?.id === item.sessionId && item.dateISO === dateISO) {
                setExerciseLogs((prev) => prev.map((log) => {
                    if (log.exerciseId !== item.exerciseId) return log

                    return {
                        ...log,
                        sets: log.sets.map((set, index) => {
                            if (index !== item.setNumber - 1) return set

                            return {
                                ...set,
                                id: result.data!.id,
                                weight: String(item.weight),
                                reps: String(item.reps),
                                saved: true,
                                saving: false,
                                pendingSync: false,
                            }
                        }),
                    }
                }))
            }
        }

        writePendingQueue(nextQueue)
        setPendingQueue(nextQueue)

        if (syncedCount > 0 && shouldNotifyOnSuccess) {
            showToast(t('Today.toastQueuedSetsSynced'))
        }

        if (nextQueue.length > 0 && shouldNotifyOnSuccess) {
            showToast(t('Today.toastQueuedSetsSyncFailed'), 'error')
        }
    }, [dateISO, session?.id, showToast, t])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const handleOnline = () => {
            void processPendingQueue(true)
        }

        window.addEventListener('online', handleOnline)

        let syncTimeout: number | null = null

        if (navigator.onLine && pendingQueue.length > 0) {
            syncTimeout = window.setTimeout(() => {
                void processPendingQueue(false)
            }, 0)
        }

        return () => {
            if (syncTimeout) {
                window.clearTimeout(syncTimeout)
            }
            window.removeEventListener('online', handleOnline)
        }
    }, [pendingQueue.length, processPendingQueue])

    async function refreshTodayView() {
        setLoading(true)
        const result = await getTodayViewAction(dateISO, dayOfWeek)
        setLoading(false)

        if (!result.ok || !result.data) {
            showToast(result.message ?? 'Unable to refresh workout', 'error')
            return
        }

        setWorkout(result.data.workout)
        setSession(result.data.session)
        setExerciseLogs(applyPendingStateToLogs(result.data.exerciseLogs, pendingQueue))
        setNotes(result.data.notes)
    }

    async function loadAllWorkouts() {
        if (allWorkouts.length > 0 || loadingWorkouts) {
            return
        }

        setLoadingWorkouts(true)
        const result = await listUserWorkoutsAction()
        setLoadingWorkouts(false)

        if (!result.ok || !result.data) {
            showToast(result.message ?? 'Unable to load workouts', 'error')
            return
        }

        setAllWorkouts(result.data)
    }

    async function handleSwitchWorkout(newWorkoutId: string) {
        const result = await switchWorkoutForDayAction(dateISO, newWorkoutId)

        if (!result.ok) {
            showToast(result.message ?? 'Unable to switch workout', 'error')
            return
        }

        setShowOverrideModal(false)
        await refreshTodayView()
    }

    async function handleSkipWorkout() {
        if (!session) return

        const result = await skipWorkoutAction(session.id, session.notes ?? null)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to skip workout', 'error')
            return
        }

        showToast(t('Today.toastWorkoutSkippedForToday'))
        setShowOverrideModal(false)
        await refreshTodayView()
    }

    async function handleUndoSkip() {
        if (!session) return

        const result = await undoSkipWorkoutAction(session.id, session.notes ?? null)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to undo skip', 'error')
            return
        }

        await refreshTodayView()
    }

    async function handleReschedule(targetDay: number) {
        if (!workout) return

        const result = await rescheduleWorkoutAction(dateISO, dayOfWeek, targetDay, workout.id, session?.id ?? null, dayNames)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to reschedule workout', 'error')
            return
        }

        showToast(t('Today.toastWorkoutMovedToDay', { day: dayNames[targetDay] }))
        setShowRescheduleModal(false)
        await refreshTodayView()
    }

    async function handleSaveSet(exerciseIndex: number, setIndex: number) {
        if (!session) return

        const currentLog = optimisticExerciseLogs[exerciseIndex]
        const currentSet = currentLog.sets[setIndex]
        const weight = parseFloat(currentSet.weight)
        const reps = parseInt(currentSet.reps)

        if (Number.isNaN(weight) || Number.isNaN(reps) || weight < 0 || reps < 1) {
            showToast(t('Today.toastEnterValidWeightAndReps'), 'error')
            return
        }

        const previousLogs = cloneLogs(exerciseLogs)
        const clientMutationId = createClientMutationId()
        const mutationKey = setMutationKey(currentLog.exerciseId, setIndex + 1)
        latestMutationRef.current[mutationKey] = clientMutationId

        commitSetPatch(exerciseIndex, setIndex, {
            weight: String(weight),
            reps: String(reps),
            saved: true,
            saving: true,
            pendingSync: false,
        })

        let result

        try {
            result = await saveSetAction({
                sessionId: session.id,
                exerciseId: currentLog.exerciseId,
                setNumber: setIndex + 1,
                weight,
                reps,
                setLogId: currentSet.id,
            })
        } catch (error) {
            result = {
                ok: false,
                message: error instanceof Error ? error.message : 'Unexpected error',
            }
        }

        const queueItem: PendingSetQueueItem = {
            clientId: `${session.id}:${currentLog.exerciseId}:${setIndex + 1}`,
            clientMutationId,
            dateISO,
            sessionId: session.id,
            exerciseId: currentLog.exerciseId,
            setNumber: setIndex + 1,
            weight,
            reps,
            setLogId: currentSet.id,
        }

        const shouldQueueOffline = !result.ok && (!navigator.onLine || isOfflineLikeError(result.message))

        if (shouldQueueOffline) {
            const nextQueue = upsertQueueItem(readPendingQueue(), queueItem)
            writePendingQueue(nextQueue)
            setPendingQueue(nextQueue)
            commitSetPatch(exerciseIndex, setIndex, {
                weight: String(weight),
                reps: String(reps),
                saved: true,
                saving: false,
                pendingSync: true,
            })
            showToast(t('Today.toastSetQueuedOffline'))
            return
        }

        if (!result.ok || !result.data) {
            if (latestMutationRef.current[mutationKey] !== clientMutationId) {
                return
            }

            setExerciseLogs(previousLogs)
            showToast(
                result.message === 'Invalid set values'
                    ? t('Today.toastEnterValidWeightAndReps')
                    : (result.message ?? 'Unable to save set'),
                'error'
            )
            return
        }

        if (latestMutationRef.current[mutationKey] !== clientMutationId) {
            return
        }

        commitSetPatch(
            exerciseIndex,
            setIndex,
            {
                id: result.data!.id,
                weight: String(weight),
                reps: String(reps),
                saved: true,
                saving: false,
                pendingSync: false,
            },
            { optimistic: false }
        )

        showToast(t('Today.toastSetSaved', { setNumber: setIndex + 1 }))
    }

    function handleSetChange(exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) {
        commitSetPatch(exerciseIndex, setIndex, {
            [field]: value,
            saved: false,
            pendingSync: false,
        })
    }

    async function handleSaveNotes() {
        if (!session) return

        const result = await saveSessionNotesAction(session.id, notes)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to save notes', 'error')
            return
        }

        setSession((prev) => (prev ? { ...prev, notes: notes.trim() || null } : prev))
        showToast(t('Today.toastNotesSaved'))
    }

    const totalSets = useMemo(() => optimisticExerciseLogs.reduce((acc, exerciseLog) => acc + exerciseLog.targetSets, 0), [optimisticExerciseLogs])
    const completedSets = useMemo(
        () => optimisticExerciseLogs.reduce((acc, exerciseLog) => acc + exerciseLog.sets.filter((set) => set.saved).length, 0),
        [optimisticExerciseLogs]
    )
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0
    const isSkipped = session?.notes?.startsWith('[SKIPPED]')
    const pendingSyncCount = useMemo(
        () => optimisticExerciseLogs.reduce((acc, exerciseLog) => acc + exerciseLog.sets.filter((set) => set.pendingSync).length, 0),
        [optimisticExerciseLogs]
    )

    if (loading) {
        return (
            <div className="px-4 pt-6">
                <div className="h-8 w-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-40 bg-white dark:bg-zinc-900 rounded-2xl animate-pulse" />
                    ))}
                </div>
            </div>
        )
    }

    if (!workout) {
        return (
            <div className="px-4 pt-6">
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{dayNames[dayOfWeek]}</h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{isHistorical ? t('Today.historical') : t('Today.today')} • {dateISO}</p>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center mb-4">
                        <span className="text-3xl">😴</span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('Today.restDay')}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mb-6">{t('Today.noWorkout')}</p>
                    <button
                        onClick={async () => {
                            await loadAllWorkouts()
                            setShowOverrideModal(true)
                        }}
                        className="px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-800 transition-colors"
                    >
                        {t('Today.startAnyway')}
                    </button>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mt-4">{t('Today.changeSchedule')}</p>
                </div>

                {showOverrideModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.selectWorkout')}</h3>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.chooseWorkout')}</p>
                            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                                {allWorkouts.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSwitchWorkout(item.id)}
                                        className="w-full text-left px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium hover:bg-zinc-800 transition-colors"
                                    >
                                        {item.name}
                                    </button>
                                ))}
                                {allWorkouts.length === 0 && (
                                    <p className="text-zinc-500 dark:text-zinc-400 text-sm text-center py-4">{t('Today.noWorkouts')}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowOverrideModal(false)}
                                className="w-full py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
                            >
                                {t('Common.cancel')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (isSkipped) {
        return (
            <div className="px-4 pt-6">
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <div className="flex items-center justify-between mb-1">
                    <h1 className="text-2xl font-bold text-zinc-500 dark:text-zinc-400 opacity-50 line-through">{workout.name}</h1>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">{isHistorical ? t('Today.historical') : t('Today.today')} • {dateISO}</p>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-3xl opacity-50">🛋️</span>
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">{t('Today.workoutSkipped')}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-[250px] mb-6">{t('Today.youChoseToRest')}</p>
                    <button
                        onClick={handleUndoSkip}
                        className="px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-800 transition-colors"
                    >
                        {t('Today.undoSkip')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 pt-6 pb-8">
            {isHistorical && (
                <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                    {t('Today.historicalView')}
                </div>
            )}
            <div className="flex items-start justify-between mb-0.5">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{workout.name}</h1>
                <button
                    onClick={async () => {
                        await loadAllWorkouts()
                        setShowOverrideModal(true)
                    }}
                    className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-white bg-white dark:bg-zinc-900 rounded-full transition-colors"
                    title={t('Today.switchWorkout')}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{dayNames[dayOfWeek]} • {dateISO}</p>

            <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('Today.progress')}</span>
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{completedSets}/{totalSets} {t('Today.sets')}</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                {progress === 100 && <p className="text-xs text-emerald-400 font-semibold mt-1.5 text-center">{t('Today.workoutComplete')}</p>}
                {pendingSyncCount > 0 && (
                    <p className="text-xs text-amber-500 font-semibold mt-1.5 text-center">
                        {pendingSyncCount} • {t('Today.pendingSync')}
                    </p>
                )}
            </div>

            <div className="space-y-4">
                {optimisticExerciseLogs.map((exerciseLog, exerciseIndex) => {
                    const completed = exerciseLog.sets.filter((set) => set.saved).length

                    return (
                        <div key={exerciseLog.exerciseId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{exerciseLog.exerciseName}</h3>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${completed === exerciseLog.targetSets ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                    {completed}/{exerciseLog.targetSets}
                                </span>
                            </div>

                            <div className="divide-y divide-zinc-800/30">
                                {exerciseLog.sets.map((set, setIndex) => {
                                    const prevMark = exerciseLog.previousSets?.[setIndex]
                                    return (
                                    <div key={setIndex} className={`px-4 py-3 ${set.saved ? 'bg-zinc-100 dark:bg-zinc-800/20' : ''}`}>
                                        <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold w-6 text-center ${set.saved ? 'text-emerald-400' : 'text-zinc-600 dark:text-zinc-400 dark:text-zinc-600'}`}>
                                            {set.saved ? '✓' : setIndex + 1}
                                        </span>

                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.5"
                                                value={set.weight}
                                                onChange={(event) => handleSetChange(exerciseIndex, setIndex, 'weight', event.target.value)}
                                                placeholder={prevMark ? String(prevMark.weight) : '0'}
                                                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-center text-base font-semibold placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
                                            />
                                            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-center block mt-0.5">{t('Today.kg')}</span>
                                        </div>

                                        <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-sm font-bold">×</span>

                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={set.reps}
                                                onChange={(event) => handleSetChange(exerciseIndex, setIndex, 'reps', event.target.value)}
                                                placeholder={prevMark ? String(prevMark.reps) : '0'}
                                                className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white text-center text-base font-semibold placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
                                            />
                                            <span className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 text-center block mt-0.5">{t('Today.reps')}</span>
                                        </div>

                                        <button
                                            onClick={() => handleSaveSet(exerciseIndex, setIndex)}
                                            disabled={!set.weight || !set.reps || set.saving}
                                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 min-w-[60px] ${set.pendingSync
                                                ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25'
                                                : set.saved
                                                    ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                                                    : 'bg-violet-600 text-zinc-900 dark:text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed'}`}
                                        >
                                            {set.saving ? '...' : (set.pendingSync ? t('Today.pendingSync') : (set.saved ? t('Common.edit') : t('Common.save')))}
                                        </button>
                                        </div>

                                        {prevMark && (
                                            <div className="ml-6 mt-1.5 flex items-center gap-1 text-[10px] text-violet-400/70">
                                                <span>▲</span>
                                                <span>{t('Today.previousMark')}: {prevMark.weight}{t('Today.kg')} × {prevMark.reps}</span>
                                            </div>
                                        )}
                                    </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {session && (
                <div className="mt-6 mb-8">
                    <label className="block text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-2">{t('Today.sessionNotes')}</label>
                    <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        onBlur={handleSaveNotes}
                        placeholder={t('Today.sessionNotesPlaceholder')}
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent text-sm resize-none"
                    />
                    <p className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 mt-1">{t('Today.autoSaves')}</p>
                </div>
            )}

            {showOverrideModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.switchWorkout')}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.doingSomethingElse')}</p>

                        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                            {allWorkouts.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSwitchWorkout(item.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${item.id === workout.id ? 'bg-violet-600/20 text-violet-400 border border-violet-600/50' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-800'}`}
                                >
                                    {item.name} {item.id === workout.id && t('Today.current')}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                onClick={() => {
                                    setShowOverrideModal(false)
                                    setShowRescheduleModal(true)
                                }}
                                className="py-3 bg-emerald-600/10 text-emerald-500 font-semibold rounded-xl hover:bg-emerald-600/20 transition-colors text-sm"
                            >
                                {t('Today.reschedule')}
                            </button>
                            <button onClick={handleSkipWorkout} className="py-3 bg-red-500/10 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 transition-colors text-sm">
                                {t('Today.skipWorkout')}
                            </button>
                        </div>

                        <button onClick={() => setShowOverrideModal(false)} className="w-full py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors">
                            {t('Common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {showRescheduleModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.rescheduleWorkout')}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">{t('Today.rescheduleDesc')}</p>

                        <div className="grid grid-cols-2 gap-2 mb-6">
                            {[0, 1, 2, 3, 4, 5, 6].map((targetDay) => {
                                if (targetDay === dayOfWeek) return null
                                return (
                                    <button
                                        key={targetDay}
                                        onClick={() => handleReschedule(targetDay)}
                                        className="py-3 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800"
                                    >
                                        {dayNames[targetDay]}
                                    </button>
                                )
                            })}
                        </div>

                        <button onClick={() => setShowRescheduleModal(false)} className="w-full py-3.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors">
                            {t('Common.cancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
