export interface ExerciseReconciliationRecord {
  id: string;
  name: string;
  modality: string | null;
  muscleGroup: string | null;
  source: "custom" | "system";
  systemKey?: string | null;
}

export interface ExerciseMatchCandidate {
  exercise: ExerciseReconciliationRecord;
  score: number;
  reason: string;
}

export type ExerciseMatchResult =
  | {
      kind: "matched";
      source: ExerciseReconciliationRecord;
      target: ExerciseReconciliationRecord;
      score: number;
      reason: string;
      candidates: ExerciseMatchCandidate[];
    }
  | {
      kind: "ambiguous";
      source: ExerciseReconciliationRecord;
      candidates: ExerciseMatchCandidate[];
    }
  | {
      kind: "unmatched";
      source: ExerciseReconciliationRecord;
      candidates: ExerciseMatchCandidate[];
    };

const NAME_STOP_WORDS = new Set([
  "cadeira",
  "com",
  "da",
  "de",
  "do",
  "em",
  "na",
  "no",
]);

const NAME_ALIAS_PAIRS = new Map<string, string>([
  ["abdutora", "cadeira abdutora"],
  ["adutora", "cadeira adutora"],
  ["extensora", "cadeira extensora"],
  ["extensora unilateral", "cadeira extensora unilateral"],
  ["flexora unilateral", "cadeira flexora unilateral"],
  ["cross inferior", "crossover inferior"],
  ["cross superior", "crossover superior"],
  ["pull over", "pullover"],
  ["pull overhead", "pull overhead"],
]);

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeName(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const normalized = normalizeWhitespace(
    stripAccents(value)
      .toLowerCase()
      .replace(/[()/_-]+/g, " ")
      .replace(/\bcross\b/g, "crossover")
      .replace(/\bpull over\b/g, "pullover")
      .replace(/\bpull-over\b/g, "pullover")
      .replace(/\bbarra livre\b/g, "barra livre")
      .replace(/[^a-z0-9\s]+/g, " "),
  );

  return NAME_ALIAS_PAIRS.get(normalized) ?? normalized;
}

function normalizeModality(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    stripAccents(value)
      .toLowerCase()
      .replace(/[()/_-]+/g, " ")
      .replace(/\bbarra livre\b/g, "barra livre")
      .replace(/[^a-z0-9\s]+/g, " "),
  );
}

function tokenizeName(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length > 0 && !NAME_STOP_WORDS.has(token));
}

function modalityFamily(value: string | null | undefined) {
  const normalized = normalizeModality(value);

  if (!normalized) {
    return "";
  }

  if (normalized.includes("cabo") || normalized.includes("polia")) {
    return "cable";
  }

  if (normalized.includes("halter")) {
    return "dumbbell";
  }

  if (normalized.includes("smith")) {
    return "smith";
  }

  if (normalized.includes("maquina")) {
    return "machine";
  }

  if (normalized.includes("barra")) {
    return "bar";
  }

  if (normalized.includes("peso corporal") || normalized.includes("livre")) {
    return "bodyweight";
  }

  return normalized;
}

function buildCandidateScore(input: {
  source: ExerciseReconciliationRecord;
  target: ExerciseReconciliationRecord;
}): ExerciseMatchCandidate | null {
  const sourceName = normalizeName(input.source.name);
  const targetName = normalizeName(input.target.name);
  const sourceTokens = tokenizeName(input.source.name);
  const targetTokens = tokenizeName(input.target.name);
  const sourceTokenSet = new Set(sourceTokens);
  const targetTokenSet = new Set(targetTokens);
  const sharedTokens = sourceTokens.filter((token) => targetTokenSet.has(token));
  const allSourceTokensCovered =
    sourceTokens.length > 0 && sourceTokens.every((token) => targetTokenSet.has(token));
  const allTargetTokensCovered =
    targetTokens.length > 0 && targetTokens.every((token) => sourceTokenSet.has(token));
  const sourceModality = normalizeModality(input.source.modality);
  const targetModality = normalizeModality(input.target.modality);
  const sourceFamily = modalityFamily(input.source.modality);
  const targetFamily = modalityFamily(input.target.modality);
  const sourceMuscle = normalizeName(input.source.muscleGroup);
  const targetMuscle = normalizeName(input.target.muscleGroup);

  let score = 0;
  const reasons: string[] = [];

  if (sourceName === targetName && sourceName.length > 0) {
    score += 100;
    reasons.push("exact-name");
  } else if (
    sourceName.length > 0 &&
    (targetName.includes(sourceName) || sourceName.includes(targetName))
  ) {
    score += 70;
    reasons.push("name-contains");
  } else if (allSourceTokensCovered || allTargetTokensCovered) {
    score += 65;
    reasons.push("token-coverage");
  } else if (sharedTokens.length > 0) {
    const coverage =
      sharedTokens.length / Math.max(sourceTokens.length, targetTokens.length, 1);

    if (coverage >= 0.5) {
      score += 50;
      reasons.push("shared-tokens");
    } else {
      score += 25;
      reasons.push("weak-token-overlap");
    }
  } else {
    return null;
  }

  if (sourceMuscle && targetMuscle && sourceMuscle === targetMuscle) {
    score += 12;
    reasons.push("same-muscle-group");
  } else if (sourceMuscle && targetMuscle && sourceMuscle !== targetMuscle) {
    score -= 15;
  }

  if (sourceModality && targetModality && sourceModality === targetModality) {
    score += 20;
    reasons.push("exact-modality");
  } else if (
    sourceFamily &&
    targetFamily &&
    sourceFamily === targetFamily &&
    sourceModality !== targetModality
  ) {
    score += 10;
    reasons.push("compatible-modality");
  } else if (sourceModality && targetModality && sourceFamily !== targetFamily) {
    score -= 10;
  }

  if (score < 55) {
    return null;
  }

  return {
    exercise: input.target,
    score,
    reason: reasons.join(", "),
  };
}

export function matchCustomExerciseToSystem(
  source: ExerciseReconciliationRecord,
  systemExercises: ExerciseReconciliationRecord[],
): ExerciseMatchResult {
  const candidates = systemExercises
    .filter((exercise) => exercise.source === "system")
    .map((exercise) =>
      buildCandidateScore({
        source,
        target: exercise,
      }),
    )
    .filter((candidate): candidate is ExerciseMatchCandidate => candidate != null)
    .sort((left, right) => right.score - left.score);

  const topCandidate = candidates[0];
  const secondCandidate = candidates[1];
  const sourceModality = normalizeModality(source.modality);

  if (!topCandidate) {
    return {
      kind: "unmatched",
      source,
      candidates: [],
    };
  }

  const scoreGap = secondCandidate
    ? topCandidate.score - secondCandidate.score
    : topCandidate.score;
  const sameNameFamilyIsAmbiguous =
    !sourceModality &&
    secondCandidate != null &&
    normalizeName(topCandidate.exercise.name) ===
      normalizeName(secondCandidate.exercise.name) &&
    scoreGap < 20;
  const confidentMatch =
    !sameNameFamilyIsAmbiguous &&
    (topCandidate.score >= 95 ||
      (topCandidate.score >= 82 && scoreGap >= 10) ||
      (topCandidate.score >= 74 && !secondCandidate));

  if (!confidentMatch) {
    return {
      kind: "ambiguous",
      source,
      candidates: candidates.slice(0, 5),
    };
  }

  return {
    kind: "matched",
    source,
    target: topCandidate.exercise,
    score: topCandidate.score,
    reason: topCandidate.reason,
    candidates: candidates.slice(0, 5),
  };
}
