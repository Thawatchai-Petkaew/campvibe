import { NextRequest, NextResponse } from 'next/server';
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
 * Overlap-with-booking behavior (AC-6, owner decision reaffirmed 2026-07-04 on
 * the pull request GATE-REWORK): creating a block whose range overlaps an existing
 * ACTIVE booking (CONFIRMED or PENDING) in the same scope is a HARD REJECT —
 * 409 + the Thai copy "ไม่สามารถบล็อกวันนี้ได้ เนื่องจากมีการจองอยู่แล้ว" + the
 * list of conflicting bookings in the payload. No BlockedDate row is created.
 * An earlier revision of this route shipped a warn-but-allow variant (create
 * anyway, carry a `warning` payload); the owner explicitly rejected that in
 * favor of the ticket's original AC-6 text — do not reintroduce warn-but-allow
 * without a new owner decision.
 *
 * Scope of the overlap check: camp-wide blocks (spotId null) conflict with ANY
 * active booking on the camp; spot-level blocks conflict only with bookings
 * tied to that exact spot — same scoping lib/campsite-availability.ts and the
 * booking write path (app/api/bookings/route.ts, CAM-57) already use.
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

    // AC-6 (owner decision, hard reject): a block overlapping an active booking
    // (CONFIRMED/PENDING) in scope must FAIL before any BlockedDate row is
    // written — check BEFORE create, not after. Whole-camp blocks (spotId null)
    // conflict with ANY active booking on the camp; spot-level blocks conflict
    // only with bookings tied to that exact spot. Predicate mirrors the booking
    // write path's BlockedDate check (app/api/bookings/route.ts, CAM-57) so a
    // block can never be created where a live booking would already have been
    // rejected, and vice versa.
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

    if (overlappingBookings.length > 0) {
      // Structured log (internal only — never sent to the client): a rejected
      // write attempt is expected operator behavior, not a system error, so it
      // logs at warn rather than through apiError's error-level path. No PII —
      // booking ids + date range only (security.md / observability.md).
      console.warn('[API Conflict 409] blocked_date_overlaps_booking', {
        campSiteId: id,
        spotId: data.spotId ?? null,
        conflictCount: overlappingBookings.length,
      });

      return NextResponse.json(
        {
          error: 'blocked_date_overlaps_booking',
          message: 'ไม่สามารถบล็อกวันนี้ได้ เนื่องจากมีการจองอยู่แล้ว',
          conflicts: overlappingBookings,
        },
        { status: 409 }
      );
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

    return apiSuccess({ blockedDate }, 201);
  } catch (error) {
    return apiError('Failed to create blocked date', 500, error);
  }
}
