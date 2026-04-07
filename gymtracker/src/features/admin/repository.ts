import "server-only";

import { getAdminServerContext } from "@/lib/supabase/auth";
import {
  getServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service-role";
import type {
  AdminAuditLog,
  Exercise,
  ManualBillingEvent,
  Profile,
} from "@/lib/types";
import { isProfileAccessActive } from "@/lib/access-control";
import type {
  AdminAuditEntry,
  AdminBillingInput,
  AdminCreateUserInput,
  AdminDashboardData,
  AdminSystemExerciseInput,
  AdminSystemExerciseItem,
  AdminUpdateUserInput,
  AdminUserDetailData,
  AdminUserListItem,
  AdminUserListQuery,
  ManualBillingEventView,
} from "@/features/admin/types";
import {
  addDaysToISO,
  getCurrentReferenceMonth,
  getEndOfMonthISO,
  getEndOfPreviousMonthISO,
  getReferenceMonthFromInput,
  getTodayISODate,
  maxDateISO,
  normalizeAdminSearch,
  normalizeAdminText,
  slugifySystemExerciseKey,
} from "@/features/admin/utils";

type AuthDirectoryUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

interface AdminOperationContext {
  serviceRole: ReturnType<typeof getServiceRoleClient>;
  actorId: string;
  actorName: string;
  todayISO: string;
}

function ensureActiveMemberInput(input: {
  role: Profile["role"];
  accessStatus: Profile["access_status"];
  memberAccessMode: Profile["member_access_mode"];
  billingDayOfMonth: number | null;
  billingGraceBusinessDays: number;
  paidUntil: string | null;
  trialEndsAt: string | null;
}) {
  if (input.role !== "member") {
    return;
  }

  if (
    input.memberAccessMode === "billable" &&
    (input.billingDayOfMonth == null ||
      input.billingDayOfMonth < 1 ||
      input.billingDayOfMonth > 31)
  ) {
    throw new Error("Billable members must have a billing day between 1 and 31");
  }

  if (
    input.billingGraceBusinessDays < 0 ||
    input.billingGraceBusinessDays > 10
  ) {
    throw new Error("Grace days must be between 0 and 10");
  }

  if (
    input.accessStatus === "active" &&
    input.memberAccessMode === "billable" &&
    !input.paidUntil
  ) {
    throw new Error("Active billable members must have a paid until date");
  }

  if (input.memberAccessMode === "trial" && !input.trialEndsAt) {
    throw new Error("Trial members must have a trial end date");
  }
}

async function getAdminOperationContext(): Promise<AdminOperationContext> {
  const context = await getAdminServerContext();
  const serviceRole = getServiceRoleClient();

  await purgeExpiredTrialUsers(serviceRole, context.user.id);

  return {
    serviceRole,
    actorId: context.user.id,
    actorName: context.profile.display_name,
    todayISO: context.todayISO,
  };
}

async function purgeExpiredTrialUsers(
  serviceRole: ReturnType<typeof getServiceRoleClient>,
  actorId: string,
) {
  const todayISO = getTodayISODate();
  const { data, error } = await serviceRole
    .from("profiles")
    .select("id, display_name")
    .eq("role", "member")
    .eq("member_access_mode", "trial")
    .lt("trial_ends_at", todayISO);

  if (error) {
    throw new Error(error.message);
  }

  const expiredProfiles = data ?? [];

  for (const profile of expiredProfiles) {
    const { error: auditError } = await serviceRole.from("admin_audit_log").insert({
      actor_user_id: actorId,
      target_user_id: profile.id,
      entity_type: "user",
      entity_id: profile.id,
      action: "user.trial_auto_deleted",
      metadata: {
        displayName: profile.display_name,
        deletedAt: todayISO,
        reason: "trial_expired",
      },
    });

    if (auditError) {
      throw new Error(auditError.message);
    }

    const deleteResult = await serviceRole.auth.admin.deleteUser(profile.id);

    if (deleteResult.error) {
      throw new Error(deleteResult.error.message);
    }
  }
}

async function listAllAuthUsers(
  serviceRole: AdminOperationContext["serviceRole"],
): Promise<AuthDirectoryUser[]> {
  const users: AuthDirectoryUser[] = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const result = await serviceRole.auth.admin.listUsers({ page, perPage });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const batch = result.data.users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
    }));

    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function ensureProfileExists(
  serviceRole: AdminOperationContext["serviceRole"],
  input: {
    userId: string;
    displayName: string;
    role: Profile["role"];
    accessStatus: Profile["access_status"];
    memberAccessMode: Profile["member_access_mode"];
    billingDayOfMonth: number | null;
    billingGraceBusinessDays: number;
    paidUntil: string | null;
    trialEndsAt: string | null;
    mustChangePassword: boolean;
    createdByAdminId: string | null;
  },
) {
  const { error } = await serviceRole.from("profiles").upsert(
    {
      id: input.userId,
      display_name: input.displayName,
      role: input.role,
      access_status: input.accessStatus,
      member_access_mode: input.memberAccessMode,
      billing_day_of_month: input.billingDayOfMonth,
      billing_grace_business_days: input.billingGraceBusinessDays,
      paid_until: input.paidUntil,
      trial_ends_at: input.trialEndsAt,
      must_change_password: input.mustChangePassword,
      created_by_admin_id: input.createdByAdminId,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function writeAdminAuditLog(
  context: AdminOperationContext,
  input: {
    action: string;
    entityType: AdminAuditLog["entity_type"];
    entityId?: string | null;
    targetUserId?: string | null;
    metadata?: AdminAuditLog["metadata"];
  },
) {
  const { error } = await context.serviceRole.from("admin_audit_log").insert({
    actor_user_id: context.actorId,
    target_user_id: input.targetUserId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

function mapProfilesToListItems(
  profiles: Profile[],
  authUsers: AuthDirectoryUser[],
): AdminUserListItem[] {
  const authUsersById = authUsers.reduce<Map<string, AuthDirectoryUser>>(
    (accumulator, user) => {
      accumulator.set(user.id, user);
      return accumulator;
    },
    new Map(),
  );

  return profiles.map((profile) => {
    const authUser = authUsersById.get(profile.id);

    return {
      id: profile.id,
      displayName: profile.display_name,
      email: authUser?.email ?? null,
      role: profile.role,
      accessStatus: profile.access_status,
      memberAccessMode: profile.member_access_mode,
      billingDayOfMonth: profile.billing_day_of_month,
      billingGraceBusinessDays: profile.billing_grace_business_days,
      paidUntil: profile.paid_until,
      trialEndsAt: profile.trial_ends_at,
      mustChangePassword: profile.must_change_password,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
    };
  });
}

function buildAuditEntries(
  logs: AdminAuditLog[],
  profilesById: Map<string, Profile>,
): AdminAuditEntry[] {
  return logs.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entity_type,
    createdAt: entry.created_at,
    actorName: profilesById.get(entry.actor_user_id)?.display_name ?? "Admin",
    targetName: entry.target_user_id
      ? profilesById.get(entry.target_user_id)?.display_name ?? null
      : null,
    metadata: entry.metadata,
  }));
}

function filterUsers(
  users: AdminUserListItem[],
  query: AdminUserListQuery,
  todayISO: string,
) {
  const search = normalizeAdminSearch(query.search);

  return users.filter((user) => {
    const matchesSearch =
      search.length === 0 ||
      user.displayName.toLowerCase().includes(search) ||
      (user.email ?? "").toLowerCase().includes(search);
    const matchesRole =
      query.roleFilter === "all" || user.role === query.roleFilter;
    const matchesStatus =
      query.statusFilter === "all" ||
      (query.statusFilter === "active"
        ? user.role === "admin" ||
          (user.accessStatus === "active" &&
            (user.memberAccessMode === "internal" ||
              (user.memberAccessMode === "billable" &&
                user.paidUntil != null &&
                user.paidUntil >= todayISO) ||
              (user.memberAccessMode === "trial" &&
                user.trialEndsAt != null &&
                user.trialEndsAt >= todayISO)))
        : user.role === "member" &&
          (user.accessStatus === "blocked" ||
            (user.memberAccessMode === "billable" &&
              (user.paidUntil == null || user.paidUntil < todayISO)) ||
            (user.memberAccessMode === "trial" &&
              (user.trialEndsAt == null || user.trialEndsAt < todayISO))));
    const matchesPayment =
      query.paymentFilter === "all" ||
      (query.paymentFilter === "paid"
        ? user.role === "admin" ||
          user.memberAccessMode !== "billable" ||
          (user.paidUntil != null && user.paidUntil >= todayISO)
        : user.role === "member" &&
          user.memberAccessMode === "billable" &&
          (user.paidUntil == null || user.paidUntil < todayISO));

    return matchesSearch && matchesRole && matchesStatus && matchesPayment;
  });
}

async function getProfilesForAdmin(
  serviceRole: AdminOperationContext["serviceRole"],
) {
  const { data, error } = await serviceRole
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Profile[];
}

export async function getAdminDashboardRepository(): Promise<AdminDashboardData> {
  const context = await getAdminOperationContext();
  const currentReferenceMonth = getCurrentReferenceMonth();
  const [profiles, authUsers, auditLogResult, billingResult] = await Promise.all([
    getProfilesForAdmin(context.serviceRole),
    listAllAuthUsers(context.serviceRole),
    context.serviceRole
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    context.serviceRole
      .from("manual_billing_events")
      .select("*")
      .eq("reference_month", currentReferenceMonth)
      .in("status", ["paid", "waived"]),
  ]);

  if (auditLogResult.error) {
    throw new Error(auditLogResult.error.message);
  }

  if (billingResult.error) {
    throw new Error(billingResult.error.message);
  }

  const profilesById = profiles.reduce<Map<string, Profile>>((accumulator, profile) => {
    accumulator.set(profile.id, profile);
    return accumulator;
  }, new Map());
  const userItems = mapProfilesToListItems(profiles, authUsers);
  const currentMonthEnd = getEndOfMonthISO(currentReferenceMonth);

  return {
    summary: {
      activeMembers: profiles.filter(
        (profile) =>
          profile.role === "member" &&
          isProfileAccessActive(profile, context.todayISO),
      ).length,
      blockedMembers: profiles.filter(
        (profile) =>
          profile.role === "member" &&
          !isProfileAccessActive(profile, context.todayISO),
      ).length,
      expiringThisMonth: profiles.filter(
        (profile) =>
          profile.role === "member" &&
          profile.paid_until != null &&
          profile.paid_until >= context.todayISO &&
          profile.paid_until <= currentMonthEnd,
      ).length,
      currentMonthReceipts: (billingResult.data ?? []).length,
    },
    operational: {
      serviceRoleConfigured: isServiceRoleConfigured(),
    },
    recentUsers: userItems.slice(0, 5),
    recentAuditLog: buildAuditEntries(
      ((auditLogResult.data ?? []) as AdminAuditLog[]),
      profilesById,
    ),
    currentReferenceMonth,
  };
}

export async function listAdminUsersRepository(
  query: AdminUserListQuery,
): Promise<AdminUserListItem[]> {
  const context = await getAdminOperationContext();
  const [profiles, authUsers] = await Promise.all([
    getProfilesForAdmin(context.serviceRole),
    listAllAuthUsers(context.serviceRole),
  ]);

  return filterUsers(
    mapProfilesToListItems(profiles, authUsers),
    query,
    context.todayISO,
  );
}

export async function getAdminUserDetailRepository(
  userId: string,
): Promise<AdminUserDetailData | null> {
  const context = await getAdminOperationContext();
  const [profileResult, authUserResult, billingResult, auditResult, workoutResult, bodyResult] =
    await Promise.all([
      context.serviceRole.from("profiles").select("*").eq("id", userId).maybeSingle(),
      context.serviceRole.auth.admin.getUserById(userId),
      context.serviceRole
        .from("manual_billing_events")
        .select("*")
        .eq("user_id", userId)
        .order("reference_month", { ascending: false }),
      context.serviceRole
        .from("admin_audit_log")
        .select("*")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      context.serviceRole
        .from("workout_sessions")
        .select("performed_at")
        .eq("user_id", userId)
        .order("performed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      context.serviceRole
        .from("body_measurements")
        .select("measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (authUserResult.error) {
    throw new Error(authUserResult.error.message);
  }

  if (billingResult.error) {
    throw new Error(billingResult.error.message);
  }

  if (auditResult.error) {
    throw new Error(auditResult.error.message);
  }

  if (workoutResult.error) {
    throw new Error(workoutResult.error.message);
  }

  if (bodyResult.error) {
    throw new Error(bodyResult.error.message);
  }

  if (!profileResult.data || !authUserResult.data.user) {
    return null;
  }

  const actorAndTargetProfiles = await context.serviceRole
    .from("profiles")
    .select("*")
    .in("id", [
      context.actorId,
      userId,
      ...((auditResult.data ?? []) as AdminAuditLog[])
        .flatMap((entry) => [entry.actor_user_id, entry.target_user_id])
        .filter((value): value is string => Boolean(value)),
      ...((billingResult.data ?? []) as ManualBillingEvent[])
        .map((entry) => entry.recorded_by),
    ]);

  if (actorAndTargetProfiles.error) {
    throw new Error(actorAndTargetProfiles.error.message);
  }

  const profilesById = ((actorAndTargetProfiles.data ?? []) as Profile[]).reduce<
    Map<string, Profile>
  >((accumulator, profile) => {
    accumulator.set(profile.id, profile);
    return accumulator;
  }, new Map());

  const userItem = mapProfilesToListItems(
    [profileResult.data as Profile],
    [
      {
        id: authUserResult.data.user.id,
        email: authUserResult.data.user.email ?? null,
        created_at: authUserResult.data.user.created_at,
        last_sign_in_at: authUserResult.data.user.last_sign_in_at ?? null,
      },
    ],
  )[0];
  const lastWorkoutAt = workoutResult.data?.performed_at ?? null;
  const lastBodyMeasurementAt = bodyResult.data?.measured_at ?? null;
  const lastActivityAt = maxDateISO(lastWorkoutAt, lastBodyMeasurementAt);

  const billingEvents: ManualBillingEventView[] = (
    (billingResult.data ?? []) as ManualBillingEvent[]
  ).map((event) => ({
    id: event.id,
    referenceMonth: event.reference_month,
    status: event.status,
    note: event.note,
    recordedByName: profilesById.get(event.recorded_by)?.display_name ?? null,
    createdAt: event.created_at,
  }));

  return {
    user: userItem,
    lastWorkoutAt,
    lastBodyMeasurementAt,
    lastActivityAt,
    billingEvents,
    auditEntries: buildAuditEntries(
      ((auditResult.data ?? []) as AdminAuditLog[]),
      profilesById,
    ),
    isSelf: context.actorId === userId,
  };
}

export async function createAdminUserRepository(input: AdminCreateUserInput) {
  const context = await getAdminOperationContext();

  const normalizedDisplayName = input.displayName.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedDisplayName || !normalizedEmail) {
    throw new Error("Display name and email are required");
  }

  if (input.temporaryPassword.length < 8) {
    throw new Error("Temporary password must be at least 8 characters long");
  }

  const userResult = await context.serviceRole.auth.admin.createUser({
    email: normalizedEmail,
    password: input.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: normalizedDisplayName,
    },
  });

  if (userResult.error || !userResult.data.user) {
    throw new Error(userResult.error?.message ?? "Unable to create user");
  }

  const paidUntil =
    input.role === "admin" || input.memberAccessMode !== "billable"
      ? null
      : input.paidUntil;
  const memberAccessMode =
    input.role === "admin" ? "internal" : input.memberAccessMode;
  const billingDayOfMonth =
    memberAccessMode === "billable" ? input.billingDayOfMonth : null;
  const billingGraceBusinessDays =
    memberAccessMode === "billable" ? input.billingGraceBusinessDays : 0;
  const trialEndsAt =
    memberAccessMode === "trial"
      ? input.trialEndsAt ??
        (input.trialDays != null
          ? addDaysToISO(context.todayISO, Math.max(input.trialDays - 1, 0))
          : null)
      : null;

  ensureActiveMemberInput({
    role: input.role,
    accessStatus: input.accessStatus,
    memberAccessMode,
    billingDayOfMonth,
    billingGraceBusinessDays,
    paidUntil,
    trialEndsAt,
  });

  await ensureProfileExists(context.serviceRole, {
    userId: userResult.data.user.id,
    displayName: normalizedDisplayName,
    role: input.role,
    accessStatus: input.accessStatus,
    memberAccessMode,
    billingDayOfMonth,
    billingGraceBusinessDays,
    paidUntil,
    trialEndsAt,
    mustChangePassword: true,
    createdByAdminId: context.actorId,
  });

  await writeAdminAuditLog(context, {
    action: "user.created",
    entityType: "user",
    entityId: userResult.data.user.id,
    targetUserId: userResult.data.user.id,
    metadata: {
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      role: input.role,
      accessStatus: input.accessStatus,
      memberAccessMode,
      billingDayOfMonth,
      billingGraceBusinessDays,
      paidUntil,
      trialEndsAt,
    },
  });
}

export async function updateAdminUserRepository(
  userId: string,
  input: AdminUpdateUserInput,
) {
  const context = await getAdminOperationContext();
  ensureActiveMemberInput(input);

  if (context.actorId === userId && input.role !== "admin") {
    throw new Error("You cannot remove your own admin access");
  }

  if (context.actorId === userId && input.accessStatus === "blocked") {
    throw new Error("You cannot block your own account");
  }

  const { data: existingProfile, error } = await context.serviceRole
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!existingProfile) {
    throw new Error("User not found");
  }

  const paidUntil =
    input.role === "admin" || input.memberAccessMode !== "billable"
      ? null
      : input.paidUntil;
  const memberAccessMode =
    input.role === "admin" ? "internal" : input.memberAccessMode;
  const billingDayOfMonth =
    memberAccessMode === "billable" ? input.billingDayOfMonth : null;
  const billingGraceBusinessDays =
    memberAccessMode === "billable" ? input.billingGraceBusinessDays : 0;
  const trialEndsAt =
    memberAccessMode === "trial"
      ? input.trialEndsAt
      : null;

  const { error: updateError } = await context.serviceRole
    .from("profiles")
    .update({
      display_name: input.displayName.trim(),
      role: input.role,
      access_status: input.accessStatus,
      member_access_mode: memberAccessMode,
      billing_day_of_month: billingDayOfMonth,
      billing_grace_business_days: billingGraceBusinessDays,
      paid_until: paidUntil,
      trial_ends_at: trialEndsAt,
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeAdminAuditLog(context, {
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    targetUserId: userId,
    metadata: {
      previous: {
        displayName: existingProfile.display_name,
        role: existingProfile.role,
        accessStatus: existingProfile.access_status,
        memberAccessMode: existingProfile.member_access_mode,
        billingDayOfMonth: existingProfile.billing_day_of_month,
        billingGraceBusinessDays: existingProfile.billing_grace_business_days,
        paidUntil: existingProfile.paid_until,
        trialEndsAt: existingProfile.trial_ends_at,
      },
      next: {
        displayName: input.displayName.trim(),
        role: input.role,
        accessStatus: input.accessStatus,
        memberAccessMode,
        billingDayOfMonth,
        billingGraceBusinessDays,
        paidUntil,
        trialEndsAt,
      },
    },
  });
}

export async function recordManualBillingEventRepository(
  userId: string,
  input: AdminBillingInput,
) {
  const context = await getAdminOperationContext();
  const referenceMonth = getReferenceMonthFromInput(input.referenceMonth);
  const { data: profile, error: profileError } = await context.serviceRole
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("User not found");
  }

  if (profile.role !== "member" || profile.member_access_mode !== "billable") {
    throw new Error("Manual billing is only available for billable members");
  }

  const { error: billingError } = await context.serviceRole
    .from("manual_billing_events")
    .upsert(
      {
        user_id: userId,
        reference_month: referenceMonth,
        status: input.status,
        note: normalizeAdminText(input.note),
        recorded_by: context.actorId,
      },
      { onConflict: "user_id,reference_month" },
    );

  if (billingError) {
    throw new Error(billingError.message);
  }

  let nextPaidUntil = profile.paid_until;
  let nextAccessStatus = profile.access_status;

  if (profile.role === "member" && profile.member_access_mode === "billable") {
    if (input.status === "paid" || input.status === "waived") {
      nextPaidUntil = maxDateISO(
        profile.paid_until,
        getEndOfMonthISO(referenceMonth),
      );
      nextAccessStatus = "active";
    } else {
      const previousMonthEnd = getEndOfPreviousMonthISO(referenceMonth);
      nextPaidUntil =
        profile.paid_until != null && profile.paid_until > previousMonthEnd
          ? previousMonthEnd
          : profile.paid_until;
      nextAccessStatus = "blocked";
    }
  }

  const { error: updateError } = await context.serviceRole
    .from("profiles")
    .update({
      access_status: nextAccessStatus,
      paid_until: nextPaidUntil,
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeAdminAuditLog(context, {
    action: "billing.recorded",
    entityType: "billing",
    entityId: userId,
    targetUserId: userId,
    metadata: {
      referenceMonth,
      status: input.status,
      note: normalizeAdminText(input.note),
      paidUntil: nextPaidUntil,
      accessStatus: nextAccessStatus,
    },
  });
}

export async function resetAdminUserTemporaryPasswordRepository(
  userId: string,
  temporaryPassword: string,
) {
  const context = await getAdminOperationContext();

  if (context.actorId === userId) {
    throw new Error("Use the password recovery flow for your own account");
  }

  if (temporaryPassword.length < 8) {
    throw new Error("Temporary password must be at least 8 characters long");
  }

  const userResult = await context.serviceRole.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    email_confirm: true,
  });

  if (userResult.error) {
    throw new Error(userResult.error.message);
  }

  const { error } = await context.serviceRole
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(context, {
    action: "auth.temporary_password_reset",
    entityType: "auth",
    entityId: userId,
    targetUserId: userId,
    metadata: {},
  });
}

export async function deleteAdminUserRepository(userId: string) {
  const context = await getAdminOperationContext();

  if (context.actorId === userId) {
    throw new Error("You cannot delete your own admin account");
  }

  const [profileResult, authUserResult] = await Promise.all([
    context.serviceRole.from("profiles").select("*").eq("id", userId).maybeSingle(),
    context.serviceRole.auth.admin.getUserById(userId),
  ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (authUserResult.error) {
    throw new Error(authUserResult.error.message);
  }

  if (!profileResult.data) {
    throw new Error("User not found");
  }

  await writeAdminAuditLog(context, {
    action: "user.deleted",
    entityType: "user",
    entityId: userId,
    targetUserId: userId,
    metadata: {
      email: authUserResult.data.user?.email ?? null,
      displayName: profileResult.data.display_name,
    },
  });

  const deleteResult = await context.serviceRole.auth.admin.deleteUser(userId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }
}

export async function listAdminSystemExercisesRepository(): Promise<
  AdminSystemExerciseItem[]
> {
  const context = await getAdminOperationContext();
  const { data, error } = await context.serviceRole
    .from("exercises")
    .select("id, system_key, name, modality, muscle_group, archived_at, created_at")
    .eq("is_system", true)
    .is("user_id", null)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Exercise[]).map((exercise) => ({
    id: exercise.id,
    systemKey: exercise.system_key,
    name: exercise.name,
    modality: exercise.modality,
    muscleGroup: exercise.muscle_group,
    archivedAt: exercise.archived_at,
    createdAt: exercise.created_at,
  }));
}

async function generateUniqueSystemKey(
  context: AdminOperationContext,
  input: AdminSystemExerciseInput,
  currentExerciseId?: string,
) {
  const baseKey = slugifySystemExerciseKey(input);
  let candidate = baseKey;
  let suffix = 2;

  while (true) {
    const query = context.serviceRole
      .from("exercises")
      .select("id")
      .eq("system_key", candidate)
      .maybeSingle();
    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.id === currentExerciseId) {
      return candidate;
    }

    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }
}

export async function createAdminSystemExerciseRepository(
  input: AdminSystemExerciseInput,
) {
  const context = await getAdminOperationContext();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Exercise name is required");
  }

  const systemKey = await generateUniqueSystemKey(context, input);
  const { data, error } = await context.serviceRole
    .from("exercises")
    .insert({
      user_id: null,
      is_system: true,
      system_key: systemKey,
      name: normalizedName,
      modality: normalizeAdminText(input.modality),
      muscle_group: normalizeAdminText(input.muscleGroup),
    })
    .select("id, system_key, name, modality, muscle_group, archived_at, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(context, {
    action: "exercise.system_created",
    entityType: "exercise",
    entityId: data.id,
    metadata: {
      systemKey,
      name: data.name,
      modality: data.modality,
      muscleGroup: data.muscle_group,
    },
  });
}

export async function updateAdminSystemExerciseRepository(
  exerciseId: string,
  input: AdminSystemExerciseInput,
) {
  const context = await getAdminOperationContext();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Exercise name is required");
  }

  const { data: existingExercise, error: existingError } = await context.serviceRole
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .eq("is_system", true)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existingExercise) {
    throw new Error("Base exercise not found");
  }

  const { error } = await context.serviceRole
    .from("exercises")
    .update({
      name: normalizedName,
      modality: normalizeAdminText(input.modality),
      muscle_group: normalizeAdminText(input.muscleGroup),
    })
    .eq("id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(context, {
    action: "exercise.system_updated",
    entityType: "exercise",
    entityId: exerciseId,
    metadata: {
      previous: {
        name: existingExercise.name,
        modality: existingExercise.modality,
        muscleGroup: existingExercise.muscle_group,
      },
      next: {
        name: normalizedName,
        modality: normalizeAdminText(input.modality),
        muscleGroup: normalizeAdminText(input.muscleGroup),
      },
    },
  });
}

export async function archiveAdminSystemExerciseRepository(exerciseId: string) {
  const context = await getAdminOperationContext();
  const { error } = await context.serviceRole
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", exerciseId)
    .eq("is_system", true);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(context, {
    action: "exercise.system_archived",
    entityType: "exercise",
    entityId: exerciseId,
  });
}

export async function unarchiveAdminSystemExerciseRepository(exerciseId: string) {
  const context = await getAdminOperationContext();
  const { error } = await context.serviceRole
    .from("exercises")
    .update({ archived_at: null })
    .eq("id", exerciseId)
    .eq("is_system", true);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(context, {
    action: "exercise.system_unarchived",
    entityType: "exercise",
    entityId: exerciseId,
  });
}
