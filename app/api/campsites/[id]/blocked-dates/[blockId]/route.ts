import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';

/**
 * CAM-56 — soft-delete (cancel) a host BlockedDate.
 * Same permission model as the collection route: owner or team member with
 * BOOKING_UPDATE (see app/api/campsites/[id]/blocked-dates/route.ts header comment).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { id, blockId } = await params;

  const { error: authError } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    // Scope by campSiteId so a block can only be cancelled under its own campsite
    // (no cross-campsite IDOR) and only if it isn't already soft-deleted.
    const owned = await prisma.blockedDate.findFirst({
      where: { id: blockId, campSiteId: id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) {
      return apiError('Blocked date not found', 404);
    }

    await prisma.blockedDate.update({
      where: { id: blockId },
      data: { deletedAt: new Date() },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to cancel blocked date', 500, error);
  }
}
