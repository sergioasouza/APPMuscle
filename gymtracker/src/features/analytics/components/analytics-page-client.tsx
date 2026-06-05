"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldLabel, Select } from "@/components/ui/fields";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/ui/surface";
import {
  getExerciseGlobalAnalyticsAction,
  getWorkoutAnalyticsAction,
} from "@/features/analytics/actions";
import { useAnalyticsPalettePreference } from "@/features/appearance/use-analytics-palette-preference";
import type {
  EvolutionPoint,
  ExerciseSummary,
  SessionWithTotals,
} from "@/features/analytics/types";
import type { Workout, WorkoutExerciseWithExercise, SetLog } from "@/lib/types";

interface AnalyticsPageClientProps {
  initialWorkouts: Workout[];
}

const TAB_EVOLUTION = "evolution" as const;
const TAB_COMPARISON = "comparison" as const;
type Tab = typeof TAB_EVOLUTION | typeof TAB_COMPARISON;
type AnalyticsScope = "workout" | "global";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-400" />
    </div>
  );
}

function getTrendIcon(summary: ExerciseSummary) {
  if (summary.trend === "up") {
    return "↗";
  }

  if (summary.trend === "down") {
    return "↘";
  }

  return "→";
}

function getTrendClassName(summary: ExerciseSummary) {
  if (summary.trend === "up") {
    return "text-emerald-300";
  }

  if (summary.trend === "down") {
    return "text-rose-300";
  }

  return "text-zinc-300";
}

