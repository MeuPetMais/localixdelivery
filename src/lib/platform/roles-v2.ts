// RBAC v2 — Platform-scoped role aliases.
// Canonical uppercase names used across UI + documentation. They map 1:1 to
// the lowercase PlatformRole enum consumed by PlatformPermissionRegistry.
import type { PlatformRole } from "./types";

export type PlatformRoleV2 =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "PLATFORM_SUPPORT"
  | "PLATFORM_FINANCE"
  | "PLATFORM_READONLY";

export const PLATFORM_ROLES_V2: PlatformRoleV2[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
  "PLATFORM_FINANCE",
  "PLATFORM_READONLY",
];

const V2_TO_LEGACY: Record<PlatformRoleV2, PlatformRole> = {
  PLATFORM_OWNER: "super_admin",
  PLATFORM_ADMIN: "platform_admin",
  PLATFORM_SUPPORT: "support_admin",
  PLATFORM_FINANCE: "finance_admin",
  PLATFORM_READONLY: "read_only",
};

const LEGACY_TO_V2: Record<PlatformRole, PlatformRoleV2> = {
  super_admin: "PLATFORM_OWNER",
  platform_admin: "PLATFORM_ADMIN",
  support_admin: "PLATFORM_SUPPORT",
  finance_admin: "PLATFORM_FINANCE",
  operations_admin: "PLATFORM_ADMIN",
  read_only: "PLATFORM_READONLY",
};

export function toLegacyPlatformRole(role: PlatformRoleV2): PlatformRole {
  return V2_TO_LEGACY[role];
}

export function toPlatformRoleV2(role: PlatformRole): PlatformRoleV2 {
  return LEGACY_TO_V2[role];
}
