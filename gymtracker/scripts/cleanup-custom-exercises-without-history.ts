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
  modality: string | null;
  muscle_group: string | null;
  archived_at: string | null;
};

type WorkoutExerciseRow = {
  id: string;
  exercise_id: string;
  workout_id: string;
  workouts: { id: string; name: string; user_id: string }[] | { id: string; name: string; user_id: string } | null;
};

type LogRow = {
  id: string;
  exercise_id: string;
};

type CleanupCandidate = {
  exercise: ExerciseRow;
  linkedWorkouts: Array<{ id: string; name: string }>;
  logCount: number;
};

function exitWithUsage() {
  console.log(`
Usage:
  npm run cleanup:custom-exercises -- --email you@example.com --password your-password
  npm run cleanup:custom-exercises -- --email you@example.com --password your-password --apply

Recommended in PowerShell:
  $env:SUPABASE_USER_EMAIL="you@example.com"
  $env:SUPABASE_USER_PASSWORD="your-password"
  npm run cleanup:custom-exercises

Options:
  --apply   Remove workout links and delete the custom exercises
  --json    Print the report in JSON as well
  --help    Show this help
`);
  process.exit(1);
}

function normalizeWorkouts(
  value: WorkoutExerciseRow["workouts"],
): Array<{ id: string; name: string }> {
  if (Array.isArray(value)) {
    return value.map((workout) => ({
      id: workout.id,
      name: workout.name,
    }));
  }

  if (value) {
    return [
      {
        id: value.id,
        name: value.name,
      },
    ];
  }

  return [];
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

  const customExercisesResult = await supabase
    .from("exercises")
    .select("id, user_id, name, modality, muscle_group, archived_at")
    .eq("user_id", user.id)
    .eq("is_system", false)
    .order("name");

  if (customExercisesResult.error) {
    throw new Error(customExercisesResult.error.message);
  }

  const customExercises = (customExercisesResult.data ?? []) as ExerciseRow[];
  const customExerciseIds = customExercises.map((exercise) => exercise.id);

  if (customExerciseIds.length === 0) {
    console.log("Nenhum exercício próprio encontrado para esta conta.");
    return;
  }

  const [workoutExercisesResult, logsResult] = await Promise.all([
    supabase
      .from("workout_exercises")
      .select("id, exercise_id, workout_id, workouts!inner(id, name, user_id)")
      .eq("workouts.user_id", user.id)
      .in("exercise_id", customExerciseIds),
    supabase
      .from("set_logs")
      .select("id, exercise_id, workout_sessions!inner(user_id)")
      .eq("workout_sessions.user_id", user.id)
      .in("exercise_id", customExerciseIds),
  ]);

  if (workoutExercisesResult.error) {
    throw new Error(workoutExercisesResult.error.message);
  }

  if (logsResult.error) {
    throw new Error(logsResult.error.message);
  }

  const workoutExercises = (workoutExercisesResult.data ?? []) as WorkoutExerciseRow[];
  const logs = (logsResult.data ?? []) as LogRow[];

  const workoutsByExerciseId = workoutExercises.reduce<
    Map<string, Array<{ id: string; name: string }>>
  >((accumulator, row) => {
    const current = accumulator.get(row.exercise_id) ?? [];
    current.push(...normalizeWorkouts(row.workouts));
    accumulator.set(row.exercise_id, current);
    return accumulator;
  }, new Map());
  const logCountByExerciseId = logs.reduce<Map<string, number>>(
    (accumulator, row) => {
      accumulator.set(row.exercise_id, (accumulator.get(row.exercise_id) ?? 0) + 1);
      return accumulator;
    },
    new Map(),
  );

  const linkedWithoutHistory: CleanupCandidate[] = [];
  const deletableWithoutHistory: CleanupCandidate[] = [];
  const withHistory: CleanupCandidate[] = [];

  for (const exercise of customExercises) {
    const linkedWorkoutsRaw = workoutsByExerciseId.get(exercise.id) ?? [];
    const linkedWorkouts = linkedWorkoutsRaw.filter(
      (workout, index, items) =>
        items.findIndex((candidate) => candidate.id === workout.id) === index,
    );
    const logCount = logCountByExerciseId.get(exercise.id) ?? 0;
    const candidate = {
      exercise,
      linkedWorkouts,
      logCount,
    };

    if (logCount > 0) {
      withHistory.push(candidate);
      continue;
    }

    if (linkedWorkouts.length > 0) {
      linkedWithoutHistory.push(candidate);
      continue;
    }

    deletableWithoutHistory.push(candidate);
  }

  console.log(
    `${apply ? "Aplicando" : "Simulando"} limpeza de exercícios próprios sem histórico.\n`,
  );

  if (linkedWithoutHistory.length > 0) {
    console.log("Sem histórico, mas ainda vinculados a treinos:");
    for (const item of linkedWithoutHistory) {
      console.log(
        `- ${buildDisplayName(item.exercise)} | treinos: ${item.linkedWorkouts
          .map((workout) => workout.name)
          .join(", ")}`,
      );
    }
    console.log("");
  }

  if (deletableWithoutHistory.length > 0) {
    console.log("Sem histórico e já prontos para exclusão:");
    for (const item of deletableWithoutHistory) {
      console.log(`- ${buildDisplayName(item.exercise)}`);
    }
    console.log("");
  }

  if (withHistory.length > 0) {
    console.log("Mantidos porque ainda possuem histórico:");
    for (const item of withHistory) {
      console.log(
        `- ${buildDisplayName(item.exercise)} | séries: ${item.logCount}, treinos vinculados: ${item.linkedWorkouts.length}`,
      );
    }
    console.log("");
  }

  if (!apply) {
    console.log(
      "Dry-run concluído. Nada foi alterado. Rode novamente com --apply para efetivar.",
    );
  } else {
    const deletedExerciseNames: string[] = [];

    for (const item of [...linkedWithoutHistory, ...deletableWithoutHistory]) {
      if (item.linkedWorkouts.length > 0) {
        const deleteLinksResult = await supabase
          .from("workout_exercises")
          .delete()
          .eq("exercise_id", item.exercise.id);

        if (deleteLinksResult.error) {
          throw new Error(deleteLinksResult.error.message);
        }
      }

      const deleteExerciseResult = await supabase
        .from("exercises")
        .delete()
        .eq("id", item.exercise.id)
        .eq("user_id", user.id);

      if (deleteExerciseResult.error) {
        throw new Error(deleteExerciseResult.error.message);
      }

      deletedExerciseNames.push(buildDisplayName(item.exercise));
    }

    console.log("Limpeza aplicada com sucesso:\n");

    if (deletedExerciseNames.length === 0) {
      console.log("Nenhum exercício precisou ser removido.");
    } else {
      for (const name of deletedExerciseNames) {
        console.log(`- ${name}`);
      }
    }
  }

  if (printJson) {
    console.log(
      JSON.stringify(
        {
          apply,
          linkedWithoutHistory: linkedWithoutHistory.map((item) => ({
            exercise: buildDisplayName(item.exercise),
            workouts: item.linkedWorkouts.map((workout) => workout.name),
          })),
          deletableWithoutHistory: deletableWithoutHistory.map((item) =>
            buildDisplayName(item.exercise),
          ),
          withHistory: withHistory.map((item) => ({
            exercise: buildDisplayName(item.exercise),
            logCount: item.logCount,
            linkedWorkoutCount: item.linkedWorkouts.length,
          })),
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
