import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { campTag, campSlugTag } from '@/lib/catalog-cache';

/**
 * CAM-362 — DELETE = soft-delete a Zone + detach every attached spot to
 * no-zone, in ONE transaction (tech.md §3.3). Justified deviation from the
 * spot-DELETE-uses-CAMPSITE_DELETE sibling: this only re-labels spots to
 * no-zone — it destroys no bookable inventory and no booking history, so it
 * is an UPDATE-class edit (CAMPSITE_UPDATE), not a DELETE-class destruction.
 */

class ZoneNotFoundError extends Error {}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; zoneId: string }> }
) {
  const { id, zoneId } = await params;

  const { error: authError, campSite, session } = await requireCampSitePermission(id, 'CAMPSITE_UPDATE');
  if (authError) return authError;

  try {
    const detachedSpotCount = await prisma.$transaction(async (tx) => {
      // 1) CAS soft-delete, live-only + camp-scoped (no cross-camp IDOR, no
      // double-delete race, no separate find-then-update window — mirrors
      // the holds DELETE compare-and-swap pattern).
      const del = await tx.zone.updateMany({
        where: { id: zoneId, campSiteId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (del.count === 0) {
        throw new ZoneNotFoundError(); // rolls back everything
      }

      // 2) detach every LIVE attached spot to no-zone (membership cleared;
      // Spot.zone string left as-is per tech.md §4.2 — it's a deprecated
      // display fallback, not the membership source of truth).
      const detached = await tx.spot.updateMany({
        where: { campSiteId: id, zoneId, deletedAt: null },
        data: { zoneId: null },
      });

      // 3) audit — an important host-data mutation (api.md rule 8, ADR-012 pattern).
      await tx.auditLog.create({
        data: {
          actorId: session!.user!.id,
          action: 'zone.deleted',
          entityType: 'Zone',
          entityId: zoneId,
          metadata: { campSiteId: id, detachedSpotCount: detached.count },
        },
      });

      return detached.count;
    });

    revalidateTag(campTag(id), {});
    if (campSite) {
      revalidateTag(campSlugTag(campSite.nameThSlug), {});
      revalidateTag(campSlugTag(campSite.nameEnSlug), {});
    }

    return apiSuccess({ success: true, detachedSpotCount });
  } catch (error) {
    if (error instanceof ZoneNotFoundError) {
      return apiError('Zone not found', 404);
    }
    return apiError('Failed to delete zone', 500, error);
  }
}
