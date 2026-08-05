import translations from '@/locales/translations.json';

/**
 * lib/notifications/copy.ts — single source of copy for `Notification` rows
 * (CAM-681, the first writer of the table — prisma/schema.prisma:857-873).
 *
 * Per-event kill-switch map, mirroring lib/notify-messages.ts's NOTIFY_EVENTS
 * pattern: suppression is decided HERE (a disabled event returns `null` from
 * its build function) rather than branching at every call site.
 *
 * PDPA / disclosure (load-bearing — see lib/notifications/booking-events.ts's
 * module doc for the full reasoning): a Notification row cannot be revoked
 * and GET /api/notifications filters only by `userId` — no per-read
 * permission re-check. So a row that names the guest is a PERMANENT
 * disclosure to whoever held BOOKING_VIEW the day it was written, even after
 * their access is later revoked. The copy built here therefore carries ONLY
 * camp name, dates, and guest COUNT — never the guest's name, phone, or
 * email. Identity stays behind the `link` (`/dashboard/bookings?highlight=`),
 * which re-checks BOOKING_VIEW on every load.
 *
 * Copy rules: Thai, no em-dash separator, no technical jargon
 * (.claude/rules/code.md #4).
 */

export type NotificationEventKind = 'bookingCreated';

export const NOTIFICATION_EVENTS: Record<NotificationEventKind, boolean> = {
  bookingCreated: true,
};

export interface BookingCreatedCopyInput {
  /** Booking.snapshotCampName (TH) — frozen at booking time, ADR-005. May be
   *  null on a legacy row shape; a generic fallback covers that case. */
  campName: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
}

export interface NotificationCopy {
  title: string;
  body: string;
}

const FALLBACK_CAMP_NAME = 'แคมป์ของคุณ';

function formatThaiDate(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/** Thai copy templates, single source in locales/translations.json (`notifications.booking.*`). */
const TH_TEMPLATE = translations.th.notifications.booking;

/**
 * Builds the Thai title/body for a "new booking" notification pushed to a
 * host/team member. Returns null when NOTIFICATION_EVENTS.bookingCreated is
 * off — the caller (lib/notifications/booking-events.ts) must treat null as
 * "write nothing", not as an error.
 */
export function buildBookingCreatedCopy(input: BookingCreatedCopyInput): NotificationCopy | null {
  if (!NOTIFICATION_EVENTS.bookingCreated) return null;

  const campName = input.campName ?? FALLBACK_CAMP_NAME;
  const checkIn = formatThaiDate(input.checkInDate);
  const checkOut = formatThaiDate(input.checkOutDate);

  const body = TH_TEMPLATE.body
    .replace('{campName}', campName)
    .replace('{checkInDate}', checkIn)
    .replace('{checkOutDate}', checkOut)
    .replace('{guests}', String(input.guests));

  return { title: TH_TEMPLATE.title, body };
}

/** Deep link target — re-checks BOOKING_VIEW on every load (see module doc). */
export function bookingHighlightLink(bookingId: string): string {
  return `/dashboard/bookings?highlight=${bookingId}`;
}
