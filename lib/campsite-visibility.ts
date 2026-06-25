/**
 * SEC-1: Pure, testable helpers for campsite visibility gating.
 * No Prisma, no I/O — safe to unit-test without database.
 *
 * Gate rule (applied at route/page layer, NOT inside buildCampSiteWhere):
 *   A campsite is public when it is active, published, and not soft-deleted.
 *   Operators can view their own unpublished campsites; admins can view any.
 */

/** Minimal camp shape required for visibility checks. */
export interface CampSiteVisibilityFields {
  isActive: boolean;
  isPublished: boolean;
  deletedAt: Date | null;
  operatorId: string;
}

/** Minimal session shape — typed tightly to avoid any/unknown leaks. */
export type VisibilitySession =
  | { user?: { id?: string | null; role?: string | null } | null }
  | null
  | undefined;

/**
 * Returns true when the campsite is publicly visible:
 *   active AND published AND not soft-deleted.
 */
export function isCampSitePublic(
  camp: Pick<CampSiteVisibilityFields, 'isActive' | 'isPublished' | 'deletedAt'>
): boolean {
  return camp.isActive && camp.isPublished && camp.deletedAt === null;
}

/**
 * Returns true when the caller is allowed to view the campsite.
 * Priority order:
 *   1. Public camp → always visible (no auth required).
 *   2. ADMIN role → visible regardless of publish/active/deleted state.
 *   3. Owner (session.user.id === camp.operatorId) → visible to their own camps.
 *   4. Everyone else → not visible.
 */
export function canViewCampSite(
  camp: CampSiteVisibilityFields,
  session: VisibilitySession
): boolean {
  if (isCampSitePublic(camp)) return true;

  const userId = session?.user?.id ?? null;
  const role = session?.user?.role ?? null;

  if (role === 'ADMIN') return true;
  if (userId !== null && userId === camp.operatorId) return true;

  return false;
}
