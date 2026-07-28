/**
 * cam-618-booking-status-paid.test.ts — CAM-618: a Thai camper must never see the raw
 * token "PAID" on a booking; PAID must resolve to a Thai label like every other
 * BookingStatus member, and the label map must never again be able to silently omit a
 * real Prisma `BookingStatus` member.
 *
 * Prove-It: before the fix, `getBookingStatusMeta('PAID')` fell through to
 * `{ labelKey: null, variant: 'muted' }` because PAID was missing from the hand-written
 * union `lib/booking-status.ts` used to declare (a shadow of the real Prisma enum) —
 * five render surfaces then fell back to `booking.status` (the raw English token) per the
 * AC#9 unknown-status contract. This file asserts PAID now resolves like its four
 * siblings, AND that the map can never again silently omit a real BookingStatus member.
 *
 * Reachability finding (CAM-618): PAID is PURELY LATENT today. Grepped every writer of
 * `Booking.status` (app/api/bookings/route.ts creates PENDING only; the PATCH route's
 * own allowlist below excludes PAID; no seed script writes it) — no code path can create
 * a PAID booking yet. This is a trap set for the payment work, not a live production bug
 * seen by a real camper today; it becomes live the day a payment integration writes
 * status='PAID' directly to the DB or through a new endpoint.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getBookingStatusMeta } from '@/lib/booking-status';
import { BookingStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// getBookingStatusMeta('PAID') — unit
// ---------------------------------------------------------------------------
describe('[unit] getBookingStatusMeta — PAID (CAM-618)', () => {
  it('[normal] PAID -> labelKey "statusPaid", variant "success"', () => {
    const result = getBookingStatusMeta('PAID');
    expect(result.labelKey).toBe('statusPaid');
    expect(result.variant).toBe('success');
  });

  it('[regression] PAID no longer falls back to the raw-token contract (labelKey is not null)', () => {
    // Before the fix: getBookingStatusMeta('PAID') returned { labelKey: null, variant: 'muted' }
    // (the AC#9 unknown-status fallback) — every render surface then showed the raw English
    // token "PAID" instead of a Thai label. Prove-It: this assertion FAILS on the pre-fix code.
    const { labelKey } = getBookingStatusMeta('PAID');
    expect(labelKey).not.toBeNull();
  });

  it('[regression] PAID variant is not "warning", "muted", or "info" (only "success")', () => {
    const { variant } = getBookingStatusMeta('PAID');
    expect(variant).not.toBe('warning');
    expect(variant).not.toBe('muted');
    expect(variant).not.toBe('info');
  });
});

// ---------------------------------------------------------------------------
// i18n verbatim — locales/translations.json bookings.statusPaid
// ---------------------------------------------------------------------------
describe('i18n verbatim — locales/translations.json bookings.statusPaid (CAM-618)', () => {
  const translationsPath = path.join(process.cwd(), 'locales/translations.json');
  const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf-8')) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const th = translations['th']['bookings'];
  const en = translations['en']['bookings'];

  it('[copy] th.bookings.statusPaid === "ชำระเงินแล้ว" (Thai copy verbatim)', () => {
    expect(th.statusPaid).toBe('ชำระเงินแล้ว');
  });

  it('[copy] en.bookings.statusPaid === "Paid" (EN copy)', () => {
    expect(en.statusPaid).toBe('Paid');
  });

  it('[copy] Thai statusPaid has no em-dash separator (per code.md Thai-copy rule)', () => {
    expect(th.statusPaid).not.toContain('—');
  });

  it('[normal] PAID labelKey is a real key in both th.bookings and en.bookings', () => {
    const { labelKey } = getBookingStatusMeta('PAID');
    expect(labelKey).not.toBeNull();
    expect(th).toHaveProperty(labelKey!);
    expect(en).toHaveProperty(labelKey!);
  });
});

// ---------------------------------------------------------------------------
// Drift guard — runtime completeness against the REAL Prisma-generated enum.
//
// lib/booking-status.ts's STATUS_MAP is now typed `Record<BookingStatus, BookingStatusMeta>`
// against the Prisma-GENERATED type (compile-time exhaustiveness: adding a member to
// prisma/schema.prisma's BookingStatus enum and running `npx prisma generate` makes
// lib/booking-status.ts fail `tsc --noEmit` with a missing-property error until STATUS_MAP
// is updated). That compile-time proof was verified manually during this story — see the PR
// body for the captured failing `tsc` output — and reverted, since shipping a schema.prisma
// edit is out of this story's file surface (the enum itself is already correct).
//
// This test asserts the SAME invariant at RUNTIME, independent of tsc: every member of the
// ACTUAL Prisma client's BookingStatus object must resolve to a non-null labelKey. If a
// future schema member is ever added without a STATUS_MAP entry, this test goes red in CI —
// a second, independent tripwire on the same drift, exercised on every test run (not just
// the one-time manual tsc proof).
// ---------------------------------------------------------------------------
describe('[drift guard] every real Prisma BookingStatus member has a mapped Thai label (CAM-618)', () => {
  it('[normal] Object.values(BookingStatus) all resolve to a non-null labelKey (no raw-token leak)', () => {
    const members = Object.values(BookingStatus);
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) {
      const { labelKey } = getBookingStatusMeta(member);
      expect(
        labelKey,
        `BookingStatus.${member} must have a mapped labelKey (would otherwise leak the raw token)`
      ).not.toBeNull();
    }
  });

  it('[normal] BookingStatus currently has exactly the 5 known members', () => {
    // Pins the known set so a reviewer sees exactly what changed if this needs updating.
    expect(Object.values(BookingStatus).sort()).toEqual(
      ['CANCELLED', 'COMPLETED', 'CONFIRMED', 'PAID', 'PENDING'].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — app/api/bookings/[id]/route.ts's own hand-written shadow, found in
// the CAM-618 sweep. PAID stays intentionally EXCLUDED from what a generic PATCH may set
// (payment status is not yet a caller-settable transition — that is payment-integration
// work, out of this story's scope). This guards that the allowlist literal itself still
// type-checks against the real enum (a renamed/removed member would be caught by
// `satisfies readonly BookingStatus[]`).
// ---------------------------------------------------------------------------
describe('source-inspection — app/api/bookings/[id]/route.ts PATCH allowlist (CAM-618 sweep)', () => {
  const routeSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/api/bookings/[id]/route.ts'),
    'utf-8'
  );

  it('[source] PATCH does not accept PAID as a settable status (payment work is out of scope)', () => {
    expect(routeSrc).toContain('PATCHABLE_BOOKING_STATUSES');
    const arrayLiteralMatch = routeSrc.match(/PATCHABLE_BOOKING_STATUSES\s*=\s*\[([^\]]*)\]/);
    expect(arrayLiteralMatch).not.toBeNull();
    expect(arrayLiteralMatch![1]).not.toContain('PAID');
  });

  it('[source] the allowlist is typed against the real BookingStatus (satisfies readonly BookingStatus[])', () => {
    expect(routeSrc).toContain('satisfies readonly BookingStatus[]');
  });
});
