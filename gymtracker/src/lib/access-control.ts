import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTodayInTimezone } from "@/lib/utils";

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

export type AppUserRole = "member" | "admin";
export type AppAccessStatus = "active" | "blocked";
export type AppMemberAccessMode = "internal" | "billable" | "trial";

export interface AppProfileAccess {
  id: string;
  display_name: string;
  rotation_anchor_date: string | null;
  created_at: string;
  role: AppUserRole;
  access_status: AppAccessStatus;
  member_access_mode: AppMemberAccessMode;
  billing_day_of_month: number | null;
  billing_grace_business_days: number;
  paid_until: string | null;
  trial_ends_at: string | null;
  must_change_password: boolean;
  created_by_admin_id: string | null;
  updated_at: string;
}

export interface AuthenticatedAppContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: NonNullable<
    Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]
  >;
  profile: AppProfileAccess;
  todayISO: string;
}

export function getTodayAccessDateISO() {
  return getTodayInTimezone(APP_TIMEZONE).dateISO;
}

export function isProfileAdmin(profile: AppProfileAccess) {
  return profile.role === "admin";
}

export function isProfileAccessActive(
  profile: AppProfileAccess,
  todayISO: string,
) {
  if (isProfileAdmin(profile)) {
    return true;
  }

  if (profile.access_status !== "active") {
    return false;
  }

  if (profile.member_access_mode === "internal") {
    return true;
  }

  if (profile.member_access_mode === "trial") {
    return profile.trial_ends_at != null && profile.trial_ends_at >= todayISO;
  }

  return profile.paid_until != null && profile.paid_until >= todayISO;
}

export function resolveBlockedReason(
  profile: AppProfileAccess,
  todayISO: string,
): "manual_block" | "payment_overdue" | "password_change_required" | "trial_expired" {
  if (profile.must_change_password) {
    return "password_change_required";
  }

  if (profile.access_status === "blocked") {
    return "manual_block";
  }

  if (
    profile.member_access_mode === "trial" &&
    (profile.trial_ends_at == null || profile.trial_ends_at < todayISO)
  ) {
    return "trial_expired";
  }

  if (
    profile.member_access_mode === "billable" &&
    (profile.paid_until == null || profile.paid_until < todayISO)
  ) {
    return "payment_overdue";
  }

  return "manual_block";
}

export function resolvePostAuthDestination(
  profile: AppProfileAccess,
  todayISO: string,
) {
  if (profile.must_change_password) {
    return "/auth/change-password";
  }

  if (isProfileAdmin(profile)) {
    return "/admin";
  }

  if (isProfileAccessActive(profile, todayISO)) {
    return "/today";
  }

  return "/blocked";
}

export async function getOptionalAuthenticatedAppContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: AuthenticatedAppContext["user"] | null;
  profile: AppProfileAccess | null;
  todayISO: string;
}> {
  const supabase = await createClient();
  const todayISO = getTodayAccessDateISO();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message.toLowerCase().includes("auth session missing")) {
      return {
        supabase,
        user: null,
        profile: null,
        todayISO,
      };
    }

    throw new Error(error.message);
  }

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
      todayISO,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, display_name, rotation_anchor_date, created_at, role, access_status, member_access_mode, billing_day_of_month, billing_grace_business_days, paid_until, trial_ends_at, must_change_password, created_by_admin_id, updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error("Profile not found for authenticated user");
  }

  return {
    supabase,
    user,
    profile,
    todayISO,
  };
}

export async function getRequiredAuthenticatedAppContext(): Promise<AuthenticatedAppContext> {
  const context = await getOptionalAuthenticatedAppContext();

  if (!context.user || !context.profile) {
    throw new Error("Unauthorized");
  }

  return {
    supabase: context.supabase,
    user: context.user,
    profile: context.profile,
    todayISO: context.todayISO,
  };
}
