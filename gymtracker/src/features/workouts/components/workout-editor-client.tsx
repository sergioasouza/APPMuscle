"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  addExistingExerciseToWorkoutAction,
  archiveExerciseAction,
  checkExerciseHasLogsAction,
  createExerciseAndAddToWorkoutAction,
  deleteWorkoutExerciseAction,
  listAvailableExercisesAction,
  reorderWorkoutExercisesAction,
  updateWorkoutExerciseTargetSetsAction,
  updateWorkoutNameAction,
} from "@/features/workouts/actions";
import { WorkoutsSectionNav } from "@/features/workouts/components/workouts-section-nav";
import type { Workout } from "@/lib/types";
import type { WorkoutEditorExercise } from "@/features/workouts/types";

interface WorkoutEditorClientProps {
  initialWorkout: Workout;
  initialWorkoutExercises: WorkoutEditorExercise[];
}

function createClientMutationId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function WorkoutEditorClient({
  initialWorkout,
  initialWorkoutExercises,
}: WorkoutEditorClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();

  const [workoutName, setWorkoutName] = useState(initialWorkout.name);
  const [originalName, setOriginalName] = useState(initialWorkout.name);
  const [workoutExercises, setWorkoutExercises] = useState(
    initialWorkoutExercises,
  );
  const [availableExercises, setAvailableExercises] = useState<
    WorkoutEditorExercise["exercises"][]
  >([]);
  const [exerciseLibraryLoaded, setExerciseLibraryLoaded] = useState(false);
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<WorkoutEditorExercise | null>(null);
  // null = not checking; string = exercise id currently being checked for logs
  const [checkingLogsForId, setCheckingLogsForId] = useState<string | null>(
    null,
  );
  // null = no dialog open; true/false = has logs result, dialog is open
  const [deleteTargetHasLogs, setDeleteTargetHasLogs] = useState<
    boolean | null
  >(null);
  const [archivingExercise, setArchivingExercise] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingSetByExerciseId, setSavingSetByExerciseId] = useState<
    Record<string, boolean>
  >({});
  const [reordering, setReordering] = useState(false);
  const [addingExercise, setAddingExercise] = useState(false);
  const [removingExercise, setRemovingExercise] = useState(false);
  const latestNameMutationRef = useRef<string | null>(null);
  const latestSetMutationByExerciseRef = useRef<Record<string, string>>({});
  const latestReorderMutationRef = useRef<string | null>(null);

  const filteredAvailableExercises = useMemo(() => {
    const normalizedSearch = exerciseSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return availableExercises;
    }

    return availableExercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(normalizedSearch),
    );
  }, [availableExercises, exerciseSearch]);

  async function handleSaveName() {
    if (savingName || workoutName.trim() === originalName) {
      return;
    }

    const previousName = originalName;
    const normalizedName = workoutName.trim();
    const clientMutationId = createClientMutationId();
    latestNameMutationRef.current = clientMutationId;
    setSavingName(true);
    setOriginalName(normalizedName);
    setWorkoutName(normalizedName);

    const result = await updateWorkoutNameAction(
      initialWorkout.id,
      normalizedName,
    );

    if (latestNameMutationRef.current !== clientMutationId) {
      return;
    }

    setSavingName(false);

    if (!result.ok || !result.data) {
      setOriginalName(previousName);
      setWorkoutName(previousName);
      showToast(result.message ?? "Unable to update workout name", "error");
      return;
    }

    showToast(t("Workouts.toastNameUpdated"));
  }

  async function ensureExerciseLibraryLoaded() {
    if (exerciseLibraryLoaded || exerciseLibraryLoading) {
      return;
    }

    setExerciseLibraryLoading(true);
    const result = await listAvailableExercisesAction(initialWorkout.id);
    setExerciseLibraryLoading(false);

    if (!result.ok || !result.data) {
      showToast(result.message ?? "Unable to load exercises", "error");
      return;
    }

    setAvailableExercises(result.data);
    setExerciseLibraryLoaded(true);
  }

  async function openAddExercise() {
    setShowAddExercise(true);
    await ensureExerciseLibraryLoaded();
  }

  async function handleAddExistingExercise() {
    if (addingExercise || !selectedExerciseId) {
      return;
    }

    setAddingExercise(true);

    const result = await addExistingExerciseToWorkoutAction(
      initialWorkout.id,
      selectedExerciseId,
    );

    setAddingExercise(false);

    if (!result.ok || !result.data) {
      showToast(result.message ?? "Unable to add exercise", "error");
      return;
    }

    setWorkoutExercises((prev) => [...prev, result.data!]);
    setAvailableExercises((prev) =>
      prev.filter((exercise) => exercise.id !== selectedExerciseId),
    );
    setSelectedExerciseId(null);
    setShowAddExercise(false);
    setExerciseSearch("");
    showToast(t("Workouts.toastExerciseAdded"));
  }

  async function handleCreateAndAddExercise() {
    if (addingExercise || !newExerciseName.trim()) {
      return;
    }

    setAddingExercise(true);

    const result = await createExerciseAndAddToWorkoutAction(
      initialWorkout.id,
      newExerciseName,
    );

    setAddingExercise(false);

    if (!result.ok || !result.data) {
      showToast(result.message ?? "Unable to create exercise", "error");
      return;
    }

    setWorkoutExercises((prev) => [...prev, result.data!]);
    setNewExerciseName("");
    setShowAddExercise(false);
    setExerciseSearch("");
    setSelectedExerciseId(null);
    showToast(
      t("Workouts.toastExerciseCreatedAndAdded", {
        name: result.data.exercises?.name ?? "",
      }),
    );
  }

  async function handleUpdateSets(workoutExerciseId: string, newSets: number) {
    if (newSets < 1 || newSets > 20) {
      return;
    }

    if (savingSetByExerciseId[workoutExerciseId]) {
      return;
    }

    const clientMutationId = createClientMutationId();
    latestSetMutationByExerciseRef.current[workoutExerciseId] =
      clientMutationId;
    setSavingSetByExerciseId((prev) => ({
      ...prev,
      [workoutExerciseId]: true,
    }));
    const previousExercises = workoutExercises.map((exercise) => ({
      ...exercise,
      exercises: { ...exercise.exercises },
    }));
    setWorkoutExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === workoutExerciseId
          ? { ...exercise, target_sets: newSets }
          : exercise,
      ),
    );

    const result = await updateWorkoutExerciseTargetSetsAction(
      initialWorkout.id,
      workoutExerciseId,
      newSets,
    );

    if (
      latestSetMutationByExerciseRef.current[workoutExerciseId] !==
      clientMutationId
    ) {
      return;
    }

    setSavingSetByExerciseId((prev) => ({
      ...prev,
      [workoutExerciseId]: false,
    }));

    if (!result.ok) {
      setWorkoutExercises(previousExercises);
      showToast(result.message ?? "Unable to update target sets", "error");
    }
  }

  // Called when the user clicks the X button on an exercise card.
  // We check for training history before showing the appropriate dialog.
  async function handleClickRemoveExercise(
    workoutExercise: WorkoutEditorExercise,
  ) {
    if (removingExercise || archivingExercise) return;
    if (checkingLogsForId) return; // already checking another exercise

    setCheckingLogsForId(workoutExercise.exercises?.id ?? null);
    const result = await checkExerciseHasLogsAction(
      workoutExercise.exercises?.id ?? "",
    );
    setCheckingLogsForId(null);

    const hasLogs = result.ok && result.data === true;
    setDeleteTargetHasLogs(hasLogs);
    setDeleteTarget(workoutExercise);
  }

  function handleCloseDeleteDialog() {
    setDeleteTarget(null);
    setDeleteTargetHasLogs(null);
  }

  // Remove from workout only (no library change)
  async function handleRemoveExercise() {
    if (!deleteTarget || removingExercise) {
      return;
    }

    const target = deleteTarget;
    const previousExercises = workoutExercises;
    setRemovingExercise(true);

    handleCloseDeleteDialog();
    setWorkoutExercises((prev) =>
      prev.filter((exercise) => exercise.id !== target.id),
    );

    const result = await deleteWorkoutExerciseAction(
      initialWorkout.id,
      target.id,
    );
    setRemovingExercise(false);

    if (!result.ok) {
      setWorkoutExercises(previousExercises);
      showToast(result.message ?? "Unable to remove exercise", "error");
      return;
    }

    if (exerciseLibraryLoaded && target.exercises) {
      setAvailableExercises((prev) =>
        [...prev, target.exercises].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
    }

    showToast(
      t("Workouts.toastExerciseRemoved", {
        name: target.exercises?.name ?? "",
      }),
    );
  }

  // Archive from library AND remove from workout
  async function handleArchiveAndRemoveExercise() {
    if (!deleteTarget || archivingExercise) return;

    const target = deleteTarget;
    const previousExercises = workoutExercises;
    setArchivingExercise(true);

    handleCloseDeleteDialog();
    setWorkoutExercises((prev) =>
      prev.filter((exercise) => exercise.id !== target.id),
    );

    // Run both operations concurrently
    const [removeResult, archiveResult] = await Promise.all([
      deleteWorkoutExerciseAction(initialWorkout.id, target.id),
      archiveExerciseAction(target.exercises?.id ?? ""),
    ]);

    setArchivingExercise(false);

    if (!removeResult.ok || !archiveResult.ok) {
      setWorkoutExercises(previousExercises);
      showToast(
        removeResult.message ??
          archiveResult.message ??
          "Unable to archive exercise",
        "error",
      );
      return;
    }

    // Archived exercises must NOT be re-added to the picker
    // (they're hidden from the library now)
    showToast(
      t("Workouts.toastExerciseArchived", {
        name: target.exercises?.name ?? "",
      }),
    );
  }

  async function handleReorder(index: number, direction: "up" | "down") {
    if (
      reordering ||
      (direction === "up" && index === 0) ||
      (direction === "down" && index === workoutExercises.length - 1)
    ) {
      return;
    }

    const clientMutationId = createClientMutationId();
    latestReorderMutationRef.current = clientMutationId;
    setReordering(true);

    const previousExercises = workoutExercises.map((exercise) => ({
      ...exercise,
      exercises: { ...exercise.exercises },
    }));

    const nextExercises = [...workoutExercises];
    const swapIndex = direction === "up" ? index - 1 : index + 1;

    [nextExercises[index], nextExercises[swapIndex]] = [
      nextExercises[swapIndex],
      nextExercises[index],
    ];

    const normalizedExercises = nextExercises.map((exercise, nextIndex) => ({
      ...exercise,
      display_order: nextIndex,
    }));

    setWorkoutExercises(normalizedExercises);

    const result = await reorderWorkoutExercisesAction(
      initialWorkout.id,
      normalizedExercises.map((exercise) => exercise.id),
    );

    if (latestReorderMutationRef.current !== clientMutationId) {
      return;
    }

    setReordering(false);

    if (!result.ok) {
      setWorkoutExercises(previousExercises);
      showToast(result.message ?? t("Workouts.toastOrderSaveError"), "error");
    }
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <button
        onClick={() => router.push("/workouts")}
        className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 hover:text-white transition-colors mb-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        {t("Workouts.back")}
      </button>

      <div className="flex items-center gap-2 mb-6">
        <input
          type="text"
          value={workoutName}
          onChange={(event) => setWorkoutName(event.target.value)}
          onBlur={handleSaveName}
          disabled={savingName}
          className="text-2xl font-bold text-zinc-900 dark:text-white bg-transparent border-b-2 border-transparent
            focus:border-violet-600 focus:outline-none transition-colors flex-1 py-1 disabled:opacity-70 disabled:cursor-not-allowed"
        />
      </div>

      <WorkoutsSectionNav />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
          {t("Workouts.exercises")}
        </h2>
        <span className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">
          {workoutExercises.length} {t("Workouts.itemsCount")}
        </span>
      </div>

      {workoutExercises.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-2xl p-8 text-center mb-4">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-3">
            {t("Workouts.noExercises")}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {workoutExercises.map((workoutExercise, index) =>
            (() => {
              const isSavingSets = !!savingSetByExerciseId[workoutExercise.id];
              const isCheckingLogs =
                checkingLogsForId === workoutExercise.exercises?.id;

              return (
                <div
                  key={workoutExercise.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/50 rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-6 h-6 rounded-lg flex items-center justify-center">
                          {index + 1}
                        </span>
                        {workoutExercise.exercises ? (
                          <Link
                            href={`/workouts/exercises/${workoutExercise.exercises.id}`}
                            className="text-base font-semibold text-zinc-900 transition-colors hover:text-violet-600 dark:text-white dark:hover:text-violet-300"
                          >
                            {workoutExercise.exercises.name}
                          </Link>
                        ) : (
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                            (deleted)
                          </h3>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t("Workouts.targetSets")}
                        </span>
                        <div className="flex items-center gap-0">
                          <button
                            onClick={() =>
                              handleUpdateSets(
                                workoutExercise.id,
                                workoutExercise.target_sets - 1,
                              )
                            }
                            disabled={
                              workoutExercise.target_sets <= 1 || isSavingSets
                            }
                            className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-l-xl flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 active:scale-95 transition-all border border-zinc-300 dark:border-zinc-700"
                          >
                            −
                          </button>
                          <div className="w-10 h-9 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-white flex items-center justify-center text-sm font-bold border-y border-zinc-300 dark:border-zinc-700">
                            {workoutExercise.target_sets}
                          </div>
                          <button
                            onClick={() =>
                              handleUpdateSets(
                                workoutExercise.id,
                                workoutExercise.target_sets + 1,
                              )
                            }
                            disabled={
                              workoutExercise.target_sets >= 20 || isSavingSets
                            }
                            className="w-9 h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-r-xl flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 active:scale-95 transition-all border border-zinc-300 dark:border-zinc-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleReorder(index, "up")}
                          disabled={index === 0 || reordering}
                          className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 15.75l7.5-7.5 7.5 7.5"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleReorder(index, "down")}
                          disabled={
                            index === workoutExercises.length - 1 || reordering
                          }
                          className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-white disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </button>
                        <button
                          disabled={
                            removingExercise ||
                            archivingExercise ||
                            !!checkingLogsForId
                          }
                          onClick={() =>
                            handleClickRemoveExercise(workoutExercise)
                          }
                          className="p-1.5 text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 hover:text-red-400 transition-colors ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isCheckingLogs ? (
                            <svg
                              className="w-5 h-5 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })(),
          )}
        </div>
      )}

      {showAddExercise ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 animate-[slideDown_0.2s_ease-out]">
          <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-3">
            {t("Workouts.addExercise")}
          </h3>

          <input
            type="text"
            value={exerciseSearch}
            disabled={addingExercise}
            onChange={(event) => setExerciseSearch(event.target.value)}
            placeholder={t("Workouts.searchExercises")}
            className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-base mb-3"
          />

          {exerciseLibraryLoading ? (
            <div className="space-y-2 mb-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </div>
          ) : filteredAvailableExercises.length > 0 ? (
            <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
              {filteredAvailableExercises.map((exercise) => (
                <button
                  key={exercise.id}
                  disabled={addingExercise}
                  onClick={() => {
                    setSelectedExerciseId(exercise.id);
                    setNewExerciseName("");
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    selectedExerciseId === exercise.id
                      ? "bg-violet-600/20 text-violet-300 border border-violet-600/30"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-800"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {exercise.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t("Workouts.noAvailableExercises")}
            </div>
          )}

          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-600">
              {t("Workouts.orCreateNew")}
            </span>
            <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          </div>

          <input
            type="text"
            value={newExerciseName}
            disabled={addingExercise}
            onChange={(event) => {
              setNewExerciseName(event.target.value);
              setSelectedExerciseId(null);
            }}
            placeholder={t("Workouts.newExercisePlaceholder")}
            className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-600
              focus:border-transparent text-base mb-3"
          />

          <div className="flex gap-2">
            <button
              disabled={addingExercise}
              onClick={() => {
                setShowAddExercise(false);
                setExerciseSearch("");
                setSelectedExerciseId(null);
                setNewExerciseName("");
              }}
              className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium rounded-xl hover:bg-zinc-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("Common.cancel")}
            </button>
            <button
              onClick={
                selectedExerciseId
                  ? handleAddExistingExercise
                  : handleCreateAndAddExercise
              }
              disabled={
                addingExercise ||
                (!selectedExerciseId && !newExerciseName.trim())
              }
              className="flex-1 py-2.5 bg-violet-600 text-zinc-900 dark:text-white font-medium rounded-xl hover:bg-violet-500 transition-colors disabled:opacity-50 text-sm"
            >
              {addingExercise
                ? "..."
                : selectedExerciseId
                  ? t("Workouts.addSelected")
                  : t("Workouts.createAndAdd")}
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={addingExercise}
          onClick={openAddExercise}
          className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium rounded-2xl hover:border-zinc-700 hover:text-zinc-400 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + {t("Workouts.addExercise")}
        </button>
      )}

      {/* Standard remove dialog — exercise has NO training history */}
      <ConfirmDialog
        open={!!deleteTarget && deleteTargetHasLogs === false}
        title={t("Workouts.removeConfirmTitle")}
        description={t("Workouts.removeConfirmDesc").replace(
          "{name}",
          deleteTarget?.exercises?.name ?? "",
        )}
        confirmLabel={t("Workouts.remove")}
        variant="danger"
        onConfirm={handleRemoveExercise}
        onCancel={handleCloseDeleteDialog}
      />

      {/* Archive dialog — exercise HAS training history */}
      {!!deleteTarget && deleteTargetHasLogs === true && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseDeleteDialog}
          />
          <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 animate-[slideUp_0.2s_ease-out] shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("Workouts.archiveExerciseTitle")}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              {t("Workouts.archiveExerciseDesc").replace(
                "{name}",
                deleteTarget?.exercises?.name ?? "",
              )}
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={handleArchiveAndRemoveExercise}
                disabled={archivingExercise || removingExercise}
                className="w-full py-3 bg-amber-500 text-zinc-900 font-medium rounded-xl hover:bg-amber-400 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                📦 {t("Workouts.archiveAndRemove")}
              </button>
              <button
                onClick={handleRemoveExercise}
                disabled={archivingExercise || removingExercise}
                className="w-full py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-500 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {t("Workouts.removeOnly")}
              </button>
              <button
                onClick={handleCloseDeleteDialog}
                disabled={archivingExercise || removingExercise}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {t("Common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
