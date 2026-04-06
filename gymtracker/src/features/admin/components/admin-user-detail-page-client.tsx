'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import {
    deleteAdminUserAction,
    recordManualBillingEventAction,
    resetAdminUserTemporaryPasswordAction,
    updateAdminUserAction,
} from '@/features/admin/actions'
import type {
    AdminBillingInput,
    AdminUserDetailData,
    AdminUpdateUserInput,
} from '@/features/admin/types'

interface AdminUserDetailPageClientProps {
    detail: AdminUserDetailData
}

function formatDate(value: string | null, withTime = false) {
    if (!value) {
        return 'Não disponível'
    }

    const parsed = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)

    return parsed.toLocaleString(
        'pt-BR',
        withTime
            ? { dateStyle: 'short', timeStyle: 'short' }
            : { dateStyle: 'short' },
    )
}

function getCurrentMonthReference() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
}

export function AdminUserDetailPageClient({
    detail,
}: AdminUserDetailPageClientProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const [userForm, setUserForm] = useState<AdminUpdateUserInput>({
        displayName: detail.user.displayName,
        role: detail.user.role,
        accessStatus: detail.user.accessStatus,
        memberAccessMode: detail.user.memberAccessMode,
        billingDayOfMonth: detail.user.billingDayOfMonth,
        billingGraceBusinessDays: detail.user.billingGraceBusinessDays,
        paidUntil: detail.user.paidUntil,
        trialEndsAt: detail.user.trialEndsAt,
    })
    const [billingForm, setBillingForm] = useState<AdminBillingInput>({
        referenceMonth: getCurrentMonthReference(),
        status: 'paid',
        note: '',
    })
    const [temporaryPassword, setTemporaryPassword] = useState('')
    const [savingUser, setSavingUser] = useState(false)
    const [savingBilling, setSavingBilling] = useState(false)
    const [resettingPassword, setResettingPassword] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    const billingStatusLabel = useMemo(
        () => ({
            paid: 'Pago',
            unpaid: 'Não pago',
            waived: 'Cortesia',
        }),
        [],
    )

    async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSavingUser(true)
        const result = await updateAdminUserAction(detail.user.id, userForm)
        setSavingUser(false)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível salvar este usuário.', 'error')
            return
        }

        showToast('Usuário atualizado.')
        router.refresh()
    }

    async function handleRecordBilling(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSavingBilling(true)
        const result = await recordManualBillingEventAction(detail.user.id, billingForm)
        setSavingBilling(false)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível registrar a cobrança.', 'error')
            return
        }

        showToast('Cobrança manual registrada.')
        router.refresh()
    }

    async function handleResetTemporaryPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (temporaryPassword.length < 8) {
            showToast('A senha provisória precisa ter pelo menos 8 caracteres.', 'error')
            return
        }

        setResettingPassword(true)
        const result = await resetAdminUserTemporaryPasswordAction(
            detail.user.id,
            temporaryPassword,
        )
        setResettingPassword(false)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível resetar a senha agora.', 'error')
            return
        }

        showToast('Senha provisória atualizada.')
        setTemporaryPassword('')
        router.refresh()
    }

    async function handleDeleteUser() {
        const result = await deleteAdminUserAction(detail.user.id)

        if (!result.ok) {
            showToast(result.message ?? 'Não foi possível excluir o usuário.', 'error')
            return
        }

        showToast('Usuário excluído.')
        router.replace('/admin/users')
        router.refresh()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-500">
                        Detalhe do usuário
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                        {detail.user.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {detail.user.email ?? 'Sem e-mail'}
                    </p>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Pago até
                    </p>
                    <p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
                        {detail.user.memberAccessMode === 'billable'
                            ? formatDate(detail.user.paidUntil)
                            : detail.user.memberAccessMode === 'trial'
                                ? formatDate(detail.user.trialEndsAt)
                                : 'Livre'}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Último treino
                    </p>
                    <p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
                        {formatDate(detail.lastWorkoutAt)}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Última medição
                    </p>
                    <p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
                        {formatDate(detail.lastBodyMeasurementAt)}
                    </p>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Última atividade
                    </p>
                    <p className="mt-3 text-2xl font-black text-zinc-900 dark:text-white">
                        {formatDate(detail.lastActivityAt)}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <form
                    onSubmit={handleUpdateUser}
                    className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        Dados e acesso
                    </h3>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Nome
                            </span>
                            <input
                                type="text"
                                value={userForm.displayName}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        displayName: event.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Papel
                            </span>
                            <select
                                value={userForm.role}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        role: event.target.value as AdminUpdateUserInput['role'],
                                        paidUntil:
                                            event.target.value === 'admin' ? null : current.paidUntil,
                                    }))
                                }
                                disabled={detail.isSelf}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            >
                                <option value="member">Aluno</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Status
                            </span>
                            <select
                                value={userForm.accessStatus}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        accessStatus: event.target.value as AdminUpdateUserInput['accessStatus'],
                                    }))
                                }
                                disabled={detail.isSelf}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                                value={userForm.memberAccessMode}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        memberAccessMode: event.target.value as AdminUpdateUserInput['memberAccessMode'],
                                        paidUntil:
                                            event.target.value === 'billable' ? current.paidUntil : null,
                                        trialEndsAt:
                                            event.target.value === 'trial' ? current.trialEndsAt : null,
                                    }))
                                }
                                disabled={detail.isSelf || userForm.role === 'admin'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                                value={userForm.paidUntil ?? ''}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        paidUntil: event.target.value || null,
                                    }))
                                }
                                disabled={userForm.role === 'admin' || userForm.memberAccessMode !== 'billable'}
                                required={
                                    userForm.role === 'member' &&
                                    userForm.accessStatus === 'active' &&
                                    userForm.memberAccessMode === 'billable'
                                }
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                                value={userForm.billingDayOfMonth ?? ''}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        billingDayOfMonth: event.target.value ? Number(event.target.value) : null,
                                    }))
                                }
                                disabled={userForm.role === 'admin' || userForm.memberAccessMode !== 'billable'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                                value={userForm.billingGraceBusinessDays}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        billingGraceBusinessDays: Number(event.target.value || 0),
                                    }))
                                }
                                disabled={userForm.role === 'admin' || userForm.memberAccessMode !== 'billable'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Teste até
                            </span>
                            <input
                                type="date"
                                value={userForm.trialEndsAt ?? ''}
                                onChange={(event) =>
                                    setUserForm((current) => ({
                                        ...current,
                                        trialEndsAt: event.target.value || null,
                                    }))
                                }
                                disabled={userForm.role === 'admin' || userForm.memberAccessMode !== 'trial'}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="submit"
                            disabled={savingUser}
                            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingUser ? 'Salvando...' : 'Salvar usuário'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDeleteOpen(true)}
                            disabled={detail.isSelf}
                            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Excluir usuário
                        </button>
                    </div>
                </form>

                <div className="space-y-6">
                    <form
                        onSubmit={handleResetTemporaryPassword}
                        className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Senha provisória
                        </h3>
                        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Define uma nova senha provisória e volta a exigir troca de senha no próximo login.
                        </p>
                        <label className="mt-4 block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Nova senha provisória
                            </span>
                            <input
                                type="text"
                                value={temporaryPassword}
                                onChange={(event) => setTemporaryPassword(event.target.value)}
                                minLength={8}
                                disabled={detail.isSelf}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={resettingPassword || detail.isSelf}
                            className="mt-4 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                        >
                            {resettingPassword ? 'Atualizando...' : 'Resetar senha provisória'}
                        </button>
                    </form>

                    <form
                        onSubmit={handleRecordBilling}
                        className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Cobrança manual
                        </h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Mês de referência
                                </span>
                                <input
                                    type="date"
                                    value={billingForm.referenceMonth}
                                    onChange={(event) =>
                                        setBillingForm((current) => ({
                                            ...current,
                                            referenceMonth: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                    Resultado
                                </span>
                                <select
                                    value={billingForm.status}
                                    onChange={(event) =>
                                        setBillingForm((current) => ({
                                            ...current,
                                            status: event.target.value as AdminBillingInput['status'],
                                        }))
                                    }
                                    className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                                >
                                    <option value="paid">Pago</option>
                                    <option value="unpaid">Não pago</option>
                                    <option value="waived">Cortesia</option>
                                </select>
                            </label>
                        </div>
                        <label className="mt-4 block">
                            <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                Observação
                            </span>
                            <textarea
                                value={billingForm.note ?? ''}
                                onChange={(event) =>
                                    setBillingForm((current) => ({
                                        ...current,
                                        note: event.target.value,
                                    }))
                                }
                                rows={3}
                                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={savingBilling || detail.user.memberAccessMode !== 'billable'}
                            className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingBilling ? 'Registrando...' : 'Registrar cobrança'}
                        </button>
                        {detail.user.memberAccessMode !== 'billable' ? (
                            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                                A cobrança manual só se aplica a usuários com cobrança mensal.
                            </p>
                        ) : null}
                    </form>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        Histórico de cobrança
                    </h3>
                    <div className="mt-4 space-y-3">
                        {detail.billingEvents.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Nenhum evento de cobrança registrado ainda.
                            </p>
                        ) : (
                            detail.billingEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                {formatDate(event.referenceMonth)}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                Registrado por {event.recordedByName ?? 'admin'} em{' '}
                                                {formatDate(event.createdAt, true)}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                            {billingStatusLabel[event.status]}
                                        </span>
                                    </div>
                                    {event.note ? (
                                        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                                            {event.note}
                                        </p>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        Auditoria recente
                    </h3>
                    <div className="mt-4 space-y-3">
                        {detail.auditEntries.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Nenhuma ação administrativa recente para esta conta.
                            </p>
                        ) : (
                            detail.auditEntries.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                            {entry.action}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {formatDate(entry.createdAt, true)}
                                        </p>
                                    </div>
                                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                                        {entry.actorName}
                                        {entry.targetName ? ` -> ${entry.targetName}` : ''}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={confirmDeleteOpen}
                title="Excluir usuário?"
                description="Isso remove a conta de autenticação e os dados relacionados. Use só quando tiver certeza."
                confirmLabel="Excluir definitivamente"
                variant="danger"
                onConfirm={handleDeleteUser}
                onCancel={() => setConfirmDeleteOpen(false)}
            />
        </div>
    )
}
