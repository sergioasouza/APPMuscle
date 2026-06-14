export const SET_METHODS = [
  "straight",
  "cluster",
  "myo_reps",
  "drop_set",
  "rest_pause",
  "amrap",
] as const;

export type SetMethod = (typeof SET_METHODS)[number];
export type SetLogState = "in_progress" | "completed" | "stopped";

interface SetPrescriptionBase {
  id: string;
  position: number;
  method: SetMethod;
}

export type StraightSetPrescription = SetPrescriptionBase & {
  method: "straight";
  config: {
    targetReps: number | null;
    restSeconds: number | null;
    targetWeightKg: number | null;
    targetRir: number | null;
  };
};

export type ClusterSetPrescription = SetPrescriptionBase & {
  method: "cluster";
  config: {
    blocks: number;
    repsPerBlock: number;
    intraRestSeconds: number;
    targetWeightKg: number | null;
  };
};

export type MyoRepsSetPrescription = SetPrescriptionBase & {
  method: "myo_reps";
  config: {
    activationReps: number;
    initialRestSeconds: number;
    miniSetCount: number;
    miniSetReps: number;
    intraRestSeconds: number;
    targetWeightKg: number | null;
  };
};

export type DropSetPrescription = SetPrescriptionBase & {
  method: "drop_set";
  config: {
    initialReps: number;
    drops: number;
    reductionPercent: number;
    repsPerDrop: number;
    targetWeightKg: number | null;
  };
};

export type RestPauseSetPrescription = SetPrescriptionBase & {
  method: "rest_pause";
  config: {
    initialReps: number;
    pauseSeconds: number;
    miniSetCount: number;
    miniSetReps: number;
    targetWeightKg: number | null;
  };
};

export type AmrapSetPrescription = SetPrescriptionBase & {
  method: "amrap";
  config: {
    targetWeightKg: number | null;
    restSeconds: number | null;
  };
};

export type SetPrescription =
  | StraightSetPrescription
  | ClusterSetPrescription
  | MyoRepsSetPrescription
  | DropSetPrescription
  | RestPauseSetPrescription
  | AmrapSetPrescription;

export type SetSegmentKind =
  | "work"
  | "cluster"
  | "activation"
  | "mini_set"
  | "drop"
  | "amrap";

export interface SetSegment {
  id: string;
  position: number;
  kind: SetSegmentKind;
  weightKg: number | null;
  reps: number | null;
  targetReps: number | null;
  suggestedWeightKg: number | null;
  completed: boolean;
}

export interface SetLogPayload {
  sessionId: string;
  exerciseId: string;
  originalExerciseId?: string;
  prescriptionId: string;
  setNumber: number;
  setMethod: SetMethod;
  prescriptionSnapshot: SetPrescription;
  segments: SetSegment[];
  actualRir: number | null;
  state: SetLogState;
  setLogId?: string;
}

type LegacySetLogLike = {
  id?: string;
  weight_kg?: number | null;
  reps?: number | null;
  segments?: unknown;
  state?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `00000000-0000-4000-8000-${Math.random()
    .toString(16)
    .slice(2, 14)
    .padEnd(12, "0")}`;
}

function createLegacyPrescriptionId(position: number) {
  return `00000000-0000-4000-8000-${String(position).padStart(12, "0")}`;
}

export function createDefaultSetPrescription(
  method: SetMethod = "straight",
  position = 1,
  id = createId(),
): SetPrescription {
  switch (method) {
    case "cluster":
      return {
        id,
        position,
        method,
        config: {
          blocks: 4,
          repsPerBlock: 2,
          intraRestSeconds: 20,
          targetWeightKg: null,
        },
      };
    case "myo_reps":
      return {
        id,
        position,
        method,
        config: {
          activationReps: 15,
          initialRestSeconds: 20,
          miniSetCount: 4,
          miniSetReps: 4,
          intraRestSeconds: 15,
          targetWeightKg: null,
        },
      };
    case "drop_set":
      return {
        id,
        position,
        method,
        config: {
          initialReps: 10,
          drops: 2,
          reductionPercent: 20,
          repsPerDrop: 8,
          targetWeightKg: null,
        },
      };
    case "rest_pause":
      return {
        id,
        position,
        method,
        config: {
          initialReps: 10,
          pauseSeconds: 20,
          miniSetCount: 3,
          miniSetReps: 3,
          targetWeightKg: null,
        },
      };
    case "amrap":
      return {
        id,
        position,
        method,
        config: {
          targetWeightKg: null,
          restSeconds: null,
        },
      };
    case "straight":
    default:
      return {
        id,
        position,
        method: "straight",
        config: {
          targetReps: null,
          restSeconds: null,
          targetWeightKg: null,
          targetRir: null,
        },
      };
  }
}

