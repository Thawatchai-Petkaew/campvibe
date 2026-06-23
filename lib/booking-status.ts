// Pure util — no React or i18n imports so QA can unit-test without a render environment.
// CAM-61 (booking detail page) imports this same util so the mapping is defined once.

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
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
  CANCELLED: { labelKey: "statusCancelled", variant: "muted" },
  COMPLETED: { labelKey: "statusCompleted", variant: "info" },
};

/**
 * Maps a `Booking.status` string to its i18n key and Badge variant.
 *
 * - Known statuses (PENDING / CONFIRMED / CANCELLED / COMPLETED) return a
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
