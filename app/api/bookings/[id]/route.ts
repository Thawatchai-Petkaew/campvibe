import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';
import { apiError, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';
import type { TeamRole } from '@/lib/team-permissions';
import { getEffectivePermissions, hasPermission } from '@/lib/team-permissions';
import { getOwnedBooking } from '@/lib/bookings';
import type { BookingStatus } from '@/lib/booking-status';
import { notifyBookingCancelled } from '@/lib/notifications/booking-events';
import { checkRateLimit } from '@/lib/rate-limit';

// CAM-618: this is a deliberate ALLOWLIST of the statuses a caller (camper/host/admin) may
// set directly through this generic PATCH — not a mirror of the full `BookingStatus` enum,
// so it is NOT expected to grow every time the schema enum does. `PAID` is intentionally
// excluded: payment status must come from a payment-processor integration (not yet built),
// never a manual PATCH by camper/host/admin — see PR discussion / docs/specs/... tech.md for
// the reachability finding. The `satisfies` check below still gives real compiler protection:
// if any of these four literals is ever renamed or removed from the Prisma enum, this line
// fails to typecheck (catches a typo/rename, without forcing exhaustiveness — which would be
// the wrong shape for an intentional subset).
const PATCHABLE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const satisfies readonly BookingStatus[];
const BookingStatusEnum = z.enum(PATCHABLE_BOOKING_STATUSES);

// CAM-646: thrown inside the $transaction below when the compare-and-swap
// (BR-1) matches zero rows — another request already moved this booking's
// status between the read below and this write. Caught in the outer catch
// (mirrors app/api/campsites/[id]/zones/[zoneId]/route.ts's
// ZoneNotFoundError idiom) so it maps to 409, not a generic 500.
class BookingStatusConflictError extends Error {}

// AC-4/AC-5, EC-3: both "someone else already moved it" (CAS count 0) and
// "this is a no-op transition" (BR-2) are refused the same way — a 409 with
// nothing written. One shared response so the two call sites can't drift.
function bookingStatusConflict() {
  return apiError(
    'Booking status already changed',
    409,
    "This booking's status was already changed by another request. Please reload and try again."
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error: authError, session } = await requireAuth();
  if (authError) return authError;

  // BR-7: rate limit as defence-in-depth against write amplification — this
  // endpoint had none before (unlike POST /api/bookings' booking:create
  // 20/min). Same shape/limit as that sibling for consistency.
  const rl = checkRateLimit(`booking:patch:${session!.user!.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) },
    });
  }

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

    // BR-4 (CAM-646): actor precedence for the audit trail is admin > host >
    // camper — the same precedence CAM-682 already established for the
    // notify gate below. A host who booked their own camp satisfies
    // isCamper AND canHostUpdate simultaneously (EC-2); cancelling is a
    // host action, so `canHostUpdate` outranks `isCamper` here.
    const actorRole: 'admin' | 'host' | 'camper' = isPlatformAdmin
      ? 'admin'
      : canHostUpdate
        ? 'host'
        : 'camper';

    // BR-2: a no-op transition (requested status === current status) is
    // refused the same way as a CAS conflict, writing nothing. PATCH has no
    // rate-limit ceiling low enough to make honestly recording a no-op safe
    // against unbounded append-only write amplification into a table with
    // no reader, no retention job, and no erasure path (tech.md Decision 3).
    if (status === booking.status) {
      return bookingStatusConflict();
    }

    // BR-1/EC-3: compare-and-swap on {id, status: <the status just read>}.
    // A count of 0 means another request already moved this booking's
    // status between the read above and this write — refuse with a
    // conflict rather than silently overwriting (the lost-update bug
    // tech.md identifies in the plain `update` this replaces).
    //
    // BR-3/EC-1: the audit row is written INSIDE this same transaction as
    // the CAS update — the deliberate INVERSE of the notification contract
    // below (CAM-681/CAM-682 return success even when notify fails): a
    // trail that can be lost between commit and write is not a trail.
    let updatedBooking;
    try {
      updatedBooking = await prisma.$transaction(async (tx) => {
        const cas = await tx.booking.updateMany({
          where: { id, status: booking.status },
          data: { status },
        });
        if (cas.count === 0) {
          throw new BookingStatusConflictError();
        }

        // BR-5/BR-6: metadata carries exactly {from, to, campSiteId,
        // actorRole} — no money value, no guest name, no contact detail.
        // ipAddress/userAgent stay null: AuditLog is append-only with no
        // erasure path, so populating them would create an un-erasable PII
        // store (deliberate, dated tech.md Decision 7).
        await tx.auditLog.create({
          data: {
            actorId: session!.user!.id,
            action: 'booking.status.update',
            entityType: 'Booking',
            entityId: id,
            metadata: { from: booking.status, to: status, campSiteId: booking.campSiteId, actorRole },
          },
        });

        return tx.booking.findUniqueOrThrow({ where: { id } });
      });
    } catch (txError) {
      if (txError instanceof BookingStatusConflictError) {
        return bookingStatusConflict();
      }
      throw txError;
    }

    // CAM-682: notify the host/team only when a CAMPER cancels their OWN
    // booking — never when a host cancels (isCamper alone is not enough: a
    // host who booked their own camp is both camper and host on this row,
    // and a host-initiated cancel notifying them about themselves is noise,
    // CAM-74 AC#5). CONFIRMED/COMPLETED notify nobody this round.
    if (status === 'CANCELLED' && isCamper && !canHostUpdate) {
      // Same 500-trap defence as app/api/bookings/route.ts's notifyBookingCreated
      // call site: notifyBookingCancelled() never throws by design, but this
      // try/catch is a second line of defence against a bad import throwing
      // synchronously before the function's own internal catch can run — a
      // notify failure must never turn a successful cancel into a 500.
      try {
        await notifyBookingCancelled(updatedBooking);
      } catch (notifyError) {
        console.error(
          JSON.stringify({
            level: 'error',
            event: 'booking_cancel_notify_call_site_failed',
            bookingId: updatedBooking.id,
            reason: notifyError instanceof Error ? notifyError.message : String(notifyError),
          })
        );
      }
    }

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
