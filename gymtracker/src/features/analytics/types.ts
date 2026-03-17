import type {
  SetLog,
  WorkoutExerciseWithExercise,
  WorkoutSession,
} from "@/lib/types";

export type SessionWithTotals = WorkoutSession & {
  totalVolume: number;
  totalSets: number;
};

/** A single data-point on the per-exercise evolution chart. */
export interface EvolutionPoint {
  /** ISO date (YYYY-MM-DD) of the session */
  date: string;
  /** Best weight in the session for this exercise */
  weight: number;
  /** Reps of the best set */
  reps: number;
  /** Estimated 1RM via Epley formula: weight × (1 + reps/30) */
  estimated1RM: number;
}

/** Summary stats for the currently selected exercise. */
export interface ExerciseSummary {
  /** All-time best estimated 1RM */
  prEstimated1RM: number;
  /** Weight × reps of the PR set */
  prWeight: number;
  prReps: number;
  /** Date of the PR */
  prDate: string;
  /** Best set of the most recent session */
  lastWeight: number;
  lastReps: number;
  lastDate: string;
  /** Trend comparing avg 1RM of last 3 sessions vs previous 3 */
  trend: "up" | "down" | "stable";
}

/** Full analytics payload returned by the service (scoped to one workout). */
export interface WorkoutAnalyticsData {
  workoutExercises: WorkoutExerciseWithExercise[];
  sessions: SessionWithTotals[];
  setLogs: SetLog[];
  /** Pre-computed evolution data keyed by exercise_id */
  evolution: Record<string, EvolutionPoint[]>;
  /** Pre-computed summaries keyed by exercise_id */
  summaries: Record<string, ExerciseSummary>;
}

/**
 * Analytics payload for a single exercise aggregated across ALL workouts.
 * Returned by getExerciseGlobalAnalytics / getExerciseGlobalAnalyticsAction.
 */
export interface ExerciseGlobalAnalyticsData {
  exerciseId: string;
  exerciseName: string;
  /** Chronological evolution curve built from every session that has logs
   *  for this exercise, regardless of which workout it belongs to. */
  evolution: EvolutionPoint[];
  /** Summary stats (PR, last session, trend) — null if no data yet. */
  summary: ExerciseSummary | null;
}

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  message?: string;
}
