import type { PlatformPermission, PlatformRole } from "./types";

const READ_ALL: PlatformPermission[] = [
  "platform.dashboard.read",
  "platform.tenants.read",
  "platform.users.read",
  "platform.admins.read",
  "platform.plans.read",
  "platform.subscriptions.read",
  "platform.finance.read",
  "platform.commissions.read",
  "platform.coupons.read",
  "platform.feature_flags.read",
  "platform.config.read",
  "platform.audit.read",
  "platform.logs.read",
  "platform.support.read",
  "platform.incidents.read",
  "platform.moderation.read",
  "platform.notifications.read",
  "platform.monitoring.read",
];

const ALL_WRITES: PlatformPermission[] = [
  "platform.tenants.write",
  "platform.tenants.suspend",
  "platform.users.write",
  "platform.admins.write",
  "platform.plans.write",
  "platform.subscriptions.write",
  "platform.finance.write",
  "platform.commissions.write",
  "platform.coupons.write",
  "platform.feature_flags.write",
  "platform.config.write",
  "platform.support.write",
  "platform.moderation.write",
  "platform.notifications.write",
];

const ROLE_MATRIX: Record<PlatformRole, PlatformPermission[]> = {
  super_admin: [...READ_ALL, ...ALL_WRITES],
  platform_admin: [
    ...READ_ALL,
    "platform.tenants.write",
    "platform.tenants.suspend",
    "platform.users.write",
    "platform.plans.write",
    "platform.coupons.write",
    "platform.feature_flags.write",
    "platform.config.write",
    "platform.notifications.write",
  ],
  finance_admin: [
    "platform.dashboard.read",
    "platform.tenants.read",
    "platform.subscriptions.read",
    "platform.finance.read",
    "platform.finance.write",
    "platform.commissions.read",
    "platform.commissions.write",
    "platform.plans.read",
    "platform.audit.read",
  ],
  support_admin: [
    "platform.dashboard.read",
    "platform.tenants.read",
    "platform.users.read",
    "platform.support.read",
    "platform.support.write",
    "platform.incidents.read",
    "platform.moderation.read",
    "platform.moderation.write",
    "platform.notifications.read",
    "platform.notifications.write",
  ],
  operations_admin: [
    "platform.dashboard.read",
    "platform.tenants.read",
    "platform.tenants.write",
    "platform.tenants.suspend",
    "platform.monitoring.read",
    "platform.incidents.read",
    "platform.logs.read",
    "platform.audit.read",
  ],
  read_only: [...READ_ALL],
};

export const PlatformPermissionRegistry = {
  permissionsFor(role: PlatformRole): PlatformPermission[] {
    return ROLE_MATRIX[role] ?? [];
  },
  can(role: PlatformRole, permission: PlatformPermission): boolean {
    return (ROLE_MATRIX[role] ?? []).includes(permission);
  },
  assertCan(role: PlatformRole, permission: PlatformPermission): void {
    if (!this.can(role, permission)) {
      throw new Error(`Forbidden: role ${role} lacks ${permission}`);
    }
  },
  roles(): PlatformRole[] {
    return Object.keys(ROLE_MATRIX) as PlatformRole[];
  },
};
