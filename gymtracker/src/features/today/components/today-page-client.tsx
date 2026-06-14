'use client'

import { startTransition, useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from 'react'
import { RotateCcw, SkipForward, TimerReset } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { FieldLabel, Input, Textarea } from '@/components/ui/fields'
import { EmptyState, PageHeader, PageShell, StatusPill, Surface } from '@/components/ui/surface'
import { useToast } from '@/components/ui/toast'
import { getLocalizedWeekdayNames } from '@/lib/utils'
import { buildWorkoutSessionNotesWithStatus, parseWorkoutSessionStatus } from '@/lib/workout-session-status'
import { getCompletedExerciseSetCount } from '@/features/today/progress'
import {
    getTodayViewAction,
    listTodayExerciseOptionsAction,
    listUserWorkoutsAction,
    rescheduleWorkoutAction,
    saveCardioLogAction,
    saveExerciseTargetSetsAction,
    saveSessionNotesAction,
    saveSetAction,
    saveSetLogAction,
    skipCardioAction,
    skipExerciseAction,
    skipWorkoutAction,
    substituteExerciseAction,
    switchWorkoutForDayAction,
    undoSkipCardioAction,
    undoExerciseSubstitutionAction,
    undoSkipExerciseAction,
    undoSkipWorkoutAction,
} from '@/features/today/actions'
import type { Workout, WorkoutSession } from '@/lib/types'
import type {
    CardioIntervalState,
    CardioLogState,
    ExerciseLogSetState,
    ExerciseLogState,
    TodayExerciseOption,
    TodayViewData,
} from '@/features/today/types'
import {
    getRestSecondsAfterSegment,
    type SetLogPayload,
    type SetLogState,
} from '@/lib/set-methods'

interface PendingSetQueueItem {
    clientId: string
    clientMutationId: string
    dateISO: string
    sessionId: string
    exerciseId: string
    originalExerciseId?: string
    setNumber: number
    prescriptionId?: string
    payload?: SetLogPayload
    weight?: number
    reps?: number
    setLogId?: string
}

interface SetPatchMutation {
    exerciseIndex: number
    setIndex: number
    patch: Partial<ExerciseLogSetState>
}

const PENDING_SET_QUEUE_KEY = 'gymtracker.pending-set-queue'
const ONLINE_AUTO_SYNC_DELAY_MS = 3000

interface TodayPageClientProps {
    dateISO: string
    dayOfWeek: number
    isHistorical: boolean
    initialData: TodayViewData
}

function cloneLogs(logs: ExerciseLogState[]) {
    return logs.map((log) => ({
        ...log,
        sets: log.sets.map((set) => ({
            ...set,
            prescription: structuredClone(set.prescription),
            segments: set.segments.map((segment) => ({ ...segment })),
        })),
    }))
}
function cloneCardioLogs(logs: CardioLogState[]) {
    return logs.map((log) => ({
        ...log,
        intervals: log.intervals.map((interval) => ({ ...interval })),
    }))
}

function parseNonNegativeInteger(value: string) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null
    }

    return parsed
}

function parsePositiveInteger(value: string) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
        return null
    }

    return parsed
}

function parseNonNegativeNumber(value: string) {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) {
        return null
    }

    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null
    }

    return parsed
}

function splitTotalDuration(totalDurationMinutes: string) {
    const parsed = parseNonNegativeInteger(totalDurationMinutes)
    if (parsed == null) {
        return { hours: '', minutes: '' }
    }

    return {
        hours: String(Math.floor(parsed / 60)),
        minutes: String(parsed % 60),
    }
}

function combineDurationParts(hours: string, minutes: string) {
    const parsedHours = parseNonNegativeInteger(hours) ?? 0
    const parsedMinutes = parseNonNegativeInteger(minutes) ?? 0
    const total = parsedHours * 60 + parsedMinutes

    return total > 0 ? String(total) : ''
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
        && (
            item.prescriptionId
                ? queueItem.prescriptionId === item.prescriptionId
                : queueItem.setNumber === item.setNumber
        )
    ))

    nextQueue.push(item)
    return nextQueue
}

function removeQueueItem(queue: PendingSetQueueItem[], item: PendingSetQueueItem) {
    return queue.filter((queueItem) => queueItem.clientId !== item.clientId)
}

function setMutationKey(exerciseId: string, prescriptionId: string) {
    return `${exerciseId}:${prescriptionId}`
}

function createClientMutationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface SyncStatusBarProps {
    isOnline: boolean
    pendingCount: number
    syncing: boolean
    onRetry: () => void
    labels: {
        online: string
        offline: string
        pending: string
        syncing: string
        retry: string
    }
}

