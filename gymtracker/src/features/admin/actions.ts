"use server";

import { revalidatePath } from "next/cache";
import { errorResult, okResult } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import {
  archiveAdminSystemExercise,
  createAdminSystemExercise,
  createAdminUser,
  deleteAdminUser,
  recordManualBillingEvent,
  resetAdminUserTemporaryPassword,
  unarchiveAdminSystemExercise,
  updateAdminSystemExercise,
  updateAdminUser,
} from "@/features/admin/service";
import type {
  AdminBillingInput,
  AdminCreateUserInput,
  AdminSystemExerciseInput,
  AdminUpdateUserInput,
} from "@/features/admin/types";

function revalidateAdminSurfaces(userId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/exercises");

  if (userId) {
    revalidatePath(`/admin/users/${userId}`);
  }
}

export async function createAdminUserAction(
  input: AdminCreateUserInput,
): Promise<ActionResult<null>> {
  try {
    await createAdminUser(input);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateAdminUserAction(
  userId: string,
  input: AdminUpdateUserInput,
): Promise<ActionResult<null>> {
  try {
    await updateAdminUser(userId, input);
    revalidateAdminSurfaces(userId);
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function recordManualBillingEventAction(
  userId: string,
  input: AdminBillingInput,
): Promise<ActionResult<null>> {
  try {
    await recordManualBillingEvent(userId, input);
    revalidateAdminSurfaces(userId);
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function resetAdminUserTemporaryPasswordAction(
  userId: string,
  temporaryPassword: string,
): Promise<ActionResult<null>> {
  try {
    await resetAdminUserTemporaryPassword(userId, temporaryPassword);
    revalidateAdminSurfaces(userId);
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteAdminUserAction(
  userId: string,
): Promise<ActionResult<null>> {
  try {
    await deleteAdminUser(userId);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function createAdminSystemExerciseAction(
  input: AdminSystemExerciseInput,
): Promise<ActionResult<null>> {
  try {
    await createAdminSystemExercise(input);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateAdminSystemExerciseAction(
  exerciseId: string,
  input: AdminSystemExerciseInput,
): Promise<ActionResult<null>> {
  try {
    await updateAdminSystemExercise(exerciseId, input);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function archiveAdminSystemExerciseAction(
  exerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await archiveAdminSystemExercise(exerciseId);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}

export async function unarchiveAdminSystemExerciseAction(
  exerciseId: string,
): Promise<ActionResult<null>> {
  try {
    await unarchiveAdminSystemExercise(exerciseId);
    revalidateAdminSurfaces();
    return okResult(null);
  } catch (error) {
    return errorResult(error);
  }
}
