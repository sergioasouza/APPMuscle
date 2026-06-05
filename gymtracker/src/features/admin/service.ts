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
import {
  assertIntegerInRange,
  assertOptionalIsoDate,
  assertUuid,
} from "@/lib/validation";

function assertOneOf<T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string,
): asserts value is T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${fieldName} is invalid`);
  }
}

function validateAdminUserInput(
  input: AdminCreateUserInput | AdminUpdateUserInput,
) {
  assertOneOf(input.role, ["member", "admin"], "Role");
  assertOneOf(input.accessStatus, ["active", "blocked"], "Access status");
  assertOneOf(
    input.memberAccessMode,
    ["internal", "billable", "trial"],
    "Member access mode",
  );

  if (input.billingDayOfMonth != null) {
    assertIntegerInRange(input.billingDayOfMonth, "Billing day", 1, 31);
  }

  assertIntegerInRange(
    input.billingGraceBusinessDays,
    "Billing grace business days",
    0,
    10,
  );
  assertOptionalIsoDate(input.paidUntil, "Paid until");
  assertOptionalIsoDate(input.trialEndsAt, "Trial end date");
}

function validateAdminCreateUserInput(input: AdminCreateUserInput) {
  validateAdminUserInput(input);

  if (!input.displayName.trim() || !input.email.trim()) {
    throw new Error("Display name and email are required");
  }

  if (input.temporaryPassword.length < 8) {
    throw new Error("Temporary password must be at least 8 characters long");
  }

  if (input.trialDays != null) {
    assertIntegerInRange(input.trialDays, "Trial days", 1, 90);
  }
}

function validateAdminUpdateUserInput(input: AdminUpdateUserInput) {
  validateAdminUserInput(input);

  if (!input.displayName.trim()) {
    throw new Error("Display name is required");
  }
}

function validateAdminSystemExerciseInput(input: AdminSystemExerciseInput) {
  if (!input.name.trim()) {
    throw new Error("Exercise name is required");
  }
}

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
  assertUuid(userId, "User id");

  return getAdminUserDetailRepository(userId);
}

export async function createAdminUser(input: AdminCreateUserInput) {
  validateAdminCreateUserInput(input);

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
  assertUuid(userId, "User id");
  validateAdminUpdateUserInput(input);

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
  assertUuid(userId, "User id");
  assertOneOf(input.status, ["paid", "unpaid", "waived"], "Billing status");

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
  assertUuid(userId, "User id");

  if (temporaryPassword.length < 8) {
    throw new Error("Temporary password must be at least 8 characters long");
  }

  return resetAdminUserTemporaryPasswordRepository(userId, temporaryPassword);
}

export async function deleteAdminUser(userId: string) {
  assertUuid(userId, "User id");

  return deleteAdminUserRepository(userId);
}

export async function listAdminSystemExercises() {
  return listAdminSystemExercisesRepository();
}

export async function createAdminSystemExercise(input: AdminSystemExerciseInput) {
  validateAdminSystemExerciseInput(input);

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
  assertUuid(exerciseId, "Exercise id");
  validateAdminSystemExerciseInput(input);

  return updateAdminSystemExerciseRepository(exerciseId, {
    ...input,
    name: input.name.trim(),
    modality: input.modality?.trim() ?? null,
    muscleGroup: input.muscleGroup?.trim() ?? null,
  });
}

export async function archiveAdminSystemExercise(exerciseId: string) {
  assertUuid(exerciseId, "Exercise id");

  return archiveAdminSystemExerciseRepository(exerciseId);
}

export async function unarchiveAdminSystemExercise(exerciseId: string) {
  assertUuid(exerciseId, "Exercise id");

  return unarchiveAdminSystemExerciseRepository(exerciseId);
}
