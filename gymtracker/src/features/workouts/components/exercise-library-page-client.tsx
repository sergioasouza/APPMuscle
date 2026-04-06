"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { createExerciseAction } from "@/features/workouts/actions";
import { WorkoutsSectionNav } from "@/features/workouts/components/workouts-section-nav";
import type {
  ExerciseDraftInput,
  ExerciseLibraryData,
  ExerciseLibraryFilter,
  ExerciseLibrarySourceFilter,
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

const emptyDraft: ExerciseDraftInput = {
  name: "",
  modality: "",
  muscleGroup: "",
};

const pageSizeOptions = [10, 20, 30] as const;

function buildPaginationSequence(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const sequence: Array<number | string> = [];

  for (const page of sortedPages) {
    const lastValue = sequence[sequence.length - 1];
    const lastPage =
      typeof lastValue === "number"
        ? lastValue
        : typeof sequence[sequence.length - 2] === "number"
          ? (sequence[sequence.length - 2] as number)
          : null;

    if (lastPage != null && page - lastPage > 1) {
      sequence.push(`ellipsis-${lastPage}-${page}`);
    }

    sequence.push(page);
  }

  return sequence;
}

export function ExerciseLibraryPageClient({
  initialData,
}: ExerciseLibraryPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Workouts");
  const { showToast } = useToast();

  const [search, setSearch] = useState(initialData.query.search);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState<ExerciseDraftInput>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);
  const statusFilter = initialData.query.statusFilter;
  const sourceFilter = initialData.query.sourceFilter;
  const { stats, pagination } = initialData;
  const showingFrom =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.pageSize + 1;
  const showingTo =
    pagination.totalItems === 0
      ? 0
      : Math.min(pagination.page * pagination.pageSize, pagination.totalItems);
  const paginationSequence = buildPaginationSequence(
    pagination.page,
    pagination.totalPages,
  );

  const replaceLibraryQuery = useCallback((next: {
    search?: string;
    status?: ExerciseLibraryFilter;
    source?: ExerciseLibrarySourceFilter;
    page?: number;
    pageSize?: number;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextSearch = next.search ?? search;

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    } else {
      params.delete("search");
    }

    if (next.status && next.status !== "active") {
      params.set("status", next.status);
    } else if (next.status === "active") {
      params.delete("status");
    }

    if (next.source && next.source !== "all") {
      params.set("source", next.source);
    } else if (next.source === "all") {
      params.delete("source");
    }

    if (next.page && next.page > 1) {
      params.set("page", String(next.page));
    } else if (next.page != null) {
      params.delete("page");
    }

    if (
      next.pageSize &&
      next.pageSize !== pageSizeOptions[0] &&
      pageSizeOptions.includes(next.pageSize as (typeof pageSizeOptions)[number])
    ) {
      params.set("pageSize", String(next.pageSize));
    } else if (next.pageSize != null) {
      params.delete("pageSize");
    }

    const queryString = params.toString();
    const href = queryString
      ? `/workouts/exercises?${queryString}`
      : "/workouts/exercises";

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [router, search, searchParams]);

  useEffect(() => {
    if (deferredSearch === initialData.query.search) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      replaceLibraryQuery({
        search: deferredSearch,
        status: statusFilter,
        source: sourceFilter,
        page: 1,
        pageSize: pagination.pageSize,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    deferredSearch,
    initialData.query.search,
    pagination.pageSize,
    replaceLibraryQuery,
    searchParams,
    sourceFilter,
    statusFilter,
  ]);

  async function handleCreateExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (creating || !draft.name?.trim()) {
      return;
    }

    setCreating(true);
    const result = await createExerciseAction(draft);
    setCreating(false);

    if (!result.ok || !result.data) {
      showToast(result.message ?? t("exerciseCreateError"), "error");
      return;
    }

    showToast(
      t("exerciseToastCreated", {
        name: result.data.display_name,
      }),
    );
    setDraft(emptyDraft);
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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseStatTotal")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.totalCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseCatalogBase")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.systemCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseFilterActive")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("exerciseFilterArchived")}
          </p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            {stats.archivedCount}
          </p>
        </div>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateExercise}
          className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              {t("exerciseCreateLabel")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t("exerciseCreateDescription")}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldName")}
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                placeholder={t("newExercisePlaceholder")}
                autoFocus
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldModality")}
              </span>
              <input
                type="text"
                value={draft.modality ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    modality: event.target.value,
                  }))
                }
                placeholder={t("exerciseFieldModalityPlaceholder")}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {t("exerciseFieldMuscleGroup")}
              </span>
              <input
                type="text"
                value={draft.muscleGroup ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    muscleGroup: event.target.value,
                  }))
                }
                placeholder={t("exerciseFieldMuscleGroupPlaceholder")}
                className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setShowCreateForm(false);
                setDraft(emptyDraft);
              }}
              className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {t("cancelExerciseCreate")}
            </button>
            <button
              type="submit"
              disabled={creating || !draft.name?.trim()}
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
              onClick={() =>
                replaceLibraryQuery({
                  search,
                  status: value,
                  source: sourceFilter,
                  page: 1,
                  pageSize: pagination.pageSize,
                })
              }
              aria-pressed={statusFilter === value}
              disabled={isPending}
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
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            ["all", t("exerciseSourceFilterAll")],
            ["custom", t("exerciseSourceFilterMine")],
            ["system", t("exerciseSourceFilterBase")],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                replaceLibraryQuery({
                  search,
                  status: statusFilter,
                  source: value,
                  page: 1,
                  pageSize: pagination.pageSize,
                })
              }
              aria-pressed={sourceFilter === value}
              disabled={isPending}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                sourceFilter === value
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            {t("exercisePaginationSummary", {
              from: showingFrom,
              to: showingTo,
              total: pagination.totalItems,
            })}
          </p>
          {isPending && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {t("exercisePaginationUpdating")}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>{t("exercisePageSizeLabel")}</span>
          <select
            value={pagination.pageSize}
            onChange={(event) =>
              replaceLibraryQuery({
                search,
                status: statusFilter,
                source: sourceFilter,
                page: 1,
                pageSize: Number(event.target.value),
              })
            }
            className="rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {pageSizeOptions.map((value) => (
              <option key={value} value={value}>
                {t("exercisePageSizeOption", { count: value })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {stats.totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("exerciseLibraryEmptyTitle")}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {t("exerciseLibraryEmptyDescription")}
          </p>
        </div>
      ) : pagination.totalItems === 0 ? (
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
          {initialData.items.map((item) => {
            const lastPerformedLabel = formatDateLabel(item.lastPerformedAt);

            return (
              <Link
                key={item.id}
                href={`/workouts/exercises/${item.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
                        {item.displayName}
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
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                          item.source === "system"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}
                      >
                        {item.source === "system"
                          ? t("exerciseSourceSystem")
                          : t("exerciseSourceCustom")}
                      </span>
                      {item.isCustomized && (
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          {t("exerciseCustomizedBadge")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {item.muscleGroup
                        ? `${item.muscleGroup}${item.modality ? ` • ${item.modality}` : ""}`
                        : item.modality ?? t("exerciseOpenDetail")}
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

          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("exercisePaginationPage", {
                page: pagination.page,
                totalPages: pagination.totalPages,
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPreviousPage || isPending}
                onClick={() =>
                    replaceLibraryQuery({
                      search,
                      status: statusFilter,
                      source: sourceFilter,
                      page: pagination.page - 1,
                      pageSize: pagination.pageSize,
                    })
                }
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t("exercisePaginationPrevious")}
              </button>

              {paginationSequence.map((value) =>
                typeof value === "number" ? (
                  <button
                    key={value}
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      replaceLibraryQuery({
                        search,
                        status: statusFilter,
                        source: sourceFilter,
                        page: value,
                        pageSize: pagination.pageSize,
                      })
                    }
                    aria-current={value === pagination.page ? "page" : undefined}
                    className={`min-w-10 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      value === pagination.page
                        ? "bg-violet-600 text-white"
                        : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {value}
                  </button>
                ) : (
                  <span
                    key={value}
                    className="px-1 text-sm text-zinc-400 dark:text-zinc-500"
                  >
                    …
                  </span>
                ),
              )}

              <button
                type="button"
                disabled={!pagination.hasNextPage || isPending}
                onClick={() =>
                  replaceLibraryQuery({
                    search,
                    status: statusFilter,
                    source: sourceFilter,
                    page: pagination.page + 1,
                    pageSize: pagination.pageSize,
                  })
                }
                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t("exercisePaginationNext")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
