"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { createExerciseAction } from "@/features/workouts/actions";
import { WorkoutsSectionNav } from "@/features/workouts/components/workouts-section-nav";
import { filterExerciseLibraryItems } from "@/features/workouts/library";
import type {
  ExerciseLibraryData,
  ExerciseLibraryFilter,
} from "@/features/workouts/types";

interface ExerciseLibraryPageClientProps {
  initialData: ExerciseLibraryData;
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

export function ExerciseLibraryPageClient({
  initialData,
}: ExerciseLibraryPageClientProps) {
  const router = useRouter();
  const t = useTranslations("Workouts");
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ExerciseLibraryFilter>("active");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [creating, setCreating] = useState(false);

  const filteredItems = filterExerciseLibraryItems(
    initialData.items,
    search,
    statusFilter,
  );
  const activeCount = initialData.items.filter(
    (item) => item.archivedAt == null,
  ).length;
  const archivedCount = initialData.items.length - activeCount;

  async function handleCreateExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating || !newExerciseName.trim()) {
      return;
    }

    setCreating(true);
    const result = await createExerciseAction(newExerciseName);
    setCreating(false);

    if (!result.ok || !result.data) {
      showToast(result.message ?? t("exerciseCreateError"), "error");
      return;
    }

    showToast(
      t("exerciseToastCreated", {
        name: result.data.name,
      }),
    );
    setNewExerciseName("");
    setShowCreateForm(false);
    router.push(`/workouts/exercises/${result.data.id}`);
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t("exerciseLibraryTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("exerciseLibrarySubtitle")}
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => setShowCreateForm(true)}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + {t("exerciseNewButton")}
        </button>
      </div>

      <WorkoutsSectionNav />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseStatTotal")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {initialData.items.length}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseFilterActive")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseFilterArchived")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {archivedCount}
          </p>
        </div>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateExercise}
          className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {t("exerciseCreateLabel")}
          </label>
          <input
            type="text"
            value={newExerciseName}
            onChange={(event) => setNewExerciseName(event.target.value)}
            placeholder={t("newExercisePlaceholder")}
            autoFocus
            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setShowCreateForm(false);
                setNewExerciseName("");
              }}
              className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {t("cancelExerciseCreate")}
            </button>
            <button
              type="submit"
              disabled={creating || !newExerciseName.trim()}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? t("exerciseCreating") : t("exerciseCreateSubmit")}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {t("exerciseSearchLabel")}
        </label>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("exerciseSearchPlaceholder")}
          className="mb-4 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        <div className="grid grid-cols-3 gap-2">
          {([
            ["active", t("exerciseFilterActive")],
            ["archived", t("exerciseFilterArchived")],
            ["all", t("exerciseFilterAll")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                statusFilter === value
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {initialData.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("exerciseLibraryEmptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t("exerciseLibraryEmptyDescription")}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("exerciseLibraryNoResultsTitle")}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t("exerciseLibraryNoResultsDescription")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const lastPerformedLabel = formatDateLabel(item.lastPerformedAt);

            return (
              <Link
                key={item.id}
                href={`/workouts/exercises/${item.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
                        {item.name}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          item.archivedAt == null
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.archivedAt == null
                          ? t("statusActive")
                          : t("statusArchived")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t("exerciseOpenDetail")}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {t("exerciseViewAction")}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t("exerciseLinkedWorkouts")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {item.linkedWorkoutCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t("exerciseLoggedSessions")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {item.loggedSessionCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t("exerciseSetCount")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {item.totalSetCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-100 px-3 py-2.5 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {t("exerciseLastPerformed")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">
                      {lastPerformedLabel ?? t("exerciseNeverPerformed")}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
