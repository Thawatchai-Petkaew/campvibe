import { prisma } from '@/lib/prisma';
import type { PermissionCode, TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';

/**
 * CAM-680 — camp access, forward and inverse.
 *
 * A prisma-backed data module (no `NextResponse`; importable from a Server
 * Component). Mirrors the shape of `lib/bookings.ts`.
 *
 * Two exported directions, both built on the SAME predicate — "is this user
 * an active team member of this camp with the BOOKING_VIEW permission (or
 * the camp's owner)?":
 *
 *   - listCampSiteIdsForBookingView(userId)  — "which camps may this user
 *     see bookings for?" (the pre-existing, inverse question; already
 *     inlined at app/api/operator/bookings/route.ts before this story).
 *   - listBookingViewRecipients(campSiteId)  — "which users should be told
 *     about this camp?" (the new, forward question the next three stories
 *     need).
 *
 * A third export, getOperatorBookingAccessSummary, is NOT one of the two
 * directions above. app/api/operator/bookings/route.ts needs strictly more
 * than campSiteIds (a `hasAnyMembership` flag for its pre-existing 403
 * branch, and a per-camp effective-permission map for its pre-existing
 * `canUpdate` field) from the exact same underlying rows. Since
 * `listCampSiteIdsForBookingView`'s contract is fixed at `Promise<string[]>`,
 * calling it AND separately re-deriving that extra data would fire the
 * campSiteTeamMember query twice per request for no reason. Both exported
 * functions here are instead built on one shared, unexported predicate
 * (`fetchRawCampAccess` + `deriveViewAccess`) so the *logic* is one no-op
 * lift in both places; that route calls only getOperatorBookingAccessSummary
 * (a single query pair), while any other caller that only needs the id list
 * uses listCampSiteIdsForBookingView directly.
 */

export interface HostRecipient {
  userId: string;
  email: string;
  isOwner: boolean;
}

type RawMembership = { campSiteId: string; role: TeamRole; permissions: string[] };

/** The one shared internal predicate's data source: every camp `userId` owns, plus every ACTIVE (not necessarily accepted — see the module doc) team-member row they hold, raw. */
async function fetchRawCampAccess(userId: string): Promise<{ ownedSites: { id: string }[]; memberships: RawMembership[] }> {
  const [ownedSites, memberships] = await Promise.all([
    prisma.campSite.findMany({ where: { operatorId: userId }, select: { id: true } }),
    prisma.campSiteTeamMember.findMany({
      where: { userId, isActive: true },
      select: { campSiteId: true, role: true, permissions: true },
    }),
  ]);
  return { ownedSites, memberships: memberships as RawMembership[] };
}

/** Pure derivation from the raw rows above — no prisma access. Shared by both `listCampSiteIdsForBookingView` and `getOperatorBookingAccessSummary` so the two never drift. */
function deriveViewAccess(
  ownedSites: { id: string }[],
  memberships: RawMembership[]
): { campSiteIds: string[]; permissionsByCampSiteId: Map<string, PermissionCode[]> } {
  const ownedIds = ownedSites.map((s) => s.id);
  const permissionsByCampSiteId = new Map<string, PermissionCode[]>();
  const memberViewIds: string[] = [];
  memberships.forEach((m) => {
    const eff = getEffectivePermissions({ role: m.role, permissions: m.permissions });
    permissionsByCampSiteId.set(m.campSiteId, eff);
    if (hasPermission(eff, 'BOOKING_VIEW')) memberViewIds.push(m.campSiteId);
  });
  return {
    campSiteIds: Array.from(new Set([...ownedIds, ...memberViewIds])),
    permissionsByCampSiteId,
  };
}

/**
 * Which camp sites may `userId` view bookings for — the camp's owner OR an
 * ACTIVE team member with the BOOKING_VIEW permission.
 *
 * Behaviour lifted verbatim (CAM-680) from the inline block that used to
 * live at app/api/operator/bookings/route.ts:28-46 — a provable no-op
 * refactor. (That specific route now calls `getOperatorBookingAccessSummary`
 * below instead, purely to avoid a second query for the extra fields it
 * also needs — see the module doc comment. This function is the standalone
 * id-only direction for every OTHER caller, including the next three
 * stories this module exists for.)
 *
 * `isActive`-only (does NOT also require `acceptedAt !== null`). Every
 * existing authz site in this codebase (this one included) treats an
 * invited-but-unaccepted team member as already able to READ — tolerable
 * for a read. See `listBookingViewRecipients` below for why that same
 * looseness is NOT acceptable when the direction is PUSHING a notification
 * at someone. Tightening this read path to also require `acceptedAt` is
 * deliberately a separate security ticket — do not back-port it here.
 */
export async function listCampSiteIdsForBookingView(userId: string): Promise<string[]> {
  const { ownedSites, memberships } = await fetchRawCampAccess(userId);
  return deriveViewAccess(ownedSites, memberships).campSiteIds;
}

/**
 * Which users should be told about `campSiteId` — the camp's owner (from
 * `CampSite.operatorId`) UNION every `CampSiteTeamMember` row that is
 * `isActive === true` AND `acceptedAt !== null` AND effectively holds
 * BOOKING_VIEW. Deduped by `userId`.
 *
 * Two things this guards against:
 *
 * 1. Duplicate recipients — `@@unique([userId, campSiteId])` lets an
 *    operator ALSO hold a `CampSiteTeamMember` row with role OWNER for
 *    their own camp (`ROLE_DEFAULT_PERMISSIONS.OWNER` grants everything).
 *    The naive `[owner, ...members]` would then return that user twice —
 *    two bell rows per booking now, two emails later. We dedupe by
 *    `userId` into a Map keyed on userId; the operator branch runs first,
 *    so a later matching team-member row is a no-op, not a second entry.
 *
 * 2. The `acceptedAt` divergence — unlike `listCampSiteIdsForBookingView`
 *    above (isActive-only), this direction ALSO requires `acceptedAt`. An
 *    invited-but-unaccepted member (`isActive` defaults to `true` at invite
 *    time; `acceptedAt` stays null until they accept) is fine to let
 *    through a READ authz check, but it is not fine to PUSH a notification
 *    at someone who never accepted the invite. This divergence is
 *    intentional and stays local to this direction — see the note on
 *    `listCampSiteIdsForBookingView` for why the read side is a separate,
 *    deliberately deferred, security ticket.
 */
export async function listBookingViewRecipients(campSiteId: string): Promise<HostRecipient[]> {
  const [campSite, members] = await Promise.all([
    prisma.campSite.findUnique({
      where: { id: campSiteId },
      select: {
        operatorId: true,
        operator: { select: { id: true, email: true } },
      },
    }),
    prisma.campSiteTeamMember.findMany({
      where: { campSiteId, isActive: true, acceptedAt: { not: null } },
      select: {
        role: true,
        permissions: true,
        user: { select: { id: true, email: true } },
      },
    }),
  ]);

  const recipients = new Map<string, HostRecipient>();

  if (campSite?.operator) {
    recipients.set(campSite.operator.id, {
      userId: campSite.operator.id,
      email: campSite.operator.email,
      isOwner: true,
    });
  }

  members.forEach((m) => {
    // Already present (e.g. the operator ALSO holds an accepted OWNER team
    // row for their own camp) — dedupe, do not overwrite or double-add.
    if (recipients.has(m.user.id)) return;

    const eff = getEffectivePermissions({ role: m.role as TeamRole, permissions: m.permissions });
    if (!hasPermission(eff, 'BOOKING_VIEW')) return;

    recipients.set(m.user.id, {
      userId: m.user.id,
      email: m.user.email,
      isOwner: false, // by construction: the real operator was already added above
    });
  });

  return Array.from(recipients.values());
}

export interface OperatorBookingAccessSummary {
  /** Same value listCampSiteIdsForBookingView(userId) would return. */
  campSiteIds: string[];
  /** Any ACTIVE team-member row at all, regardless of permission — see usage note below. */
  hasAnyMembership: boolean;
  /** Effective permissions per camp site, for camps reached via team membership (not ownership). */
  permissionsByCampSiteId: Map<string, PermissionCode[]>;
}

/**
 * NOT one of the two directions above — see the module doc comment.
 *
 * Returns exactly what app/api/operator/bookings/route.ts needs so that
 * route can keep its `403 Forbidden: missing BOOKING_VIEW permission`
 * branch and its per-booking `canUpdate` computation unchanged, with zero
 * raw team-membership queries left in the route file, and without firing
 * that query twice in the same request:
 *
 *   - campSiteIds             — identical to listCampSiteIdsForBookingView.
 *   - hasAnyMembership        — does the user hold ANY active team-member
 *     row at all (regardless of permission)? Combined with
 *     `campSiteIds.length === 0` (which already implies the user owns no
 *     camp — an owned site is always in the union), this reproduces the
 *     route's original `ownedIds.length === 0 && memberships.length > 0`
 *     check that decides 403 vs a plain empty list.
 *   - permissionsByCampSiteId — the same `memberPermByCampSiteId` map the
 *     route used to build inline, for the `canUpdate` field on each
 *     returned booking (isOwner is still computed by the route itself from
 *     `booking.campSite.operatorId`).
 */
export async function getOperatorBookingAccessSummary(userId: string): Promise<OperatorBookingAccessSummary> {
  const { ownedSites, memberships } = await fetchRawCampAccess(userId);
  const { campSiteIds, permissionsByCampSiteId } = deriveViewAccess(ownedSites, memberships);
  return { campSiteIds, hasAnyMembership: memberships.length > 0, permissionsByCampSiteId };
}
