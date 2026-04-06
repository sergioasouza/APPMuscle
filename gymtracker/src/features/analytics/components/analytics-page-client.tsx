"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  getWorkoutAnalyticsAction,
  getExerciseGlobalAnalyticsAction,
} from "@/features/analytics/actions";
import type { Workout, WorkoutExerciseWithExercise, SetLog } from "@/lib/types";
import type {
  EvolutionPoint,
  ExerciseSummary,
  SessionWithTotals,
} from "@/features/analytics/types";

/* ─── props ─── */

interface AnalyticsPageClientProps {
  initialWorkouts: Workout[];
}

/* ─── constants ─── */

const TAB_EVOLUTION = "evolution" as const;
const TAB_COMPARISON = "comparison" as const;
type Tab = typeof TAB_EVOLUTION | typeof TAB_COMPARISON;

type AnalyticsScope = "workout" | "global";

/* ─── component ─── */

export function AnalyticsPageClient({
  initialWorkouts,
}: AnalyticsPageClientProps) {
  const t = useTranslations();

  /* ── state ── */
  const [workouts] = useState(initialWorkouts);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(
    null,
  );
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
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [analyticsScope, setAnalyticsScope] =
    useState<AnalyticsScope>("workout");
  const [globalEvolution, setGlobalEvolution] = useState<EvolutionPoint[]>([]);
  const [globalSummary, setGlobalSummary] = useState<ExerciseSummary | null>(
    null,
  );
  const [globalLoading, setGlobalLoading] = useState(false);

  /* ── fetch per-workout data ── */
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
      // Auto-select first exercise
      if (result.data.workoutExercises.length > 0) {
        setSelectedExerciseId(result.data.workoutExercises[0].exercise_id);
      }
    }
    setLoadingData(false);
  }, []);

  /* ── fetch global (cross-workout) data when scope or exercise changes ── */
  useEffect(() => {
    if (analyticsScope !== "global" || !selectedExerciseId) return;

    let cancelled = false;

    async function fetchGlobal() {
      setGlobalLoading(true);
      const result = await getExerciseGlobalAnalyticsAction(
        selectedExerciseId!,
      );
      if (!cancelled && result.ok && result.data) {
        setGlobalEvolution(result.data.evolution);
        setGlobalSummary(result.data.summary);
      }
      if (!cancelled) setGlobalLoading(false);
    }

    void fetchGlobal();
    return () => {
      cancelled = true;
    };
  }, [analyticsScope, selectedExerciseId]);

  /* ── derived ── */
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId);
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
    (we) => we.exercise_id === selectedExerciseId,
  );

  /* ── chart data ── */
  const chartData = useMemo(() => {
    return currentEvolution.map((point) => ({
      date: new Date(point.date + "T00:00:00").toLocaleDateString(undefined, {
        day: "2-digit",
        month: "2-digit",
      }),
      fullDate: point.date,
      weight: point.weight,
      reps: point.reps,
      estimated1RM: point.estimated1RM,
    }));
  }, [currentEvolution]);

  /* ── comparison table data ── */
  const comparisonData = useMemo(() => {
    if (sessions.length === 0 || workoutExercises.length === 0) return null;

    // Sort sessions oldest → newest
    const sorted = [...sessions].sort((a, b) =>
      a.performed_at.localeCompare(b.performed_at),
    );

    // Per exercise, per session: get all set logs
    const rows = workoutExercises.map((we) => {
      const exerciseName = we.exercises.display_name;

      const sessionsData = sorted.map((session) => {
        const sets = allSetLogs
          .filter(
            (s) =>
              s.session_id === session.id && s.exercise_id === we.exercise_id,
          )
          .sort((a, b) => a.set_number - b.set_number);
        return { session, sets };
      });

      return { exerciseId: we.exercise_id, exerciseName, sessionsData };
    });

    // Compute PRs per exercise (highest 1RM set across all sessions)
    const prs: Record<string, number> = {};
    for (const row of rows) {
      let maxE1RM = 0;
      for (const sd of row.sessionsData) {
        for (const set of sd.sets) {
          const e1rm = set.weight_kg * (1 + set.reps / 30);
          if (e1rm > maxE1RM) maxE1RM = e1rm;
        }
      }
      prs[row.exerciseId] = maxE1RM;
    }

    return { sorted, rows, prs };
  }, [sessions, workoutExercises, allSetLogs]);

  /* ─── render ─── */
  return (
    <div className="flex flex-col gap-6 pb-24">
      <h1 className="text-2xl font-bold">{t("Analytics.title")}</h1>

      {/* Workout selector */}
      <select
        value={selectedWorkoutId ?? ""}
        onChange={(e) => e.target.value && handleWorkoutChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="" disabled>
          {t("Analytics.selectWorkoutPlaceholder")}
        </option>
        {workouts.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      {/* Prompt if no workout */}
      {!selectedWorkoutId && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <span className="text-4xl">📊</span>
          <p className="text-sm text-muted-foreground">
            {t("Analytics.selectWorkoutPrompt")}
          </p>
        </div>
      )}

      {/* Loading */}
      {loadingData && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* No data for selected workout */}
      {selectedWorkoutId && !loadingData && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <span className="text-4xl">🏋️</span>
          <p className="font-medium text-foreground">
            {t("Analytics.noDataFor")} &ldquo;{selectedWorkout?.name}&rdquo;
          </p>
          <p className="text-sm text-muted-foreground">
            {t("Analytics.completeWorkoutToCompare")}
          </p>
        </div>
      )}

      {/* Main content */}
      {selectedWorkoutId && !loadingData && sessions.length > 0 && (
        <>
          {/* Tabs */}
          <div className="flex rounded-xl bg-muted p-1">
            <button
              onClick={() => setActiveTab(TAB_EVOLUTION)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                activeTab === TAB_EVOLUTION
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📈 {t("Analytics.evolution")}
            </button>
            <button
              onClick={() => setActiveTab(TAB_COMPARISON)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                activeTab === TAB_COMPARISON
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📋 {t("Analytics.comparison")}
            </button>
          </div>

          {/* ─── Evolution Tab ─── */}
          {activeTab === TAB_EVOLUTION && (
            <div className="flex flex-col gap-5">
              {/* Exercise selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("Analytics.selectExercise")}
                </label>
                <select
                  value={selectedExerciseId ?? ""}
                  onChange={(e) => {
                    setSelectedExerciseId(e.target.value);
                    // Reset global cache when changing exercise
                    setGlobalEvolution([]);
                    setGlobalSummary(null);
                  }}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {workoutExercises.map((we) => (
                    <option key={we.exercise_id} value={we.exercise_id}>
                      {we.exercises.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope toggle: This Workout / All Workouts */}
              <div className="flex rounded-xl bg-muted p-1">
                <button
                  onClick={() => setAnalyticsScope("workout")}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    analyticsScope === "workout"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🏋️ {t("Analytics.scopeWorkout")}
                </button>
                <button
                  onClick={() => setAnalyticsScope("global")}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    analyticsScope === "global"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🌍 {t("Analytics.scopeGlobal")}
                </button>
              </div>

              {/* Global loading spinner */}
              {analyticsScope === "global" && globalLoading && (
                <div className="flex items-center justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              )}

              {/* Summary cards */}
              {currentSummary && (
                <div className="grid grid-cols-3 gap-3">
                  {/* PR Card */}
                  <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Analytics.currentPR")}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {currentSummary.prWeight}
                      <span className="text-xs font-normal text-muted-foreground">
                        {t("Analytics.kg")}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        × {currentSummary.prReps}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("Analytics.estimated1RM")}:{" "}
                      {currentSummary.prEstimated1RM}
                      {t("Analytics.kg")}
                    </span>
                  </div>

                  {/* Last Workout Card */}
                  <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Analytics.lastWorkout")}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {currentSummary.lastWeight}
                      <span className="text-xs font-normal text-muted-foreground">
                        {t("Analytics.kg")}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        × {currentSummary.lastReps}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(
                        currentSummary.lastDate + "T00:00:00",
                      ).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Trend Card */}
                  <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-sm">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("Analytics.trend")}
                    </span>
                    <span className="text-2xl">
                      {currentSummary.trend === "up" && "📈"}
                      {currentSummary.trend === "down" && "📉"}
                      {currentSummary.trend === "stable" && "➡️"}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        currentSummary.trend === "up"
                          ? "text-emerald-500"
                          : currentSummary.trend === "down"
                            ? "text-red-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      {currentSummary.trend === "up" && t("Analytics.trendUp")}
                      {currentSummary.trend === "down" &&
                        t("Analytics.trendDown")}
                      {currentSummary.trend === "stable" &&
                        t("Analytics.trendStable")}
                    </span>
                  </div>
                </div>
              )}

              {/* Evolution chart */}
              {chartData.length > 0 ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                    {selectedExercise?.exercises.display_name}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {chartData.length} {t("Analytics.sessions")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsScope === "global"
                      ? t("Analytics.globalEvolutionSubtitle")
                      : t("Analytics.bestSetPerSession")}
                  </p>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 8, bottom: 8, left: -12 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                          opacity={0.4}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          domain={["dataMin - 5", "dataMax + 5"]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "12px",
                            fontSize: "13px",
                          }}
                          formatter={(value, name) => {
                            if (name === "weight")
                              return [
                                `${value} ${t("Analytics.kg")}`,
                                t("Analytics.weight"),
                              ];
                            if (name === "estimated1RM")
                              return [
                                `${value} ${t("Analytics.kg")}`,
                                t("Analytics.estimated1RM"),
                              ];
                            return [`${value}`, `${name}`];
                          }}
                          labelFormatter={(label) => label}
                        />
                        {/* PR reference line */}
                        {currentSummary && (
                          <ReferenceLine
                            y={currentSummary.prWeight}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                              value: t("Analytics.pr"),
                              fill: "#f59e0b",
                              fontSize: 11,
                              position: "right",
                            }}
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
                          name="weight"
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
                          name="estimated1RM"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
                      {t("Analytics.weight")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      {t("Analytics.estimated1RM")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-0.5 w-4 bg-amber-500"
                        style={{ borderTop: "2px dashed" }}
                      />
                      {t("Analytics.pr")}
                    </span>
                  </div>
                </div>
              ) : selectedExerciseId ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm text-muted-foreground">
                    {t("Analytics.noEvolutionData")}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          {/* ─── Comparison Tab ─── */}
          {activeTab === TAB_COMPARISON && comparisonData && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                {t("Analytics.selectSessions")}
              </p>

              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                        {t("Analytics.selectExercise")}
                      </th>
                      {comparisonData.sorted.map((session) => (
                        <th
                          key={session.id}
                          className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap"
                        >
                          {new Date(
                            session.performed_at + "T00:00:00",
                          ).toLocaleDateString(undefined, {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.rows.map((row) => {
                      const maxSets = Math.max(
                        ...row.sessionsData.map((sd) => sd.sets.length),
                        1,
                      );

                      return Array.from({ length: maxSets }).map(
                        (_, setIdx) => (
                          <tr
                            key={`${row.exerciseId}-${setIdx}`}
                            className="border-b border-border/50 last:border-0"
                          >
                            {/* Exercise name — only on first set row */}
                            <td className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">
                              {setIdx === 0 ? (
                                <span className="text-sm">
                                  {row.exerciseName}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t("Analytics.set")} {setIdx + 1}
                                </span>
                              )}
                            </td>

                            {row.sessionsData.map((sd) => {
                              const set = sd.sets[setIdx];
                              if (!set) {
                                return (
                                  <td
                                    key={sd.session.id}
                                    className="px-3 py-2 text-center text-muted-foreground"
                                  >
                                    —
                                  </td>
                                );
                              }

                              // Check if this set is the exercise PR
                              const setE1RM =
                                set.weight_kg * (1 + set.reps / 30);
                              const isPR =
                                Math.abs(
                                  setE1RM - comparisonData.prs[row.exerciseId],
                                ) < 0.1;

                              return (
                                <td
                                  key={sd.session.id}
                                  className={`px-3 py-2 text-center whitespace-nowrap ${
                                    isPR
                                      ? "text-amber-500 font-bold"
                                      : "text-foreground"
                                  }`}
                                >
                                  {set.weight_kg}
                                  {t("Analytics.kg")} × {set.reps}
                                  {isPR && (
                                    <span className="ml-1 text-xs">🏆</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ),
                      );
                    })}

                    {/* Volume row */}
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">
                        {t("Analytics.volume")}
                      </td>
                      {comparisonData.sorted.map((session) => (
                        <td
                          key={session.id}
                          className="px-3 py-2.5 text-center font-semibold text-foreground whitespace-nowrap"
                        >
                          {session.totalVolume.toLocaleString()}
                          {t("Analytics.kg")}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