export function normalizeSetPrescriptions(
  value: unknown,
  legacyTargetSets = 1,
): SetPrescription[] {
  if (!Array.isArray(value) || value.length === 0) {
    return Array.from(
      { length: Math.max(1, legacyTargetSets) },
      (_, index) =>
        createDefaultSetPrescription(
          "straight",
          index + 1,
          createLegacyPrescriptionId(index + 1),
        ),
    );
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      return createDefaultSetPrescription(
        "straight",
        index + 1,
        createLegacyPrescriptionId(index + 1),
      );
    }

    const candidate = item as Partial<SetPrescription>;
    const method = SET_METHODS.includes(candidate.method as SetMethod)
      ? (candidate.method as SetMethod)
      : "straight";
    const defaults = createDefaultSetPrescription(
      method,
      index + 1,
      typeof candidate.id === "string" && candidate.id
        ? candidate.id
        : createLegacyPrescriptionId(index + 1),
    );

    return {
      ...defaults,
      ...candidate,
      position: index + 1,
      config: {
        ...defaults.config,
        ...(candidate.config && typeof candidate.config === "object"
          ? candidate.config
          : {}),
      },
    } as SetPrescription;
  });
}

export function duplicateSetPrescription(
  prescription: SetPrescription,
  position: number,
): SetPrescription {
  return {
    ...structuredClone(prescription),
    id: createId(),
    position,
  };
}

function segment(input: {
  position: number;
  kind: SetSegmentKind;
  targetReps?: number | null;
  suggestedWeightKg?: number | null;
}): SetSegment {
  return {
    id: createId(),
    position: input.position,
    kind: input.kind,
    weightKg: null,
    reps: null,
    targetReps: input.targetReps ?? null,
    suggestedWeightKg: input.suggestedWeightKg ?? null,
    completed: false,
  };
}

