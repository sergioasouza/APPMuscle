'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import {
    archiveAdminSystemExerciseAction,
    createAdminSystemExerciseAction,
    unarchiveAdminSystemExerciseAction,
    updateAdminSystemExerciseAction,
} from '@/features/admin/actions'
import type { AdminSystemExerciseInput, AdminSystemExerciseItem } from '@/features/admin/types'

interface AdminExercisesPageClientProps {
    initialExercises: AdminSystemExerciseItem[]
}

const emptyDraft: AdminSystemExerciseInput = {
    name: '',
    modality: '',
    muscleGroup: '',
}

type StatusFilter = 'all' | 'active' | 'archived'

export function AdminExercisesPageClient({
    initialExercises,
}: AdminExercisesPageClientProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
    const [createDraft, setCreateDraft] = useState<AdminSystemExerciseInput>(emptyDraft)
    const [creating, setCreating] = useState(false)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [drafts, setDrafts] = useState<Record<string, AdminSystemExerciseInput>>(
        () =>
            initialExercises.reduce<Record<string, AdminSystemExerciseInput>>(
                (accumulator, exercise) => {
                    accumulator[exercise.id] = {
                        name: exercise.name,
                        modality: exercise.modality ?? '',
                        muscleGroup: exercise.muscleGroup ?? '',
                    }
                    return accumulator
                },
                {},
            ),
    )

    const filteredExercises = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()

        return initialExercises.filter((exercise) => {
            const matchesSearch =
                normalizedSearch.length === 0 ||
                exercise.name.toLowerCase().includes(normalizedSearch) ||
                (exercise.modality ?? '').toLowerCase().includes(normalizedSearch) ||
                (exercise.muscleGroup ?? '').toLowerCase().includes(normalizedSearch) ||
                (exercise.systemKey ?? '').toLowerCase().includes(normalizedSearch)

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active'
                    ? exercise.archivedAt == null
                    : exercise.archivedAt != null)

            return matchesSearch && matchesStatus
        })
    }, [initialExercises, search, statusFilter])

    async function handleCreateExercise(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setCreating(true)
        const result = await createAdminSystemExerciseAction(createDraft)
        setCreating(false)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível criar o exercício base.', 'error')
            return
        }

        showToast('Exercício base criado.')
        setCreateDraft(emptyDraft)
        router.refresh()
    }

    async function handleSaveExercise(exerciseId: string) {
        const draft = drafts[exerciseId]
        setSavingId(exerciseId)
        const result = await updateAdminSystemExerciseAction(exerciseId, draft)
        setSavingId(null)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível salvar o exercício base.', 'error')
            return
        }

        showToast('Exercício base atualizado.')
        router.refresh()
    }

    async function handleToggleArchive(exercise: AdminSystemExerciseItem) {
        setSavingId(exercise.id)
        const result =
            exercise.archivedAt == null
                ? await archiveAdminSystemExerciseAction(exercise.id)
                : await unarchiveAdminSystemExerciseAction(exercise.id)
        setSavingId(null)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível atualizar o status do exercício.', 'error')
            return
        }

        showToast(exercise.archivedAt == null ? 'Exercício arquivado.' : 'Exercício reativado.')
        router.refresh()
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Exercícios base
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
                    O admin controla o catálogo canônico do sistema. Overrides dos usuários continuam locais e não são perdidos.
                </p>
            </div>

            <form
                onSubmit={handleCreateExercise}
                className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                    Novo exercício base
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Nome
                        </span>
                        <input
                            type="text"
                            value={createDraft.name}
                            onChange={(event) =>
                                setCreateDraft((current) => ({
                                    ...current,
                                    name: event.target.value,
                                }))
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            required
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Modalidade
                        </span>
                        <input
                            type="text"
                            value={createDraft.modality ?? ''}
                            onChange={(event) =>
                                setCreateDraft((current) => ({
                                    ...current,
                                    modality: event.target.value,
                                }))
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Grupo muscular
                        </span>
                        <input
                            type="text"
                            value={createDraft.muscleGroup ?? ''}
                            onChange={(event) =>
                                setCreateDraft((current) => ({
                                    ...current,
                                    muscleGroup: event.target.value,
                                }))
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </label>
                </div>
                <button
                    type="submit"
                    disabled={creating}
                    className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {creating ? 'Criando...' : 'Criar exercício base'}
                </button>
            </form>

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Buscar
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Nome, system key, modalidade ou grupo muscular"
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Status
                        </span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="active">Ativos</option>
                            <option value="archived">Arquivados</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="space-y-3">
                {filteredExercises.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                            Nenhum exercício base encontrado
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Ajuste a busca ou o filtro de status.
                        </p>
                    </div>
                ) : (
                    filteredExercises.map((exercise) => {
                        const draft = drafts[exercise.id] ?? emptyDraft

                        return (
                            <div
                                key={exercise.id}
                                className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-white">
                                                {exercise.name}
                                            </h3>
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${exercise.archivedAt == null
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                }`}>
                                                {exercise.archivedAt == null ? 'Ativo' : 'Arquivado'}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                                            {exercise.systemKey ?? 'sem system key'}
                                        </p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleArchive(exercise)}
                                            disabled={savingId === exercise.id}
                                            className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                                        >
                                            {savingId === exercise.id
                                                ? 'Atualizando...'
                                                : exercise.archivedAt == null
                                                    ? 'Arquivar'
                                                    : 'Reativar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSaveExercise(exercise.id)}
                                            disabled={savingId === exercise.id}
                                            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {savingId === exercise.id ? 'Salvando...' : 'Salvar'}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Nome
                                        </span>
                                        <input
                                            type="text"
                                            value={draft.name}
                                            onChange={(event) =>
                                                setDrafts((current) => ({
                                                    ...current,
                                                    [exercise.id]: {
                                                        ...draft,
                                                        name: event.target.value,
                                                    },
                                                }))
                                            }
                                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Modalidade
                                        </span>
                                        <input
                                            type="text"
                                            value={draft.modality ?? ''}
                                            onChange={(event) =>
                                                setDrafts((current) => ({
                                                    ...current,
                                                    [exercise.id]: {
                                                        ...draft,
                                                        modality: event.target.value,
                                                    },
                                                }))
                                            }
                                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            Grupo muscular
                                        </span>
                                        <input
                                            type="text"
                                            value={draft.muscleGroup ?? ''}
                                            onChange={(event) =>
                                                setDrafts((current) => ({
                                                    ...current,
                                                    [exercise.id]: {
                                                        ...draft,
                                                        muscleGroup: event.target.value,
                                                    },
                                                }))
                                            }
                                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                        />
                                    </label>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
