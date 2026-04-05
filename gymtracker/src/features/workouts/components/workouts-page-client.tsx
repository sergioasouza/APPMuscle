'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { createWorkoutAction, deleteWorkoutAction } from '@/features/workouts/actions'
import { WorkoutsSectionNav } from '@/features/workouts/components/workouts-section-nav'
import type { WorkoutListItem } from '@/features/workouts/types'

interface WorkoutsPageClientProps {
    initialWorkouts: WorkoutListItem[]
}

function createClientMutationId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function WorkoutsPageClient({ initialWorkouts }: WorkoutsPageClientProps) {
    const t = useTranslations()
    const router = useRouter()
    const { showToast } = useToast()

    const [workouts, setWorkouts] = useState(initialWorkouts)
    const [showNewForm, setShowNewForm] = useState(false)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<WorkoutListItem | null>(null)
    const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null)
    const latestDeleteMutationByWorkoutRef = useRef<Record<string, string>>({})

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()

        if (creating || !newName.trim()) {
            return
        }

        setCreating(true)

        try {
            const result = await createWorkoutAction(newName)

            if (!result.ok || !result.data) {
                showToast(result.message ?? 'Unable to create workout', 'error')
                return
            }

            setWorkouts((prev) => [result.data!, ...prev])
            setShowNewForm(false)
            setNewName('')
            showToast(t('Workouts.toastCreated', { name: result.data.name }))
            router.push(`/workouts/${result.data.id}`)
        } finally {
            setCreating(false)
        }
    }

    async function handleDelete() {
        if (!deleteTarget) {
            return
        }

        const target = deleteTarget
        if (deletingWorkoutId === target.id) {
            return
        }

        const clientMutationId = createClientMutationId()
        latestDeleteMutationByWorkoutRef.current[target.id] = clientMutationId
        setDeletingWorkoutId(target.id)
        const previousWorkouts = workouts

        setDeleteTarget(null)
        setWorkouts((prev) => prev.filter((workout) => workout.id !== target.id))

        try {
            const result = await deleteWorkoutAction(target.id)

            if (latestDeleteMutationByWorkoutRef.current[target.id] !== clientMutationId) {
                return
            }

            if (!result.ok) {
                setWorkouts(previousWorkouts)
                showToast(result.message ?? 'Unable to delete workout', 'error')
                return
            }

            showToast(t('Workouts.toastDeleted', { name: target.name }))
        } finally {
            if (latestDeleteMutationByWorkoutRef.current[target.id] === clientMutationId) {
                setDeletingWorkoutId(null)
            }
        }
    }

    return (
        <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('Workouts.title')}</h1>
                <button
                    disabled={creating || deletingWorkoutId !== null}
                    onClick={() => setShowNewForm(true)}
                    className="px-4 py-2.5 bg-violet-600 text-zinc-900 dark:text-white text-sm font-semibold rounded-xl
            hover:bg-violet-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    + {t('Workouts.newButton')}
                </button>
            </div>

            <WorkoutsSectionNav />

            {showNewForm && (
                <form
                    onSubmit={handleCreate}
                    className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4
            animate-[slideDown_0.2s_ease-out]"
                >
                    <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">{t('Common.name')}</label>
                    <input
                        type="text"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder={t('Workouts.workoutNamePlaceholder')}
                        autoFocus
                        className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-base"
                    />
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowNewForm(false)
                                setNewName('')
                            }}
                            className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium rounded-xl
                hover:bg-zinc-700 transition-colors text-sm"
                        >
                            {t('Common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={creating || !newName.trim()}
                            className="flex-1 py-2.5 bg-violet-600 text-zinc-900 dark:text-white font-medium rounded-xl
                hover:bg-violet-500 transition-colors disabled:opacity-50 text-sm"
                        >
                            {creating ? '...' : t('Common.create')}
                        </button>
                    </div>
                </form>
            )}

            {workouts.length === 0 && !showNewForm ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">{t('Workouts.noWorkouts')}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t('Workouts.createNew')}</p>
                    <button
                        onClick={() => setShowNewForm(true)}
                        className="px-6 py-3 bg-violet-600 text-zinc-900 dark:text-white font-semibold rounded-xl
              hover:bg-violet-500 active:scale-95 transition-all"
                    >
                        {t('Workouts.createWorkout')}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {workouts.map((workout) => (
                        <div
                            key={workout.id}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-4
                flex items-center justify-between group hover:border-zinc-700 transition-colors"
                        >
                            <button
                                disabled={deletingWorkoutId !== null}
                                onClick={() => router.push(`/workouts/${workout.id}`)}
                                className="flex-1 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{workout.name}</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('Workouts.tapToEdit')}</p>
                            </button>

                            <button
                                disabled={deletingWorkoutId !== null}
                                onClick={() => setDeleteTarget(workout)}
                                className="p-2 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-red-400 transition-colors ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title={t('Workouts.deleteConfirmTitle')}
                description={t('Workouts.deleteConfirmDesc').replace('{name}', deleteTarget?.name || '')}
                confirmLabel={t('Common.delete')}
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    )
}
