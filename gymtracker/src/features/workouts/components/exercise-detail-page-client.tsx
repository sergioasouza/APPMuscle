"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  archiveExerciseAction,
  deleteExerciseAction,
  unarchiveExerciseAction,
  updateExerciseNameAction,
} from "@/features/workouts/actions";
import { WorkoutsSectionNav } from "@/features/workouts/components/workouts-section-nav";
import type { ExerciseDetailData } from "@/features/workouts/types";

interface ExerciseDetailPageClientProps {
  initialData: ExerciseDetailData;
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ExerciseDetailPageClient({
  initialData,
}: ExerciseDetailPageClientProps) {
  const router = useRouter();
  const t = useTranslations("Workouts");
  const { showToast } = useToast();

  const [exerciseName, setExerciseName] = useState(initialData.exercise.name);
  const [savedExerciseName, setSavedExerciseName] = useState(
    initialData.exercise.name,
  );
  const [archivedAt, setArchivedAt] = useState(initialData.exercise.archived_at);
  const [savingName, setSavingName] = useState(false);
  const [togglingArchive, setTogglingArchive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const analyticsSummary = initialData.globalAnalytics.summary;
  const evolutionChartData = initialData.globalAnalytics.evolution.map(
    (point) => ({
      date: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
      }),
      weight: point.weight,
      estimated1RM: point.estimated1RM,
    }),
  );

  async function handleSaveName() {
    const normalizedName = exerciseName.trim();

    if (!normalizedName || normalizedName === savedExerciseName || savingName) {
      setExerciseName(savedExerciseName);
      return;
    }

    setSavingName(true);
    const result = await updateExerciseNameAction(
      initialData.exercise.id,
      normalizedName,
    );
    setSavingName(false);

    if (!result.ok || !result.data) {
      setExerciseName(savedExerciseName);
      showToast(result.message ?? t("exerciseUpdateError"), "error");
      return;
    }

    setExerciseName(result.data.name);
    setSavedExerciseName(result.data.name);
    showToast(
      t("exerciseToastUpdated", {
        name: result.data.name,
      }),
    );
    router.refresh();
  }

  async function handleToggleArchive() {
    if (togglingArchive) {
      return;
    }

    setTogglingArchive(true);
    const result =
      archivedAt == null
        ? await archiveExerciseAction(initialData.exercise.id)
        : await unarchiveExerciseAction(initialData.exercise.id);
    setTogglingArchive(false);

    if (!result.ok) {
      showToast(
        result.message ??
          (archivedAt == null
            ? t("exerciseArchiveError")
            : t("exerciseReactivateError")),
        "error",
      );
      return;
    }

    const nextArchivedAt =
      archivedAt == null ? new Date().toISOString() : null;
    setArchivedAt(nextArchivedAt);
    showToast(
      archivedAt == null
        ? t("exerciseToastArchived", { name: savedExerciseName })
        : t("exerciseToastReactivated", { name: savedExerciseName }),
    );
    router.refresh();
  }

