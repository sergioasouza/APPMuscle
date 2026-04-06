import "server-only";

import {
  archiveAdminSystemExerciseRepository,
  createAdminSystemExerciseRepository,
  createAdminUserRepository,
  deleteAdminUserRepository,
  getAdminDashboardRepository,
  getAdminUserDetailRepository,
  listAdminSystemExercisesRepository,
  listAdminUsersRepository,
  recordManualBillingEventRepository,
  resetAdminUserTemporaryPasswordRepository,
  unarchiveAdminSystemExerciseRepository,
  updateAdminSystemExerciseRepository,
  updateAdminUserRepository,
} from "@/features/admin/repository";
import type {
  AdminBillingInput,
  AdminCreateUserInput,
  AdminSystemExerciseInput,
  AdminUserListQuery,
  AdminUpdateUserInput,
} from "@/features/admin/types";
import { getReferenceMonthFromInput, normalizeAdminSearch } from "@/features/admin/utils";

export async function getAdminDashboardData() {
  return getAdminDashboardRepository();
}

export async function listAdminUsers(input?: Partial<AdminUserListQuery>) {
  return listAdminUsersRepository({
    search: normalizeAdminSearch(input?.search),
    statusFilter: input?.statusFilter ?? "all",
    roleFilter: input?.roleFilter ?? "all",
    paymentFilter: input?.paymentFilter ?? "all",
  });
}

export async function getAdminUserDetail(userId: string) {
  if (!userId) {
    throw new Error("User id is required");
  }

  return getAdminUserDetailRepository(userId);
}

export async function createAdminUser(input: AdminCreateUserInput) {
  return createAdminUserRepository({
    ...input,
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    billingDayOfMonth: input.billingDayOfMonth ?? null,
    billingGraceBusinessDays: input.billingGraceBusinessDays ?? 0,
    paidUntil: input.paidUntil || null,
    trialDays: input.trialDays ?? null,
    trialEndsAt: input.trialEndsAt || null,
  });
}

export async function updateAdminUser(
  userId: string,
  input: AdminUpdateUserInput,
) {
  if (!userId) {
    throw new Error("User id is required");
  }

  return updateAdminUserRepository(userId, {
    ...input,
    displayName: input.displayName.trim(),
    billingDayOfMonth: input.billingDayOfMonth ?? null,
    billingGraceBusinessDays: input.billingGraceBusinessDays ?? 0,
    paidUntil: input.paidUntil || null,
    trialEndsAt: input.trialEndsAt || null,
  });
}

export async function recordManualBillingEvent(
  userId: string,
  input: AdminBillingInput,
) {
  if (!userId) {
    throw new Error("User id is required");
  }

  return recordManualBillingEventRepository(userId, {
    ...input,
    referenceMonth: getReferenceMonthFromInput(input.referenceMonth),
    note: input.note?.trim() ?? null,
  });
}

export async function resetAdminUserTemporaryPassword(
  userId: string,
  temporaryPassword: string,
) {
  if (!userId) {
    throw new Error("User id is required");
  }

  return resetAdminUserTemporaryPasswordRepository(userId, temporaryPassword);
}

export async function deleteAdminUser(userId: string) {
  if (!userId) {
    throw new Error("User id is required");
  }

  return deleteAdminUserRepository(userId);
}

export async function listAdminSystemExercises() {
  return listAdminSystemExercisesRepository();
}

export async function createAdminSystemExercise(input: AdminSystemExerciseInput) {
  return createAdminSystemExerciseRepository({
    ...input,
    name: input.name.trim(),
    modality: input.modality?.trim() ?? null,
    muscleGroup: input.muscleGroup?.trim() ?? null,
  });
}

export async function updateAdminSystemExercise(
  exerciseId: string,
  input: AdminSystemExerciseInput,
) {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  return updateAdminSystemExerciseRepository(exerciseId, {
    ...input,
    name: input.name.trim(),
    modality: input.modality?.trim() ?? null,
    muscleGroup: input.muscleGroup?.trim() ?? null,
  });
}

export async function archiveAdminSystemExercise(exerciseId: string) {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  return archiveAdminSystemExerciseRepository(exerciseId);
}

export async function unarchiveAdminSystemExercise(exerciseId: string) {
  if (!exerciseId) {
    throw new Error("Exercise id is required");
  }

  return unarchiveAdminSystemExerciseRepository(exerciseId);
}
