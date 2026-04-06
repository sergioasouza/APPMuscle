import {
  buildExerciseDisplayName,
  isExerciseAvailableForPicker,
  resolveExerciseForUser,
} from "@/lib/exercise-resolution";
import type { Exercise, ExerciseOverride } from "@/lib/types";

const systemExercise: Exercise = {
  id: "exercise-system",
  user_id: null,
  name: "Supino Reto",
  system_key: "supino-reto-smith",
  is_system: true,
  modality: "Smith",
  muscle_group: "Peito",
  archived_at: null,
  created_at: "2026-04-01T08:00:00.000Z",
};

describe("exercise resolution helpers", () => {
  it("builds display names with optional modality", () => {
    expect(
      buildExerciseDisplayName({ name: "Supino Reto", modality: "Smith" }),
    ).toBe("Supino Reto (Smith)");
    expect(buildExerciseDisplayName({ name: "Prancha Isométrica" })).toBe(
      "Prancha Isométrica",
    );
  });

  it("applies local override values only for the current user", () => {
    const override: ExerciseOverride = {
      id: "override-1",
      user_id: "user-1",
      exercise_id: systemExercise.id,
      custom_name: "Supino Smith Inclinado",
      custom_modality: "Smith",
      custom_muscle_group: "Peito",
      archived_at: null,
      hidden_at: null,
      created_at: "2026-04-05T08:00:00.000Z",
      updated_at: "2026-04-05T08:00:00.000Z",
    };

    expect(resolveExerciseForUser(systemExercise, override)).toMatchObject({
      name: "Supino Smith Inclinado",
      display_name: "Supino Smith Inclinado (Smith)",
      source: "system",
      is_customized: true,
      base_name: "Supino Reto",
    });
  });

  it("marks picker availability based on archived and hidden local state", () => {
    const archived = resolveExerciseForUser(systemExercise, {
      id: "override-2",
      user_id: "user-1",
      exercise_id: systemExercise.id,
      custom_name: null,
      custom_modality: null,
      custom_muscle_group: null,
      archived_at: "2026-04-05T08:00:00.000Z",
      hidden_at: null,
      created_at: "2026-04-05T08:00:00.000Z",
      updated_at: "2026-04-05T08:00:00.000Z",
    });
    const hidden = resolveExerciseForUser(systemExercise, {
      id: "override-3",
      user_id: "user-1",
      exercise_id: systemExercise.id,
      custom_name: null,
      custom_modality: null,
      custom_muscle_group: null,
      archived_at: null,
      hidden_at: "2026-04-05T08:00:00.000Z",
      created_at: "2026-04-05T08:00:00.000Z",
      updated_at: "2026-04-05T08:00:00.000Z",
    });

    expect(isExerciseAvailableForPicker(archived)).toBe(false);
    expect(isExerciseAvailableForPicker(hidden)).toBe(false);
    expect(isExerciseAvailableForPicker(resolveExerciseForUser(systemExercise))).toBe(
      true,
    );
  });
});
