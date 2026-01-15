import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';
import type { TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';

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