export function buildSetSegments(
  prescription: SetPrescription,
): SetSegment[] {
  switch (prescription.method) {
    case "cluster":
      return Array.from({ length: prescription.config.blocks }, (_, index) =>
        segment({
          position: index + 1,
          kind: "cluster",
          targetReps: prescription.config.repsPerBlock,
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
      );
    case "myo_reps":
      return [
        segment({
          position: 1,
          kind: "activation",
          targetReps: prescription.config.activationReps,
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
        ...Array.from(
          { length: prescription.config.miniSetCount },
          (_, index) =>
            segment({
              position: index + 2,
              kind: "mini_set",
              targetReps: prescription.config.miniSetReps,
              suggestedWeightKg: prescription.config.targetWeightKg,
            }),
        ),
      ];
    case "drop_set":
      return [
        segment({
          position: 1,
          kind: "work",
          targetReps: prescription.config.initialReps,
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
        ...Array.from({ length: prescription.config.drops }, (_, index) => {
          const multiplier =
            1 - (prescription.config.reductionPercent / 100) * (index + 1);
          const suggestedWeight =
            prescription.config.targetWeightKg == null
              ? null
              : Math.max(
                  0,
                  Math.round(
                    prescription.config.targetWeightKg * multiplier * 2,
                  ) / 2,
                );

          return segment({
            position: index + 2,
            kind: "drop",
            targetReps: prescription.config.repsPerDrop,
            suggestedWeightKg: suggestedWeight,
          });
        }),
      ];
    case "rest_pause":
      return [
        segment({
          position: 1,
          kind: "work",
          targetReps: prescription.config.initialReps,
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
        ...Array.from(
          { length: prescription.config.miniSetCount },
          (_, index) =>
            segment({
              position: index + 2,
              kind: "mini_set",
              targetReps: prescription.config.miniSetReps,
              suggestedWeightKg: prescription.config.targetWeightKg,
            }),
        ),
      ];
    case "amrap":
      return [
        segment({
          position: 1,
          kind: "amrap",
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
      ];
    case "straight":
    default:
      return [
        segment({
          position: 1,
          kind: "work",
          targetReps: prescription.config.targetReps,
          suggestedWeightKg: prescription.config.targetWeightKg,
        }),
      ];
  }
}

export function getRestSecondsAfterSegment(
  prescription: SetPrescription,
  segmentPosition: number,
) {
  switch (prescription.method) {
    case "cluster":
      return segmentPosition < prescription.config.blocks
        ? prescription.config.intraRestSeconds
        : 0;
    case "myo_reps":
      return segmentPosition === 1
        ? prescription.config.initialRestSeconds
        : segmentPosition <= prescription.config.miniSetCount
          ? prescription.config.intraRestSeconds
          : 0;
    case "rest_pause":
      return segmentPosition <= prescription.config.miniSetCount
        ? prescription.config.pauseSeconds
        : 0;
    case "straight":
      return prescription.config.restSeconds ?? 0;
    case "amrap":
      return prescription.config.restSeconds ?? 0;
    case "drop_set":
    default:
      return 0;
  }
}

export function normalizeSetLogSegments(log: LegacySetLogLike): SetSegment[] {
  if (Array.isArray(log.segments) && log.segments.length > 0) {
    return log.segments.map((item, index) => {
      const candidate =
        item && typeof item === "object"
          ? (item as Partial<SetSegment>)
          : {};

      return {
        id:
          typeof candidate.id === "string" && candidate.id
            ? candidate.id
            : createId(),
        position: index + 1,
        kind: candidate.kind ?? (index === 0 ? "work" : "mini_set"),
        weightKg:
          typeof candidate.weightKg === "number"
            ? candidate.weightKg
            : null,
        reps:
          typeof candidate.reps === "number" ? candidate.reps : null,
        targetReps:
          typeof candidate.targetReps === "number"
            ? candidate.targetReps
            : null,
        suggestedWeightKg:
          typeof candidate.suggestedWeightKg === "number"
            ? candidate.suggestedWeightKg
            : null,
        completed: candidate.completed !== false,
      };
    });
  }

  return [
    {
      id: log.id ?? createId(),
      position: 1,
      kind: "work",
      weightKg:
        typeof log.weight_kg === "number" ? Number(log.weight_kg) : null,
      reps: typeof log.reps === "number" ? log.reps : null,
      targetReps: null,
      suggestedWeightKg: null,
      completed: true,
    },
  ];
}

export function getPrimarySetSegment(log: LegacySetLogLike) {
  return normalizeSetLogSegments(log)[0] ?? null;
}

export function getSetLogVolume(log: LegacySetLogLike) {
  return normalizeSetLogSegments(log).reduce((total, current) => {
    if (
      !current.completed ||
      current.weightKg == null ||
      current.reps == null
    ) {
      return total;
    }

    return total + current.weightKg * current.reps;
  }, 0);
}

export function isConceptualSetCompleted(log: LegacySetLogLike) {
  return log.state == null || log.state !== "in_progress";
}

function assertInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}`);
  }
}

function assertOptionalNumber(
  value: unknown,
  fieldName: string,
  min: number,
  max: number,
) {
  if (value == null) {
    return;
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
}

export function assertSetPrescription(
  prescription: SetPrescription,
  fieldName = "Set prescription",
) {
  if (!prescription || typeof prescription !== "object") {
    throw new Error(`${fieldName} is required`);
  }

  if (!UUID_PATTERN.test(prescription.id)) {
    throw new Error(`${fieldName} id must be a valid UUID`);
  }

  assertInteger(prescription.position, `${fieldName} position`, 1, 20);

  switch (prescription.method) {
    case "straight":
      assertOptionalNumber(
        prescription.config.targetReps,
        `${fieldName} target reps`,
        1,
        1000,
      );
      assertOptionalNumber(
        prescription.config.restSeconds,
        `${fieldName} rest`,
        0,
        3600,
      );
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      assertOptionalNumber(
        prescription.config.targetRir,
        `${fieldName} target RIR`,
        0,
        10,
      );
      break;
    case "cluster":
      assertInteger(prescription.config.blocks, `${fieldName} blocks`, 2, 20);
      assertInteger(
        prescription.config.repsPerBlock,
        `${fieldName} reps per block`,
        1,
        100,
      );
      assertInteger(
        prescription.config.intraRestSeconds,
        `${fieldName} intra-set rest`,
        1,
        600,
      );
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      break;
    case "myo_reps":
      assertInteger(
        prescription.config.activationReps,
        `${fieldName} activation reps`,
        1,
        100,
      );
      assertInteger(
        prescription.config.initialRestSeconds,
        `${fieldName} initial rest`,
        1,
        600,
      );
      assertInteger(
        prescription.config.miniSetCount,
        `${fieldName} mini-set count`,
        1,
        20,
      );
      assertInteger(
        prescription.config.miniSetReps,
        `${fieldName} mini-set reps`,
        1,
        100,
      );
      assertInteger(
        prescription.config.intraRestSeconds,
        `${fieldName} intra-set rest`,
        1,
        600,
      );
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      break;
    case "drop_set":
      assertInteger(
        prescription.config.initialReps,
        `${fieldName} initial reps`,
        1,
        100,
      );
      assertInteger(prescription.config.drops, `${fieldName} drops`, 1, 10);
      assertInteger(
        prescription.config.reductionPercent,
        `${fieldName} reduction`,
        1,
        90,
      );
      assertInteger(
        prescription.config.repsPerDrop,
        `${fieldName} reps per drop`,
        1,
        100,
      );
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      break;
    case "rest_pause":
      assertInteger(
        prescription.config.initialReps,
        `${fieldName} initial reps`,
        1,
        100,
      );
      assertInteger(
        prescription.config.pauseSeconds,
        `${fieldName} pause`,
        1,
        600,
      );
      assertInteger(
        prescription.config.miniSetCount,
        `${fieldName} mini-set count`,
        1,
        20,
      );
      assertInteger(
        prescription.config.miniSetReps,
        `${fieldName} mini-set reps`,
        1,
        100,
      );
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      break;
    case "amrap":
      assertOptionalNumber(
        prescription.config.targetWeightKg,
        `${fieldName} target weight`,
        0,
        5000,
      );
      assertOptionalNumber(
        prescription.config.restSeconds,
        `${fieldName} rest`,
        0,
        3600,
      );
      break;
    default:
      throw new Error(`${fieldName} method is invalid`);
  }
}

export function assertSetPrescriptions(prescriptions: SetPrescription[]) {
  if (!Array.isArray(prescriptions) || prescriptions.length < 1) {
    throw new Error("At least one set prescription is required");
  }

  if (prescriptions.length > 20) {
    throw new Error("A workout exercise cannot have more than 20 sets");
  }

  const ids = new Set<string>();

  prescriptions.forEach((prescription, index) => {
    assertSetPrescription(prescription, `Set prescription ${index + 1}`);

    if (prescription.position !== index + 1) {
      throw new Error("Set prescription positions must be sequential");
    }

    if (ids.has(prescription.id)) {
      throw new Error("Set prescription ids must be unique");
    }

    ids.add(prescription.id);
  });
}

export function assertSetLogPayload(payload: SetLogPayload) {
  assertSetPrescription(payload.prescriptionSnapshot, "Prescription snapshot");

  if (payload.prescriptionId !== payload.prescriptionSnapshot.id) {
    throw new Error("Prescription id does not match the snapshot");
  }

  if (payload.setMethod !== payload.prescriptionSnapshot.method) {
    throw new Error("Set method does not match the snapshot");
  }

  assertInteger(payload.setNumber, "Set number", 1, 20);
  assertOptionalNumber(payload.actualRir, "Actual RIR", 0, 10);

  if (!["in_progress", "completed", "stopped"].includes(payload.state)) {
    throw new Error("Set state is invalid");
  }

  if (!Array.isArray(payload.segments) || payload.segments.length < 1) {
    throw new Error("At least one segment is required");
  }

  payload.segments.forEach((current, index) => {
    if (!current || typeof current !== "object") {
      throw new Error(`Segment ${index + 1} is invalid`);
    }

    if (!UUID_PATTERN.test(current.id)) {
      throw new Error(`Segment ${index + 1} id must be a valid UUID`);
    }

    if (current.position !== index + 1) {
      throw new Error("Segment positions must be sequential");
    }

    assertOptionalNumber(
      current.weightKg,
      `Segment ${index + 1} weight`,
      0,
      5000,
    );
    assertOptionalNumber(
      current.reps,
      `Segment ${index + 1} reps`,
      1,
      1000,
    );

    if (
      current.completed &&
      (current.weightKg == null || current.reps == null)
    ) {
      throw new Error(
        `Segment ${index + 1} needs weight and reps before completion`,
      );
    }
  });

  const firstIncompleteSegmentIndex = payload.segments.findIndex(
    (current) => !current.completed,
  );
  if (
    firstIncompleteSegmentIndex >= 0 &&
    payload.segments
      .slice(firstIncompleteSegmentIndex + 1)
      .some((current) => current.completed)
  ) {
    throw new Error("Set segments must be completed in order");
  }

  if (
    payload.state === "completed" &&
    payload.segments.some((current) => !current.completed)
  ) {
    throw new Error("A completed set needs every segment to be completed");
  }

  if (
    payload.state === "stopped" &&
    payload.setMethod !== "myo_reps"
  ) {
    throw new Error("Only myo-reps can be stopped early");
  }
}

export function assertSetLogMatchesPrescription(
  payload: SetLogPayload,
  prescription: SetPrescription,
) {
  if (
    payload.prescriptionId !== prescription.id ||
    payload.setMethod !== prescription.method ||
    payload.setNumber !== prescription.position
  ) {
    throw new Error("Set log does not match the workout prescription");
  }

  const expectedSegments = buildSetSegments(prescription);

  if (payload.segments.length !== expectedSegments.length) {
    throw new Error("Set segment count does not match the prescription");
  }

  payload.segments.forEach((current, index) => {
    if (current.kind !== expectedSegments[index].kind) {
      throw new Error(
        `Segment ${index + 1} does not match the prescription method`,
      );
    }
  });

  if (
    payload.state === "stopped" &&
    payload.segments.every((current) => current.completed)
  ) {
    throw new Error("A stopped myo-reps set must have an unfinished segment");
  }
}
