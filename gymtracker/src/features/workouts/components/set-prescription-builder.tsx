"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  SET_METHODS,
  createDefaultSetPrescription,
  duplicateSetPrescription,
  type SetMethod,
  type SetPrescription,
} from "@/lib/set-methods";

interface SetPrescriptionBuilderProps {
  prescriptions: SetPrescription[];
  disabled?: boolean;
  onChange: (prescriptions: SetPrescription[]) => void;
}

type SetMethodFieldKey =
  | "targetReps"
  | "restSeconds"
  | "targetWeightKg"
  | "targetRir"
  | "blocks"
  | "repsPerBlock"
  | "intraRestSeconds"
  | "activationReps"
  | "initialRestSeconds"
  | "miniSetCount"
  | "miniSetReps"
  | "initialReps"
  | "drops"
  | "reductionPercent"
  | "repsPerDrop"
  | "pauseSeconds";

function NumberField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  optional = false,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => {
          if (optional && event.target.value === "") {
            onChange(null);
            return;
          }

          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-400/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
      />
    </label>
  );
}

function patchConfig(
  prescription: SetPrescription,
  patch: Record<string, number | null>,
) {
  return {
    ...prescription,
    config: {
      ...prescription.config,
      ...patch,
    },
  } as SetPrescription;
}

function PrescriptionFields({
  prescription,
  onChange,
}: {
  prescription: SetPrescription;
  onChange: (prescription: SetPrescription) => void;
}) {
  const t = useTranslations("SetMethods");
  const numberField = (
    key: SetMethodFieldKey,
    value: number | null,
    options?: {
      min?: number;
      max?: number;
      step?: number;
      optional?: boolean;
    },
  ) => (
    <NumberField
      label={t(`fields.${key}`)}
      value={value}
      min={options?.min}
      max={options?.max}
      step={options?.step}
      optional={options?.optional}
      onChange={(nextValue) =>
        onChange(patchConfig(prescription, { [key]: nextValue }))
      }
    />
  );

  switch (prescription.method) {
    case "straight":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numberField("targetReps", prescription.config.targetReps, {
            min: 1,
            optional: true,
          })}
          {numberField("restSeconds", prescription.config.restSeconds, {
            optional: true,
          })}
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
          {numberField("targetRir", prescription.config.targetRir, {
            max: 10,
            step: 0.5,
            optional: true,
          })}
        </div>
      );
    case "cluster":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numberField("blocks", prescription.config.blocks, { min: 2, max: 20 })}
          {numberField("repsPerBlock", prescription.config.repsPerBlock, {
            min: 1,
          })}
          {numberField(
            "intraRestSeconds",
            prescription.config.intraRestSeconds,
            { min: 1 },
          )}
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
        </div>
      );
    case "myo_reps":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {numberField("activationReps", prescription.config.activationReps, {
            min: 1,
          })}
          {numberField(
            "initialRestSeconds",
            prescription.config.initialRestSeconds,
            { min: 1 },
          )}
          {numberField("miniSetCount", prescription.config.miniSetCount, {
            min: 1,
            max: 20,
          })}
          {numberField("miniSetReps", prescription.config.miniSetReps, {
            min: 1,
          })}
          {numberField(
            "intraRestSeconds",
            prescription.config.intraRestSeconds,
            { min: 1 },
          )}
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
        </div>
      );
    case "drop_set":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {numberField("initialReps", prescription.config.initialReps, {
            min: 1,
          })}
          {numberField("drops", prescription.config.drops, {
            min: 1,
            max: 10,
          })}
          {numberField(
            "reductionPercent",
            prescription.config.reductionPercent,
            { min: 1, max: 90 },
          )}
          {numberField("repsPerDrop", prescription.config.repsPerDrop, {
            min: 1,
          })}
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
        </div>
      );
    case "rest_pause":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {numberField("initialReps", prescription.config.initialReps, {
            min: 1,
          })}
          {numberField("pauseSeconds", prescription.config.pauseSeconds, {
            min: 1,
          })}
          {numberField("miniSetCount", prescription.config.miniSetCount, {
            min: 1,
            max: 20,
          })}
          {numberField("miniSetReps", prescription.config.miniSetReps, {
            min: 1,
          })}
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
        </div>
      );
    case "amrap":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {numberField("targetWeightKg", prescription.config.targetWeightKg, {
            step: 0.5,
            optional: true,
          })}
          {numberField("restSeconds", prescription.config.restSeconds, {
            optional: true,
          })}
        </div>
      );
  }
}

