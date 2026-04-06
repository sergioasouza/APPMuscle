import type { Exercise, ExerciseOverride, ResolvedExercise } from "@/lib/types";

export function normalizeExerciseText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function buildExerciseDisplayName(input: {
  name: string;
  modality?: string | null;
}) {
  return input.modality ? `${input.name} (${input.modality})` : input.name;
}

export function hasExerciseOverrideData(
  override: ExerciseOverride | null | undefined,
) {
  if (!override) {
    return false;
  }

  return (
    override.custom_name != null ||
    override.custom_modality != null ||
    override.custom_muscle_group != null ||
    override.archived_at != null ||
    override.hidden_at != null
  );
}

export function resolveExerciseForUser(
  exercise: Exercise,
  override?: ExerciseOverride | null,
): ResolvedExercise {
  const effectiveName =
    exercise.is_system && override?.custom_name != null
      ? override.custom_name
      : exercise.name;
  const effectiveModality =
    exercise.is_system && override?.custom_modality !== undefined
      ? override.custom_modality
      : exercise.modality;
  const effectiveMuscleGroup =
    exercise.is_system && override?.custom_muscle_group !== undefined
      ? override.custom_muscle_group
      : exercise.muscle_group;
  const effectiveArchivedAt =
    exercise.is_system && override != null
      ? override.archived_at
      : exercise.archived_at;
  const hiddenAt = exercise.is_system ? override?.hidden_at ?? null : null;

  return {
    ...exercise,
    name: effectiveName,
    modality: effectiveModality ?? null,
    muscle_group: effectiveMuscleGroup ?? null,
    archived_at: effectiveArchivedAt ?? null,
    source: exercise.is_system ? "system" : "custom",
    display_name: buildExerciseDisplayName({
      name: effectiveName,
      modality: effectiveModality,
    }),
    hidden_at: hiddenAt,
    is_customized: exercise.is_system ? hasExerciseOverrideData(override) : false,
    base_name: exercise.name,
    base_modality: exercise.modality,
    base_muscle_group: exercise.muscle_group,
  };
}

export function isExerciseHiddenForUser(exercise: ResolvedExercise) {
  return exercise.hidden_at != null;
}

export function isExerciseArchivedForUser(exercise: ResolvedExercise) {
  return exercise.archived_at != null;
}

export function isExerciseAvailableForPicker(exercise: ResolvedExercise) {
  return !isExerciseHiddenForUser(exercise) && !isExerciseArchivedForUser(exercise);
}

export function buildExerciseConflictLabel(input: {
  name: string;
  modality?: string | null;
}) {
  return buildExerciseDisplayName({
    name: input.name,
    modality: normalizeExerciseText(input.modality),
  });
}
