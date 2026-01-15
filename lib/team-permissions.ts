/**
 * IMPORTANT:
 * We intentionally keep this module independent of `@prisma/client` runtime enums.
 * In dev, Prisma Client can be stale and enums may be undefined, causing 500s in API routes.
 *
 * We store permissions as string codes in DB (`TEXT[]`), so string-based checks are safe.
 */
export type TeamRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";

export type PermissionCode =
  | "CAMPSITE_VIEW"
  | "CAMPSITE_UPDATE"
  | "CAMPSITE_DELETE"
  | "BOOKING_VIEW"
  | "BOOKING_UPDATE"
  | "BOOKING_CREATE"
  | "BOOKING_DELETE"
  | "TEAM_VIEW"
  | "TEAM_INVITE"
  | "TEAM_UPDATE_ROLE"
  | "TEAM_REMOVE"
  | "ANALYTICS_VIEW"
  | "FINANCIAL_VIEW";

export const ALL_PERMISSIONS: PermissionCode[] = [
  "CAMPSITE_VIEW",
  "CAMPSITE_UPDATE",
  "CAMPSITE_DELETE",
  "BOOKING_VIEW",
  "BOOKING_UPDATE",
  "BOOKING_CREATE",
  "BOOKING_DELETE",
  "TEAM_VIEW",
  "TEAM_INVITE",
  "TEAM_UPDATE_ROLE",
  "TEAM_REMOVE",
  "ANALYTICS_VIEW",
  "FINANCIAL_VIEW",
];

/**
 * Server-authoritative default permissions by role.
 * If a team member has an explicit `permissions` array, that overrides these defaults.
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<TeamRole, PermissionCode[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: [
    "CAMPSITE_UPDATE",
    "BOOKING_VIEW",
    "BOOKING_CREATE",
    "BOOKING_UPDATE",
    "BOOKING_DELETE",
    "TEAM_VIEW",
    "TEAM_INVITE",
    "TEAM_UPDATE_ROLE",
    "TEAM_REMOVE",
    "ANALYTICS_VIEW",
    "FINANCIAL_VIEW",
  ],
  MANAGER: ["BOOKING_VIEW", "BOOKING_UPDATE", "TEAM_VIEW", "ANALYTICS_VIEW"],
  STAFF: ["BOOKING_VIEW", "BOOKING_UPDATE"],
  VIEWER: ["BOOKING_VIEW"],
};

export function getEffectivePermissions(input: {
  role: TeamRole;
  permissions?: string[] | null;
}): PermissionCode[] {
  const explicit = Array.isArray(input.permissions) ? input.permissions : [];
  if (explicit.length > 0) {
    // Only keep valid permission codes.
    const allowed = new Set(ALL_PERMISSIONS);
    return explicit.filter((p): p is PermissionCode => allowed.has(p as PermissionCode)) as PermissionCode[];
  }
  return ROLE_DEFAULT_PERMISSIONS[input.role] || [];
}

export function hasPermission(perms: PermissionCode[], perm: PermissionCode) {
  return perms.includes(perm);
}

