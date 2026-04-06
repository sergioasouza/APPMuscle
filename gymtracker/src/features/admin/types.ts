import type {
  AdminAuditLog,
  ManualBillingEvent,
  Profile,
} from "@/lib/types";

export type AdminUserRole = Profile["role"];
export type AdminAccessStatus = Profile["access_status"];
export type AdminMemberAccessMode = Profile["member_access_mode"];
export type ManualBillingStatus = ManualBillingEvent["status"];

export interface AdminUserListItem {
  id: string;
  displayName: string;
  email: string | null;
  role: AdminUserRole;
  accessStatus: AdminAccessStatus;
  memberAccessMode: AdminMemberAccessMode;
  billingDayOfMonth: number | null;
  billingGraceBusinessDays: number;
  paidUntil: string | null;
  trialEndsAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastSignInAt: string | null;
}

export interface AdminDashboardData {
  summary: {
    activeMembers: number;
    blockedMembers: number;
    expiringThisMonth: number;
    currentMonthReceipts: number;
  };
  recentUsers: AdminUserListItem[];
  recentAuditLog: AdminAuditEntry[];
  currentReferenceMonth: string;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  entityType: AdminAuditLog["entity_type"];
  createdAt: string;
  actorName: string;
  targetName: string | null;
  metadata: AdminAuditLog["metadata"];
}

export interface AdminUserListQuery {
  search: string;
  statusFilter: "all" | "active" | "blocked";
  roleFilter: "all" | "member" | "admin";
  paymentFilter: "all" | "paid" | "overdue";
}

export interface ManualBillingEventView {
  id: string;
  referenceMonth: string;
  status: ManualBillingStatus;
  note: string | null;
  recordedByName: string | null;
  createdAt: string;
}

export interface AdminUserDetailData {
  user: AdminUserListItem;
  lastWorkoutAt: string | null;
  lastBodyMeasurementAt: string | null;
  lastActivityAt: string | null;
  billingEvents: ManualBillingEventView[];
  auditEntries: AdminAuditEntry[];
  isSelf: boolean;
}

export interface AdminCreateUserInput {
  displayName: string;
  email: string;
  temporaryPassword: string;
  role: AdminUserRole;
  accessStatus: AdminAccessStatus;
  memberAccessMode: AdminMemberAccessMode;
  billingDayOfMonth: number | null;
  billingGraceBusinessDays: number;
  paidUntil: string | null;
  trialDays: number | null;
  trialEndsAt: string | null;
}

export interface AdminUpdateUserInput {
  displayName: string;
  role: AdminUserRole;
  accessStatus: AdminAccessStatus;
  memberAccessMode: AdminMemberAccessMode;
  billingDayOfMonth: number | null;
  billingGraceBusinessDays: number;
  paidUntil: string | null;
  trialEndsAt: string | null;
}

export interface AdminBillingInput {
  referenceMonth: string;
  status: ManualBillingStatus;
  note?: string | null;
}

export interface AdminSystemExerciseItem {
  id: string;
  systemKey: string | null;
  name: string;
  modality: string | null;
  muscleGroup: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface AdminSystemExerciseInput {
  name: string;
  modality?: string | null;
  muscleGroup?: string | null;
}