export function AnalyticsPageClient({
  initialWorkouts,
}: AnalyticsPageClientProps) {
  const t = useTranslations("Analytics");
  const { palette, paletteId } = useAnalyticsPalettePreference();

  const [workouts] = useState(initialWorkouts);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionWithTotals[]>([]);
  const [workoutExercises, setWorkoutExercises] = useState<
    WorkoutExerciseWithExercise[]
  >([]);
  const [allSetLogs, setAllSetLogs] = useState<SetLog[]>([]);
  const [evolution, setEvolution] = useState<Record<string, EvolutionPoint[]>>(
    {},
  );
  const [summaries, setSummaries] = useState<Record<string, ExerciseSummary>>(
    {},
  );
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>(TAB_EVOLUTION);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [analyticsScope, setAnalyticsScope] =
    useState<AnalyticsScope>("workout");
  const [globalEvolution, setGlobalEvolution] = useState<EvolutionPoint[]>([]);
  const [globalSummary, setGlobalSummary] = useState<ExerciseSummary | null>(
    null,
  );
  const [globalLoading, setGlobalLoading] = useState(false);

  const handleWorkoutChange = useCallback(async (workoutId: string) => {
    setSelectedWorkoutId(workoutId);
    setLoadingData(true);
    setSelectedExerciseId(null);
    setAnalyticsScope("workout");
    setGlobalEvolution([]);
    setGlobalSummary(null);

    const result = await getWorkoutAnalyticsAction(workoutId);
    if (result.ok && result.data) {
      setSessions(result.data.sessions);
      setWorkoutExercises(result.data.workoutExercises);
      setAllSetLogs(result.data.setLogs);
      setEvolution(result.data.evolution);
      setSummaries(result.data.summaries);

      if (result.data.workoutExercises.length > 0) {
        setSelectedExerciseId(result.data.workoutExercises[0].exercise_id);
      }
    }

    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (analyticsScope !== "global" || !selectedExerciseId) {
      return;
    }

    const exerciseId = selectedExerciseId;
    let cancelled = false;

    async function fetchGlobalAnalytics() {
      setGlobalLoading(true);
      const result = await getExerciseGlobalAnalyticsAction(exerciseId);

      if (!cancelled && result.ok && result.data) {
        setGlobalEvolution(result.data.evolution);
        setGlobalSummary(result.data.summary);
      }

      if (!cancelled) {
        setGlobalLoading(false);
      }
    }

    void fetchGlobalAnalytics();

    return () => {
      cancelled = true;
    };
  }, [analyticsScope, selectedExerciseId]);

  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId);
  const currentEvolution = useMemo(() => {
    if (analyticsScope === "global") {
      return globalEvolution;
    }

    if (!selectedExerciseId) {
      return [];
    }

    return evolution[selectedExerciseId] ?? [];
  }, [analyticsScope, evolution, globalEvolution, selectedExerciseId]);
  const currentSummary = useMemo(() => {
    if (analyticsScope === "global") {
      return globalSummary ?? undefined;
    }

    if (!selectedExerciseId) {
      return undefined;
    }

    return summaries[selectedExerciseId];
  }, [analyticsScope, globalSummary, selectedExerciseId, summaries]);
  const selectedExercise = workoutExercises.find(
    (exercise) => exercise.exercise_id === selectedExerciseId,
  );

  const chartData = useMemo(
    () =>
      currentEvolution.map((point) => ({
        date: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "2-digit",
        }),
        fullDate: point.date,
        weight: point.weight,
        reps: point.reps,
        estimated1RM: point.estimated1RM,
      })),
    [currentEvolution],
  );

  const comparisonData = useMemo(() => {
    if (sessions.length === 0 || workoutExercises.length === 0) {
      return null;
    }

    const sortedSessions = [...sessions].sort((first, second) =>
      first.performed_at.localeCompare(second.performed_at),
    );

    const rows = workoutExercises.map((exercise) => {
      const exerciseName = exercise.exercises.display_name;

      const sessionsData = sortedSessions.map((session) => {
        const sets = allSetLogs
          .filter(
            (setLog) =>
              setLog.session_id === session.id &&
              setLog.exercise_id === exercise.exercise_id,
          )
          .sort((first, second) => first.set_number - second.set_number);

        return { session, sets };
      });

      return { exerciseId: exercise.exercise_id, exerciseName, sessionsData };
    });

    const prs: Record<string, number> = {};

    for (const row of rows) {
      let maxEstimatedOneRepMax = 0;

      for (const sessionData of row.sessionsData) {
        for (const set of sessionData.sets) {
          const estimatedOneRepMax = set.weight_kg * (1 + set.reps / 30);
          maxEstimatedOneRepMax = Math.max(
            maxEstimatedOneRepMax,
            estimatedOneRepMax,
          );
        }
      }

      prs[row.exerciseId] = maxEstimatedOneRepMax;
    }

    return { sortedSessions, rows, prs };
  }, [allSetLogs, sessions, workoutExercises]);

  return (
    <PageShell size="wide">
      <Surface tone="accent" className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="p-6 sm:p-8">
            <PageHeader
              eyebrow={t("eyebrow")}
              title={t("title")}
              description={t("description")}
            />

            <div className="mt-6 flex flex-wrap gap-2">
              <StatusPill className="border-sky-300/25 bg-sky-400/12 text-sky-100">
                {t("workoutCount", { count: workouts.length })}
              </StatusPill>
              <StatusPill className="border-emerald-300/25 bg-emerald-400/12 text-emerald-100">
                {t(`paletteOptions.${paletteId}`)}
              </StatusPill>
            </div>
          </div>

          <div
            className="relative min-h-[220px] overflow-hidden border-t border-white/10 p-6 sm:p-8 lg:border-l lg:border-t-0"
            style={{ background: palette.chartSurface }}
          >
            <div
              className="absolute -right-10 top-8 h-40 w-40 rounded-full blur-3xl"
              style={{ backgroundColor: palette.glow }}
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                {t("palettePreview")}
              </p>
              <div className="mt-8 space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                    <span>{t("weight")}</span>
                    <span>86kg</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "78%",
                        backgroundColor: palette.primary,
                        boxShadow: `0 0 28px ${palette.glow}`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                    <span>{t("estimated1RM")}</span>
                    <span>103kg</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "64%",
                        backgroundColor: palette.secondary,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: palette.benchmark }}
                  />
                  {t("prHighlight")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Surface>

      <Surface className="mt-6 overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
          <div className="p-5 sm:p-6">
            <FieldLabel htmlFor="analytics-workout-select">
              {t("workoutLabel")}
            </FieldLabel>
            <Select
              id="analytics-workout-select"
              value={selectedWorkoutId ?? ""}
              className="bg-white dark:bg-zinc-950/80"
              onChange={(event) => {
                if (event.target.value) {
                  void handleWorkoutChange(event.target.value);
                }
              }}
            >
              <option value="" disabled>
                {t("selectWorkoutPlaceholder")}
              </option>
              {workouts.map((workout) => (
                <option key={workout.id} value={workout.id}>
                  {workout.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="border-t border-zinc-200/70 bg-zinc-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03] lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t("selectedWorkout")}
            </p>
            <p className="mt-3 line-clamp-2 text-lg font-bold text-zinc-950 dark:text-white">
              {selectedWorkout?.name ?? t("noneSelected")}
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {selectedWorkoutId
                ? t("sessionCount", { count: sessions.length })
                : t("selectWorkoutPrompt")}
            </p>
          </div>
        </div>
      </Surface>

      {!selectedWorkoutId ? (
        <div className="mt-6">
          <EmptyState
            icon="📊"
            title={t("emptyTitle")}
            description={t("selectWorkoutPrompt")}
          />
        </div>
      ) : null}

      {loadingData ? <LoadingSpinner /> : null}

      {selectedWorkoutId && !loadingData && sessions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon="🏋️"
            title={`${t("noDataFor")} "${selectedWorkout?.name}"`}
            description={t("completeWorkoutToCompare")}
          />
        </div>
      ) : null}

      {selectedWorkoutId && !loadingData && sessions.length > 0 ? (
        <>
          <Surface
            className="mt-6 grid gap-2 p-2 sm:inline-grid sm:grid-cols-2"
            role="tablist"
            aria-label={t("viewMode")}
          >
            <Button
              role="tab"
              aria-selected={activeTab === TAB_EVOLUTION}
              variant={activeTab === TAB_EVOLUTION ? "primary" : "ghost"}
              size="lg"
              className="w-full"
              onClick={() => setActiveTab(TAB_EVOLUTION)}
            >
              {t("evolution")}
            </Button>
            <Button
              role="tab"
              aria-selected={activeTab === TAB_COMPARISON}
              variant={activeTab === TAB_COMPARISON ? "primary" : "ghost"}
              size="lg"
              className="w-full"
              onClick={() => setActiveTab(TAB_COMPARISON)}
            >
              {t("comparison")}
            </Button>
          </Surface>

          {activeTab === TAB_EVOLUTION ? (
            <div className="mt-6 space-y-6">
              <Surface className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
                <div>
                  <FieldLabel htmlFor="analytics-exercise-select">
                    {t("selectExercise")}
                  </FieldLabel>
                  <Select
                    id="analytics-exercise-select"
                    value={selectedExerciseId ?? ""}
                    className="bg-white dark:bg-zinc-950/80"
                    onChange={(event) => {
                      setSelectedExerciseId(event.target.value);
                      setGlobalEvolution([]);
                      setGlobalSummary(null);
                    }}
                  >
                    {workoutExercises.map((exercise) => (
                      <option
                        key={exercise.exercise_id}
                        value={exercise.exercise_id}
                      >
                        {exercise.exercises.display_name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="sm:text-right">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                    {t("scopeLabel")}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button
                      variant={
                        analyticsScope === "workout" ? "secondary" : "ghost"
                      }
                      size="sm"
                      onClick={() => setAnalyticsScope("workout")}
                    >
                      {t("scopeWorkout")}
                    </Button>
                    <Button
                      variant={
                        analyticsScope === "global" ? "secondary" : "ghost"
                      }
                      size="sm"
                      onClick={() => setAnalyticsScope("global")}
                    >
                      {t("scopeGlobal")}
                    </Button>
                  </div>
                </div>
              </Surface>

              {analyticsScope === "global" && globalLoading ? (
                <LoadingSpinner />
              ) : null}

              {currentSummary ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <MetricCard
                    label={t("currentPR")}
                    value={`${currentSummary.prWeight}${t("kg")} × ${currentSummary.prReps}`}
                    helper={`${t("estimated1RM")}: ${currentSummary.prEstimated1RM}${t("kg")}`}
                  />
                  <MetricCard
                    label={t("lastWorkout")}
                    value={`${currentSummary.lastWeight}${t("kg")} × ${currentSummary.lastReps}`}
                    helper={new Date(`${currentSummary.lastDate}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      },
                    )}
                  />
                  <Surface className="flex min-h-[132px] flex-col justify-between p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                      {t("trend")}
                    </p>
                    <div>
                      <p
                        className={`text-3xl font-black tracking-tight ${getTrendClassName(
                          currentSummary,
                        )}`}
                      >
                        {getTrendIcon(currentSummary)}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                        {currentSummary.trend === "up"
                          ? t("trendUp")
                          : currentSummary.trend === "down"
                            ? t("trendDown")
                            : t("trendStable")}
                      </p>
                    </div>
                  </Surface>
                </div>
              ) : null}

              {chartData.length > 0 ? (
                <Surface className="overflow-hidden p-0">
                  <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill>{selectedWorkout?.name}</StatusPill>
                        {analyticsScope === "global" ? (
                          <StatusPill className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                            {t("scopeGlobal")}
                          </StatusPill>
                        ) : null}
                      </div>
                      <h3 className="mt-4 text-2xl font-bold text-zinc-950 dark:text-white">
                        {selectedExercise?.exercises.display_name}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                        {analyticsScope === "global"
                          ? t("globalEvolutionSubtitle")
                          : t("bestSetPerSession")}
                      </p>
                    </div>
                    <div
                      className="rounded-2xl border px-4 py-3 text-right"
                      style={{
                        backgroundColor: palette.primarySoft,
                        borderColor: palette.primarySoft,
                      }}
                    >
                      <p className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                        {chartData.length}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {t("sessions")}
                      </p>
                    </div>
                  </div>

                  <div
                    className="mt-8 h-80 w-full rounded-[1.5rem] border border-white/10 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    style={{
                      background: palette.chartSurface,
                      boxShadow: `0 22px 60px ${palette.glow}`,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 12, right: 14, bottom: 8, left: -14 }}
                      >
                        <CartesianGrid
                          stroke={palette.grid}
                          strokeDasharray="4 4"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "rgba(255,255,255,0.68)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "rgba(255,255,255,0.68)" }}
                          axisLine={false}
                          tickLine={false}
                          domain={["dataMin - 5", "dataMax + 5"]}
                        />
                        <Tooltip
                          cursor={{ stroke: palette.primarySoft }}
                          contentStyle={{
                            backgroundColor: "rgba(12, 18, 32, 0.92)",
                            border: `1px solid ${palette.primarySoft}`,
                            borderRadius: "18px",
                            boxShadow: "0 20px 48px rgba(0,0,0,0.32)",
                            color: "#ffffff",
                          }}
                          formatter={(value, name) => {
                            if (name === "weight") {
                              return [
                                `${value} ${t("kg")}`,
                                t("weight"),
                              ];
                            }

                            if (name === "estimated1RM") {
                              return [
                                `${value} ${t("kg")}`,
                                t("estimated1RM"),
                              ];
                            }

                            return [`${value}`, `${name}`];
                          }}
                        />
                        {currentSummary ? (
                          <ReferenceLine
                            y={currentSummary.prWeight}
                            stroke={palette.benchmark}
                            strokeDasharray="5 5"
                            strokeWidth={1.5}
                            label={{
                              value: t("pr"),
                              fill: palette.benchmark,
                              fontSize: 11,
                              position: "right",
                            }}
                          />
                        ) : null}
                        <Line
                          type="monotone"
                          dataKey="weight"
                          stroke={palette.primary}
                          strokeWidth={3}
                          dot={{ r: 4, fill: palette.primary, strokeWidth: 0 }}
                          activeDot={{
                            r: 6,
                            fill: palette.primaryStrong,
                            strokeWidth: 2,
                            stroke: "#ffffff",
                          }}
                          name="weight"
                        />
                        <Line
                          type="monotone"
                          dataKey="estimated1RM"
                          stroke={palette.secondary}
                          strokeWidth={2.5}
                          strokeDasharray="6 3"
                          dot={{ r: 3, fill: palette.secondary, strokeWidth: 0 }}
                          activeDot={{
                            r: 5,
                            fill: palette.secondaryStrong,
                            strokeWidth: 2,
                            stroke: "#ffffff",
                          }}
                          name="estimated1RM"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-zinc-600 dark:text-zinc-300">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: palette.primary }}
                      />
                      {t("weight")}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: palette.secondary }}
                      />
                      {t("estimated1RM")}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-0.5 w-5 border-t-2 border-dashed"
                        style={{ borderColor: palette.benchmark }}
                      />
                      {t("pr")}
                    </span>
                  </div>
                  </div>
                </Surface>
              ) : selectedExerciseId ? (
                <EmptyState
                  icon="📭"
                  title={t("noEvolutionTitle")}
                  description={t("noEvolutionData")}
                />
              ) : null}
            </div>
          ) : null}

          {activeTab === TAB_COMPARISON && comparisonData ? (
            <Surface className="mt-6 overflow-hidden p-0">
              <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                <p className="app-kicker">{t("comparison")}</p>
                <h3 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-white">
                  {t("selectSessions")}
                </h3>
                <p className="mt-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {t("comparisonDescription")}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200/70 bg-zinc-50/80 dark:border-white/10 dark:bg-white/[0.03]">
                      <th className="sticky left-0 z-10 bg-white/95 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 backdrop-blur dark:bg-zinc-950/95 dark:text-zinc-300 sm:px-6">
                        {t("selectExercise")}
                      </th>
                      {comparisonData.sortedSessions.map((session) => (
                        <th
                          key={session.id}
                          className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-300 sm:px-6"
                        >
                          {new Date(`${session.performed_at}T00:00:00`).toLocaleDateString(
                            undefined,
                            {
                              day: "2-digit",
                              month: "2-digit",
                            },
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.rows.map((row) => {
                      const maxSets = Math.max(
                        ...row.sessionsData.map((sessionData) => sessionData.sets.length),
                        1,
                      );

                      return Array.from({ length: maxSets }).map((_, setIndex) => (
                        <tr
                          key={`${row.exerciseId}-${setIndex}`}
                          className="border-b border-zinc-200/60 last:border-b-0 dark:border-white/6"
                        >
                          <td className="sticky left-0 z-10 bg-white/95 px-4 py-3 text-left backdrop-blur dark:bg-zinc-950/95 sm:px-6">
                            {setIndex === 0 ? (
                              <span className="font-semibold text-zinc-950 dark:text-white">
                                {row.exerciseName}
                              </span>
                            ) : (
                              <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                {t("set")} {setIndex + 1}
                              </span>
                            )}
                          </td>

                          {row.sessionsData.map((sessionData) => {
                            const set = sessionData.sets[setIndex];

                            if (!set) {
                              return (
                                <td
                                  key={sessionData.session.id}
                                className="px-4 py-3 text-center text-zinc-500 sm:px-6"
                                >
                                  —
                                </td>
                              );
                            }

                            const setEstimatedOneRepMax =
                              set.weight_kg * (1 + set.reps / 30);
                            const isPersonalRecord =
                              Math.abs(
                                setEstimatedOneRepMax -
                                  comparisonData.prs[row.exerciseId],
                              ) < 0.1;

                            return (
                              <td
                                key={sessionData.session.id}
                                className={`px-4 py-3 text-center whitespace-nowrap sm:px-6 ${
                                  isPersonalRecord
                                    ? "font-bold text-amber-700 dark:text-amber-300"
                                    : "text-zinc-700 dark:text-zinc-200"
                                }`}
                              >
                                {set.weight_kg}
                                {t("kg")} × {set.reps}
                                {isPersonalRecord ? (
                                  <span className="ml-2 text-xs">🏆</span>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })}

                    <tr className="bg-zinc-50/80 dark:bg-white/[0.03]">
                      <td className="sticky left-0 z-10 bg-white/95 px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600 backdrop-blur dark:bg-zinc-950/95 dark:text-zinc-300 sm:px-6">
                        {t("volume")}
                      </td>
                      {comparisonData.sortedSessions.map((session) => (
                        <td
                          key={session.id}
                          className="px-4 py-4 text-center font-semibold text-zinc-950 dark:text-white sm:px-6"
                        >
                          {session.totalVolume.toLocaleString()}
                          {t("kg")}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Surface>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
}
