/**
 * cam-56-blocked-dates-validation.test.ts — CAM-56 zod boundary unit tests
 *
 * Covers the `## Rules` from the ticket:
 *  - reason: optional, max 200 chars
 *  - startDate must be today or future (Asia/Bangkok, UTC+7)
 *  - startDate must not be after endDate
 *  - a single block spans at most 90 days (inclusive)
 *  - spotId: optional/nullable uuid (null/undefined = whole-camp block)
 *
 * Dates are computed relative to getBangkokTodayDateOnly() so the suite never
 * goes stale as real time passes (Prove-It: hardcoding a fixed date would start
 * failing the "today is allowed" case once that date is in the past).
 */

import { describe, it, expect } from 'vitest';
import {
  createBlockedDateSchema,
  getBangkokTodayDateOnly,
  BLOCKED_DATE_REASON_MAX_LENGTH,
  BLOCKED_DATE_MAX_RANGE_DAYS,
} from '@/lib/validations/blocked-dates';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

describe('createBlockedDateSchema — CAM-56 boundary validation', () => {
  const today = getBangkokTodayDateOnly();

  // ─────────────────────────────────────────────────────────────────────────
  // [normal] happy path — today + a short range, no spot, no reason
  // ─────────────────────────────────────────────────────────────────────────
  it('[normal] accepts a whole-camp block starting today with no reason', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(addDays(today, 2)),
    });

    expect(result.success).toBe(true);
  });

  it('[normal] accepts a spot-level block with a valid uuid spotId', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
      spotId: '550e8400-e29b-41d4-a716-446655440001',
      reason: 'ปิดปรับปรุงพื้นที่',
    });

    expect(result.success).toBe(true);
  });

  it('[null/empty] accepts an explicit null spotId (whole-camp block)', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
      spotId: null,
    });

    expect(result.success).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [boundary] startDate = today is allowed (not "in the past")
  // Prove-It: if the comparison used `>` instead of `>=`, today would be rejected.
  // ─────────────────────────────────────────────────────────────────────────
  it('[boundary] startDate = today (Bangkok) is allowed, not rejected as past', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
    });

    expect(result.success).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [error/validation] startDate in the past is rejected
  // Prove-It: removing the past-date refine would let this pass.
  // ─────────────────────────────────────────────────────────────────────────
  it('[error] rejects a startDate in the past', () => {
    const yesterday = addDays(today, -1);
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(yesterday),
      endDate: isoDate(today),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('startDate');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [error/validation] startDate after endDate is rejected
  // ─────────────────────────────────────────────────────────────────────────
  it('[error] rejects startDate after endDate', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(addDays(today, 5)),
      endDate: isoDate(addDays(today, 1)),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('endDate');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [boundary] exactly 90 days (inclusive) is allowed
  // ─────────────────────────────────────────────────────────────────────────
  it('[boundary] accepts a range spanning exactly 90 days (inclusive)', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(addDays(today, BLOCKED_DATE_MAX_RANGE_DAYS - 1)),
    });

    expect(result.success).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [boundary] 91 days is rejected
  // Prove-It: an off-by-one in the day count would let this slip through.
  // ─────────────────────────────────────────────────────────────────────────
  it('[error] rejects a range spanning 91 days (exceeds the 90-day cap)', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(addDays(today, BLOCKED_DATE_MAX_RANGE_DAYS)),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('endDate');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [boundary] reason at exactly the 200-char cap is allowed
  // ─────────────────────────────────────────────────────────────────────────
  it('[boundary] accepts a reason of exactly 200 characters', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
      reason: 'a'.repeat(BLOCKED_DATE_REASON_MAX_LENGTH),
    });

    expect(result.success).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [error/validation] reason over 200 chars is rejected
  // ─────────────────────────────────────────────────────────────────────────
  it('[error] rejects a reason exceeding 200 characters', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
      reason: 'a'.repeat(BLOCKED_DATE_REASON_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('reason');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [error/validation] a malformed spotId (not a uuid) is rejected
  // ─────────────────────────────────────────────────────────────────────────
  it('[error] rejects a non-uuid spotId', () => {
    const result = createBlockedDateSchema.safeParse({
      startDate: isoDate(today),
      endDate: isoDate(today),
      spotId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // [error/validation] missing required fields is rejected
  // ─────────────────────────────────────────────────────────────────────────
  it('[null/empty] rejects a body missing startDate/endDate', () => {
    const result = createBlockedDateSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('getBangkokTodayDateOnly — UTC+7 calendar-day normalization', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // [boundary] a late-UTC instant already rolled into the next Bangkok calendar day
  // ─────────────────────────────────────────────────────────────────────────
  it('[boundary] 23:59 UTC on day N is already day N+1 in Bangkok (UTC+7 rollover)', () => {
    // 2026-07-04T23:59:00Z + 7h = 2026-07-05T06:59:00 → Bangkok calendar day is the 5th.
    const utcInstant = new Date('2026-07-04T23:59:00.000Z');
    const bkkToday = getBangkokTodayDateOnly(utcInstant);

    expect(isoDate(bkkToday)).toBe('2026-07-05');
  });

  it('[normal] returns a UTC-midnight Date (comparable to a @db.Date value)', () => {
    const result = getBangkokTodayDateOnly(new Date('2026-07-04T10:00:00.000Z'));
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });
});
