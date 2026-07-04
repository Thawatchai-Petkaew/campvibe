import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createBlockedDateSchema } from '@/lib/validations/blocked-dates';
import { requireCampSitePermission } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';

/**
 * CAM-56 — Host-managed BlockedDate write API (camp-wide + per-spot).
 *
 * Permission model (ticket `## Rules`): "สิทธิ์สร้าง/ลบ BlockedDate: เจ้าของแคมป์ไซต์
 * (operatorId) หรือสมาชิกทีมที่มีสิทธิ์ BOOKING_UPDATE" — requireCampSitePermission
 * already grants the operator + platform ADMIN + any team member holding the given
 * permission, so BOOKING_UPDATE here covers "owner or team member with BOOKING_UPDATE"
 * in one call (mirrors app/api/campsites/[id]/spots/route.ts's RBAC pattern).
 *
 * This route is host-management-only (list + create). The camper-facing read path
 * (whether a date is bookable) is a SEPARATE, already-shipped surface — see
 * lib/campsite-availability.ts (CAM-267/CAM-190) and the BlockedDate check inside
 * app/api/bookings/route.ts (CAM-57) — neither is touched by this story.
 *
 * Overlap-with-booking behavior (Blueprint v6 re-scope comment on CAM-56, read
 * 2026-07-04): creating a block that overlaps an existing CONFIRMED/PENDING booking
 * is ALLOWED (a host may need to close dates for an emergency) but the response
 * carries a `warning` payload listing the affected bookings so the host can act
 * (e.g. contact the guest). This deliberately supersedes the older ticket AC-6 text
 * ("ไม่สามารถบล็อกวันนี้ได้ เนื่องจากมีการจองอยู่แล้ว" / hard reject) — see the PR
 * description for the reconciliation note.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error: authError } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    const blockedDates = await prisma.blockedDate.findMany({
      where: { campSiteId: id, deletedAt: null },
      include: { spot: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
    });

    return apiSuccess(blockedDates);
  } catch (error) {
    return apiError('Failed to fetch blocked dates', 500, error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error: authError } = await requireCampSitePermission(id, 'BOOKING_UPDATE');
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = createBlockedDateSchema.safeParse(body);
    if (!validation.success) {
      return apiError('Validation Error', 400, validation.error.format());
    }

    const data = validation.data;

    // IDOR guard: a spot-level block must reference a spot that belongs to THIS
    // campsite (prevents a host of camp A from blocking a spot under camp B).
    if (data.spotId) {
      const spot = await prisma.spot.findFirst({
        where: { id: data.spotId, campSiteId: id },
        select: { id: true },
      });
      if (!spot) {
        return apiError('Spot not found', 404);
      }
    }

    const blockedDate = await prisma.blockedDate.create({
      data: {
        campSiteId: id,
        spotId: data.spotId ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason || null,
      },
    });

    // Warn (never reject) when the new block overlaps an existing active booking —
    // whole-camp blocks (spotId null) affect every booking on the camp; spot-level
    // blocks only affect bookings tied to that exact spot.
    const bookingWhere: Prisma.BookingWhereInput = {
      campSiteId: id,
      status: { in: ['CONFIRMED', 'PENDING'] },
      AND: [
        { checkInDate: { lte: data.endDate } },
        { checkOutDate: { gte: data.startDate } },
      ],
    };
    if (data.spotId) {
      bookingWhere.spotId = data.spotId;
    }

    const overlappingBookings = await prisma.booking.findMany({
      where: bookingWhere,
      select: { id: true, checkInDate: true, checkOutDate: true, guests: true, spotId: true },
      orderBy: { checkInDate: 'asc' },
    });

    const payload =
      overlappingBookings.length > 0
        ? {
            blockedDate,
            warning: {
              overlappingBookingsCount: overlappingBookings.length,
              overlappingBookings,
            },
          }
        : { blockedDate };

    return apiSuccess(payload, 201);
  } catch (error) {
    return apiError('Failed to create blocked date', 500, error);
  }
}
