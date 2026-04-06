import {
  matchCustomExerciseToSystem,
  type ExerciseReconciliationRecord,
} from "@/features/workouts/exercise-reconciliation";

function buildExercise(
  input: Partial<ExerciseReconciliationRecord> & {
    id: string;
    name: string;
    source: "custom" | "system";
  },
): ExerciseReconciliationRecord {
  return {
    modality: null,
    muscleGroup: null,
    systemKey: input.source === "system" ? input.id : null,
    ...input,
  };
}

describe("exercise reconciliation matcher", () => {
  const systemExercises: ExerciseReconciliationRecord[] = [
    buildExercise({
      id: "system-abdutora",
      name: "Cadeira Abdutora",
      modality: "Máquina",
      muscleGroup: "Pernas",
      source: "system",
    }),
    buildExercise({
      id: "system-crossover-inferior",
      name: "Crossover Inferior",
      modality: "Cabo",
      muscleGroup: "Peito",
      source: "system",
    }),
    buildExercise({
      id: "system-stiff-barra-livre",
      name: "Stiff",
      modality: "Barra-Livre",
      muscleGroup: "Pernas",
      source: "system",
    }),
    buildExercise({
      id: "system-stiff-smith",
      name: "Stiff",
      modality: "Smith",
      muscleGroup: "Pernas",
      source: "system",
    }),
    buildExercise({
      id: "system-supino-reto-smith",
      name: "Supino Reto",
      modality: "Smith",
      muscleGroup: "Peito",
      source: "system",
    }),
    buildExercise({
      id: "system-supino-reto-halter",
      name: "Supino Reto",
      modality: "Halter",
      muscleGroup: "Peito",
      source: "system",
    }),
  ];

  it("matches unique aliases like Abdutora -> Cadeira Abdutora", () => {
    const result = matchCustomExerciseToSystem(
      buildExercise({
        id: "custom-abdutora",
        name: "Abdutora",
        muscleGroup: "Pernas",
        source: "custom",
      }),
      systemExercises,
    );

    expect(result.kind).toBe("matched");
    if (result.kind !== "matched") {
      throw new Error("Expected a matched result");
    }

    expect(result.target.id).toBe("system-abdutora");
  });

  it("matches normalized naming variants like Cross -> Crossover", () => {
    const result = matchCustomExerciseToSystem(
      buildExercise({
        id: "custom-cross-inferior",
        name: "Cross Inferior",
        modality: "Polia",
        muscleGroup: "Peito",
        source: "custom",
      }),
      systemExercises,
    );

    expect(result.kind).toBe("matched");
    if (result.kind !== "matched") {
      throw new Error("Expected a matched result");
    }

    expect(result.target.id).toBe("system-crossover-inferior");
  });

  it("uses modality compatibility to disambiguate exact names", () => {
    const result = matchCustomExerciseToSystem(
      buildExercise({
        id: "custom-stiff",
        name: "Stiff",
        modality: "Barra",
        muscleGroup: "Pernas",
        source: "custom",
      }),
      systemExercises,
    );

    expect(result.kind).toBe("matched");
    if (result.kind !== "matched") {
      throw new Error("Expected a matched result");
    }

    expect(result.target.id).toBe("system-stiff-barra-livre");
  });

  it("reports ambiguous matches when multiple base exercises are equally strong", () => {
    const result = matchCustomExerciseToSystem(
      buildExercise({
        id: "custom-supino-reto",
        name: "Supino Reto",
        muscleGroup: "Peito",
        source: "custom",
      }),
      systemExercises,
    );

    expect(result.kind).toBe("ambiguous");
  });

  it("reports unmatched when no base exercise is similar enough", () => {
    const result = matchCustomExerciseToSystem(
      buildExercise({
        id: "custom-inventado",
        name: "Exercício Inventado",
        source: "custom",
      }),
      systemExercises,
    );

    expect(result.kind).toBe("unmatched");
  });
});
