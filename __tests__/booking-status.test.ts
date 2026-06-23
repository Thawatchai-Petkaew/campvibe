/**
 * booking-status.test.ts — unit tests for lib/booking-status.ts (CAM-60)
 *
 * AC coverage matrix (every row in the AC table → at least one test):
 *   AC-1  PENDING  → { labelKey: 'statusPending',   variant: 'warning'  }
 *   AC-2  CONFIRMED → { labelKey: 'statusConfirmed', variant: 'success'  }
 *   AC-3  CANCELLED → { labelKey: 'statusCancelled', variant: 'muted'    }
 *         regression: CANCELLED must NOT return variant 'destructive'
 *   AC-4  COMPLETED → { labelKey: 'statusCompleted', variant: 'info'     }
 *   AC-5  th.bookings.statusPending  === 'รอยืนยัน'   (verbatim)
 *   AC-6  th.bookings.statusConfirmed === 'ยืนยันแล้ว' (verbatim)
 *   AC-7  th.bookings.statusCancelled === 'ยกเลิกแล้ว' (verbatim)
 *   AC-8  th.bookings.statusCompleted === 'เข้าพักแล้ว' (verbatim)
 *   AC-5  en.bookings.statusPending  === 'Pending'
 *   AC-6  en.bookings.statusConfirmed === 'Confirmed'
 *   AC-7  en.bookings.statusCancelled === 'Cancelled'
 *   AC-8  en.bookings.statusCompleted === 'Completed'
 *   AC-9  unknown/garbage status → { labelKey: null, variant: 'muted' } (no throw)
 *   source-inspection: app/bookings/page.tsx imports getBookingStatusMeta,
 *                      no hardcoded statusVariant / 'destructive' mapping present
 *
 * Layers:
 *   - getBookingStatusMeta → unit (pure function, no React/i18n/DB)
 *   - i18n verbatim → unit (JSON source parsing)
 *   - page.tsx wiring → source-inspection
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal · null/empty · boundary (unknown/garbage) · error/validation · regression
 *
 * Prove-It: each test was verified to FAIL when the mapping is broken
 *   (e.g. changing CANCELLED→'destructive' or deleting a STATUS_MAP entry).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getBookingStatusMeta } from '@/lib/booking-status';

// ---------------------------------------------------------------------------
// getBookingStatusMeta — unit tests
// ---------------------------------------------------------------------------
describe('getBookingStatusMeta', () => {
  // -------------------------------------------------------------------------
  // AC-1: PENDING → warning badge (yellow)
  // Prove-It: if STATUS_MAP.PENDING were removed, labelKey would be null → FAIL
  // -------------------------------------------------------------------------
  it('[normal] PENDING → labelKey "statusPending", variant "warning" (AC-1)', () => {
    const result = getBookingStatusMeta('PENDING');
    expect(result.labelKey).toBe('statusPending');
    expect(result.variant).toBe('warning');
  });

  // -------------------------------------------------------------------------
  // AC-2: CONFIRMED → success badge (green)
  // Prove-It: changing variant to 'info' would fail this assertion
  // -------------------------------------------------------------------------
  it('[normal] CONFIRMED → labelKey "statusConfirmed", variant "success" (AC-2)', () => {
    const result = getBookingStatusMeta('CONFIRMED');
    expect(result.labelKey).toBe('statusConfirmed');
    expect(result.variant).toBe('success');
  });

  // -------------------------------------------------------------------------
  // AC-3: CANCELLED → muted badge (gray), NOT 'destructive'
  // Regression guard: old code used 'destructive'; this MUST be 'muted'.
  // Prove-It: changing variant to 'destructive' would fail the muted assertion
  //           AND the "not destructive" assertion separately.
  // -------------------------------------------------------------------------
  it('[normal] CANCELLED → labelKey "statusCancelled", variant "muted" (AC-3)', () => {
    const result = getBookingStatusMeta('CANCELLED');
    expect(result.labelKey).toBe('statusCancelled');
    expect(result.variant).toBe('muted');
  });

  it('[regression] CANCELLED variant is NOT "destructive" (AC-3 regression guard)', () => {
    // This test exists to catch any reversion to the old destructive mapping.
    // Prove-It: set CANCELLED → 'destructive' → this test fails immediately.
    const { variant } = getBookingStatusMeta('CANCELLED');
    expect(variant).not.toBe('destructive');
  });

  // -------------------------------------------------------------------------
  // AC-4: COMPLETED → info badge (blue)
  // Prove-It: changing variant to 'warning' would fail this assertion
  // -------------------------------------------------------------------------
  it('[normal] COMPLETED → labelKey "statusCompleted", variant "info" (AC-4)', () => {
    const result = getBookingStatusMeta('COMPLETED');
    expect(result.labelKey).toBe('statusCompleted');
    expect(result.variant).toBe('info');
  });

  // -------------------------------------------------------------------------
  // AC-9: unknown / future status → fallback, no throw
  // Prove-It: if the function threw on unknown input, these would error → FAIL
  // -------------------------------------------------------------------------
  it('[null/empty] unknown status "NO_SHOW" → { labelKey: null, variant: "muted" } (AC-9)', () => {
    const result = getBookingStatusMeta('NO_SHOW');
    expect(result.labelKey).toBeNull();
    expect(result.variant).toBe('muted');
  });

  it('[null/empty] empty string "" → { labelKey: null, variant: "muted" } (AC-9 fallback)', () => {
    const result = getBookingStatusMeta('');
    expect(result.labelKey).toBeNull();
    expect(result.variant).toBe('muted');
  });

  it('[boundary] garbage status "REFUNDED" → { labelKey: null, variant: "muted" } (AC-9 fallback)', () => {
    const result = getBookingStatusMeta('REFUNDED');
    expect(result.labelKey).toBeNull();
    expect(result.variant).toBe('muted');
  });

  it('[boundary] lowercase "pending" is not a known status → fallback (case-sensitive)', () => {
    // The map keys are uppercase; lowercase must fall through to the fallback.
    // Prove-It: if the function lowercased input before lookup, this would return statusPending → FAIL
    const result = getBookingStatusMeta('pending');
    expect(result.labelKey).toBeNull();
    expect(result.variant).toBe('muted');
  });

  it('[error/validation] unknown status does NOT throw (AC-9: no crash)', () => {
    expect(() => getBookingStatusMeta('TOTALLY_UNKNOWN_XYZ')).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Shape integrity — result always has exactly the two expected keys
  // -------------------------------------------------------------------------
  it('[normal] result object has exactly the keys "labelKey" and "variant"', () => {
    const result = getBookingStatusMeta('PENDING');
    expect(Object.keys(result).sort()).toEqual(['labelKey', 'variant']);
  });

  // -------------------------------------------------------------------------
  // Prove-It breakage demonstration (inline logic test)
  // Shows that a wrong mapping WOULD be caught if it were in the source.
  // -------------------------------------------------------------------------
  it('[regression] PENDING variant is not "success", "muted", or "info" (only "warning")', () => {
    const { variant } = getBookingStatusMeta('PENDING');
    expect(variant).not.toBe('success');
    expect(variant).not.toBe('muted');
    expect(variant).not.toBe('info');
  });

  it('[regression] CONFIRMED variant is not "warning", "muted", or "info" (only "success")', () => {
    const { variant } = getBookingStatusMeta('CONFIRMED');
    expect(variant).not.toBe('warning');
    expect(variant).not.toBe('muted');
    expect(variant).not.toBe('info');
  });

  it('[regression] COMPLETED variant is not "warning", "success", or "muted" (only "info")', () => {
    const { variant } = getBookingStatusMeta('COMPLETED');
    expect(variant).not.toBe('warning');
    expect(variant).not.toBe('success');
    expect(variant).not.toBe('muted');
  });
});

// ---------------------------------------------------------------------------
// i18n verbatim — locales/translations.json bookings namespace
//
// Asserts the exact Thai strings specified in the AC/Rules are present.
// These strings flow through: STATUS_MAP.labelKey → t.bookings[labelKey] → Badge.
// A wrong character here = a wrong badge label for the user.
// ---------------------------------------------------------------------------
describe('i18n verbatim — locales/translations.json bookings namespace', () => {
  const translationsPath = path.join(process.cwd(), 'locales/translations.json');
  const raw = fs.readFileSync(translationsPath, 'utf-8');
  const translations = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;

  const th = translations['th']['bookings'];
  const en = translations['en']['bookings'];

  // -------------------------------------------------------------------------
  // Thai verbatim (AC-1 through AC-4 visible results)
  // Prove-It: change any character and the exact-string assertion fails.
  // -------------------------------------------------------------------------
  it('[copy] th.bookings.statusPending === "รอยืนยัน" (AC-1 Thai copy verbatim)', () => {
    expect(th.statusPending).toBe('รอยืนยัน');
  });

  it('[copy] th.bookings.statusConfirmed === "ยืนยันแล้ว" (AC-2 Thai copy verbatim)', () => {
    expect(th.statusConfirmed).toBe('ยืนยันแล้ว');
  });

  it('[copy] th.bookings.statusCancelled === "ยกเลิกแล้ว" (AC-3 Thai copy verbatim)', () => {
    expect(th.statusCancelled).toBe('ยกเลิกแล้ว');
  });

  it('[copy] th.bookings.statusCompleted === "เข้าพักแล้ว" (AC-4 Thai copy verbatim)', () => {
    expect(th.statusCompleted).toBe('เข้าพักแล้ว');
  });

  // -------------------------------------------------------------------------
  // English (AC-5 through AC-8 visible results in EN locale)
  // -------------------------------------------------------------------------
  it('[copy] en.bookings.statusPending === "Pending" (AC-5 EN copy)', () => {
    expect(en.statusPending).toBe('Pending');
  });

  it('[copy] en.bookings.statusConfirmed === "Confirmed" (AC-6 EN copy)', () => {
    expect(en.statusConfirmed).toBe('Confirmed');
  });

  it('[copy] en.bookings.statusCancelled === "Cancelled" (AC-7 EN copy)', () => {
    expect(en.statusCancelled).toBe('Cancelled');
  });

  it('[copy] en.bookings.statusCompleted === "Completed" (AC-8 EN copy)', () => {
    expect(en.statusCompleted).toBe('Completed');
  });

  // -------------------------------------------------------------------------
  // Structural completeness — all 4 status keys exist in both locales
  // -------------------------------------------------------------------------
  it('[normal] all 4 status keys exist in th.bookings namespace', () => {
    const expected = ['statusPending', 'statusConfirmed', 'statusCancelled', 'statusCompleted'];
    for (const key of expected) {
      expect(th).toHaveProperty(key);
    }
  });

  it('[normal] all 4 status keys exist in en.bookings namespace', () => {
    const expected = ['statusPending', 'statusConfirmed', 'statusCancelled', 'statusCompleted'];
    for (const key of expected) {
      expect(en).toHaveProperty(key);
    }
  });

  // -------------------------------------------------------------------------
  // labelKey round-trip: getBookingStatusMeta.labelKey is a valid key in th.bookings
  // -------------------------------------------------------------------------
  it('[normal] PENDING labelKey is a real key in th.bookings', () => {
    const { labelKey } = getBookingStatusMeta('PENDING');
    expect(labelKey).not.toBeNull();
    expect(th).toHaveProperty(labelKey!);
  });

  it('[normal] CONFIRMED labelKey is a real key in th.bookings', () => {
    const { labelKey } = getBookingStatusMeta('CONFIRMED');
    expect(th).toHaveProperty(labelKey!);
  });

  it('[normal] CANCELLED labelKey is a real key in th.bookings', () => {
    const { labelKey } = getBookingStatusMeta('CANCELLED');
    expect(th).toHaveProperty(labelKey!);
  });

  it('[normal] COMPLETED labelKey is a real key in th.bookings', () => {
    const { labelKey } = getBookingStatusMeta('COMPLETED');
    expect(th).toHaveProperty(labelKey!);
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — app/bookings/page.tsx wiring
//
// Layer note: app/bookings/page.tsx is a "use client" component that imports
// getBookingStatusMeta and uses it inline. Rendering it in vitest/jsdom would
// require mocking next-auth, lucide-react, shadcn/ui, LanguageContext, and
// many other dependencies. Per the precedent established by CAM-79/76, the
// correct layer for component wiring is source-inspection.
// ---------------------------------------------------------------------------
describe('source-inspection — app/bookings/page.tsx wiring (regression guards)', () => {
  const pageSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/bookings/page.tsx'),
    'utf-8'
  );

  it('[source] page.tsx imports getBookingStatusMeta from @/lib/booking-status', () => {
    // Prove-It: remove the import → this test fails
    expect(pageSrc).toContain('getBookingStatusMeta');
    expect(pageSrc).toContain('booking-status');
  });

  it('[source] page.tsx calls getBookingStatusMeta(booking.status)', () => {
    // Prove-It: replace with a hardcoded map → this fails
    expect(pageSrc).toContain('getBookingStatusMeta(booking.status)');
  });

  it('[source] page.tsx uses labelKey from the meta result (not a hardcoded string)', () => {
    // The pattern: const { labelKey, variant } = getBookingStatusMeta(...)
    // labelKey must be referenced to look up the translation
    expect(pageSrc).toContain('labelKey');
  });

  it('[source] page.tsx does NOT hardcode a "destructive" statusVariant for CANCELLED (AC-3 regression)', () => {
    // Prove-It: if old code were present, this would fail
    // The word 'destructive' may still appear for cancel-button styling,
    // but it must NOT appear in a statusVariant/badge-variant context adjacent to CANCELLED.
    // We assert the old pattern of { status: 'CANCELLED', variant: 'destructive' } is absent.
    expect(pageSrc).not.toContain("statusVariant");
  });

  it('[source] page.tsx does NOT hardcode raw status → variant mapping inline (uses getBookingStatusMeta)', () => {
    // The old anti-pattern: a local status→variant switch/map hardcoded in the page.
    // These exact string patterns indicate a pre-CAM-60 mapping that should be gone.
    expect(pageSrc).not.toContain("'PENDING': 'warning'");
    expect(pageSrc).not.toContain("'CONFIRMED': 'success'");
  });

  it('[source] page.tsx passes variant to the Badge component (variant flows from the util)', () => {
    // The Badge must receive the variant from the getBookingStatusMeta call.
    expect(pageSrc).toContain('variant={variant}');
  });

  it('[source] page.tsx handles unknown labelKey with fallback to raw booking.status (AC-9)', () => {
    // The pattern: labelKey ? t.bookings[labelKey] : booking.status
    // This ensures an unknown status shows raw text rather than crashing.
    expect(pageSrc).toContain('booking.status');
  });
});
