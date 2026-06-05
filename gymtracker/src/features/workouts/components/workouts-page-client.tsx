"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldLabel, Input } from "@/components/ui/fields";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatusPill,
  Surface,
} from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import {
  createWorkoutAction,
  deleteWorkoutAction,
  duplicateWorkoutAction,
} from "@/features/workouts/actions";
import { WorkoutsSectionNav } from "@/features/workouts/components/workouts-section-nav";
import type { WorkoutListItem } from "@/features/workouts/types";

interface WorkoutsPageClientProps {
  initialWorkouts: WorkoutListItem[];
}

function createClientMutationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function WorkoutsPageClient({
  initialWorkouts,
}: WorkoutsPageClientProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { showToast } = useToast();

  const [workouts, setWorkouts] = useState(initialWorkouts);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [duplicatingWorkoutId, setDuplicatingWorkoutId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<WorkoutListItem | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const latestDeleteMutationByWorkoutRef = useRef<Record<string, string>>({});

  const busy = creating || deletingWorkoutId !== null || duplicatingWorkoutId !== null;

  function closeCreateForm() {
    setShowNewForm(false);
    setNewName("");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    if (creating || !newName.trim()) {
      return;
    }

    setCreating(true);

    try {
      const result = await createWorkoutAction(newName);

      if (!result.ok || !result.data) {
        showToast(result.message ?? "Unable to create workout", "error");
        return;
      }

      setWorkouts((previous) => [result.data!, ...previous]);
      closeCreateForm();
      showToast(t("Workouts.toastCreated", { name: result.data.name }));
      router.push(`/workouts/${result.data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(workout: WorkoutListItem) {
    if (duplicatingWorkoutId || deletingWorkoutId || creating) {
      return;
    }

    setDuplicatingWorkoutId(workout.id);
    const result = await duplicateWorkoutAction(workout.id);
    setDuplicatingWorkoutId(null);

    if (!result.ok || !result.data) {
      showToast(result.message ?? "Unable to duplicate workout", "error");
      return;
    }

    setWorkouts((previous) => [result.data!, ...previous]);
    showToast(t("Workouts.toastDuplicated", { name: result.data.name }));
    router.push(`/workouts/${result.data.id}`);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;

    if (deletingWorkoutId === target.id) {
      return;
    }

    const clientMutationId = createClientMutationId();
    latestDeleteMutationByWorkoutRef.current[target.id] = clientMutationId;
    setDeletingWorkoutId(target.id);
    const previousWorkouts = workouts;

    setDeleteTarget(null);
    setWorkouts((previous) =>
      previous.filter((workout) => workout.id !== target.id),
    );

    try {
      const result = await deleteWorkoutAction(target.id);

      if (latestDeleteMutationByWorkoutRef.current[target.id] !== clientMutationId) {
        return;
      }

      if (!result.ok) {
        setWorkouts(previousWorkouts);
        showToast(result.message ?? "Unable to delete workout", "error");
        return;
      }

      showToast(t("Workouts.toastDeleted", { name: target.name }));
    } finally {
      if (latestDeleteMutationByWorkoutRef.current[target.id] === clientMutationId) {
        setDeletingWorkoutId(null);
      }
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        eyebrow={t("Workouts.sectionWorkouts")}
        title={t("Workouts.title")}
        description={t("Workouts.overviewDescription")}
        actions={
          <Button disabled={busy} size="lg" onClick={() => setShowNewForm(true)}>
            + {t("Workouts.newButton")}
          </Button>
        }
      />

      <div className="mt-6">
        <WorkoutsSectionNav />
      </div>

      {showNewForm ? (
        <Surface className="mt-6 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-kicker">{t("Workouts.createWorkout")}</p>
              <h2 className="mt-2 text-xl font-bold text-zinc-950 dark:text-white">
                {t("Workouts.newWorkout")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {t("Workouts.createNew")}
              </p>
            </div>
            <StatusPill>{t("Workouts.focusLabel")}</StatusPill>
          </div>

          <form className="space-y-4" onSubmit={handleCreate}>
            <div>
              <FieldLabel htmlFor="new-workout-name">{t("Common.name")}</FieldLabel>
              <Input
                id="new-workout-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t("Workouts.workoutNamePlaceholder")}
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                size="lg"
              >
                {creating ? t("Workouts.creating") : t("Common.create")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={creating}
                onClick={closeCreateForm}
              >
                {t("Common.cancel")}
              </Button>
            </div>
          </form>
        </Surface>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div>
          <p className="app-kicker">{t("Workouts.workoutsOverviewLabel")}</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            {t("Workouts.totalWorkouts", { count: workouts.length })}
          </p>
        </div>
      </div>

      {workouts.length === 0 && !showNewForm ? (
        <div className="mt-6">
          <EmptyState
            icon="🏋️"
            title={t("Workouts.noWorkouts")}
            description={t("Workouts.createNew")}
            action={
              <Button size="lg" onClick={() => setShowNewForm(true)}>
                {t("Workouts.createWorkout")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {workouts.map((workout) => {
            const isDeleting = deletingWorkoutId === workout.id;
            const isDuplicating = duplicatingWorkoutId === workout.id;

            return (
              <Surface
                key={workout.id}
                className="flex h-full flex-col gap-5 p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <StatusPill className="bg-white/8 text-zinc-100">
                      {t("Workouts.workoutCardLabel")}
                    </StatusPill>
                    <h3 className="mt-4 truncate text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                      {workout.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      {t("Workouts.tapToEdit")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right text-xs text-zinc-300">
                    <div className="font-semibold text-white">
                      {new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(workout.created_at))}
                    </div>
                    <div className="mt-1 uppercase tracking-[0.18em] text-zinc-400">
                      {t("Workouts.createdAtLabel")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    size="lg"
                    disabled={busy}
                    onClick={() => router.push(`/workouts/${workout.id}`)}
                  >
                    {t("Common.edit")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={busy}
                    onClick={() => handleDuplicate(workout)}
                  >
                    {isDuplicating ? t("Workouts.duplicating") : t("Workouts.duplicate")}
                  </Button>
                  <Button
                    variant="danger"
                    size="lg"
                    disabled={busy}
                    onClick={() => setDeleteTarget(workout)}
                  >
                    {isDeleting ? t("Workouts.deleting") : t("Common.delete")}
                  </Button>
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("Workouts.deleteConfirmTitle")}
        description={t("Workouts.deleteConfirmDesc").replace(
          "{name}",
          deleteTarget?.name ?? "",
        )}
        confirmLabel={t("Common.delete")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageShell>
  );
}
