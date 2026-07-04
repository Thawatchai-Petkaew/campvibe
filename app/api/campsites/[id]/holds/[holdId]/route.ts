import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';

/**
 * CAM-302 — release (cancel) a host InternalHold (BR-4).
 * Same permission model as the collection route: owner or team member with
 * BOOKING_UPDATE (see app/api/campsites/[id]/holds/route.ts header comment).
 *
 * Release sets status = RELEASED; the row is KEPT (append-only history per
 * ADR-012 §4 — never a hard delete, and InternalHold carries no deletedAt).
 * The `updateMany` is an atomic compare-and-swap scoped to
 * { id, campSiteId, status: ACTIVE }: a missing hold, a hold under a
 * different campsite, or an already-RELEASED hold all answer 404 with zero
 * rows changed — no separate find-then-update race window (BR-4, EC-3).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; holdId: string }> }
) {
  const { id, holdId } = await params;

  const { error: authError, session } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    const result = await prisma.internalHold.updateMany({
      where: { id: holdId, campSiteId: id, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });

    if (result.count === 0) {
      return apiError('Hold not found', 404);
    }

    // BR-7: one AuditLog row per release. No PII — ids + camp only.
    await prisma.auditLog.create({
      data: {
        actorId: session!.user!.id,
        action: 'hold.released',
        entityType: 'InternalHold',
        entityId: holdId,
        metadata: { campSiteId: id },
      },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError('Failed to release hold', 500, error);
  }
}
