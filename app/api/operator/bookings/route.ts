import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import type { PermissionCode, TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';

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
    const [ownedSites, memberships] = await Promise.all([
      prisma.campSite.findMany({ where: { operatorId: userId }, select: { id: true } }),
      prisma.campSiteTeamMember.findMany({
        where: { userId, isActive: true },
        select: { campSiteId: true, role: true, permissions: true },
      }),
    ]);

    const ownedIds = ownedSites.map((s) => s.id);
    const memberPermByCampSiteId = new Map<string, PermissionCode[]>();
    const memberViewIds: string[] = [];
    memberships.forEach((m) => {
      const role = m.role as TeamRole;
      const eff = getEffectivePermissions({ role, permissions: m.permissions });
      memberPermByCampSiteId.set(m.campSiteId, eff);
      if (hasPermission(eff, "BOOKING_VIEW")) memberViewIds.push(m.campSiteId);
    });

    const campSiteIds = Array.from(new Set([...ownedIds, ...memberViewIds]));
    if (campSiteIds.length === 0) {
      // If user is "host context" (has memberships) but lacks BOOKING_VIEW, be explicit.
      if (ownedIds.length === 0 && memberships.length > 0) {
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
      }
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
