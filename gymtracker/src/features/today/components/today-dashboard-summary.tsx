import { getLocale, getTranslations } from "next-intl/server";
import { MetricCard, StatusPill, Surface } from "@/components/ui/surface";
import type { TodayDashboardSummary } from "@/features/today/dashboard-summary";

interface TodayDashboardSummaryProps {
  summary: TodayDashboardSummary;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export async function TodayDashboardSummaryPanel({
  summary,
}: TodayDashboardSummaryProps) {
  const t = await getTranslations("TodaySummary");
  const currentLocale = await getLocale();

  return (
    <div className="space-y-4 px-4 pt-6">
      <Surface className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-kicker">{t("eyebrow")}</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
              {t("title")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {t("description")}
            </p>
          </div>
          {summary.nextWorkout ? (
            <StatusPill className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
              {summary.nextWorkout.isToday ? t("todayLabel") : t("upNextLabel")}
            </StatusPill>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr]">
          <MetricCard
            label={t("streak")}
            value={summary.streak}
            helper={t("streakHelper", { count: summary.streak })}
          />
          <MetricCard
            label={t("adherence")}
            value={`${summary.adherence.percentage}%`}
            helper={t("adherenceHelper", {
              completed: summary.adherence.completed,
              planned: summary.adherence.planned,
            })}
          />
          <Surface className="flex min-h-[132px] flex-col justify-between p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t("nextWorkout")}
            </p>
            <div>
              <p className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                {summary.nextWorkout?.name ?? t("noWorkout")}
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {summary.nextWorkout
                  ? summary.nextWorkout.isToday
                    ? t("todayWorkout")
                    : t("nextWorkoutOn", {
                        date: formatDate(summary.nextWorkout.dateISO, currentLocale),
                      })
                  : t("noWorkoutDescription")}
              </p>
            </div>
          </Surface>
        </div>
      </Surface>

      <Surface className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-kicker">{t("prsEyebrow")}</p>
            <h3 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">
              {t("prsTitle")}
            </h3>
          </div>
          <StatusPill>{summary.recentPrs.length}</StatusPill>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {summary.recentPrs.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {t("prsEmpty")}
            </p>
          ) : (
            summary.recentPrs.map((record) => (
              <div
                key={`${record.exerciseName}-${record.performedAt}`}
                className="rounded-3xl border border-zinc-200/80 bg-zinc-50/85 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <p className="font-semibold text-zinc-950 dark:text-white">
                  {record.exerciseName}
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                  {record.estimated1RM}
                  <span className="ml-1 text-sm font-semibold text-zinc-400">kg</span>
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {t("prDate", {
                    date: formatDate(record.performedAt, currentLocale),
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </Surface>
    </div>
  );
}
