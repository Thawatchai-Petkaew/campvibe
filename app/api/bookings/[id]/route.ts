import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';
import type { TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';
import { getOwnedBooking } from '@/lib/bookings';

const BookingStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const statusValidation = BookingStatusEnum.safeParse(body.status);

    if (!statusValidation.success) {
      return apiError('Status is required and must be valid', 400);
    }

    const status = statusValidation.data;

    // Fetch booking to check permissions
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        campSite: {
          include: {
            operator: true
          }
        }
      }
    });

    if (!booking) {
      return apiError('Booking not found', 404);
    }

    // Permissions:
    // 1. Camper can CANCEL their own booking.
    // 2. Operator OR team member with BOOKING_UPDATE can CONFIRM/CANCEL/COMPLETE bookings at their camp site.
    const isCamper = booking.userId === session!.user!.id;
    const isOperator = booking.campSite?.operatorId === session!.user!.id;

    let isTeamUpdater = false;
    if (!isOperator && booking.campSiteId) {
      const member = await prisma.campSiteTeamMember.findFirst({
        where: { userId: session!.user!.id, campSiteId: booking.campSiteId, isActive: true },
        select: { role: true, permissions: true },
      });
      if (member) {
        const eff = getEffectivePermissions({ role: member.role as TeamRole, permissions: member.permissions });
        isTeamUpdater = hasPermission(eff, "BOOKING_UPDATE");
      }
    }

    // NextAuth session typing may not include `user.role` (even if DB has it). Use a safe cast.
    const isPlatformAdmin = (session?.user as any)?.role === 'ADMIN';
    const canHostUpdate = isPlatformAdmin || isOperator || isTeamUpdater;

    if (!isCamper && !canHostUpdate) {
      return apiError('Forbidden', 403);
    }

    // If camper cancels, status must be CANCELLED
    if (isCamper && !canHostUpdate && status !== 'CANCELLED') {
      return apiError('Campers can only cancel bookings', 400);
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status }
    });

    return apiSuccess(updatedBooking);
  } catch (error) {
    return apiError('Failed to update booking', 500, error);
  }
}

// GET /api/bookings/[id]
// Returns full booking detail for the authenticated Camper who owns the booking.
//
// Auth:   requireAuth() → 401 if no session.
// Authz:  owner-scoped via getOwnedBooking(id, session.user.id).
//         If booking doesn't exist OR belongs to another user → 404 (no 403/404 split
//         that would reveal existence — CAM-61 AC#7 / Rules "no existence leak").
// Scope:  Camper's own bookings only; operator/admin access is out of scope for this story.
//
// Error-code set: 401 (unauthenticated) · 404 (not found or not owner) · 500 (internal)
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    // 2. Authz + ownership: fetch only if booking.userId === session.user.id
    const booking = await getOwnedBooking(id, session!.user!.id);

    // 3. Same 404 for "not found" and "belongs to another user" — no existence leak
    if (!booking) {
      return apiError('Booking not found', 404);
    }

    // 4. Typed response with Decimal serialization (totalPrice is Decimal in DB)
    return apiSuccess(booking);
  } catch (error) {
    return apiError('Failed to fetch booking', 500, error);
  }
}
