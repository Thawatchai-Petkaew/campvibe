import { prisma } from '@/lib/prisma';
import { listBookingViewRecipients } from '@/lib/camp-access';
import {
  buildBookingCancelledCopy,
  buildBookingCreatedCopy,
  bookingHighlightLink,
} from '@/lib/notifications/copy';

/**
 * lib/notifications/booking-events.ts — CAM-681, the FIRST writer of the
 * `Notification` table (prisma/schema.prisma:857-873 — zero writers before
 * this story). CAM-682 adds a second event (booking cancelled) to the SAME
 * module — same never-throw shape, same kill-switch-in-copy-layer pattern,
 * same no-guest-PII rule; see notifyBookingCancelled below.
 *
 * notifyBookingCreated is called ONCE, from app/api/bookings/route.ts,
 * strictly AFTER withBookingTransaction has already committed a real
 * `Booking` row — never from inside that transaction. Two reasons, both
 * about withBookingTransaction's Serializable retry (route.ts:59-280, up to
 * 4 attempts on P2034):
 *
 *   1. Writing via the tx client INSIDE the transaction would fire once per
 *      retry attempt — up to 4 notification rows for one booking.
 *   2. Writing via the OUTER prisma client from inside a callback that later
 *      rolls back would leave orphan notification rows for a booking that
 *      never existed (the write is not part of the transaction, so a
 *      Postgres rollback of the booking has no effect on it).
 *
 * Firing post-commit, exactly once, with the real committed booking id
 * avoids both. Uses `await`, not `after()` (Next.js's fire-and-forget
 * primitive) — `after()` can be dropped when a serverless instance is
 * reclaimed, and the one precedent in this repo (lib/ai/turn-log.ts) had to
 * add an `isTestRunner()` guard that disables the whole path under test. One
 * extra query on a route that already runs a Serializable transaction is
 * noise.
 *
 * Never throws (mirrors lib/delivery/tickets.ts's notifySafe shape: build →
 * if suppressed return → act → log the failure structurally → never throw).
 * A notification failure — including the recipient lookup itself rejecting
 * — must never turn a successfully committed booking into a 500 for the
 * camper who just booked (app/api/bookings/route.ts's outer catch at
 * :341-343 turns any thrown error into a 500; this module must never reach
 * it, and the call site wraps the call anyway as a second line of defence).
 */

export interface BookingCreatedEventInput {
  id: string;
  /** The booking's creator — excluded from recipients (never notify yourself). */
  userId: string;
  campSiteId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  /** Booking.snapshotCampName (TH), frozen at booking time — ADR-005. */
  snapshotCampName: string | null;
}

export async function notifyBookingCreated(booking: BookingCreatedEventInput): Promise<void> {
  try {
    const copy = buildBookingCreatedCopy({
      campName: booking.snapshotCampName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      guests: booking.guests,
    });
    if (!copy) return; // CAM-681 kill switch off — write nothing, not an error

    const recipients = await listBookingViewRecipients(booking.campSiteId);
    const targets = recipients.filter((r) => r.userId !== booking.userId);
    if (targets.length === 0) return;

    const link = bookingHighlightLink(booking.id);

    await prisma.notification.createMany({
      data: targets.map((r) => ({
        userId: r.userId,
        type: 'BOOKING' as const,
        title: copy.title,
        body: copy.body,
        link,
        isRead: false,
      })),
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'booking_notify_failed',
        bookingId: booking.id,
        campSiteId: booking.campSiteId,
        reason: e instanceof Error ? e.message : String(e),
      })
    );
  }
}

/**
 * CAM-682 — same input shape as BookingCreatedEventInput (both carry the
 * fields buildBookingCancelledCopy/buildBookingCreatedCopy need plus the
 * booking's owning userId for the self-notify exclusion below); kept as its
 * own named type so the two events can diverge independently later.
 */
export interface BookingCancelledEventInput {
  id: string;
  /** The booking's owner (the camper) — excluded from recipients (never
   *  notify yourself), same rule as notifyBookingCreated. */
  userId: string;
  campSiteId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
  /** Booking.snapshotCampName (TH), frozen at booking time — ADR-005. */
  snapshotCampName: string | null;
}

/**
 * Notifies the host/team recipients that a CAMPER cancelled their own
 * booking. The call site (app/api/bookings/[id]/route.ts PATCH) is
 * responsible for only calling this when the cancelling actor is the camper
 * and NOT also someone who can act as host on this camp (`isCamper &&
 * !canHostUpdate`) — a host who booked their own camp and then cancels is a
 * HOST action, and notifying them about themselves is noise (CAM-74 AC#5).
 * This function does not re-derive that condition; it assumes the caller
 * already decided to fire.
 *
 * Same never-throw shape as notifyBookingCreated — see this module's doc
 * comment above. A notification failure here must never turn a successfully
 * committed cancellation into a 500 for the camper who just cancelled.
 */
export async function notifyBookingCancelled(booking: BookingCancelledEventInput): Promise<void> {
  try {
    const copy = buildBookingCancelledCopy({
      campName: booking.snapshotCampName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      guests: booking.guests,
    });
    if (!copy) return; // kill switch off — write nothing, not an error

    const recipients = await listBookingViewRecipients(booking.campSiteId);
    const targets = recipients.filter((r) => r.userId !== booking.userId);
    if (targets.length === 0) return;

    const link = bookingHighlightLink(booking.id);

    await prisma.notification.createMany({
      data: targets.map((r) => ({
        userId: r.userId,
        type: 'BOOKING' as const,
        title: copy.title,
        body: copy.body,
        link,
        isRead: false,
      })),
    });
  } catch (e) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'booking_cancel_notify_failed',
        bookingId: booking.id,
        campSiteId: booking.campSiteId,
        reason: e instanceof Error ? e.message : String(e),
      })
    );
  }
}
