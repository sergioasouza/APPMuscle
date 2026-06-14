import { describe, expect, it } from "vitest";
import {
  assertSetLogMatchesPrescription,
  assertSetLogPayload,
  assertSetPrescription,
  buildSetSegments,
  createDefaultSetPrescription,
  duplicateSetPrescription,
  getPrimarySetSegment,
  getSetLogVolume,
  normalizeSetPrescriptions,
  type SetMethod,
} from "@/lib/set-methods";

describe("set methods", () => {
  it.each([
    ["straight", 1],
    ["cluster", 4],
    ["myo_reps", 5],
    ["drop_set", 3],
    ["rest_pause", 4],
    ["amrap", 1],
  ] satisfies Array<[SetMethod, number]>)(
    "builds valid %s defaults",
    (method, expectedSegments) => {
      const prescription = createDefaultSetPrescription(method);

      expect(() => assertSetPrescription(prescription)).not.toThrow();
      expect(buildSetSegments(prescription)).toHaveLength(expectedSegments);
    },
  );

  it("normalizes a legacy target count into straight prescriptions", () => {
    const prescriptions = normalizeSetPrescriptions(undefined, 3);

    expect(prescriptions).toHaveLength(3);
    expect(prescriptions.every((item) => item.method === "straight")).toBe(
      true,
    );
    expect(prescriptions.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it("duplicates a prescription with a new stable identity", () => {
    const original = createDefaultSetPrescription("drop_set", 1);
    const duplicate = duplicateSetPrescription(original, 2);

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.position).toBe(2);
    expect(duplicate.method).toBe("drop_set");
    expect(duplicate.config).toEqual(original.config);
  });

  it("normalizes a legacy set log into one completed segment", () => {
    const log = {
      id: "5fc8bd62-4dd4-4f5d-b6a2-d27bfba058c2",
      weight_kg: 80,
      reps: 8,
    };

    expect(getPrimarySetSegment(log)).toMatchObject({
      weightKg: 80,
      reps: 8,
      completed: true,
    });
    expect(getSetLogVolume(log)).toBe(640);
  });

  it("sums every completed segment into volume", () => {
    expect(
      getSetLogVolume({
        segments: [
          {
            id: "665bb00a-aafe-4ead-bf21-55c44d78a58c",
            position: 1,
            kind: "work",
            weightKg: 100,
            reps: 10,
            targetReps: 10,
            suggestedWeightKg: 100,
            completed: true,
          },
          {
            id: "7b60ea26-0e28-4e50-b1b0-f4cd64bc71b5",
            position: 2,
            kind: "drop",
            weightKg: 80,
            reps: 8,
            targetReps: 8,
            suggestedWeightKg: 80,
            completed: true,
          },
        ],
      }),
    ).toBe(1640);
  });

  it("rejects a completed set with an incomplete segment", () => {
    const prescription = createDefaultSetPrescription("straight");

    expect(() =>
      assertSetLogPayload({
        sessionId: "5fc8bd62-4dd4-4f5d-b6a2-d27bfba058c2",
        exerciseId: "665bb00a-aafe-4ead-bf21-55c44d78a58c",
        prescriptionId: prescription.id,
        setNumber: 1,
        setMethod: prescription.method,
        prescriptionSnapshot: prescription,
        segments: buildSetSegments(prescription).map((item) => ({
          ...item,
          completed: true,
        })),
        actualRir: null,
        state: "completed",
      }),
    ).toThrow("needs weight and reps");
  });

  it("rejects segment structures that do not match the method", () => {
    const prescription = createDefaultSetPrescription("cluster");
    const segments = buildSetSegments(prescription).slice(0, 2).map((item) => ({
      ...item,
      weightKg: 80,
      reps: 2,
      completed: true,
    }));
    const payload = {
      sessionId: "5fc8bd62-4dd4-4f5d-b6a2-d27bfba058c2",
      exerciseId: "665bb00a-aafe-4ead-bf21-55c44d78a58c",
      prescriptionId: prescription.id,
      setNumber: 1,
      setMethod: prescription.method,
      prescriptionSnapshot: prescription,
      segments,
      actualRir: null,
      state: "in_progress" as const,
    };

    expect(() => assertSetLogPayload(payload)).not.toThrow();
    expect(() =>
      assertSetLogMatchesPrescription(payload, prescription),
    ).toThrow("segment count");
  });

  it("allows only myo-reps to stop before every segment is complete", () => {
    const prescription = createDefaultSetPrescription("myo_reps");
    const segments = buildSetSegments(prescription).map((item, index) => ({
      ...item,
      weightKg: index === 0 ? 30 : null,
      reps: index === 0 ? 15 : null,
      completed: index === 0,
    }));
    const payload = {
      sessionId: "5fc8bd62-4dd4-4f5d-b6a2-d27bfba058c2",
      exerciseId: "665bb00a-aafe-4ead-bf21-55c44d78a58c",
      prescriptionId: prescription.id,
      setNumber: 1,
      setMethod: prescription.method,
      prescriptionSnapshot: prescription,
      segments,
      actualRir: 1,
      state: "stopped" as const,
    };

    expect(() => assertSetLogPayload(payload)).not.toThrow();
    expect(() =>
      assertSetLogMatchesPrescription(payload, prescription),
    ).not.toThrow();
  });
});
