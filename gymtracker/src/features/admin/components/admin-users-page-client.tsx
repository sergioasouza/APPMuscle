'use client'

import Link from 'next/link'
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { createAdminUserAction } from '@/features/admin/actions'
import type {
    AdminCreateUserInput,
    AdminUserListItem,
    AdminUserListQuery,
} from '@/features/admin/types'

interface AdminUsersPageClientProps {
    initialUsers: AdminUserListItem[]
    initialQuery: AdminUserListQuery
}

const emptyDraft: AdminCreateUserInput = {
    displayName: '',
    email: '',
    temporaryPassword: '',
    role: 'member',
    accessStatus: 'active',
    memberAccessMode: 'internal',
    billingDayOfMonth: 5,
    billingGraceBusinessDays: 0,
    paidUntil: '',
    trialDays: 7,
    trialEndsAt: '',
}

function formatDate(value: string | null) {
    if (!value) {
        return 'Não definido'
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

export function AdminUsersPageClient({
    initialUsers,
    initialQuery,
}: AdminUsersPageClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { showToast } = useToast()
    const [search, setSearch] = useState(initialQuery.search)
    const deferredSearch = useDeferredValue(search)
    const [isPending, startTransition] = useTransition()
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [draft, setDraft] = useState<AdminCreateUserInput>(emptyDraft)
    const [creating, setCreating] = useState(false)

    const todayISO = new Date().toISOString().slice(0, 10)

    const stats = useMemo(() => {
        return {
            total: initialUsers.length,
            admins: initialUsers.filter((user) => user.role === 'admin').length,
            active: initialUsers.filter(
                (user) =>
                    user.role === 'admin' ||
                    (user.accessStatus === 'active' &&
                        user.paidUntil != null &&
                        user.paidUntil >= todayISO),
            ).length,
            blocked: initialUsers.filter(
                (user) =>
                    user.role === 'member' &&
                    (user.accessStatus === 'blocked' ||
                        user.paidUntil == null ||
                        user.paidUntil < todayISO),
            ).length,
        }
    }, [initialUsers, todayISO])

    const replaceQuery = useCallback((next: Partial<AdminUserListQuery>) => {
        const params = new URLSearchParams(searchParams.toString())
        const nextSearch = next.search ?? search

        if (nextSearch.trim()) {
            params.set('search', nextSearch.trim())
        } else {
            params.delete('search')
        }

        const statusFilter = next.statusFilter ?? initialQuery.statusFilter
        const roleFilter = next.roleFilter ?? initialQuery.roleFilter
        const paymentFilter = next.paymentFilter ?? initialQuery.paymentFilter

        if (statusFilter !== 'all') {
            params.set('status', statusFilter)
        } else {
            params.delete('status')
        }

        if (roleFilter !== 'all') {
            params.set('role', roleFilter)
        } else {
            params.delete('role')
        }

        if (paymentFilter !== 'all') {
            params.set('payment', paymentFilter)
        } else {
            params.delete('payment')
        }

        const href = params.toString() ? `/admin/users?${params}` : '/admin/users'

        startTransition(() => {
            router.replace(href, { scroll: false })
        })
    }, [
        initialQuery.paymentFilter,
        initialQuery.roleFilter,
        initialQuery.statusFilter,
        router,
        search,
        searchParams,
    ])

    useEffect(() => {
        if (deferredSearch === initialQuery.search) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            replaceQuery({
                search: deferredSearch,
                statusFilter: initialQuery.statusFilter,
                roleFilter: initialQuery.roleFilter,
                paymentFilter: initialQuery.paymentFilter,
            })
        }, 250)

        return () => window.clearTimeout(timeoutId)
    }, [
        deferredSearch,
        initialQuery.paymentFilter,
        initialQuery.roleFilter,
        initialQuery.search,
        initialQuery.statusFilter,
        replaceQuery,
    ])

    async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (creating) {
            return
        }

        setCreating(true)
        const result = await createAdminUserAction(draft)
        setCreating(false)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível criar o usuário agora.', 'error')
            return
        }

        showToast('Usuário criado com sucesso.')
        setDraft(emptyDraft)
        setShowCreateForm(false)
        router.refresh()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                        Usuários
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Crie contas, acompanhe pagamento manual e gerencie o acesso de cada aluno.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowCreateForm((current) => !current)}
                    className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                    {showCreateForm ? 'Fechar criação' : 'Novo usuário'}
                </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Total
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {stats.total}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Ativos
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {stats.active}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Bloqueados
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {stats.blocked}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Admins
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {stats.admins}
                    </p>
                </div>
            </div>

            {showCreateForm ? (
                <form
                    onSubmit={handleCreateUser}
                    className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Nome
                            </span>
                            <input
                                type="text"
                                value={draft.displayName}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        displayName: event.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                E-mail
                            </span>
                            <input
                                type="email"
                                value={draft.email}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        email: event.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Senha provisória
                            </span>
                            <input
                                type="text"
                                value={draft.temporaryPassword}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        temporaryPassword: event.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                minLength={8}
                                required
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Papel
                            </span>
                            <select
                                value={draft.role}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        role: event.target.value as AdminCreateUserInput['role'],
                                        paidUntil:
                                            event.target.value === 'admin' ? '' : current.paidUntil,
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            >
                                <option value="member">Aluno</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Status de acesso
                            </span>
                            <select
                                value={draft.accessStatus}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        accessStatus: event.target.value as AdminCreateUserInput['accessStatus'],
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            >
                                <option value="active">Ativo</option>
                                <option value="blocked">Bloqueado</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Tipo de acesso
                            </span>
                            <select
                                value={draft.memberAccessMode}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        memberAccessMode: event.target.value as AdminCreateUserInput['memberAccessMode'],
                                        paidUntil:
                                            event.target.value === 'billable' ? current.paidUntil : '',
                                        trialEndsAt:
                                            event.target.value === 'trial' ? current.trialEndsAt : '',
                                    }))
                                }
                                disabled={draft.role === 'admin'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            >
                                <option value="internal">Sem cobrança</option>
                                <option value="billable">Cobrança mensal</option>
                                <option value="trial">Teste temporário</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Pago até
                            </span>
                            <input
                                type="date"
                                value={draft.paidUntil ?? ''}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        paidUntil: event.target.value,
                                    }))
                                }
                                disabled={draft.role === 'admin' || draft.memberAccessMode !== 'billable'}
                                required={
                                    draft.role === 'member' &&
                                    draft.accessStatus === 'active' &&
                                    draft.memberAccessMode === 'billable'
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Dia da cobrança
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={31}
                                value={draft.billingDayOfMonth ?? ''}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        billingDayOfMonth: event.target.value ? Number(event.target.value) : null,
                                    }))
                                }
                                disabled={draft.role === 'admin' || draft.memberAccessMode !== 'billable'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Tolerância em dias úteis
                            </span>
                            <input
                                type="number"
                                min={0}
                                max={10}
                                value={draft.billingGraceBusinessDays}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        billingGraceBusinessDays: Number(event.target.value || 0),
                                    }))
                                }
                                disabled={draft.role === 'admin' || draft.memberAccessMode !== 'billable'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Dias de teste
                            </span>
                            <input
                                type="number"
                                min={1}
                                max={90}
                                value={draft.trialDays ?? ''}
                                onChange={(event) =>
                                    setDraft((current) => ({
                                        ...current,
                                        trialDays: event.target.value ? Number(event.target.value) : null,
                                    }))
                                }
                                disabled={draft.role === 'admin' || draft.memberAccessMode !== 'trial'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                    </div>

                    <div className="mt-5 flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowCreateForm(false)
                                setDraft(emptyDraft)
                            }}
                            className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={creating}
                            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creating ? 'Criando...' : 'Criar usuário'}
                        </button>
                    </div>
                </form>
            ) : null}

            <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="grid gap-3 lg:grid-cols-[2fr_repeat(3,1fr)]">
                    <label className="block lg:col-span-1">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Buscar
                        </span>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Nome ou e-mail..."
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Papel
                        </span>
                        <select
                            value={initialQuery.roleFilter}
                            onChange={(event) =>
                                replaceQuery({
                                    search,
                                    roleFilter: event.target.value as AdminUserListQuery['roleFilter'],
                                })
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="member">Alunos</option>
                            <option value="admin">Admins</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Acesso
                        </span>
                        <select
                            value={initialQuery.statusFilter}
                            onChange={(event) =>
                                replaceQuery({
                                    search,
                                    statusFilter: event.target.value as AdminUserListQuery['statusFilter'],
                                })
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="active">Ativos</option>
                            <option value="blocked">Bloqueados</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                            Pagamento
                        </span>
                        <select
                            value={initialQuery.paymentFilter}
                            onChange={(event) =>
                                replaceQuery({
                                    search,
                                    paymentFilter: event.target.value as AdminUserListQuery['paymentFilter'],
                                })
                            }
                            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="paid">Em dia</option>
                            <option value="overdue">Vencidos</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="space-y-3">
                {initialUsers.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                            Nenhum usuário encontrado
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Ajuste os filtros ou crie uma nova conta.
                        </p>
                    </div>
                ) : (
                    initialUsers.map((user) => (
                        <Link
                            key={user.id}
                            href={`/admin/users/${user.id}`}
                            className="block rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-white">
                                            {user.displayName}
                                        </h3>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${user.role === 'admin'
                                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                            }`}>
                                            {user.role === 'admin' ? 'Admin' : 'Aluno'}
                                        </span>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${user.accessStatus === 'active'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            }`}>
                                            {user.accessStatus === 'active' ? 'Ativo' : 'Bloqueado'}
                                        </span>
                                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                            {user.memberAccessMode === 'internal'
                                                ? 'Sem cobrança'
                                                : user.memberAccessMode === 'billable'
                                                    ? 'Cobrança mensal'
                                                    : 'Teste'}
                                        </span>
                                        {user.mustChangePassword ? (
                                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                Troca de senha pendente
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                        {user.email ?? 'Sem e-mail'}
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                                    <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            Pago até
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                                            {user.memberAccessMode === 'billable'
                                                ? formatDate(user.paidUntil)
                                                : user.memberAccessMode === 'trial'
                                                    ? formatDate(user.trialEndsAt)
                                                    : 'Livre'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            Último login
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                                            {user.lastSignInAt
                                                ? new Date(user.lastSignInAt).toLocaleDateString('pt-BR')
                                                : 'Nunca'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
                                        <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                            Atualizado
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                                            {new Date(user.updatedAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
            {isPending ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Atualizando lista...
                </p>
            ) : null}
        </div>
    )
}
