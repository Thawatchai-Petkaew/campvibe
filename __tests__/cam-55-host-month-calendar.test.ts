/**
 * cam-55-host-month-calendar.test.ts — unit + source-inspection tests for the
 * CAM-55 host month calendar (bookings, blocks, remaining capacity per day).
 *
 * The repo's vitest config runs in the `node` environment (no jsdom/RTL — see
 * vitest.config.ts), so a real component-render test is not available here.
 * This file follows the same source-inspection pattern established by
 * __tests__/cam-56-blocked-dates-availability-page.test.ts and
 * __tests__/cam-190-avail1-blockeddate.test.ts:
 *   - unit tests exercise the REAL per-day mapping function
 *     (getCampSiteDailyAvailability, mocked at the prisma boundary only) —
 *     this is the single source BR-1 requires; no parallel math is written
 *     anywhere, including in this test.
 *   - source-inspection tests assert the structural contract (i18n, 8 states,
 *     a11y wiring, data-testid convention, BR-1/BR-2 compliance) on the new
 *     component + its wiring into the CAM-56 page.
 *
 * AC coverage: AC-1 (month grid: booked count + block marker + remaining),
 * AC-2 (prev/next re-render), AC-3 (whole-camp block marked "ปิดรับ"),
 * AC-4 (no bookings/blocks -> full remaining capacity).
 * BR-1 (single math source) · BR-2 (month bounds 12 back / 18 forward) ·
 * BR-3 (8 states) · EC-1 (no new authz bypass) · EC-2 (zero-data month still
 * renders every day, no crash).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mock — prisma only; no DB connection needed (mirrors CAM-190's test)
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: vi.fn(),
    },
    blockedDate: {
      findMany: vi.fn(),
    },
    // CAM-302: getCampSiteDailyAvailability now also reads ACTIVE non-expired
    // InternalHold rows (heldGuests leg) — mocked so this file's existing
    // per-day mapping tests keep exercising the real function unmodified.
    internalHold: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { getCampSiteDailyAvailability } from '@/lib/campsite-availability';

const CAMP_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-000000000055';

/** Build a Date at midnight UTC from an ISO date string */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no bookings, no blocked dates, no holds (AC-4 / EC-2 baseline)
  (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.internalHold.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Per-day mapping — the ONLY source of truth the calendar's numbers may use
// (BR-1). These call the real function; only prisma is mocked at the boundary.
// ---------------------------------------------------------------------------

describe('CAM-55 AC-4/EC-2 — per-day mapping: no bookings + no blocks', () => {
  it('[unit] a day with zero bookings and zero blocks reports bookedGuests=0, blockedByHost=false (full remaining capacity is derivable)', async () => {
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-08-01'), d('2026-08-01'));
    expect(result['2026-08-01']).toEqual({ bookedGuests: 0, bookedTents: 0, blockedByHost: false, heldGuests: 0 });
  });

  it('[unit] a whole month range with zero data still returns an entry for every day (no gap, no crash)', async () => {
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-08-01'), d('2026-08-05'));
    expect(Object.keys(result)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });
});

describe('CAM-55 AC-1 — per-day mapping: booked count', () => {
  it('[unit] a day covered by a CONFIRMED booking reports the booked guest count', async () => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-08-05'), checkOutDate: d('2026-08-06'), guests: 4, status: 'CONFIRMED' },
    ]);
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-08-05'), d('2026-08-05'));
    expect(result['2026-08-05'].bookedGuests).toBe(4);
    expect(result['2026-08-05'].blockedByHost).toBe(false);
  });
});

describe('CAM-55 AC-3 — per-day mapping: whole-camp BlockedDate', () => {
  it('[unit] every day inside a whole-camp block range reports blockedByHost=true', async () => {
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-08-10'), endDate: d('2026-08-12') },
    ]);
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-08-10'), d('2026-08-12'));
    expect(result['2026-08-10'].blockedByHost).toBe(true);
    expect(result['2026-08-11'].blockedByHost).toBe(true);
    expect(result['2026-08-12'].blockedByHost).toBe(true);
  });

  it('[unit] a day with BOTH a booking and a block reports both facts (calendar renders booked count + ปิดรับ together)', async () => {
    (prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { checkInDate: d('2026-08-15'), checkOutDate: d('2026-08-16'), guests: 2, status: 'PENDING' },
    ]);
    (prisma.blockedDate.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { startDate: d('2026-08-15'), endDate: d('2026-08-15') },
    ]);
    const result = await getCampSiteDailyAvailability(CAMP_ID, d('2026-08-15'), d('2026-08-15'));
    expect(result['2026-08-15']).toEqual({ bookedGuests: 2, bookedTents: 1, blockedByHost: true, heldGuests: 0 });
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — the endpoint the calendar consumes (BR-1: single math)
// ---------------------------------------------------------------------------

const routeSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/api/campsites/[id]/availability/route.ts'),
  'utf-8'
);

describe('CAM-55 BR-1 — the consumed endpoint computes from getCampSiteDailyAvailability only', () => {
  it('calls getCampSiteDailyAvailability (the single per-day math function) — no second query built here', () => {
    expect(routeSrc).toContain('getCampSiteDailyAvailability(id, start, end)');
  });

  it('remainingGuests is derived from maxGuestsPerDay - (bookedGuests + heldGuests) — CAM-302 threads holds into the same one formula', () => {
    expect(routeSrc).toContain(
      'remainingGuests: campSite.maxGuestsPerDay ? campSite.maxGuestsPerDay - (data.bookedGuests + data.heldGuests) : null'
    );
  });

  it('blockedByHost is passed through unchanged (AC-3 source of truth)', () => {
    expect(routeSrc).toContain('blockedByHost: data.blockedByHost');
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — the new calendar component
// ---------------------------------------------------------------------------

const calendarSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/availability-calendar.tsx'),
  'utf-8'
);

describe('CAM-55 calendar component — BR-1 no parallel calculation', () => {
  it('fetches the shared availability endpoint (the one that wraps getCampSiteDailyAvailability)', () => {
    expect(calendarSrc).toContain('/api/campsites/${campSiteId}/availability?startDate=');
  });

  it('does NOT import getCampSiteDailyAvailability or prisma directly (no parallel math client-side)', () => {
    // The doc comment at the top of the file MENTIONS getCampSiteDailyAvailability
    // for provenance (BR-1) — that is documentation, not an import/call. Assert
    // there is no import from lib/campsite-availability or lib/prisma, and no
    // direct call to the function.
    expect(calendarSrc).not.toContain('from "@/lib/campsite-availability"');
    expect(calendarSrc).not.toContain('from "@/lib/prisma"');
    expect(calendarSrc).not.toContain('getCampSiteDailyAvailability(');
  });

  it('reads blockedByHost / bookedGuests / remainingGuests straight from the API entry (no re-derivation)', () => {
    expect(calendarSrc).toContain('entry?.blockedByHost');
    expect(calendarSrc).toContain('entry?.bookedGuests');
    expect(calendarSrc).toContain('entry?.remainingGuests');
  });
});

describe('CAM-55 calendar component — i18n (no hardcoded copy)', () => {
  it('pulls calendar copy from t.availabilityCalendar (new namespace)', () => {
    expect(calendarSrc).toContain('const copy = t.availabilityCalendar');
  });

  it('reuses the existing t.booking.remainingSpots key for "เหลือ {n} ที่" (no duplicated key)', () => {
    expect(calendarSrc).toContain('t.booking.remainingSpots.replace(');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(calendarSrc)).toBe(false);
  });
});

describe('CAM-55 AC-3 — blocked-day marker', () => {
  it('renders the block marker via the i18n copy key (verbatim "ปิดรับ" lives in locales, not inline)', () => {
    expect(calendarSrc).toContain('copy.blockedMarker');
  });

  it('pairs the marker with an icon + Badge (text/icon, not color-only signal)', () => {
    expect(calendarSrc).toContain('<Badge variant="destructive"');
    expect(calendarSrc).toContain('<Lock');
  });
});

describe('CAM-55 BR-2 — month navigation bounded 12 back / 18 forward', () => {
  it('defines the exact bounds as named constants', () => {
    expect(calendarSrc).toContain('const MONTHS_BACK = 12;');
    expect(calendarSrc).toContain('const MONTHS_FORWARD = 18;');
  });

  it('wires the disabled state on both nav buttons at the bounds', () => {
    expect(calendarSrc).toContain('disabled={atMinBound}');
    expect(calendarSrc).toContain('disabled={atMaxBound}');
  });

  it('guards navigation so the month can never pass the bounds even on a stale click', () => {
    expect(calendarSrc).toContain('if (atMinBound) return;');
    expect(calendarSrc).toContain('if (atMaxBound) return;');
  });
});

describe('CAM-55 — 8 states present', () => {
  it('[loading] uses the client-fetch anti-flicker hook (useMinimumLoading) per loading-ui-standard §4', () => {
    expect(calendarSrc).toContain('useMinimumLoading(loading');
  });

  it('[loading] renders a skeleton mirroring the 7-column grid (not a spinner/blank)', () => {
    expect(calendarSrc).toContain('data-testid="skeleton--availability-calendar-grid"');
    expect(calendarSrc).toContain('grid grid-cols-7');
  });

  it('[error] renders ErrorBanner + a retry action on load failure', () => {
    expect(calendarSrc).toContain('data-testid="alert--availability-calendar-load-error"');
    expect(calendarSrc).toContain('data-testid="btn--availability-calendar-retry"');
  });

  it('[disabled] nav buttons disable at BR-2 bounds', () => {
    expect(calendarSrc).toContain('disabled={atMinBound}');
    expect(calendarSrc).toContain('disabled={atMaxBound}');
  });

  it('[success] renders the day grid with per-day cells keyed by date', () => {
    expect(calendarSrc).toContain('data-testid={`cell--calendar-day-${dateKey}`}');
  });

  it('[hover/focus/active] nav + retry controls reuse the shared Button primitive (states inherited, not reinvented)', () => {
    expect(calendarSrc).toContain('import { Button } from "@/components/ui/button"');
  });

  it('[empty/EC-2] every cell falls back to safe defaults so a zero-data month still renders (no crash, no empty-state confusion)', () => {
    expect(calendarSrc).toContain('entry?.blockedByHost ?? false');
    expect(calendarSrc).toContain('entry?.bookedGuests ?? 0');
    expect(calendarSrc).toContain('entry?.remainingGuests ?? null');
  });
});

describe('CAM-55 — a11y wiring (loading-ui-standard §5)', () => {
  it('sets aria-busy on the loading region', () => {
    expect(calendarSrc).toContain('aria-busy={showSkeleton}');
  });

  it('uses role="status" + aria-live="polite" with a text label for the loading region', () => {
    expect(calendarSrc).toContain('role="status" aria-live="polite"');
  });

  it('marks the decorative skeleton grid + weekday header + spacer cells aria-hidden', () => {
    expect(calendarSrc).toContain('aria-hidden="true"');
    expect(calendarSrc).toContain('data-testid="skeleton--availability-calendar-grid"');
  });

  it('gives both nav buttons an accessible name via aria-label', () => {
    expect(calendarSrc).toContain('aria-label={copy.prevMonthAriaLabel}');
    expect(calendarSrc).toContain('aria-label={copy.nextMonthAriaLabel}');
  });
});

describe('CAM-55 — data-testid convention (<type>--<module>-<detail>)', () => {
  const REQUIRED_TESTIDS = [
    'section--availability-calendar',
    'btn--calendar-prev',
    'btn--calendar-next',
    'section--availability-calendar-grid',
    'skeleton--availability-calendar-grid',
    'alert--availability-calendar-load-error',
    'btn--availability-calendar-retry',
  ];

  it.each(REQUIRED_TESTIDS)('includes the %s test id', (testId) => {
    expect(calendarSrc).toContain(`data-testid="${testId}"`);
  });

  it('day cells use the cell--calendar-day-<date> convention (dynamic template, not static)', () => {
    expect(calendarSrc).toContain('data-testid={`cell--calendar-day-${dateKey}`}');
  });
});

describe('CAM-55 — reuse-first (no new primitive invented)', () => {
  it('composes only from existing components/ui/* primitives (Button, Badge, Skeleton, ErrorBanner)', () => {
    expect(calendarSrc).toContain('from "@/components/ui/button"');
    expect(calendarSrc).toContain('from "@/components/ui/badge"');
    expect(calendarSrc).toContain('from "@/components/ui/skeleton"');
    expect(calendarSrc).toContain('from "@/components/ui/error-banner"');
  });

  it('uses lucide-react only for icons (§7 icon policy)', () => {
    expect(calendarSrc).toContain('from "lucide-react"');
    expect(calendarSrc).not.toContain('@tabler/icons-react');
  });
});

// ---------------------------------------------------------------------------
// Source-inspection — the CAM-56 page wires the calendar in (EC-1: no bypass)
// ---------------------------------------------------------------------------

const pageSrc = fs.readFileSync(
  path.join(process.cwd(), 'app/dashboard/campsites/[id]/availability/page.tsx'),
  'utf-8'
);

describe('CAM-55 AC-2 — the availability page embeds the month calendar', () => {
  it('imports AvailabilityCalendar', () => {
    expect(pageSrc).toContain('import { AvailabilityCalendar } from "@/components/availability-calendar"');
  });

  it('renders it with the page campSiteId', () => {
    // CAM-343 BR-7: the calendar now also receives refreshKey so a hold
    // create/release forces a refetch (see cam-343 test suite for that wiring).
    expect(pageSrc).toContain('<AvailabilityCalendar campSiteId={campSiteId} refreshKey={holdsRefreshKey} />');
  });
});

describe('CAM-55 EC-1 — no new authz bypass (reuses the existing forbidden gate)', () => {
  it('the existing forbidden early-return appears BEFORE the calendar in source order', () => {
    const forbiddenIdx = pageSrc.indexOf('if (forbidden) {');
    const calendarIdx = pageSrc.indexOf('<AvailabilityCalendar');
    expect(forbiddenIdx).toBeGreaterThan(-1);
    expect(calendarIdx).toBeGreaterThan(forbiddenIdx);
  });
});
