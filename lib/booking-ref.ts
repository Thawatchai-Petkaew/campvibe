/**
 * Pure booking-reference formatter — no imports, no side effects.
 * QA can unit-test this without a render environment.
 * CAM-61 (booking detail page) can import and reuse this util.
 *
 * Rule (CAM-59): ref = first 8 chars of Booking.id (UUID), uppercased,
 * prefixed with "CAMP-". Example: "CAMP-A1B2C3D4"
 */
export function formatBookingRef(id: string): string {
  return "CAMP-" + id.slice(0, 8).toUpperCase();
}
