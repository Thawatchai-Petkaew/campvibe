import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { hasPermission } from '@/lib/team-permissions';
import { getOperatorBookingAccessSummary } from '@/lib/camp-access';

// RISK-12: cap the list query so it never does a full-table scan as data grows.
// Returns the most recent N bookings (orderBy createdAt desc).
// Full keyset + infinite-scroll is a deferred FE story.
const BOOKING_LIST_LIMIT = 100;

export async function GET(request: NextRequest) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const userId = session?.user?.id;
  if (!userId) {
    return apiError('User ID not found in session', 401);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'desc';

    // Determine camp sites user can VIEW bookings for (owner OR team member with BOOKING_VIEW).
    // CAM-680: the campSiteId list + the per-camp permission map (for canUpdate below) now
    // come from lib/camp-access.ts — no raw team-membership query left in this route file.
    const { campSiteIds, hasAnyMembership, permissionsByCampSiteId: memberPermByCampSiteId } =
      await getOperatorBookingAccessSummary(userId);

    if (campSiteIds.length === 0) {
      // If user is "host context" (has memberships) but lacks BOOKING_VIEW, be explicit.
      // campSiteIds.length === 0 already implies the user owns no camp site (an owned
      // site is always included in the union), so hasAnyMembership alone reproduces the
      // original `ownedIds.length === 0 && memberships.length > 0` check.
      if (hasAnyMembership) {
        return apiError('Forbidden: missing BOOKING_VIEW permission', 403);
      }
      return apiSuccess([]);
    }

    const where: any = {
      campSiteId: { in: campSiteIds },
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        campSite: {
          select: {
            nameTh: true,
            nameEn: true,
            images: true,
            operatorId: true,
            id: true,
          }
        },
        spot: {
          select: {
            name: true,
            zone: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: sort === 'asc' ? 'asc' : 'desc'
      },
      take: BOOKING_LIST_LIMIT,
    });

    const withAccess = bookings.map((b: any) => {
      const campSiteId = b?.campSite?.id || b.campSiteId;
      const isOwner = b?.campSite?.operatorId === userId;
      const eff = campSiteId ? (memberPermByCampSiteId.get(campSiteId) || []) : [];
      const canUpdate = isOwner || hasPermission(eff, "BOOKING_UPDATE");
      return { ...b, canUpdate };
    });

    return apiSuccess(withAccess);
  } catch (error) {
    return apiError('Failed to fetch bookings', 500, error);
  }
}
