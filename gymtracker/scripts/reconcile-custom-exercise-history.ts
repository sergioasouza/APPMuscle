import {
  matchCustomExerciseToSystem,
  type ExerciseReconciliationRecord,
} from "../src/features/workouts/exercise-reconciliation";
import {
  buildDisplayName,
  createAuthenticatedSupabaseClient,
  hasFlag,
  loadLocalEnvFiles,
  readScriptCredentials,
} from "./lib/supabase-script-support";

type ExerciseRow = {
  id: string;
  user_id: string | null;
  name: string;
  system_key: string | null;
  is_system: boolean;
  modality: string | null;
  muscle_group: string | null;
  archived_at: string | null;
  created_at: string;
};

type SourceLogRow = {
  id: string;
  exercise_id: string;
  session_id: string;
  set_number: number;
  created_at: string;
  workout_sessions: { user_id: string }[] | { user_id: string } | null;
};

type SourceWorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  target_sets: number;
  display_order: number;
  workouts: { user_id: string }[] | { user_id: string } | null;
};

type TargetSetLogRow = {
  id: string;
  session_id: string;
  set_number: number;
};

type TargetWorkoutExerciseRow = {
  id: string;
  workout_id: string;
  target_sets: number;
  display_order: number;
};

type CustomExerciseReport = {
  exercise: ExerciseReconciliationRecord;
  logCount: number;
  sessionCount: number;
  workoutLinkCount: number;
};

type MigrationSummary = {
  sourceName: string;
  targetName: string;
  movedLogs: number;
  renumberedLogs: number;
  movedWorkoutLinks: number;
  mergedWorkoutLinks: number;
  deletedSource: boolean;
};

function exitWithUsage() {
  console.log(`
Usage:
  npm run reconcile:exercise-history -- --email you@example.com --password your-password
  npm run reconcile:exercise-history -- --email you@example.com --password your-password --apply

Recommended in PowerShell to avoid leaving the password in history:
  $env:SUPABASE_USER_EMAIL="you@example.com"
  $env:SUPABASE_USER_PASSWORD="your-password"
  npm run reconcile:exercise-history

Options:
  --apply   Applies the reconciliation instead of only previewing it
  --json    Prints the report in JSON as well
  --help    Shows this help
`);
  process.exit(1);
}

function toRecord(row: ExerciseRow): ExerciseReconciliationRecord {
  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    muscleGroup: row.muscle_group,
    source: row.is_system ? "system" : "custom",
    systemKey: row.system_key,
  };
}