  async function handleDeleteExercise() {
    if (deleting || !initialData.usageSummary.canDelete) {
      return;
    }

    setDeleting(true);
    const result = await deleteExerciseAction(initialData.exercise.id);
    setDeleting(false);
    setDeleteDialogOpen(false);

    if (!result.ok) {
      showToast(result.message ?? t("exerciseDeleteError"), "error");
      return;
    }

    showToast(
      t("exerciseToastDeleted", {
        name: savedExerciseName,
      }),
    );
    router.push("/workouts/exercises");
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <Link
        href="/workouts/exercises"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        {t("exerciseBackToLibrary")}
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
            onBlur={handleSaveName}
            disabled={savingName}
            className="w-full border-b-2 border-transparent bg-transparent py-1 text-2xl font-bold text-zinc-900 transition-colors focus:border-violet-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 dark:text-white"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                archivedAt == null
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {archivedAt == null ? t("statusActive") : t("statusArchived")}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("exerciseRenameHint")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={togglingArchive || deleting}
            className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {archivedAt == null
              ? t("exerciseArchiveAction")
              : t("exerciseReactivateAction")}
          </button>
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!initialData.usageSummary.canDelete || deleting}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("exerciseDeleteAction")}
          </button>
        </div>
      </div>

      <WorkoutsSectionNav />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseLinkedWorkouts")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {initialData.usageSummary.linkedWorkoutCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseLoggedSessions")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {initialData.usageSummary.loggedSessionCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseSetCount")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {initialData.usageSummary.totalSetCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseLastPerformed")}
          </p>
          <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">
            {formatDateLabel(initialData.usageSummary.lastPerformedAt) ??
              t("exerciseNeverPerformed")}
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                {t("exerciseProgressTitle")}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t("exerciseProgressSubtitle")}
              </p>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {initialData.globalAnalytics.evolution.length}{" "}
              {t("exerciseLoggedSessions")}
            </span>
          </div>

          {evolutionChartData.length > 0 ? (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={evolutionChartData}
                    margin={{ top: 8, right: 8, bottom: 8, left: -12 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-zinc-200 dark:stroke-zinc-800"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      className="fill-zinc-500 dark:fill-zinc-400"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="fill-zinc-500 dark:fill-zinc-400"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}
                    />
                    {analyticsSummary && (
                      <ReferenceLine
                        y={analyticsSummary.prWeight}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                      activeDot={{
                        r: 6,
                        fill: "#8b5cf6",
                        strokeWidth: 2,
                        stroke: "white",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="estimated1RM"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                      activeDot={{
                        r: 5,
                        fill: "#10b981",
                        strokeWidth: 2,
                        stroke: "white",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
                  {t("exerciseChartWeight")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {t("exerciseChartEstimated1RM")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0.5 w-4 bg-amber-500"
                    style={{ borderTop: "2px dashed" }}
                  />
                  {t("exerciseChartPR")}
                </span>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-14 text-center dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                {t("exerciseProgressEmptyTitle")}
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {t("exerciseProgressEmptyDescription")}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("exercisePerformanceTitle")}
            </h2>
            {analyticsSummary ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("exerciseCurrentPR")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                    {analyticsSummary.prWeight} kg x {analyticsSummary.prReps}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t("exerciseEstimatedOneRM", {
                      value: analyticsSummary.prEstimated1RM,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("exerciseLastSession")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                    {analyticsSummary.lastWeight} kg x{" "}
                    {analyticsSummary.lastReps}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatDateLabel(analyticsSummary.lastDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {t("exerciseTrend")}
                  </p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                    {t(`exerciseTrendValue.${analyticsSummary.trend}`)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                {t("exercisePerformanceEmpty")}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("exerciseUsageTitle")}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("exerciseTotalVolume")}
                </p>
                <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
                  {initialData.usageSummary.totalVolume.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("exerciseDeleteRule")}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {initialData.usageSummary.canDelete
                    ? t("exerciseDeleteAllowed")
                    : t("exerciseDeleteBlocked")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("exerciseLinkedWorkoutsTitle")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t("exerciseLinkedWorkoutsSubtitle")}
            </p>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {initialData.linkedWorkouts.length}
          </span>
        </div>

        {initialData.linkedWorkouts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t("exerciseNoLinkedWorkouts")}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {initialData.linkedWorkouts.map((workout) => (
              <Link
                key={workout.id}
                href={`/workouts/${workout.id}`}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:text-violet-300"
              >
                {workout.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        title={t("exerciseDeleteConfirmTitle")}
        description={t("exerciseDeleteConfirmDescription", {
          name: savedExerciseName,
        })}
        confirmLabel={t("exerciseDeleteConfirmButton")}
        variant="danger"
        onConfirm={handleDeleteExercise}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
