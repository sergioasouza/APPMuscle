"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  updateExerciseAction,
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

  const [formState, setFormState] = useState({
    name: initialData.exercise.name,
    modality: initialData.exercise.modality ?? "",
    muscleGroup: initialData.exercise.muscle_group ?? "",
  });
  const [savedState, setSavedState] = useState(formState);
  const [archivedAt, setArchivedAt] = useState(initialData.exercise.archived_at);
  const [savingExercise, setSavingExercise] = useState(false);
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
  const hasUnsavedChanges = useMemo(
    () =>
      formState.name.trim() !== savedState.name ||
      formState.modality.trim() !== savedState.modality ||
      formState.muscleGroup.trim() !== savedState.muscleGroup,
    [formState, savedState],
  );
  const deleteMode = initialData.usageSummary.deleteMode;
  const deleteActionLabel =
    deleteMode === "hide"
      ? t("exerciseHideAction")
      : t("exerciseDeleteAction");

  async function handleSaveExercise() {
    const normalizedName = formState.name.trim();

    if (!normalizedName || !hasUnsavedChanges || savingExercise) {
      setFormState(savedState);
      return;
    }

    setSavingExercise(true);
    const result = await updateExerciseAction(initialData.exercise.id, {
      name: normalizedName,
      modality: formState.modality,
      muscleGroup: formState.muscleGroup,
    });
    setSavingExercise(false);

    if (!result.ok || !result.data) {
      setFormState(savedState);
      showToast(result.message ?? t("exerciseUpdateError"), "error");
      return;
    }

    const nextSavedState = {
      name: result.data.name,
      modality: result.data.modality ?? "",
      muscleGroup: result.data.muscle_group ?? "",
    };

    setFormState(nextSavedState);
    setSavedState(nextSavedState);
    showToast(
      t("exerciseToastUpdated", {
        name: result.data.display_name,
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
        ? t("exerciseToastArchived", { name: initialData.exercise.display_name })
        : t("exerciseToastReactivated", {
            name: initialData.exercise.display_name,
          }),
    );
    router.refresh();
  }

  async function handleDeleteExercise() {
    if (deleting || deleteMode === "blocked") {
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
      deleteMode === "hide"
        ? t("exerciseToastHidden", {
            name: initialData.exercise.display_name,
          })
        : t("exerciseToastDeleted", {
            name: initialData.exercise.display_name,
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
          <h1 className="truncate text-2xl font-bold text-zinc-900 dark:text-white">
            {initialData.exercise.display_name}
          </h1>
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
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                initialData.exercise.source === "system"
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {initialData.exercise.source === "system"
                ? t("exerciseSourceSystem")
                : t("exerciseSourceCustom")}
            </span>
            {initialData.exercise.source === "system" &&
              initialData.exercise.is_customized && (
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                  {t("exerciseCustomizedBadge")}
                </span>
              )}
          </div>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {initialData.exercise.source === "system"
              ? t("exerciseSystemHint")
              : t("exerciseCustomHint")}
          </p>
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
            disabled={deleteMode === "blocked" || deleting}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteActionLabel}
          </button>
        </div>
      </div>

      <WorkoutsSectionNav />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.2fr_1.8fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("exerciseFormTitle")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {initialData.exercise.source === "system"
                ? t("exerciseFormSystemDescription")
                : t("exerciseFormCustomDescription")}
            </p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldName")}
              </span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={savingExercise}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldModality")}
              </span>
              <input
                type="text"
                value={formState.modality}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    modality: event.target.value,
                  }))
                }
                disabled={savingExercise}
                placeholder={t("exerciseFieldModalityPlaceholder")}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldMuscleGroup")}
              </span>
              <input
                type="text"
                value={formState.muscleGroup}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    muscleGroup: event.target.value,
                  }))
                }
                disabled={savingExercise}
                placeholder={t("exerciseFieldMuscleGroupPlaceholder")}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={savingExercise || !hasUnsavedChanges}
              onClick={() => setFormState(savedState)}
              className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {t("exerciseResetAction")}
            </button>
            <button
              type="button"
              disabled={savingExercise || !formState.name.trim() || !hasUnsavedChanges}
              onClick={handleSaveExercise}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingExercise ? t("exerciseSaving") : t("exerciseSaveAction")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                  {deleteMode === "hide"
                    ? t("exerciseDeleteHidesLocally")
                    : deleteMode === "hard"
                      ? t("exerciseDeleteAllowed")
                      : t("exerciseDeleteBlocked")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("exerciseFieldModality")}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                  {savedState.modality || t("exerciseMetaEmpty")}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("exerciseFieldMuscleGroup")}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                  {savedState.muscleGroup || t("exerciseMetaEmpty")}
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
        title={
          deleteMode === "hide"
            ? t("exerciseHideConfirmTitle")
            : t("exerciseDeleteConfirmTitle")
        }
        description={
          deleteMode === "hide"
            ? t("exerciseHideConfirmDescription", {
                name: initialData.exercise.display_name,
              })
            : t("exerciseDeleteConfirmDescription", {
                name: initialData.exercise.display_name,
              })
        }
        confirmLabel={
          deleteMode === "hide"
            ? t("exerciseHideConfirmButton")
            : t("exerciseDeleteConfirmButton")
        }
        variant="danger"
        onConfirm={handleDeleteExercise}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
