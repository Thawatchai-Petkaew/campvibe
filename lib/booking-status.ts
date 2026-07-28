// Pure util — no React or i18n imports so QA can unit-test without a render environment.
// CAM-61 (booking detail page) imports this same util so the mapping is defined once.
//
// CAM-618: `BookingStatus` is imported from the generated Prisma client instead of being
// hand-declared here. STATUS_MAP below is a `Record<BookingStatus, …>` over the REAL
// `prisma/schema.prisma` enum, so it is exhaustive by construction: adding a member to the
// schema enum and regenerating the client (`npx prisma generate`) makes this file fail to
// typecheck until the new member is added to STATUS_MAP. The previous hand-written union
// (`"PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"`) silently omitted PAID and defeated
// the compiler — see lib/delivery/status-adapter.ts's `STATE_TO_STATUS` for the same
// Record-over-a-generated-enum pattern, proven out there first.
import type { BookingStatus } from "@prisma/client";

export type { BookingStatus };
export type BadgeVariant = "warning" | "success" | "muted" | "info";

export interface BookingStatusMeta {
  /** Key into the translations object under `bookings.*`, e.g. "statusPending".
   *  `null` signals an unknown status; the caller should render the raw value. */
  labelKey: string | null;
  variant: BadgeVariant;
}

const STATUS_MAP: Record<BookingStatus, BookingStatusMeta> = {
  PENDING: { labelKey: "statusPending", variant: "warning" },
  CONFIRMED: { labelKey: "statusConfirmed", variant: "success" },
  // Payment received, ahead of the stay (schema order: PENDING → CONFIRMED → PAID →
  // COMPLETED). Same positive "success" variant as CONFIRMED — both are good-news states;
  // the label text (not the color) is what distinguishes them for the camper.
  PAID: { labelKey: "statusPaid", variant: "success" },
  CANCELLED: { labelKey: "statusCancelled", variant: "muted" },
  COMPLETED: { labelKey: "statusCompleted", variant: "info" },
};

/**
 * Maps a `Booking.status` string to its i18n key and Badge variant.
 *
 * - Known statuses (PENDING / CONFIRMED / PAID / CANCELLED / COMPLETED) return a
 *   `labelKey` under `bookings.*` in `locales/translations.json`.
 * - Unknown / future statuses return `{ labelKey: null, variant: "muted" }`
 *   so the caller can render the raw string in a neutral badge without crashing
 *   (AC#9 fallback).
 */
export function getBookingStatusMeta(status: string): BookingStatusMeta {
  const meta = STATUS_MAP[status as BookingStatus];
  if (meta) return meta;
  return { labelKey: null, variant: "muted" };
}
