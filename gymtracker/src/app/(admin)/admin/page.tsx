import Link from 'next/link'
import { getAdminDashboardData } from '@/features/admin/service'

function formatDateTime(value: string) {
    return new Date(value).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    })
}

export default async function AdminHomePage() {
    const data = await getAdminDashboardData()

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm uppercase tracking-[0.25em] text-violet-500">
                    Operação
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Visão geral
                </h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    Um painel simples para acompanhar acesso, pagamentos e atividades administrativas.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Alunos ativos
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {data.summary.activeMembers}
                    </p>
                </div>
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Alunos bloqueados
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {data.summary.blockedMembers}
                    </p>
                </div>
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Vencendo no mês
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {data.summary.expiringThisMonth}
                    </p>
                </div>
                <div className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        Recebimentos no mês
                    </p>
                    <p className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
                        {data.summary.currentMonthReceipts}
                    </p>
                </div>
            </div>

            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                            Saúde operacional
                        </p>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                            Service role para ações administrativas
                        </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        data.operational.serviceRoleConfigured
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-red-500/15 text-red-500'
                    }`}>
                        {data.operational.serviceRoleConfigured ? 'Configurada' : 'Faltando env'}
                    </span>
                </div>
                {!data.operational.serviceRoleConfigured && (
                    <p className="mt-3 text-xs text-red-500">
                        Configure SUPABASE_SERVICE_ROLE_KEY em Production na Vercel e faça um novo deploy.
                    </p>
                )}
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                                Usuários recentes
                            </h3>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                Referência de cobrança atual: {new Date(`${data.currentReferenceMonth}T00:00:00`).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                        <Link
                            href="/admin/users"
                            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                        >
                            Ver todos
                        </Link>
                    </div>

                    <div className="mt-4 space-y-3">
                        {data.recentUsers.map((user) => (
                            <Link
                                key={user.id}
                                href={`/admin/users/${user.id}`}
                                className="block rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-700"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                        {user.displayName}
                                    </p>
                                    <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-zinc-900">
                                        {user.role === 'admin' ? 'Admin' : 'Aluno'}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                                    {user.email ?? 'Sem e-mail'}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        Auditoria recente
                    </h3>
                    <div className="mt-4 space-y-3">
                        {data.recentAuditLog.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                Nenhuma ação recente registrada.
                            </p>
                        ) : (
                            data.recentAuditLog.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                                {entry.action}
                                            </p>
                                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                                {entry.actorName}
                                                {entry.targetName ? ` -> ${entry.targetName}` : ''}
                                            </p>
                                        </div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {formatDateTime(entry.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    )
}
