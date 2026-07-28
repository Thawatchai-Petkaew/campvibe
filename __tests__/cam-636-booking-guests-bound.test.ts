/**
 * cam-636-booking-guests-bound.test.ts — CAM-636 (epic CAM-630)
 *
 * Bug: `bookingSchema.guests` had NO upper bound at all
 * (`z.number().min(1).default(1)`) — a crafted request with `guests: 9999`
 * passed zod straight through to the booking transaction. This is a
 * defense-in-depth bound only; the REAL availability check is
 * `checkDateAvailabilityInTx` inside `withBookingTransaction`
 * (app/api/bookings/route.ts), unchanged by this story.
 *
 * Prove-It: `guests: 9999` is exactly the value the OLD schema
 * (`z.number().min(1).default(1)`, no `.max()`) would have accepted —
 * this test fails against that schema and passes against the fixed one.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · boundary · error/validation.
 */
import { describe, expect, it } from "vitest";
import { bookingSchema, MAX_BOOKING_GUESTS } from "@/lib/validations/booking";

const CAMP_UUID = "223e4567-e89b-42d3-a456-426614174001";
const USER_UUID = "323e4567-e89b-42d3-a456-426614174002";

function baseBooking(guests: number) {
  return {
    campSiteId: CAMP_UUID,
    checkInDate: "2027-01-01",
    checkOutDate: "2027-01-02",
    guests,
    userId: USER_UUID,
  };
}

describe("bookingSchema.guests — a real upper bound (CAM-636)", () => {
  it("[normal] a realistic large group (e.g. 30 guests) is accepted", () => {
    expect(bookingSchema.safeParse(baseBooking(30)).success).toBe(true);
  });

  it(`[boundary] exactly MAX_BOOKING_GUESTS (${MAX_BOOKING_GUESTS}) is accepted`, () => {
    expect(bookingSchema.safeParse(baseBooking(MAX_BOOKING_GUESTS)).success).toBe(true);
  });

  it(`[error/validation] MAX_BOOKING_GUESTS + 1 (${MAX_BOOKING_GUESTS + 1}) is rejected`, () => {
    const result = bookingSchema.safeParse(baseBooking(MAX_BOOKING_GUESTS + 1));
    expect(result.success).toBe(false);
  });

  it("[error/validation] the server rejects an absurd guest count (9999) that the OLD schema (no .max()) accepted today", () => {
    const result = bookingSchema.safeParse(baseBooking(9999));
    expect(result.success).toBe(false);
  });

  it("[error/validation] guests: 0 is still rejected (unchanged min bound)", () => {
    expect(bookingSchema.safeParse(baseBooking(0)).success).toBe(false);
  });

  it("[error/validation] a non-integer guest count is rejected", () => {
    expect(bookingSchema.safeParse(baseBooking(2.5)).success).toBe(false);
  });

  it("[null/empty] guests omitted defaults to 1 (unchanged default)", () => {
    const { guests, ...rest } = baseBooking(1);
    const result = bookingSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.guests).toBe(1);
  });
});
