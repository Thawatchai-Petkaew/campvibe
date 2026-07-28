/**
 * CAM-634 — lib/booking-prefill.ts (`bookingPrefillSchema` +
 * `buildBookingPrefillQuery` + `parseBookingPrefill`).
 *
 * Coverage matrix:
 *   - normal: a valid prefill round-trips (write -> read -> same value)
 *   - boundary: checkIn === today (ok) · nights === 30 (ok) / 31 (too_long) ·
 *     guests === maxGuests (ok) / maxGuests+1 (guests_out_of_range)
 *   - error/validation: one row per named reject reason (malformed / past /
 *     inverted / too_long / guests_out_of_range)
 *   - null/empty: a duplicated query param (`?guests=1&guests=2`, array-
 *     valued) is handled as `malformed`, never throws
 *   - never-throws (reader, BR-6): a fuzz-ish table of garbage `raw` shapes
 *   - fail-closed (writer, BR-7): every reject reason the reader has, fed to
 *     `buildBookingPrefillQuery`, throws instead of building a dead link
 *
 * `today` is INJECTED as a fixed literal (BR-2) on BOTH sides — no clock
 * reads anywhere in this file, matching the module under test (pure,
 * deterministic, no Bangkok-midnight flake risk).
 */
import { describe, it, expect } from 'vitest';
import {
  bookingPrefillSchema,
  buildBookingPrefillQuery,
  parseBookingPrefill,
  type BookingPrefill,
} from '@/lib/booking-prefill';
import { MAX_BOOKING_NIGHTS } from '@/lib/validations/booking';

const TODAY = '2026-08-01';
const CTX = { today: TODAY, maxGuests: 4 as number | null };
const WRITE_CTX = { today: TODAY };

describe('bookingPrefillSchema + buildBookingPrefillQuery + parseBookingPrefill (AC-1)', () => {
  it('[unit] round-trips a valid prefill: write -> read -> same value', () => {
    const value: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-08-07', guests: 2 };
    const query = buildBookingPrefillQuery(value, WRITE_CTX);
    const raw = Object.fromEntries(new URLSearchParams(query));
    const result = parseBookingPrefill(raw, CTX);
    expect(result).toEqual({ ok: true, value });
  });

  it('[unit] round-trips a valid prefill carrying `from: chat`', () => {
    const value: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-08-06', guests: 1, from: 'chat' };
    const query = buildBookingPrefillQuery(value, WRITE_CTX);
    expect(query).toContain('from=chat');
    const raw = Object.fromEntries(new URLSearchParams(query));
    const result = parseBookingPrefill(raw, CTX);
    expect(result).toEqual({ ok: true, value });
  });

  it('[unit] bookingPrefillSchema accepts the round-tripped shape directly', () => {
    const value = { checkIn: '2026-08-05', checkOut: '2026-08-07', guests: 2 };
    expect(bookingPrefillSchema.safeParse(value).success).toBe(true);
  });
});

describe('buildBookingPrefillQuery — fail-closed on our own bug (BR-7, G3 nit)', () => {
  it('[unit] a hand-built object with an unreal calendar date throws (malformed)', () => {
    const bad = { checkIn: '2026-02-31', checkOut: '2026-08-06', guests: 2 } as BookingPrefill;
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow();
  });

  it('[unit] a checkIn before ctx.today throws (past)', () => {
    const bad: BookingPrefill = { checkIn: '2026-07-31', checkOut: '2026-08-02', guests: 1 };
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow(/past/);
  });

  it('[unit] checkOut <= checkIn throws (inverted)', () => {
    const bad: BookingPrefill = { checkIn: '2026-08-10', checkOut: '2026-08-05', guests: 1 };
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow(/inverted/);
  });

  it(`[unit] more than ${MAX_BOOKING_NIGHTS} nights throws (too_long)`, () => {
    const bad: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-09-20', guests: 1 }; // 46 nights
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow(/too_long/);
  });

  it('[unit] negative guests throws (guests_out_of_range) — the reviewer\'s own example', () => {
    const bad: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-08-06', guests: -5 };
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow(/guests_out_of_range/);
  });

  it('[unit] guests === 0 throws (guests_out_of_range)', () => {
    const bad: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-08-06', guests: 0 };
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow(/guests_out_of_range/);
  });

  it('[unit] the exact adversarial-review example (unreal date + negative guests together) throws', () => {
    const bad = { checkIn: '2026-02-31', checkOut: '2026-08-06', guests: -5 } as BookingPrefill;
    expect(() => buildBookingPrefillQuery(bad, WRITE_CTX)).toThrow();
  });

  it('[unit] checkIn === ctx.today still builds cleanly (no false-positive throw, boundary)', () => {
    const value: BookingPrefill = { checkIn: TODAY, checkOut: '2026-08-02', guests: 2 };
    expect(() => buildBookingPrefillQuery(value, WRITE_CTX)).not.toThrow();
  });

  it('[unit] a valid prefill still builds cleanly (no false-positive throw)', () => {
    const value: BookingPrefill = { checkIn: '2026-08-05', checkOut: '2026-08-07', guests: 2 };
    expect(() => buildBookingPrefillQuery(value, WRITE_CTX)).not.toThrow();
  });
});

