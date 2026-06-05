import {
  createServiceRoleSupabaseClient,
  loadLocalEnvFiles,
} from "./lib/supabase-script-support";

type BootstrapUserInput = {
  email: string;
  password: string;
  displayName: string;
};

async function upsertAuthUser(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  input: BootstrapUserInput,
) {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const displayName = input.displayName.trim();

  if (!email) {
    throw new Error("Missing email");
  }

  if (!password || password.length < 8) {
    throw new Error(`Invalid password for ${email}`);
  }

  if (!displayName) {
    throw new Error(`Missing display name for ${email}`);
  }

  const existingUsers = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });

  if (existingUsers.error) {
    throw new Error(existingUsers.error.message);
  }

  const existingUser = existingUsers.data.users.find(
    (user) => user.email?.toLowerCase() === email,
  );

  if (existingUser?.id) {
    const updateResult = await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    return existingUser.id;
  }

  const createResult = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (createResult.error || !createResult.data.user) {
    throw new Error(createResult.error?.message ?? `Unable to create user: ${email}`);
  }

  return createResult.data.user.id;
}

async function upsertProfile(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  input: {
    userId: string;
    displayName: string;
    role: "member" | "admin";
    accessStatus: "active" | "blocked";
    memberAccessMode: "internal" | "billable" | "trial";
    billingDayOfMonth: number | null;
    billingGraceBusinessDays: number;
    paidUntil: string | null;
    trialEndsAt: string | null;
    mustChangePassword: boolean;
    createdByAdminId: string | null;
  },
) {
  const { error } = await supabase.from("profiles").upsert(
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

async function writeAuditLog(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  input: {
    actorUserId: string;
    targetUserId: string;
    action: string;
    metadata: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId,
    entity_type: "user",
    entity_id: input.targetUserId,
    action: input.action,
    metadata: input.metadata,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function main() {
  loadLocalEnvFiles();

  const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim() ?? "";
  const memberEmail = process.env.E2E_MEMBER_EMAIL?.trim().toLowerCase();
  const memberPassword = process.env.E2E_MEMBER_PASSWORD?.trim() ?? "";

  if (!adminEmail || !adminPassword || !memberEmail || !memberPassword) {
    throw new Error(
      "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD",
    );
  }

  const supabase = createServiceRoleSupabaseClient();

  const adminUserId = await upsertAuthUser(supabase, {
    email: adminEmail,
    password: adminPassword,
    displayName: "E2E Admin",
  });

  await upsertProfile(supabase, {
    userId: adminUserId,
    displayName: "E2E Admin",
    role: "admin",
    accessStatus: "active",
    memberAccessMode: "internal",
    billingDayOfMonth: null,
    billingGraceBusinessDays: 0,
    paidUntil: null,
    trialEndsAt: null,
    mustChangePassword: false,
    createdByAdminId: null,
  });

  await writeAuditLog(supabase, {
    actorUserId: adminUserId,
    targetUserId: adminUserId,
    action: "e2e.bootstrap.admin",
    metadata: {
      email: adminEmail,
      displayName: "E2E Admin",
    },
  });

  const memberUserId = await upsertAuthUser(supabase, {
    email: memberEmail,
    password: memberPassword,
    displayName: "E2E Member",
  });

  await upsertProfile(supabase, {
    userId: memberUserId,
    displayName: "E2E Member",
    role: "member",
    accessStatus: "active",
    memberAccessMode: "internal",
    billingDayOfMonth: null,
    billingGraceBusinessDays: 0,
    paidUntil: null,
    trialEndsAt: null,
    mustChangePassword: false,
    createdByAdminId: adminUserId,
  });

  await writeAuditLog(supabase, {
    actorUserId: adminUserId,
    targetUserId: memberUserId,
    action: "e2e.bootstrap.member",
    metadata: {
      email: memberEmail,
      displayName: "E2E Member",
      createdByAdminId: adminUserId,
    },
  });

  console.log(`E2E admin ready: ${adminEmail} (${adminUserId})`);
  console.log(`E2E member ready: ${memberEmail} (${memberUserId})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
