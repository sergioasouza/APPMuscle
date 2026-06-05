import Link from "next/link";
import {
  MetricCard,
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/ui/surface";
import { getAdminDashboardData, listAdminUsers } from "@/features/admin/service";
import type { AdminUserListItem } from "@/features/admin/types";
import { addDaysToISO, getAdminTodayISODate } from "@/features/admin/utils";

function formatDate(value: string | null) {
  if (!value) {
    return "Sem data";
  }

  const parsed = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(parsed);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AttentionList({
  title,
  description,
  tone,
  users,
  emptyMessage,
  dateLabel,
}: {
  title: string;
  description: string;
  tone: "warning" | "success" | "muted";
  users: AdminUserListItem[];
  emptyMessage: string;
  dateLabel: (user: AdminUserListItem) => string;
}) {
  return (
    <Surface tone={tone} className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="app-kicker">{title}</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">
            {users.length}
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
        </div>
        <StatusPill>{users.length > 0 ? "Atenção" : "OK"}</StatusPill>
      </div>

      <div className="mt-5 space-y-3">
        {users.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{emptyMessage}</p>
        ) : (
          users.map((user) => (
            <Link
              key={user.id}
              href={`/admin/users/${user.id}`}
              className="block rounded-3xl border border-white/10 bg-white/6 p-4 transition hover:border-violet-400/30 hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {user.displayName}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {user.email ?? "Sem e-mail"}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                  {dateLabel(user)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </Surface>
  );
}

export default async function AdminHomePage() {
  const [dashboard, allUsers] = await Promise.all([
    getAdminDashboardData(),
    listAdminUsers(),
  ]);

  const todayISO = getAdminTodayISODate();
  const expiringSoonLimit = addDaysToISO(todayISO, 7);
  const inactiveLimit = addDaysToISO(todayISO, -21);

  const expiringSoon = allUsers
    .filter(
      (user) =>
        user.role === "member" &&
        user.memberAccessMode === "billable" &&
        user.accessStatus === "active" &&
        user.paidUntil != null &&
        user.paidUntil >= todayISO &&
        user.paidUntil <= expiringSoonLimit,
    )
    .slice(0, 4);

  const renewalsPending = allUsers
    .filter(
      (user) =>
        user.role === "member" &&
        user.memberAccessMode === "billable" &&
        (user.paidUntil == null || user.paidUntil < todayISO),
    )
    .slice(0, 4);

  const inactiveUsers = allUsers
    .filter(
      (user) =>
        user.role === "member" &&
        (user.lastSignInAt == null || user.lastSignInAt.slice(0, 10) < inactiveLimit),
    )
    .slice(0, 4);

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow="Operação"
        title="Central administrativa"
        description="Uma visão mais objetiva de cobrança, acesso e atividade dos alunos para agir sem ficar caçando informação em telas separadas."
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        <MetricCard
          label="Alunos ativos"
          value={dashboard.summary.activeMembers}
          helper="Acesso liberado no momento"
        />
        <MetricCard
          label="Alunos bloqueados"
          value={dashboard.summary.blockedMembers}
          helper="Precisam de revisão manual ou cobrança"
        />
        <MetricCard
          label="Vencendo no mês"
          value={dashboard.summary.expiringThisMonth}
          helper={`Referência: ${formatDate(`${dashboard.currentReferenceMonth}-01`)}`}
        />
        <MetricCard
          label="Recebimentos no mês"
          value={dashboard.summary.currentMonthReceipts}
          helper="Pagos ou abonados"
        />
      </div>

      <Surface className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <p className="app-kicker">Saúde operacional</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">
            Service role para ações administrativas
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            Garanta que as rotinas de criação, cobrança manual e auditoria estão com a configuração certa em produção.
          </p>
        </div>
        <StatusPill
          className={
            dashboard.operational.serviceRoleConfigured
              ? "border-emerald-400/25 bg-emerald-400/12 text-emerald-200"
              : "border-rose-400/25 bg-rose-400/12 text-rose-200"
          }
        >
          {dashboard.operational.serviceRoleConfigured ? "Configurada" : "Faltando env"}
        </StatusPill>
      </Surface>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <AttentionList
          title="Acessos vencendo"
          description="Alunos ativos que vão precisar de acompanhamento ainda nesta semana."
          tone="warning"
          users={expiringSoon}
          emptyMessage="Nenhum acesso vence nos próximos 7 dias."
          dateLabel={(user) => `vence ${formatDate(user.paidUntil)}`}
        />
        <AttentionList
          title="Renovações pendentes"
          description="Cobranças atrasadas ou contas billable sem data de cobertura ativa."
          tone="warning"
          users={renewalsPending}
          emptyMessage="Nenhuma renovação pendente agora."
          dateLabel={(user) => `último ciclo ${formatDate(user.paidUntil)}`}
        />
        <AttentionList
          title="Usuários inativos"
          description="Pessoas sem login recente para reengajar antes de perder aderência."
          tone="muted"
          users={inactiveUsers}
          emptyMessage="Ninguém ficou parado por mais de 21 dias."
          dateLabel={(user) =>
            user.lastSignInAt
              ? `login ${formatDate(user.lastSignInAt.slice(0, 10))}`
              : "sem login"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Surface className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="app-kicker">Pessoas</p>
              <h3 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">
                Usuários recentes
              </h3>
              <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                Atalhos para revisar acesso, cobrança e atividade individual.
              </p>
            </div>
            <Link
              href="/admin/users"
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:border-violet-400/40 hover:bg-white/5 dark:text-white"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dashboard.recentUsers.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="block rounded-3xl border border-zinc-200/80 bg-zinc-50/85 p-4 transition hover:border-violet-400/40 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-zinc-950 dark:text-white">
                    {user.displayName}
                  </p>
                  <StatusPill className="text-zinc-300">
                    {user.role === "admin" ? "Admin" : "Aluno"}
                  </StatusPill>
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {user.email ?? "Sem e-mail"}
                </p>
              </Link>
            ))}
          </div>
        </Surface>

        <Surface className="p-6">
          <p className="app-kicker">Rastro</p>
          <h3 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">
            Auditoria recente
          </h3>

          <div className="mt-5 space-y-3">
            {dashboard.recentAuditLog.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Nenhuma ação recente registrada.
              </p>
            ) : (
              dashboard.recentAuditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-3xl border border-zinc-200/80 bg-zinc-50/85 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-950 dark:text-white">
                        {entry.action}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                        {entry.actorName}
                        {entry.targetName ? ` -> ${entry.targetName}` : ""}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Surface>
      </div>
    </PageShell>
  );
}