describe('parseBookingPrefill — boundaries (AC-1/EC boundary rows)', () => {
  it('[unit] checkIn === today is accepted, not rejected as past', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: '1' }, CTX);
    expect(result.ok).toBe(true);
  });

  it(`[unit] nights === ${MAX_BOOKING_NIGHTS} is accepted (boundary)`, () => {
    const result = parseBookingPrefill(
      { checkIn: TODAY, checkOut: '2026-08-31', guests: '1' }, // 30 nights
      CTX
    );
    expect(result.ok).toBe(true);
  });

  it(`[unit] nights === ${MAX_BOOKING_NIGHTS + 1} is rejected as too_long`, () => {
    const result = parseBookingPrefill(
      { checkIn: TODAY, checkOut: '2026-09-01', guests: '1' }, // 31 nights
      CTX
    );
    expect(result).toEqual({ ok: false, reason: 'too_long' });
  });

  it('[unit] guests === maxGuests is accepted (boundary)', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: '4' }, CTX);
    expect(result.ok).toBe(true);
  });

  it('[unit] guests === maxGuests + 1 is rejected as guests_out_of_range', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: '5' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'guests_out_of_range' });
  });

  it('[unit] a null maxGuests never rejects on the upper bound', () => {
    const result = parseBookingPrefill(
      { checkIn: TODAY, checkOut: '2026-08-02', guests: '999' },
      { today: TODAY, maxGuests: null }
    );
    expect(result.ok).toBe(true);
  });
});

describe('parseBookingPrefill — one reject reason per failure mode (error/validation)', () => {
  it('[unit] missing checkOut -> malformed', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('[unit] non-ISO checkIn format -> malformed', () => {
    const result = parseBookingPrefill({ checkIn: '08/01/2026', checkOut: '2026-08-02', guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('[unit] not a real calendar date (2026-02-31) -> malformed', () => {
    const result = parseBookingPrefill({ checkIn: '2026-02-31', checkOut: '2026-03-01', guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('[unit] duplicated (array-valued) guests param -> malformed, never throws', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: ['1', '2'] }, CTX);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('[unit] non-integer guests text -> malformed', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: '2.5' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('[unit] checkIn before today -> past', () => {
    const result = parseBookingPrefill({ checkIn: '2026-07-31', checkOut: '2026-08-02', guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'past' });
  });

  it('[unit] checkOut === checkIn -> inverted', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: TODAY, guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'inverted' });
  });

  it('[unit] checkOut before checkIn -> inverted', () => {
    const result = parseBookingPrefill({ checkIn: '2026-08-05', checkOut: '2026-08-01', guests: '1' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'inverted' });
  });

  it('[unit] guests === 0 -> guests_out_of_range (not malformed)', () => {
    const result = parseBookingPrefill({ checkIn: TODAY, checkOut: '2026-08-02', guests: '0' }, CTX);
    expect(result).toEqual({ ok: false, reason: 'guests_out_of_range' });
  });
});

describe('parseBookingPrefill — never throws (BR-6, fuzz table)', () => {
  const garbageRawInputs: unknown[] = [
    null,
    undefined,
    {},
    { checkIn: null, checkOut: undefined, guests: {} },
    { checkIn: 123, checkOut: true, guests: [] },
    { checkIn: ['a', 'b'], checkOut: ['c'], guests: ['1', '2'] },
    { checkIn: '', checkOut: '', guests: '' },
    { checkIn: 'not-a-date', checkOut: 'also-not-a-date', guests: 'NaN' },
    { checkIn: TODAY, checkOut: '2026-08-02', guests: '99999999999999999999' },
    'a string, not an object',
    42,
    [],
  ];

  it.each(garbageRawInputs)('[unit] never throws for garbage raw input %#', (garbage) => {
    type RawShape = Record<string, string | string[] | undefined>;
    expect(() => parseBookingPrefill(garbage as RawShape, CTX)).not.toThrow();
    const result = parseBookingPrefill(garbage as RawShape, CTX);
    expect(result.ok).toBe(false);
  });
});