export function SetPrescriptionBuilder({
  prescriptions,
  disabled = false,
  onChange,
}: SetPrescriptionBuilderProps) {
  const t = useTranslations("SetMethods");

  function replaceAt(index: number, prescription: SetPrescription) {
    onChange(
      prescriptions.map((current, currentIndex) =>
        currentIndex === index
          ? { ...prescription, position: currentIndex + 1 }
          : current,
      ),
    );
  }

  function changeMethod(index: number, method: SetMethod) {
    const current = prescriptions[index];
    replaceAt(
      index,
      createDefaultSetPrescription(method, index + 1, current.id),
    );
  }

  function addPrescription() {
    if (prescriptions.length >= 20) {
      return;
    }

    onChange([
      ...prescriptions,
      createDefaultSetPrescription("straight", prescriptions.length + 1),
    ]);
  }

  function duplicatePrescriptionAt(index: number) {
    if (prescriptions.length >= 20) {
      return;
    }

    const next = [...prescriptions];
    next.splice(
      index + 1,
      0,
      duplicateSetPrescription(prescriptions[index], index + 2),
    );
    onChange(next.map((item, nextIndex) => ({ ...item, position: nextIndex + 1 })));
  }

  function removePrescription(index: number) {
    if (prescriptions.length <= 1) {
      return;
    }

    onChange(
      prescriptions
        .filter((_, currentIndex) => currentIndex !== index)
        .map((item, nextIndex) => ({ ...item, position: nextIndex + 1 })),
    );
  }

  function movePrescription(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= prescriptions.length) {
      return;
    }

    const next = [...prescriptions];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next.map((item, nextIndex) => ({ ...item, position: nextIndex + 1 })));
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {t("builderTitle")}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t("builderDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={addPrescription}
          disabled={disabled || prescriptions.length >= 20}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-300/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-40 dark:text-sky-200"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("addSet")}
        </button>
      </div>

      {prescriptions.map((prescription, index) => (
        <div
          key={prescription.id}
          data-testid="set-prescription"
          data-set-method={prescription.method}
          className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-xs font-black text-sky-700 dark:text-sky-200">
                {index + 1}
              </span>
              <label className="space-y-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                <span className="sr-only">{t("method")}</span>
                <select
                  aria-label={`${t("method")} ${index + 1}`}
                  value={prescription.method}
                  disabled={disabled}
                  onChange={(event) =>
                    changeMethod(index, event.target.value as SetMethod)
                  }
                  className="min-w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                >
                  {SET_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(`methods.${method}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t("moveUp")}
                disabled={disabled || index === 0}
                onClick={() => movePrescription(index, -1)}
                className="app-icon-button h-8 w-8 rounded-xl disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("moveDown")}
                disabled={disabled || index === prescriptions.length - 1}
                onClick={() => movePrescription(index, 1)}
                className="app-icon-button h-8 w-8 rounded-xl disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("duplicate")}
                disabled={disabled || prescriptions.length >= 20}
                onClick={() => duplicatePrescriptionAt(index)}
                className="app-icon-button h-8 w-8 rounded-xl disabled:opacity-30"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t("remove")}
                disabled={disabled || prescriptions.length <= 1}
                onClick={() => removePrescription(index)}
                className="app-icon-button h-8 w-8 rounded-xl text-red-500 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <PrescriptionFields
              prescription={prescription}
              onChange={(next) => replaceAt(index, next)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