async function main() {
  loadLocalEnvFiles();

  if (hasFlag("--help")) {
    exitWithUsage();
  }

  const { email, password } = readScriptCredentials();
  const apply = hasFlag("--apply");
  const printJson = hasFlag("--json");

  if (!email || !password) {
    exitWithUsage();
  }

  const { supabase, user } = await createAuthenticatedSupabaseClient({
    email,
    password,
  });

  const [customExercisesResult, systemExercisesResult] = await Promise.all([
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .order("name"),
    supabase
      .from("exercises")
      .select("*")
      .eq("is_system", true)
      .is("user_id", null)
      .order("name"),
  ]);

  if (customExercisesResult.error) {
    throw new Error(customExercisesResult.error.message);
  }

  if (systemExercisesResult.error) {
    throw new Error(systemExercisesResult.error.message);
  }

  const customExerciseRows = (customExercisesResult.data ?? []) as ExerciseRow[];
  const systemExerciseRows = (systemExercisesResult.data ?? []) as ExerciseRow[];
  const customExerciseIds = customExerciseRows.map((exercise) => exercise.id);

  if (customExerciseIds.length === 0) {
    console.log("Nenhum exercício próprio encontrado para esta conta.");
    return;
  }

  const [sourceLogsResult, sourceWorkoutExercisesResult] = await Promise.all([
    supabase
      .from("set_logs")
      .select(
        "id, exercise_id, session_id, set_number, created_at, workout_sessions!inner(user_id)",
      )
      .eq("workout_sessions.user_id", user.id)
      .in("exercise_id", customExerciseIds),
    supabase
      .from("workout_exercises")
      .select(
        "id, workout_id, exercise_id, target_sets, display_order, workouts!inner(user_id)",
      )
      .eq("workouts.user_id", user.id)
      .in("exercise_id", customExerciseIds),
  ]);

  if (sourceLogsResult.error) {
    throw new Error(sourceLogsResult.error.message);
  }

  if (sourceWorkoutExercisesResult.error) {
    throw new Error(sourceWorkoutExercisesResult.error.message);
  }

  const sourceLogs = (sourceLogsResult.data ?? []) as SourceLogRow[];
  const sourceWorkoutExercises =
    (sourceWorkoutExercisesResult.data ?? []) as SourceWorkoutExerciseRow[];

  const logsByExerciseId = sourceLogs.reduce<Map<string, SourceLogRow[]>>(
    (accumulator, row) => {
      const current = accumulator.get(row.exercise_id) ?? [];
      current.push(row);
      accumulator.set(row.exercise_id, current);
      return accumulator;
    },
    new Map(),
  );
  const workoutExercisesByExerciseId = sourceWorkoutExercises.reduce<
    Map<string, SourceWorkoutExerciseRow[]>
  >((accumulator, row) => {
    const current = accumulator.get(row.exercise_id) ?? [];
    current.push(row);
    accumulator.set(row.exercise_id, current);
    return accumulator;
  }, new Map());

  const exercisesWithHistory: CustomExerciseReport[] = customExerciseRows
    .map((exercise) => {
      const logRows = logsByExerciseId.get(exercise.id) ?? [];
      const workoutRows = workoutExercisesByExerciseId.get(exercise.id) ?? [];

      return {
        exercise: toRecord(exercise),
        logCount: logRows.length,
        sessionCount: new Set(logRows.map((row) => row.session_id)).size,
        workoutLinkCount: new Set(workoutRows.map((row) => row.workout_id)).size,
      };
    })
    .filter((item) => item.logCount > 0);

  if (exercisesWithHistory.length === 0) {
    console.log("Nenhum exercício próprio com histórico foi encontrado.");
    return;
  }

  const systemRecords = systemExerciseRows.map(toRecord);
  const matched: Array<CustomExerciseReport & { target: ExerciseReconciliationRecord; reason: string; score: number }> = [];
  const ambiguous: Array<CustomExerciseReport & { candidates: string[] }> = [];
  const unmatched: CustomExerciseReport[] = [];

  for (const report of exercisesWithHistory) {
    const result = matchCustomExerciseToSystem(report.exercise, systemRecords);

    if (result.kind === "matched") {
      matched.push({
        ...report,
        target: result.target,
        reason: result.reason,
        score: result.score,
      });
      continue;
    }

    if (result.kind === "ambiguous") {
      ambiguous.push({
        ...report,
        candidates: result.candidates.map(
          (candidate) =>
            `${buildDisplayName(candidate.exercise)} [score ${candidate.score}]`,
        ),
      });
      continue;
    }

    unmatched.push(report);
  }

  console.log(
    `${apply ? "Aplicando" : "Simulando"} reconciliação de ${exercisesWithHistory.length} exercício(s) próprios com histórico.\n`,
  );

  if (matched.length > 0) {
    console.log("Correspondências seguras:");
    for (const item of matched) {
      console.log(
        `- ${buildDisplayName(item.exercise)} -> ${buildDisplayName(item.target)} | sessões: ${item.sessionCount}, séries: ${item.logCount}, treinos: ${item.workoutLinkCount} | ${item.reason} (score ${item.score})`,
      );
    }
    console.log("");
  }

  if (ambiguous.length > 0) {
    console.log("Ambíguos, não serão movidos:");
    for (const item of ambiguous) {
      console.log(`- ${buildDisplayName(item.exercise)} | candidatos: ${item.candidates.join(" | ")}`);
    }
    console.log("");
  }

  if (unmatched.length > 0) {
    console.log("Sem correspondência no catálogo base:");
    for (const item of unmatched) {
      console.log(`- ${buildDisplayName(item.exercise)} | sessões: ${item.sessionCount}, séries: ${item.logCount}`);
    }
    console.log("");
  }

  const migrationSummaries: MigrationSummary[] = [];

  if (apply) {
    for (const item of matched) {
      const sourceWorkoutRows =
        workoutExercisesByExerciseId.get(item.exercise.id) ?? [];
      const sourceLogRows = (logsByExerciseId.get(item.exercise.id) ?? []).sort(
        (left, right) => {
          const sessionComparison = left.session_id.localeCompare(right.session_id);
          if (sessionComparison !== 0) {
            return sessionComparison;
          }

          const setComparison = left.set_number - right.set_number;
          if (setComparison !== 0) {
            return setComparison;
          }

          return left.created_at.localeCompare(right.created_at);
        },
      );
      const affectedWorkoutIds = [...new Set(sourceWorkoutRows.map((row) => row.workout_id))];
      const affectedSessionIds = [...new Set(sourceLogRows.map((row) => row.session_id))];

      let movedWorkoutLinks = 0;
      let mergedWorkoutLinks = 0;
      let movedLogs = 0;
      let renumberedLogs = 0;

      if (affectedWorkoutIds.length > 0) {
        const targetWorkoutRowsResult = await supabase
          .from("workout_exercises")
          .select("id, workout_id, target_sets, display_order")
          .eq("exercise_id", item.target.id)
          .in("workout_id", affectedWorkoutIds);

        if (targetWorkoutRowsResult.error) {
          throw new Error(targetWorkoutRowsResult.error.message);
        }

        const targetWorkoutRows =
          (targetWorkoutRowsResult.data ?? []) as TargetWorkoutExerciseRow[];
        const targetWorkoutByWorkoutId = targetWorkoutRows.reduce<
          Map<string, TargetWorkoutExerciseRow>
        >((accumulator, row) => {
          accumulator.set(row.workout_id, row);
          return accumulator;
        }, new Map());

        for (const sourceWorkoutRow of sourceWorkoutRows) {
          const targetWorkoutRow = targetWorkoutByWorkoutId.get(
            sourceWorkoutRow.workout_id,
          );

          if (targetWorkoutRow) {
            const nextTargetSets = Math.max(
              targetWorkoutRow.target_sets,
              sourceWorkoutRow.target_sets,
            );
            const nextDisplayOrder = Math.min(
              targetWorkoutRow.display_order,
              sourceWorkoutRow.display_order,
            );

            if (
              nextTargetSets !== targetWorkoutRow.target_sets ||
              nextDisplayOrder !== targetWorkoutRow.display_order
            ) {
              const updateTargetWorkoutResult = await supabase
                .from("workout_exercises")
                .update({
                  target_sets: nextTargetSets,
                  display_order: nextDisplayOrder,
                })
                .eq("id", targetWorkoutRow.id);

              if (updateTargetWorkoutResult.error) {
                throw new Error(updateTargetWorkoutResult.error.message);
              }
            }

            const deleteSourceWorkoutResult = await supabase
              .from("workout_exercises")
              .delete()
              .eq("id", sourceWorkoutRow.id);

            if (deleteSourceWorkoutResult.error) {
              throw new Error(deleteSourceWorkoutResult.error.message);
            }

            mergedWorkoutLinks += 1;
            continue;
          }

          const moveWorkoutResult = await supabase
            .from("workout_exercises")
            .update({
              exercise_id: item.target.id,
            })
            .eq("id", sourceWorkoutRow.id);

          if (moveWorkoutResult.error) {
            throw new Error(moveWorkoutResult.error.message);
          }

          movedWorkoutLinks += 1;
        }
      }

      if (affectedSessionIds.length > 0) {
        const targetLogsResult = await supabase
          .from("set_logs")
          .select("id, session_id, set_number")
          .eq("exercise_id", item.target.id)
          .in("session_id", affectedSessionIds);

        if (targetLogsResult.error) {
          throw new Error(targetLogsResult.error.message);
        }

        const targetLogs = (targetLogsResult.data ?? []) as TargetSetLogRow[];
        const occupiedSetNumbersBySession = targetLogs.reduce<Map<string, Set<number>>>(
          (accumulator, row) => {
            const current = accumulator.get(row.session_id) ?? new Set<number>();
            current.add(row.set_number);
            accumulator.set(row.session_id, current);
            return accumulator;
          },
          new Map(),
        );

        for (const sourceLogRow of sourceLogRows) {
          const occupiedSetNumbers =
            occupiedSetNumbersBySession.get(sourceLogRow.session_id) ?? new Set<number>();

          let nextSetNumber = sourceLogRow.set_number;

          if (occupiedSetNumbers.has(nextSetNumber)) {
            const maxOccupied = occupiedSetNumbers.size
              ? Math.max(...occupiedSetNumbers)
              : 0;
            nextSetNumber = maxOccupied + 1;
          }

          const moveLogResult = await supabase
            .from("set_logs")
            .update({
              exercise_id: item.target.id,
              set_number: nextSetNumber,
            })
            .eq("id", sourceLogRow.id);

          if (moveLogResult.error) {
            throw new Error(moveLogResult.error.message);
          }

          if (nextSetNumber !== sourceLogRow.set_number) {
            renumberedLogs += 1;
          }

          occupiedSetNumbers.add(nextSetNumber);
          occupiedSetNumbersBySession.set(
            sourceLogRow.session_id,
            occupiedSetNumbers,
          );
          movedLogs += 1;
        }
      }

      const [remainingWorkoutLinksResult, remainingLogsResult] = await Promise.all([
        supabase
          .from("workout_exercises")
          .select("id", { head: true, count: "exact" })
          .eq("exercise_id", item.exercise.id),
        supabase
          .from("set_logs")
          .select("id", { head: true, count: "exact" })
          .eq("exercise_id", item.exercise.id),
      ]);

      if (remainingWorkoutLinksResult.error) {
        throw new Error(remainingWorkoutLinksResult.error.message);
      }

      if (remainingLogsResult.error) {
        throw new Error(remainingLogsResult.error.message);
      }

      let deletedSource = false;

      if (
        (remainingWorkoutLinksResult.count ?? 0) === 0 &&
        (remainingLogsResult.count ?? 0) === 0
      ) {
        const deleteSourceExerciseResult = await supabase
          .from("exercises")
          .delete()
          .eq("id", item.exercise.id)
          .eq("user_id", user.id);

        if (deleteSourceExerciseResult.error) {
          throw new Error(deleteSourceExerciseResult.error.message);
        }

        deletedSource = true;
      }

      migrationSummaries.push({
        sourceName: buildDisplayName(item.exercise),
        targetName: buildDisplayName(item.target),
        movedLogs,
        renumberedLogs,
        movedWorkoutLinks,
        mergedWorkoutLinks,
        deletedSource,
      });
    }

    console.log("Migração aplicada com sucesso:\n");

    for (const summary of migrationSummaries) {
      console.log(
        `- ${summary.sourceName} -> ${summary.targetName} | séries movidas: ${summary.movedLogs} (${summary.renumberedLogs} renumeradas), vínculos movidos: ${summary.movedWorkoutLinks}, vínculos mesclados: ${summary.mergedWorkoutLinks}, exercício antigo ${summary.deletedSource ? "apagado" : "mantido"}`,
      );
    }
  } else {
    console.log(
      "Dry-run concluído. Nada foi alterado. Rode novamente com --apply para efetivar.",
    );
  }

  if (printJson) {
    console.log(
      JSON.stringify(
        {
          apply,
          matched: matched.map((item) => ({
            source: buildDisplayName(item.exercise),
            target: buildDisplayName(item.target),
            sessions: item.sessionCount,
            sets: item.logCount,
            workoutLinks: item.workoutLinkCount,
            reason: item.reason,
            score: item.score,
          })),
          ambiguous: ambiguous.map((item) => ({
            source: buildDisplayName(item.exercise),
            candidates: item.candidates,
          })),
          unmatched: unmatched.map((item) => ({
            source: buildDisplayName(item.exercise),
            sessions: item.sessionCount,
            sets: item.logCount,
            workoutLinks: item.workoutLinkCount,
          })),
          applied: migrationSummaries,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
