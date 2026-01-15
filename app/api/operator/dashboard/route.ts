import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import type { PermissionCode, TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  
  const session = authResult.session;

  try {
    const userId = session?.user?.id;
    if (!userId) {
      return apiError('User ID not found', 401);
    }

    const [user, ownedSites, memberships] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, image: true, role: true } }),
      prisma.campSite.findMany({
        where: { operatorId: userId },
        include: {
          location: { include: { thaiLocation: true } },
          _count: { select: { bookings: true, reviews: true } },
        },
      }),
      prisma.campSiteTeamMember.findMany({
        where: { userId, isActive: true },
        select: { campSiteId: true, role: true, permissions: true },
      }),
    ]);

    const isPlatformAdmin = user?.role === 'ADMIN';

    const memberPermByCampSiteId = new Map<string, PermissionCode[]>();
    const memberViewBookingIds: string[] = [];
    const memberUpdateBookingIds: string[] = [];
    const memberFinancialIds: string[] = [];
    memberships.forEach((m) => {
      const eff = getEffectivePermissions({ role: m.role as TeamRole, permissions: m.permissions });
      memberPermByCampSiteId.set(m.campSiteId, eff);
      if (hasPermission(eff, "BOOKING_VIEW")) memberViewBookingIds.push(m.campSiteId);
      if (hasPermission(eff, "BOOKING_UPDATE")) memberUpdateBookingIds.push(m.campSiteId);
      if (hasPermission(eff, "FINANCIAL_VIEW")) memberFinancialIds.push(m.campSiteId);
    });

    const ownedIds = ownedSites.map((s) => s.id);
    const campSiteIdsForBookings = Array.from(new Set([...ownedIds, ...memberViewBookingIds]));

    const teamCampSiteIds = memberships.map((m) => m.campSiteId);
    const campSiteIdsForListing = Array.from(new Set([...ownedIds, ...teamCampSiteIds]));

    const teamCampSites = campSiteIdsForListing.length
      ? await prisma.campSite.findMany({
          where: { id: { in: campSiteIdsForListing } },
          include: {
            location: { include: { thaiLocation: true } },
            _count: { select: { bookings: true, reviews: true } },
          },
        })
      : [];

    const campSites = teamCampSites;

    const limit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('limit') || '5', 10) || 5, 1), 20);

    const bookings =
      campSiteIdsForBookings.length > 0
        ? await prisma.booking.findMany({
            where: { campSiteId: { in: campSiteIdsForBookings } },
            include: {
              user: { select: { name: true, email: true } },
              campSite: { select: { id: true, nameTh: true, nameEn: true, operatorId: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [];

    // Calculate Stats
    const canViewFinancial =
      isPlatformAdmin || ownedIds.length > 0 || memberFinancialIds.length > 0;
    const totalRevenue = canViewFinancial
      ? bookings
          .filter((b: any) => b.status !== 'CANCELLED')
          .reduce((sum: number, b: any) => sum + b.totalPrice, 0)
      : null;

    const canCreateCampSite = isPlatformAdmin || ownedIds.length > 0;
    const campSitesWithAccess = campSites.map((cs: any) => {
      const isOwner = cs.operatorId === userId;
      const eff = memberPermByCampSiteId.get(cs.id) || [];
      const canUpdate = isPlatformAdmin || isOwner || hasPermission(eff, "CAMPSITE_UPDATE");
      const canDelete = isPlatformAdmin || isOwner || hasPermission(eff, "CAMPSITE_DELETE");
      return { ...cs, canUpdate, canDelete };
    });

    return apiSuccess({
      campSites: campSitesWithAccess,
      bookings: bookings.map((b: any) => {
        const campSiteId = b?.campSite?.id || b.campSiteId;
        const isOwner = b?.campSite?.operatorId === userId;
        const eff = campSiteId ? (memberPermByCampSiteId.get(campSiteId) || []) : [];
        const canUpdate = isPlatformAdmin || isOwner || hasPermission(eff, "BOOKING_UPDATE");
        return { ...b, canUpdate };
      }),
      stats: {
        totalRevenue,
        totalBookings: campSiteIdsForBookings.length > 0 ? await prisma.booking.count({ where: { campSiteId: { in: campSiteIdsForBookings } } }) : 0,
        campSiteCount: campSitesWithAccess.length
      },
      operator: user,
      permissions: {
        canCreateCampSite,
        canViewFinancial,
        // derived convenience flags
        canViewBookings: isPlatformAdmin || ownedIds.length > 0 || memberViewBookingIds.length > 0,
        canUpdateAnyBooking: isPlatformAdmin || ownedIds.length > 0 || memberUpdateBookingIds.length > 0,
        canUpdateAnyCampSite: isPlatformAdmin || ownedIds.length > 0 || memberships.some((m) => {
          const eff = memberPermByCampSiteId.get(m.campSiteId) || [];
          return hasPermission(eff, "CAMPSITE_UPDATE");
        }),
        canDeleteAnyCampSite: isPlatformAdmin || ownedIds.length > 0 || memberships.some((m) => {
          const eff = memberPermByCampSiteId.get(m.campSiteId) || [];
          return hasPermission(eff, "CAMPSITE_DELETE");
        }),
      },
    });
  } catch (error) {
    return apiError('Failed to fetch dashboard data', 500, error);
  }
}
