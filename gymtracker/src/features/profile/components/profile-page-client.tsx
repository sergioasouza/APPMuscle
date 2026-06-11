"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/fields";
import {
  MetricCard,
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import { ANALYTICS_PALETTES } from "@/features/appearance/analytics-palettes";
import { useAnalyticsPalettePreference } from "@/features/appearance/use-analytics-palette-preference";
import { signOutAction } from "@/features/auth/actions";
import { BodyMetricsSection } from "@/features/body-metrics/components/body-metrics-section";
import type { ProfilePageData } from "@/features/profile/types";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface ProfilePageClientProps {
  initialData: ProfilePageData;
}

function formatDate(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function ProfilePageClient({ initialData }: ProfilePageClientProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { paletteId, setPaletteId } = useAnalyticsPalettePreference();
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const { showToast } = useToast();

  const [updatingLocale, setUpdatingLocale] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    const result = await signOutAction();
    if (!result.ok) {
      showToast(result.message ?? t("Profile.signOutError"), "error");
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  const handleLanguageChange = async (nextLocale: AppLocale) => {
    if (nextLocale === locale) {
      return;
    }

    try {
      setUpdatingLocale(true);

      const response = await fetch("/api/locale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) {
        throw new Error("Unable to update locale");
      }

      router.refresh();
    } catch {
      showToast(t("Profile.languageUpdateError"), "error");
    } finally {
      setUpdatingLocale(false);
    }
  };

  const avatarLetter =
    initialData.displayName?.charAt(0).toUpperCase() ||
    initialData.email?.charAt(0).toUpperCase() ||
    "?";
  const displayName = initialData.displayName || t("Profile.fallbackName");
  const accessStatusLabel =
    initialData.accessStatus === "blocked"
      ? t("Profile.accessBlocked")
      : t("Profile.accessActive");
  const accessModeLabel =
    initialData.role === "admin"
      ? t("Profile.roleAdmin")
      : initialData.memberAccessMode === "trial"
        ? t("Profile.modeTrial")
        : initialData.memberAccessMode === "internal"
          ? t("Profile.modeInternal")
          : t("Profile.modeBillable");
  const accountDateLabel =
    initialData.memberAccessMode === "trial"
      ? t("Profile.trialEndsAt")
      : initialData.memberAccessMode === "billable"
        ? t("Profile.paidUntil")
        : t("Profile.billingDay");
  const accountDateValue =
    initialData.memberAccessMode === "trial"
      ? formatDate(initialData.trialEndsAt, locale) ?? t("Profile.notAvailable")
      : initialData.memberAccessMode === "billable"
        ? formatDate(initialData.paidUntil, locale) ?? t("Profile.notAvailable")
        : initialData.billingDayOfMonth != null
          ? t("Profile.billingDayValue", {
              day: initialData.billingDayOfMonth,
            })
          : t("Profile.notAvailable");
  const memberSinceValue =
    formatDate(initialData.createdAt, locale) ?? t("Profile.notAvailable");

  return (
    <PageShell>
      <PageHeader
        eyebrow={t("Profile.accountPanelTitle")}
        title={t("Profile.title")}
        description={t("Profile.accountPanelDescription")}
      />

      <Surface tone="accent" className="mt-6 overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-3xl font-black text-white shadow-[0_18px_40px_rgba(109,40,217,0.32)]">
                {avatarLetter}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill className="border-emerald-400/20 bg-emerald-400/12 text-emerald-200">
                    {accessStatusLabel}
                  </StatusPill>
                  <StatusPill className="border-white/10 bg-white/8 text-zinc-100">
                    {accessModeLabel}
                  </StatusPill>
                </div>
                <h2 className="mt-4 truncate text-3xl font-black tracking-tight text-white">
                  {displayName}
                </h2>
                <p className="mt-2 text-sm text-zinc-300">{initialData.email}</p>
              </div>
            </div>

            <p className="mt-6 max-w-xl text-sm leading-7 text-violet-100/80">
              {t("Profile.accountHeroDescription")}
            </p>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <MetricCard
              label={t("Profile.accountStatus")}
              value={accessStatusLabel}
              helper={
                initialData.accessStatus === "blocked"
                  ? t("Profile.accessBlockedHelper")
                  : t("Profile.accessActiveHelper")
              }
            />
            <MetricCard
              label={t("Profile.accessMode")}
              value={accessModeLabel}
              helper={
                initialData.role === "admin"
                  ? t("Profile.roleAdminHelper")
                  : t("Profile.roleMember")
              }
            />
            <MetricCard
              label={accountDateLabel}
              value={accountDateValue}
              helper={t("Profile.billingVisibilityHelper")}
            />
            <MetricCard
              label={t("Profile.memberSince")}
              value={memberSinceValue}
              helper={t("Profile.memberSinceHelper")}
            />
          </div>
        </div>
      </Surface>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Surface className="p-6 sm:p-7">
          <div className="mb-6">
            <p className="app-kicker">{t("Profile.settingsPanelTitle")}</p>
            <h3 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">
              {t("Profile.settings")}
            </h3>
            <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              {t("Profile.settingsPanelDescription")}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-200/70 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t("Profile.appTheme")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t("Profile.appThemeDesc")}
                  </p>
                </div>
                <StatusPill className="text-zinc-300">
                  {mounted ? theme ?? "system" : "system"}
                </StatusPill>
              </div>
              {mounted ? (
                <Select
                  value={theme ?? "system"}
                  onChange={(event) => setTheme(event.target.value)}
                >
                  <option value="system">{t("Profile.themeSystem")}</option>
                  <option value="dark">{t("Profile.themeDark")}</option>
                  <option value="light">{t("Profile.themeLight")}</option>
                </Select>
              ) : null}
            </div>

            <div className="rounded-3xl border border-zinc-200/70 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t("Profile.language")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t("Profile.languageDesc")}
                  </p>
                </div>
                <StatusPill className="text-zinc-300">{locale.toUpperCase()}</StatusPill>
              </div>
              <Select
                value={locale}
                onChange={(event) =>
                  handleLanguageChange(event.target.value as AppLocale)
                }
                disabled={updatingLocale}
              >
                <option value="pt">{t("Profile.languagePortuguese")}</option>
                <option value="en">{t("Profile.languageEnglish")}</option>
              </Select>
            </div>

            <div className="rounded-3xl border border-zinc-200/70 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {t("Profile.analyticsPalette")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {t("Profile.analyticsPaletteDesc")}
                  </p>
                </div>
                <StatusPill className="text-zinc-700 dark:text-zinc-200">
                  {t(`Profile.analyticsPaletteOptions.${paletteId}`)}
                </StatusPill>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {ANALYTICS_PALETTES.map((palette) => {
                  const isSelected = palette.id === paletteId;

                  return (
                    <button
                      key={palette.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setPaletteId(palette.id)}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300",
                        isSelected
                          ? "border-violet-400 bg-violet-500/10 shadow-[0_14px_34px_rgba(124,58,237,0.22)]"
                          : "border-zinc-200/80 bg-white/70 hover:border-violet-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-violet-400/50",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {[palette.primary, palette.secondary, palette.benchmark].map(
                          (color) => (
                            <span
                              key={color}
                              className="h-5 w-5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: color }}
                            />
                          ),
                        )}
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-zinc-950 dark:text-white">
                        {t(`Profile.analyticsPaletteOptions.${palette.id}`)}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {t("Profile.analyticsPalettePreview")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200/70 bg-zinc-50/90 p-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                {t("Profile.version")}
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                GymTracker v1.0.0
              </p>
            </div>
          </div>
        </Surface>

        <BodyMetricsSection initialData={initialData.bodyMetrics} />
      </div>

      <Surface className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="app-kicker text-red-400">{t("Profile.account")}</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">
            {t("Profile.accountDangerTitle")}
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {t("Profile.accountDangerDescription")}
          </p>
        </div>
        <Button variant="danger" size="lg" onClick={handleSignOut}>
          {t("Profile.signOut")}
        </Button>
      </Surface>
    </PageShell>
  );
}