function SyncStatusBar({ isOnline, pendingCount, syncing, onRetry, labels }: SyncStatusBarProps) {
    const hasPending = pendingCount > 0
    const toneClassName = !isOnline
        ? 'border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-200'
        : hasPending
            ? 'border-violet-500/25 bg-violet-500/12 text-violet-700 dark:text-violet-200'
            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'

    return (
        <div
            role="status"
            aria-live="polite"
            className={`sticky top-2 z-30 mb-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between ${toneClassName}`}
        >
            <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="font-semibold">
                    {syncing ? labels.syncing : isOnline ? labels.online : labels.offline}
                </span>
                {hasPending ? (
                    <span className="rounded-full bg-white/50 px-2 py-1 text-[11px] font-semibold dark:bg-white/10">
                        {labels.pending}
                    </span>
                ) : null}
            </div>
            {hasPending ? (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRetry}
                    disabled={!isOnline || syncing}
                    className="w-full bg-white/70 dark:bg-white/10 sm:w-auto"
                >
                    {labels.retry}
                </Button>
            ) : null}
        </div>
    )
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
            const match = sessionQueue.find((item) =>
                item.exerciseId === log.exerciseId
                && (
                    item.prescriptionId === set.prescription.id
                    || (!item.prescriptionId && item.setNumber === index + 1)
                )
            )
            if (!match) {
                return set
            }

            if (match.payload) {
                return {
                    ...set,
                    id: match.payload.setLogId ?? set.id,
                    segments: match.payload.segments.map((segment) => ({
                        ...segment,
                        weight: segment.weightKg == null ? '' : String(segment.weightKg),
                        reps: segment.reps == null ? '' : String(segment.reps),
                    })),
                    actualRir: match.payload.actualRir == null ? '' : String(match.payload.actualRir),
                    state: match.payload.state,
                    saved: match.payload.state !== 'in_progress',
                    started: true,
                    saving: false,
                    pendingSync: true,
                }
            }

            const firstSegment = set.segments[0]
            return {
                ...set,
                id: match.setLogId ?? set.id,
                segments: [
                    {
                        ...firstSegment,
                        weight: match.weight == null ? firstSegment.weight : String(match.weight),
                        reps: match.reps == null ? firstSegment.reps : String(match.reps),
                        completed: true,
                    },
                    ...set.segments.slice(1),
                ],
                state: 'completed' as const,
                saved: true,
                started: true,
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

function applyExerciseTargetSetCount(
    logs: ExerciseLogState[],
    exerciseIndex: number,
    targetSets: number
) {
    return logs.map((log, logIndex) => {
        if (logIndex !== exerciseIndex) return log

        return {
            ...log,
            targetSets,
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
    const [rotation, setRotation] = useState(initialData.rotation)
    const [pendingQueue, setPendingQueue] = useState<PendingSetQueueItem[]>(() => readPendingQueue())
    const [isOnline, setIsOnline] = useState(true)
    const [syncingPendingQueue, setSyncingPendingQueue] = useState(false)
    const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogState[]>(() => applyPendingStateToLogsForSession(
        initialData.exerciseLogs,
        readPendingQueue(),
        initialData.session?.id,
        dateISO
    ))
    const [cardioLogs, setCardioLogs] = useState<CardioLogState[]>(() => cloneCardioLogs(initialData.cardioLogs))
    const [notes, setNotes] = useState(initialData.notes)
    const [showOverrideModal, setShowOverrideModal] = useState(false)
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([])
    const [showRescheduleModal, setShowRescheduleModal] = useState(false)
    const [loadingWorkouts, setLoadingWorkouts] = useState(false)
    const [exerciseOptions, setExerciseOptions] = useState<TodayExerciseOption[]>([])
    const [loadingExerciseOptions, setLoadingExerciseOptions] = useState(false)
    const [savingExerciseTargetIds, setSavingExerciseTargetIds] = useState<string[]>([])
    const [substitutionTarget, setSubstitutionTarget] = useState<ExerciseLogState | null>(null)
    const [substitutionSearch, setSubstitutionSearch] = useState('')
    const [restTimer, setRestTimer] = useState<{
        duration: number
        remaining: number
        label: string
    } | null>(null)
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
                startTransition(() => {
                    addOptimisticSetPatch({
                        exerciseIndex,
                        setIndex,
                        patch,
                    })
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

        setSyncingPendingQueue(true)
        let nextQueue = [...queue]
        let syncedCount = 0

        try {
            for (const item of queue) {
                const result = item.payload
                    ? await saveSetLogAction(item.payload)
                    : item.weight != null && item.reps != null
                        ? await saveSetAction({
                            sessionId: item.sessionId,
                            exerciseId: item.exerciseId,
                            originalExerciseId: item.originalExerciseId,
                            setNumber: item.setNumber,
                            weight: item.weight,
                            reps: item.reps,
                            setLogId: item.setLogId,
                        })
                        : { ok: false, message: 'Invalid queued set' }

                if (!result.ok || !result.data) {
                    continue
                }

                syncedCount += 1
                nextQueue = removeQueueItem(nextQueue, item)

                const mutationKey = setMutationKey(
                    item.exerciseId,
                    item.prescriptionId ?? String(item.setNumber),
                )
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
                                if (
                                    item.prescriptionId
                                        ? set.prescription.id !== item.prescriptionId
                                        : index !== item.setNumber - 1
                                ) return set

                                if (item.payload) {
                                    return {
                                        ...set,
                                        id: result.data!.id,
                                        segments: item.payload.segments.map((segment) => ({
                                            ...segment,
                                            weight: segment.weightKg == null ? '' : String(segment.weightKg),
                                            reps: segment.reps == null ? '' : String(segment.reps),
                                        })),
                                        actualRir: item.payload.actualRir == null ? '' : String(item.payload.actualRir),
                                        state: item.payload.state,
                                        saved: item.payload.state !== 'in_progress',
                                        started: true,
                                        saving: false,
                                        pendingSync: false,
                                    }
                                }

                                return {
                                    ...set,
                                    id: result.data!.id,
                                    segments: set.segments.map((segment, segmentIndex) =>
                                        segmentIndex === 0
                                            ? {
                                                ...segment,
                                                weight: String(item.weight),
                                                reps: String(item.reps),
                                                completed: true,
                                            }
                                            : segment,
                                    ),
                                    state: 'completed',
                                    saved: true,
                                    started: true,
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
        } finally {
            setSyncingPendingQueue(false)
        }
    }, [dateISO, session?.id, showToast, t])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        setIsOnline(navigator.onLine)

        let syncTimeout: number | null = null
        const schedulePendingSync = (shouldNotifyOnSuccess: boolean, delayMs: number) => {
            if (syncTimeout) {
                window.clearTimeout(syncTimeout)
            }

            syncTimeout = window.setTimeout(() => {
                syncTimeout = null
                void processPendingQueue(shouldNotifyOnSuccess)
            }, delayMs)
        }

        const handleOnline = () => {
            setIsOnline(true)

            if (readPendingQueue().length > 0) {
                schedulePendingSync(true, ONLINE_AUTO_SYNC_DELAY_MS)
            }
        }
        const handleOffline = () => {
            setIsOnline(false)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        if (navigator.onLine && pendingQueue.length > 0) {
            schedulePendingSync(false, 0)
        }

        return () => {
            if (syncTimeout) {
                window.clearTimeout(syncTimeout)
            }
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [pendingQueue.length, processPendingQueue])

    function handleRetryPendingSync() {
        void processPendingQueue(true)
    }

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
        setRotation(result.data.rotation)
        setExerciseLogs(applyPendingStateToLogs(result.data.exerciseLogs, pendingQueue))
        setCardioLogs(cloneCardioLogs(result.data.cardioLogs))
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

    async function loadExerciseOptions() {
        if (exerciseOptions.length > 0 || loadingExerciseOptions) {
            return
        }

        setLoadingExerciseOptions(true)
        const result = await listTodayExerciseOptionsAction()
        setLoadingExerciseOptions(false)

        if (!result.ok || !result.data) {
            showToast(result.message ?? 'Unable to load exercises', 'error')
            return
        }

        setExerciseOptions(result.data)
    }

    async function openSubstitutionModal(exerciseLog: ExerciseLogState) {
        setSubstitutionTarget(exerciseLog)
        setSubstitutionSearch('')
        await loadExerciseOptions()
    }

    async function handleSubstituteExercise(replacementExerciseId: string) {
        if (!session || !substitutionTarget) return

        const result = await substituteExerciseAction({
            sessionId: session.id,
            originalExerciseId: substitutionTarget.originalExerciseId,
            replacementExerciseId,
        })

        if (!result.ok) {
            showToast(result.message ?? 'Unable to substitute exercise', 'error')
            return
        }

        showToast(t('Today.toastExerciseSubstituted'))
        setSubstitutionTarget(null)
        await refreshTodayView()
    }

    async function handleUndoSubstitution(exerciseLog: ExerciseLogState) {
        if (!session) return

        const result = await undoExerciseSubstitutionAction(session.id, exerciseLog.originalExerciseId)

        if (!result.ok) {
            showToast(result.message ?? 'Unable to undo substitution', 'error')
            return
        }

        showToast(t('Today.toastExerciseSubstitutionUndone'))
        await refreshTodayView()
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

    function buildSetPayload(
        exerciseLog: ExerciseLogState,
        setIndex: number,
        nextSet: ExerciseLogSetState,
        state: SetLogState,
    ): SetLogPayload | null {
        const segments = nextSet.segments.map((segment) => {
            const weightKg = parseNonNegativeNumber(segment.weight)
            const reps = parsePositiveInteger(segment.reps)

            return {
                id: segment.id,
                position: segment.position,
                kind: segment.kind,
                weightKg,
                reps,
                targetReps: segment.targetReps,
                suggestedWeightKg: segment.suggestedWeightKg,
                completed: segment.completed,
            }
        })
        const completedSegments = segments.filter((segment) => segment.completed)

        if (
            completedSegments.some(
                (segment) => segment.weightKg == null || segment.reps == null,
            )
        ) {
            return null
        }

        const actualRir = nextSet.actualRir.trim() === ''
            ? null
            : Number.parseFloat(nextSet.actualRir.replace(',', '.'))

        if (actualRir != null && (!Number.isFinite(actualRir) || actualRir < 0 || actualRir > 10)) {
            return null
        }

        return {
            sessionId: session!.id,
            exerciseId: exerciseLog.exerciseId,
            originalExerciseId: exerciseLog.originalExerciseId,
            prescriptionId: nextSet.prescription.id,
            setNumber: setIndex + 1,
            setMethod: nextSet.prescription.method,
            prescriptionSnapshot: nextSet.prescription,
            segments,
            actualRir,
            state,
            setLogId: nextSet.id,
        }
    }

    async function persistSet(
        exerciseIndex: number,
        setIndex: number,
        nextSet: ExerciseLogSetState,
        state: SetLogState,
    ) {
        if (!session) return false

        const currentLog = optimisticExerciseLogs[exerciseIndex]
        const payload = buildSetPayload(currentLog, setIndex, nextSet, state)

        if (!payload) {
            showToast(t('Today.toastEnterValidWeightAndReps'), 'error')
            return false
        }

        const previousLogs = cloneLogs(exerciseLogs)
        const clientMutationId = createClientMutationId()
        const mutationKey = setMutationKey(
            currentLog.exerciseId,
            nextSet.prescription.id,
        )
        latestMutationRef.current[mutationKey] = clientMutationId

        commitSetPatch(exerciseIndex, setIndex, {
            ...nextSet,
            state,
            saved: state !== 'in_progress',
            started: true,
            saving: true,
            pendingSync: false,
        })

        let result

        try {
            result = await saveSetLogAction(payload)
        } catch (error) {
            result = {
                ok: false,
                message: error instanceof Error ? error.message : 'Unexpected error',
            }
        }

        const queueItem: PendingSetQueueItem = {
            clientId: `${session.id}:${currentLog.exerciseId}:${nextSet.prescription.id}`,
            clientMutationId,
            dateISO,
            sessionId: session.id,
            exerciseId: currentLog.exerciseId,
            originalExerciseId: currentLog.originalExerciseId,
            prescriptionId: nextSet.prescription.id,
            setNumber: setIndex + 1,
            payload,
            setLogId: nextSet.id,
        }

        const shouldQueueOffline = !result.ok && (!navigator.onLine || isOfflineLikeError(result.message))

        if (shouldQueueOffline) {
            const nextQueue = upsertQueueItem(readPendingQueue(), queueItem)
            writePendingQueue(nextQueue)
            setPendingQueue(nextQueue)
            commitSetPatch(exerciseIndex, setIndex, {
                ...nextSet,
                state,
                saved: state !== 'in_progress',
                started: true,
                saving: false,
                pendingSync: true,
            })
            showToast(t('Today.toastSetQueuedOffline'))
            return true
        }

        if (!result.ok || !result.data) {
            if (latestMutationRef.current[mutationKey] !== clientMutationId) {
                return false
            }

            setExerciseLogs(previousLogs)
            showToast(result.message ?? 'Unable to save set', 'error')
            return false
        }

        if (latestMutationRef.current[mutationKey] !== clientMutationId) {
            return false
        }

        commitSetPatch(
            exerciseIndex,
            setIndex,
            {
                ...nextSet,
                id: result.data.id,
                state,
                saved: state !== 'in_progress',
                started: true,
                saving: false,
                pendingSync: false,
            },
            { optimistic: false }
        )

        if (state !== 'in_progress') {
            showToast(t('Today.toastSetSaved', { setNumber: setIndex + 1 }))
        }

        return true
    }

    async function handleSaveSegment(
        exerciseIndex: number,
        setIndex: number,
        segmentIndex: number,
    ) {
        const currentSet = optimisticExerciseLogs[exerciseIndex].sets[setIndex]
        const currentSegment = currentSet.segments[segmentIndex]
        const weight = parseNonNegativeNumber(currentSegment.weight)
        const reps = parsePositiveInteger(currentSegment.reps)

        if (weight == null || reps == null) {
            showToast(t('Today.toastEnterValidWeightAndReps'), 'error')
            return
        }

        const nextSet = {
            ...currentSet,
            segments: currentSet.segments.map((segment, index) =>
                index === segmentIndex
                    ? { ...segment, weight: String(weight), reps: String(reps), completed: true }
                    : segment,
            ),
        }
        const saved = await persistSet(exerciseIndex, setIndex, nextSet, 'in_progress')

        if (saved) {
            const restSeconds = getRestSecondsAfterSegment(
                currentSet.prescription,
                segmentIndex + 1,
            )
            if (restSeconds > 0) {
                setRestTimer({
                    duration: restSeconds,
                    remaining: restSeconds,
                    label: `${optimisticExerciseLogs[exerciseIndex].exerciseName} • ${setIndex + 1}.${segmentIndex + 1}`,
                })
            }
        }
    }

    async function handleFinishSet(
        exerciseIndex: number,
        setIndex: number,
        state: 'completed' | 'stopped' = 'completed',
    ) {
        const currentSet = optimisticExerciseLogs[exerciseIndex].sets[setIndex]
        const completedSegments = currentSet.segments.filter((segment) => segment.completed)

        if (
            completedSegments.length === 0
            || (
                state === 'completed'
                && completedSegments.length !== currentSet.segments.length
            )
        ) {
            showToast(t('Today.toastCompleteSegmentsFirst'), 'error')
            return
        }

        await persistSet(exerciseIndex, setIndex, currentSet, state)
    }

    async function handleTargetSetsChange(exerciseIndex: number, nextTargetSets: number) {
        if (!session) return

        const currentLog = optimisticExerciseLogs[exerciseIndex]
        const minimumTargetSets = Math.max(1, getCompletedExerciseSetCount(currentLog))
        const maximumTargetSets = currentLog.plannedTargetSets

        if (nextTargetSets < minimumTargetSets) {
            showToast(t('Today.toastValidSetsMinCompleted'), 'error')
            return
        }

        if (nextTargetSets > maximumTargetSets) {
            showToast(t('Today.toastValidSetsOutOfRange', { count: maximumTargetSets }), 'error')
            return
        }

        const previousLogs = cloneLogs(exerciseLogs)

        setSavingExerciseTargetIds((prev) => [...new Set([...prev, currentLog.originalExerciseId])])
        setExerciseLogs((prev) => applyExerciseTargetSetCount(prev, exerciseIndex, nextTargetSets))

        const result = await saveExerciseTargetSetsAction({
            sessionId: session.id,
            exerciseId: currentLog.originalExerciseId,
            validSets: nextTargetSets,
        })

        setSavingExerciseTargetIds((prev) => prev.filter((exerciseId) => exerciseId !== currentLog.originalExerciseId))

        if (result.ok) {
            return
        }

        setExerciseLogs(previousLogs)

        const message = result.message?.includes('Cannot reduce valid sets below completed sets')
            ? t('Today.toastValidSetsMinCompleted')
            : result.message?.includes('Valid sets must be between 1 and planned target sets')
                ? t('Today.toastValidSetsOutOfRange', { count: maximumTargetSets })
                : (result.message ?? 'Unable to update valid sets')

        showToast(message, 'error')
    }

    function handleSetSegmentChange(
        exerciseIndex: number,
        setIndex: number,
        segmentIndex: number,
        field: 'weight' | 'reps',
        value: string,
    ) {
        const currentSet = optimisticExerciseLogs[exerciseIndex].sets[setIndex]
        commitSetPatch(exerciseIndex, setIndex, {
            segments: currentSet.segments.map((segment, index) =>
                index === segmentIndex
                    ? { ...segment, [field]: value, completed: false }
                    : segment,
            ),
            saved: false,
            pendingSync: false,
        })
    }

    function handleActualRirChange(
        exerciseIndex: number,
        setIndex: number,
        value: string,
    ) {
        commitSetPatch(exerciseIndex, setIndex, {
            actualRir: value,
            saved: false,
            pendingSync: false,
        })
    }

    async function handleSkipExercise(exerciseId: string) {
        if (!session) return

        const result = await skipExerciseAction(session.id, exerciseId)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to skip exercise', 'error')
            return
        }

        showToast(t('Today.toastExerciseSkipped'))
        await refreshTodayView()
    }

    async function handleUndoSkipExercise(exerciseId: string) {
        if (!session) return

        const result = await undoSkipExerciseAction(session.id, exerciseId)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to undo exercise skip', 'error')
            return
        }

        await refreshTodayView()
    }

    function updateCardioLog(cardioBlockId: string, updater: (current: CardioLogState) => CardioLogState) {
        setCardioLogs((prev) => prev.map((log) => {
            if (log.cardioBlockId !== cardioBlockId) {
                return log
            }

            return updater(log)
        }))
    }

    function handleCardioDurationPartChange(
        cardioBlockId: string,
        field: 'hours' | 'minutes',
        value: string,
    ) {
        updateCardioLog(cardioBlockId, (current) => {
            const parts = splitTotalDuration(current.totalDurationMinutes)
            const nextParts = {
                hours: field === 'hours' ? value : parts.hours,
                minutes: field === 'minutes' ? value : parts.minutes,
            }

            return {
                ...current,
                skipped: false,
                saved: false,
                totalDurationMinutes: combineDurationParts(nextParts.hours, nextParts.minutes),
            }
        })
    }

    function handleCardioDistanceChange(cardioBlockId: string, value: string) {
        updateCardioLog(cardioBlockId, (current) => ({
            ...current,
            skipped: false,
            saved: false,
            totalDistanceKm: value,
        }))
    }

    function handleAddCardioInterval(cardioBlockId: string) {
        updateCardioLog(cardioBlockId, (current) => ({
            ...current,
            skipped: false,
            saved: false,
            intervals: [
                ...current.intervals,
                {
                    durationMinutes: '',
                    speedKmh: '',
                    repeatCount: '1',
                },
            ],
        }))
    }

    function handleRemoveCardioInterval(cardioBlockId: string, intervalIndex: number) {
        updateCardioLog(cardioBlockId, (current) => ({
            ...current,
            saved: false,
            intervals: current.intervals.filter((_, index) => index !== intervalIndex),
        }))
    }

    function handleCardioIntervalChange(
        cardioBlockId: string,
        intervalIndex: number,
        field: keyof CardioIntervalState,
        value: string,
    ) {
        updateCardioLog(cardioBlockId, (current) => ({
            ...current,
            skipped: false,
            saved: false,
            intervals: current.intervals.map((interval, index) => {
                if (index !== intervalIndex) {
                    return interval
                }

                return {
                    ...interval,
                    [field]: value,
                }
            }),
        }))
    }

    async function handleSaveCardio(cardioLog: CardioLogState) {
        if (!session) return

        const totalDurationMinutes = cardioLog.totalDurationMinutes
            ? parsePositiveInteger(cardioLog.totalDurationMinutes)
            : null
        const totalDistanceKm = cardioLog.totalDistanceKm
            ? parseNonNegativeNumber(cardioLog.totalDistanceKm)
            : null
        const normalizedIntervals = cardioLog.intervals.flatMap((interval) => {
            const durationMinutes = parsePositiveInteger(interval.durationMinutes)
            const repeatCount = parsePositiveInteger(interval.repeatCount)
            const speedKmh = interval.speedKmh ? parseNonNegativeNumber(interval.speedKmh) : null

            if (durationMinutes == null || repeatCount == null) {
                return []
            }

            return [{
                id: interval.id,
                durationMinutes,
                repeatCount,
                speedKmh,
            }]
        })

        const hasAnyMetric =
            totalDurationMinutes != null ||
            totalDistanceKm != null ||
            normalizedIntervals.length > 0

        if (!hasAnyMetric) {
            showToast(t('Today.toastCardioRequiresMetric'), 'error')
            return
        }

        const allIntervalsValid = cardioLog.intervals.every((interval) => {
            if (!interval.durationMinutes && !interval.speedKmh) {
                return true
            }

            return parsePositiveInteger(interval.durationMinutes) != null
                && parsePositiveInteger(interval.repeatCount) != null
                && (interval.speedKmh === '' || parseNonNegativeNumber(interval.speedKmh) != null)
        })

        if (!allIntervalsValid) {
            showToast(t('Today.toastCardioInvalidInterval'), 'error')
            return
        }

        const result = await saveCardioLogAction({
            sessionId: session.id,
            cardioBlockId: cardioLog.cardioBlockId,
            totalDurationMinutes,
            totalDistanceKm,
            intervals: normalizedIntervals,
        })

        if (!result.ok) {
            showToast(result.message ?? 'Unable to save cardio', 'error')
            return
        }

        showToast(t('Today.toastCardioSaved'))
        await refreshTodayView()
    }

    async function handleSkipCardio(cardioBlockId: string) {
        if (!session) return

        const result = await skipCardioAction(session.id, cardioBlockId)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to skip cardio', 'error')
            return
        }

        showToast(t('Today.toastCardioSkipped'))
        await refreshTodayView()
    }

    async function handleUndoSkipCardio(cardioBlockId: string) {
        if (!session) return

        const result = await undoSkipCardioAction(session.id, cardioBlockId)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to undo cardio skip', 'error')
            return
        }

        await refreshTodayView()
    }

    async function handleSaveNotes() {
        if (!session) return

        const result = await saveSessionNotesAction(session.id, notes)
        if (!result.ok) {
            showToast(result.message ?? 'Unable to save notes', 'error')
            return
        }

        setSession((prev) => (prev ? { ...prev, notes: buildWorkoutSessionNotesWithStatus(prev.notes, notes) } : prev))
        showToast(t('Today.toastNotesSaved'))
    }

    const totalProgressUnits = useMemo(
        () => optimisticExerciseLogs.reduce((acc, exerciseLog) => acc + exerciseLog.targetSets, 0) + cardioLogs.length,
        [cardioLogs.length, optimisticExerciseLogs]
    )

    useEffect(() => {
        if (!restTimer || restTimer.remaining <= 0) {
            return
        }

        const interval = window.setInterval(() => {
            setRestTimer((current) =>
                current
                    ? { ...current, remaining: Math.max(0, current.remaining - 1) }
                    : null
            )
        }, 1000)

        return () => window.clearInterval(interval)
    }, [restTimer])
    const completedProgressUnits = useMemo(
        () => {
            const exerciseUnits = optimisticExerciseLogs.reduce((acc, exerciseLog) => {
                if (exerciseLog.skipped) {
                    return acc
                }

                return acc + getCompletedExerciseSetCount(exerciseLog)
            }, 0)
            const cardioUnits = cardioLogs.filter((cardioLog) => cardioLog.saved || cardioLog.skipped).length

            return exerciseUnits + cardioUnits
        },
        [cardioLogs, optimisticExerciseLogs]
    )
    const progress = totalProgressUnits > 0 ? (completedProgressUnits / totalProgressUnits) * 100 : 0
    const sessionStatus = useMemo(() => parseWorkoutSessionStatus(session?.notes), [session?.notes])
    const isSkipped = sessionStatus.kind === 'skipped'
    const isRescheduledSource = sessionStatus.kind === 'rescheduled_to'
    const isRescheduledTarget = sessionStatus.kind === 'rescheduled_from'
    const pendingSyncCount = useMemo(
        () => optimisticExerciseLogs.reduce((acc, exerciseLog) => acc + exerciseLog.sets.filter((set) => set.pendingSync).length, 0),
        [optimisticExerciseLogs]
    )
    const filteredSubstitutionOptions = useMemo(() => {
        const normalizedSearch = substitutionSearch.trim().toLowerCase()
        const unavailableExerciseIds = new Set(
            optimisticExerciseLogs.flatMap((exerciseLog) => [
                exerciseLog.originalExerciseId,
                exerciseLog.exerciseId,
            ]),
        )

        return exerciseOptions.filter((exercise) => {
            if (!substitutionTarget || unavailableExerciseIds.has(exercise.id)) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return [
                exercise.displayName,
                exercise.modality,
                exercise.muscleGroup,
            ].some((value) => (value ?? '').toLowerCase().includes(normalizedSearch))
        })
    }, [exerciseOptions, optimisticExerciseLogs, substitutionSearch, substitutionTarget])

    const syncStatusBar = (
        <SyncStatusBar
            isOnline={isOnline}
            pendingCount={pendingQueue.length}
            syncing={syncingPendingQueue}
            onRetry={handleRetryPendingSync}
            labels={{
                online: t('Today.syncOnline'),
                offline: t('Today.syncOffline'),
                pending: t('Today.pendingSetCount', { count: pendingQueue.length }),
                syncing: t('Today.syncingPendingSets'),
                retry: t('Today.retrySync'),
            }}
        />
    )

    if (loading) {
        return (
            <PageShell>
                <div className="h-8 w-40 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-2" />
                <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Surface key={i} className="h-40 animate-pulse" />
                    ))}
                </div>
            </PageShell>
        )
    }

    if (!workout) {
        return (
            <PageShell>
                {syncStatusBar}
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <PageHeader
                    eyebrow={isHistorical ? t('Today.historical') : t('Today.today')}
                    title={dayNames[dayOfWeek]}
                    description={dateISO}
                />
                <EmptyState
                    className="mt-8"
                    icon={<span className="font-black">Zz</span>}
                    title={t('Today.restDay')}
                    description={t('Today.noWorkout')}
                    action={(
                        <div className="flex flex-col items-center gap-3">
                            <Button
                                variant="secondary"
                                onClick={async () => {
                                    await loadAllWorkouts()
                                    setShowOverrideModal(true)
                                }}
                            >
                                {t('Today.startAnyway')}
                            </Button>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('Today.changeSchedule')}</p>
                        </div>
                    )}
                />

                {showOverrideModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                        <div role="dialog" aria-modal="true" aria-labelledby="today-select-workout-title" className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                            <h3 id="today-select-workout-title" className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.selectWorkout')}</h3>
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
            </PageShell>
        )
    }

    if (isSkipped) {
        return (
            <PageShell>
                {syncStatusBar}
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <PageHeader
                    eyebrow={`${isHistorical ? t('Today.historical') : t('Today.today')} • ${dateISO}`}
                    title={workout.name}
                    description={t('Today.youChoseToRest')}
                />
                <EmptyState
                    className="mt-8"
                    icon={<span className="font-black">--</span>}
                    title={t('Today.workoutSkipped')}
                    description={t('Today.youChoseToRest')}
                    action={<Button variant="secondary" onClick={handleUndoSkip}>{t('Today.undoSkip')}</Button>}
                />
            </PageShell>
        )
    }

    if (isRescheduledSource) {
        const destinationLabel = sessionStatus.label ?? dayNames[dayOfWeek]
        const destinationDate = sessionStatus.dateISO

        return (
            <PageShell>
                {syncStatusBar}
                {isHistorical && (
                    <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                        {t('Today.historicalView')}
                    </div>
                )}
                <PageHeader
                    eyebrow={`${isHistorical ? t('Today.historical') : t('Today.today')} • ${dateISO}`}
                    title={workout.name}
                    description={t('Today.rescheduledToDay', { day: destinationLabel })}
                />
                <EmptyState
                    className="mt-8"
                    icon={<span className="font-black">↗</span>}
                    title={t('Today.workoutRescheduled')}
                    description={destinationDate ? t('Today.rescheduledTargetDate', { date: destinationDate }) : t('Today.rescheduledToDay', { day: destinationLabel })}
                    action={(
                        <Button
                            variant="secondary"
                            onClick={async () => {
                                await loadAllWorkouts()
                                setShowOverrideModal(true)
                            }}
                        >
                            {t('Today.startAnyway')}
                        </Button>
                    )}
                />
            </PageShell>
        )
    }

    return (
        <PageShell>
            {syncStatusBar}
            {restTimer ? (
                <div
                    role="timer"
                    aria-live="polite"
                    className="sticky top-20 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-400/25 bg-sky-950/95 px-4 py-3 text-white shadow-xl backdrop-blur"
                >
                    <div className="flex items-center gap-3">
                        <TimerReset className="h-5 w-5 text-sky-300" aria-hidden="true" />
                        <div>
                            <p className="text-xs text-sky-200">{t('Today.restTimer')} • {restTimer.label}</p>
                            <p className="text-2xl font-black tabular-nums">
                                {String(Math.floor(restTimer.remaining / 60)).padStart(2, '0')}:
                                {String(restTimer.remaining % 60).padStart(2, '0')}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setRestTimer((current) =>
                                current ? { ...current, remaining: current.duration } : null
                            )}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            {t('Today.restartTimer')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setRestTimer(null)}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-sky-950"
                        >
                            <SkipForward className="h-4 w-4" aria-hidden="true" />
                            {t('Today.skipTimer')}
                        </button>
                    </div>
                </div>
            ) : null}
            {isHistorical && (
                <div className="mb-4 text-xs font-semibold text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                    {t('Today.historicalView')}
                </div>
            )}
            <PageHeader
                eyebrow={`${dayNames[dayOfWeek]} • ${dateISO}`}
                title={workout.name}
                description={isHistorical ? t('Today.historicalView') : undefined}
                actions={(
                    <>
                        {rotation.totalVariants > 1 && rotation.activeRotationIndex && (
                            <StatusPill className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                {t('Today.rotationBadge', { rotation: rotation.activeRotationIndex, total: rotation.totalVariants })}
                            </StatusPill>
                        )}
                        {isRescheduledTarget && (
                            <StatusPill className="border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200">
                                {t('Today.rescheduledFromLabel', { day: sessionStatus.label ?? dayNames[dayOfWeek] })}
                            </StatusPill>
                        )}
                        <Button
                            variant="secondary"
                            onClick={async () => {
                                await loadAllWorkouts()
                                setShowOverrideModal(true)
                            }}
                        >
                            {t('Today.switchWorkout')}
                        </Button>
                    </>
                )}
            />

            <Surface className="my-6 p-5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('Today.progress')}</span>
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{completedProgressUnits}/{totalProgressUnits} {t('Today.progressUnits')}</span>
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
            </Surface>

            <div className="space-y-4">
                {optimisticExerciseLogs.map((exerciseLog, exerciseIndex) => {
                    const completed = getCompletedExerciseSetCount(exerciseLog)
                    const started = exerciseLog.sets.filter((set) => set.started).length
                    const minimumTargetSets = Math.max(1, started)
                    const hasSavedSets = exerciseLog.sets.some((set) => set.started)
                    const isSavingTargetSets = savingExerciseTargetIds.includes(exerciseLog.originalExerciseId)

                    return (
                        <div key={exerciseLog.exerciseId} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{exerciseLog.exerciseName}</h3>
                                        {exerciseLog.substitution && (
                                            <p className="mt-0.5 text-xs text-violet-500 dark:text-violet-300">
                                                {t('Today.exerciseSubstitutionLabel', {
                                                    original: exerciseLog.originalExerciseName,
                                                    replacement: exerciseLog.exerciseName,
                                                })}
                                            </p>
                                        )}
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                {t('Today.validSetsLabel')}
                                            </span>
                                            <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60">
                                                <button
                                                    type="button"
                                                    onClick={() => handleTargetSetsChange(exerciseIndex, exerciseLog.targetSets - 1)}
                                                    disabled={exerciseLog.skipped || isSavingTargetSets || exerciseLog.targetSets <= minimumTargetSets}
                                                    aria-label={t('Today.decreaseValidSets')}
                                                    className="px-2 py-1 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-900"
                                                >
                                                    −
                                                </button>
                                                <span className="min-w-[58px] px-2 py-1 text-center text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                                                    {exerciseLog.targetSets}/{exerciseLog.plannedTargetSets}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleTargetSetsChange(exerciseIndex, exerciseLog.targetSets + 1)}
                                                    disabled={exerciseLog.skipped || isSavingTargetSets || exerciseLog.targetSets >= exerciseLog.plannedTargetSets}
                                                    aria-label={t('Today.increaseValidSets')}
                                                    className="px-2 py-1 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-900"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            {exerciseLog.targetSets !== exerciseLog.plannedTargetSets && (
                                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                    {t('Today.validSetsAdjusted')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {exerciseLog.skipped && (
                                        <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-500">
                                            {t('Today.exerciseSkippedBadge')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {exerciseLog.substitution ? (
                                        <button
                                            onClick={() => handleUndoSubstitution(exerciseLog)}
                                            disabled={hasSavedSets || exerciseLog.skipped}
                                            className="rounded-lg bg-violet-600/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300 transition-colors hover:bg-violet-600/20 disabled:opacity-40"
                                        >
                                            {t('Today.undoSubstitution')}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => openSubstitutionModal(exerciseLog)}
                                            disabled={hasSavedSets || exerciseLog.skipped}
                                            className="rounded-lg bg-violet-600/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300 transition-colors hover:bg-violet-600/20 disabled:opacity-40"
                                        >
                                            {t('Today.substituteToday')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => exerciseLog.skipped ? handleUndoSkipExercise(exerciseLog.originalExerciseId) : handleSkipExercise(exerciseLog.originalExerciseId)}
                                        disabled={!exerciseLog.skipped && hasSavedSets}
                                        className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                    >
                                        {exerciseLog.skipped ? t('Today.undoSkip') : t('Today.skipExercise')}
                                    </button>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${completed === exerciseLog.targetSets ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                                        {completed}/{exerciseLog.targetSets}
                                    </span>
                                </div>
                            </div>

                            {exerciseLog.skipped ? (
                                <div className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                                    {t('Today.exerciseSkippedDescription')}
                                </div>
                            ) : (
                            <div className="space-y-3 p-3">
                                {exerciseLog.sets.slice(0, exerciseLog.targetSets).map((set, setIndex) => {
                                    const prevMark = exerciseLog.previousSets?.[setIndex]
                                    const setLabelInput = {
                                        exercise: exerciseLog.exerciseName,
                                        setNumber: setIndex + 1,
                                    }
                                    return (
                                    <div
                                        key={set.prescription.id}
                                        data-testid="conceptual-set"
                                        data-set-method={set.prescription.method}
                                        role="group"
                                        aria-label={t('Today.setGroupLabel', setLabelInput)}
                                        className={`rounded-2xl border p-4 ${
                                            set.saved
                                                ? 'border-emerald-500/25 bg-emerald-500/5'
                                                : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50'
                                        }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
                                                    set.saved
                                                        ? 'bg-emerald-500/15 text-emerald-500'
                                                        : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
                                                }`}>
                                                    {set.saved ? '✓' : setIndex + 1}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                        {t(`SetMethods.methods.${set.prescription.method}`)}
                                                    </p>
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                                        {set.segments.length} {t('Today.segments')}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                                set.pendingSync
                                                    ? 'bg-amber-500/15 text-amber-500'
                                                    : set.state === 'completed'
                                                        ? 'bg-emerald-500/15 text-emerald-500'
                                                        : set.state === 'stopped'
                                                            ? 'bg-orange-500/15 text-orange-500'
                                                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                                            }`}>
                                                {set.pendingSync
                                                    ? t('Today.pendingSync')
                                                    : t(`Today.setStates.${set.state}`)}
                                            </span>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {set.segments.map((segment, segmentIndex) => {
                                                const previousSegment = prevMark?.segments[segmentIndex]
                                                const previousSegmentsCompleted = set.segments
                                                    .slice(0, segmentIndex)
                                                    .every((current) => current.completed)
                                                return (
                                                    <div
                                                        key={segment.id}
                                                        className={`grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(110px,0.8fr)_1fr_1fr_auto] sm:items-end ${
                                                            segment.completed
                                                                ? 'border-emerald-500/20 bg-emerald-500/5'
                                                                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                                                        }`}
                                                    >
                                                        <div>
                                                            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                                                                {segmentIndex + 1}. {t(`SetMethods.segmentKinds.${segment.kind}`)}
                                                            </p>
                                                            {segment.targetReps != null ? (
                                                                <p className="mt-1 text-[10px] text-zinc-500">
                                                                    {t('Today.targetReps', { count: segment.targetReps })}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        <label className="text-[10px] text-zinc-500">
                                                            {t('Today.kg')}
                                                            <input
                                                                type="number"
                                                                inputMode="decimal"
                                                                step="0.5"
                                                                value={segment.weight}
                                                                onChange={(event) => handleSetSegmentChange(
                                                                    exerciseIndex,
                                                                    setIndex,
                                                                    segmentIndex,
                                                                    'weight',
                                                                    event.target.value,
                                                                )}
                                                                aria-label={t('Today.segmentWeightLabel', {
                                                                    exercise: exerciseLog.exerciseName,
                                                                    setNumber: setIndex + 1,
                                                                    segmentNumber: segmentIndex + 1,
                                                                })}
                                                                placeholder={
                                                                    previousSegment?.weightKg != null
                                                                        ? String(previousSegment.weightKg)
                                                                        : segment.suggestedWeightKg != null
                                                                            ? String(segment.suggestedWeightKg)
                                                                            : '0'
                                                                }
                                                                className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-center text-base font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                                            />
                                                        </label>
                                                        <label className="text-[10px] text-zinc-500">
                                                            {t('Today.reps')}
                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                value={segment.reps}
                                                                onChange={(event) => handleSetSegmentChange(
                                                                    exerciseIndex,
                                                                    setIndex,
                                                                    segmentIndex,
                                                                    'reps',
                                                                    event.target.value,
                                                                )}
                                                                aria-label={t('Today.segmentRepsLabel', {
                                                                    exercise: exerciseLog.exerciseName,
                                                                    setNumber: setIndex + 1,
                                                                    segmentNumber: segmentIndex + 1,
                                                                })}
                                                                placeholder={
                                                                    previousSegment?.reps != null
                                                                        ? String(previousSegment.reps)
                                                                        : segment.targetReps != null
                                                                            ? String(segment.targetReps)
                                                                            : '0'
                                                                }
                                                                className="mt-1 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-center text-base font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                                            />
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleSaveSegment(exerciseIndex, setIndex, segmentIndex)}
                                                            disabled={!segment.weight || !segment.reps || set.saving || !previousSegmentsCompleted}
                                                            className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition disabled:opacity-30 ${
                                                                segment.completed
                                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                                                    : 'bg-sky-600 text-white hover:bg-sky-500'
                                                            }`}
                                                        >
                                                            {segment.completed
                                                                ? t('Today.segmentSaved')
                                                                : t('Today.saveSegment')}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
                                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                                {t('Today.actualRir')}
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min="0"
                                                    max="10"
                                                    step="0.5"
                                                    value={set.actualRir}
                                                    onChange={(event) => handleActualRirChange(
                                                        exerciseIndex,
                                                        setIndex,
                                                        event.target.value,
                                                    )}
                                                    className="mt-1 block w-28 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                />
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {set.prescription.method === 'myo_reps'
                                                && set.segments.some((segment) => segment.completed)
                                                && set.segments.some((segment) => !segment.completed) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleFinishSet(exerciseIndex, setIndex, 'stopped')}
                                                        disabled={set.saving}
                                                        className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-300"
                                                    >
                                                        {t('Today.stopMyoReps')}
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => void handleFinishSet(exerciseIndex, setIndex)}
                                                    disabled={set.saving || set.segments.some((segment) => !segment.completed)}
                                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-30"
                                                >
                                                    {set.saving ? t('Common.loading') : t('Today.finishSet')}
                                                </button>
                                            </div>
                                        </div>

                                        {prevMark ? (
                                            <p className="mt-3 text-[10px] text-violet-500 dark:text-violet-300">
                                                {t('Today.previousMark')}: {prevMark.segments
                                                    .filter((segment) => segment.completed)
                                                    .map((segment) => `${segment.weightKg ?? 0}${t('Today.kg')} × ${segment.reps ?? 0}`)
                                                    .join(' + ')}
                                            </p>
                                        ) : null}
                                    </div>
                                    )
                                })}
                            </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {cardioLogs.length > 0 && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            {t('Today.cardioSectionTitle')}
                        </h2>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {cardioLogs.length} {t('Today.cardioItemsCount')}
                        </span>
                    </div>

                    {cardioLogs.map((cardioLog) => {
                        const durationParts = splitTotalDuration(cardioLog.totalDurationMinutes)

                        return (
                            <div key={cardioLog.cardioBlockId} className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{cardioLog.cardioName}</h3>
                                            {cardioLog.skipped && (
                                                <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-500">
                                                    {t('Today.exerciseSkippedBadge')}
                                                </span>
                                            )}
                                        </div>
                                        {cardioLog.targetDurationMinutes != null && (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {t('Today.cardioTargetDuration', { minutes: cardioLog.targetDurationMinutes })}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => cardioLog.skipped ? handleUndoSkipCardio(cardioLog.cardioBlockId) : handleSkipCardio(cardioLog.cardioBlockId)}
                                        disabled={!cardioLog.skipped && cardioLog.saved}
                                        className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-40 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                    >
                                        {cardioLog.skipped ? t('Today.undoSkip') : t('Today.skipExercise')}
                                    </button>
                                </div>

                                {cardioLog.skipped ? (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                        {t('Today.cardioSkippedDescription')}
                                    </p>
                                ) : (
                                    <>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            <div>
                                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                    {t('Today.cardioDuration')}
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        inputMode="numeric"
                                                        value={durationParts.hours}
                                                        onChange={(event) => handleCardioDurationPartChange(cardioLog.cardioBlockId, 'hours', event.target.value)}
                                                        placeholder={t('Today.cardioHours')}
                                                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        inputMode="numeric"
                                                        value={durationParts.minutes}
                                                        onChange={(event) => handleCardioDurationPartChange(cardioLog.cardioBlockId, 'minutes', event.target.value)}
                                                        placeholder={t('Today.cardioMinutes')}
                                                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                    {t('Today.cardioDistance')}
                                                </label>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    inputMode="decimal"
                                                    value={cardioLog.totalDistanceKm}
                                                    onChange={(event) => handleCardioDistanceChange(cardioLog.cardioBlockId, event.target.value)}
                                                    placeholder="0"
                                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <button
                                                    onClick={() => handleSaveCardio(cardioLog)}
                                                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
                                                >
                                                    {cardioLog.saved ? t('Common.edit') : t('Common.save')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                                    {t('Today.cardioIntervals')}
                                                </span>
                                                <button
                                                    onClick={() => handleAddCardioInterval(cardioLog.cardioBlockId)}
                                                    className="rounded-lg bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 transition-colors hover:bg-emerald-600/20"
                                                >
                                                    + {t('Today.cardioAddInterval')}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {cardioLog.intervals.length === 0 && (
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        {t('Today.cardioIntervalsHint')}
                                                    </p>
                                                )}
                                                {cardioLog.intervals.map((interval, intervalIndex) => (
                                                    <div key={`${cardioLog.cardioBlockId}:${intervalIndex}`} className="grid gap-2 md:grid-cols-[0.9fr_0.9fr_0.8fr_auto]">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            inputMode="numeric"
                                                            value={interval.durationMinutes}
                                                            onChange={(event) => handleCardioIntervalChange(cardioLog.cardioBlockId, intervalIndex, 'durationMinutes', event.target.value)}
                                                            placeholder={t('Today.cardioDurationMinutes')}
                                                            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                        />
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="0.1"
                                                            inputMode="decimal"
                                                            value={interval.speedKmh}
                                                            onChange={(event) => handleCardioIntervalChange(cardioLog.cardioBlockId, intervalIndex, 'speedKmh', event.target.value)}
                                                            placeholder={t('Today.cardioSpeed')}
                                                            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                        />
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            inputMode="numeric"
                                                            value={interval.repeatCount}
                                                            onChange={(event) => handleCardioIntervalChange(cardioLog.cardioBlockId, intervalIndex, 'repeatCount', event.target.value)}
                                                            placeholder={t('Today.cardioRepeats')}
                                                            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-center text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                                        />
                                                        <button
                                                            onClick={() => handleRemoveCardioInterval(cardioLog.cardioBlockId, intervalIndex)}
                                                            className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20"
                                                        >
                                                            {t('Common.delete')}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {session && (
                <Surface className="mt-6 mb-8 p-5">
                    <FieldLabel htmlFor="today-session-notes">{t('Today.sessionNotes')}</FieldLabel>
                    <Textarea
                        id="today-session-notes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        onBlur={handleSaveNotes}
                        placeholder={t('Today.sessionNotesPlaceholder')}
                        rows={3}
                    />
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('Today.autoSaves')}</p>
                </Surface>
            )}

            {showOverrideModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="today-switch-workout-title" className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 id="today-switch-workout-title" className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.switchWorkout')}</h3>
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

            {substitutionTarget && (
                <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="today-substitute-title" className="w-full max-w-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 id="today-substitute-title" className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.substituteToday')}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                            {t('Today.substituteExerciseDescription', { exercise: substitutionTarget.originalExerciseName })}
                        </p>
                        <Input
                            value={substitutionSearch}
                            onChange={(event) => setSubstitutionSearch(event.target.value)}
                            placeholder={t('Today.substituteExerciseSearch')}
                            className="mb-4"
                        />
                        <div className="mb-6 max-h-80 space-y-2 overflow-y-auto">
                            {loadingExerciseOptions && (
                                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{t('Common.loading')}</p>
                            )}
                            {!loadingExerciseOptions && filteredSubstitutionOptions.map((exercise) => (
                                <button
                                    key={exercise.id}
                                    onClick={() => handleSubstituteExercise(exercise.id)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900"
                                >
                                    <span className="block text-sm font-semibold text-zinc-900 dark:text-white">{exercise.displayName}</span>
                                    <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                                        {[exercise.source === 'system' ? t('Today.baseExercise') : t('Today.myExercise'), exercise.muscleGroup, exercise.modality].filter(Boolean).join(' • ')}
                                    </span>
                                </button>
                            ))}
                            {!loadingExerciseOptions && filteredSubstitutionOptions.length === 0 && (
                                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{t('Today.noSubstitutionOptions')}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setSubstitutionTarget(null)}
                            className="w-full py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
                        >
                            {t('Common.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {showRescheduleModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="today-reschedule-title" className="w-full max-w-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 animate-[slideUp_0.3s_ease-out]">
                        <h3 id="today-reschedule-title" className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{t('Today.rescheduleWorkout')}</h3>
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
        </PageShell>
    )
}
