/**
 * cam-652-charge-the-chosen-unit.test.ts — CAM-652 (epic CAM-648, ADR-014)
 *
 * Unlike __tests__/cam-57-atomic-lock.test.ts (which mocks
 * @/lib/booking-pricing entirely, pinning `unit: 'PER_SITE', quantity: 1`),
 * this file uses the REAL `lib/booking-pricing.ts` so a camp's actual
 * `priceUnit` column really drives the recorded total through
 * `POST /api/bookings` — proving the server-side half of CAM-652 (the
 * client-preview half is CampgroundDetailClient.tsx, covered separately).
 *
 * AC→test matrix:
 *   [normal]   PER_PERSON camp, 3 guests, 1 night -> totalPrice = unit*3*nights,
 *              snapshotPricingUnit='PER_PERSON', snapshotQuantity=3
 *   [normal]   PER_SITE camp, 3 guests, 1 night -> totalPrice UNCHANGED (I2 golden,
 *              no guest multiplier), snapshotPricingUnit='PER_SITE', snapshotQuantity=1
 *   [null]     campSite.priceUnit is null/undefined in the DB row (a booking made
 *              via a raw fixture that predates CAM-650's default) -> normalizes to
 *              PER_SITE (ADR-014 §2), never crashes
 *   [boundary] a spot-level booking reads the SPOT's own priceUnit, not the camp's
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { buildBookingPriceArgs, computeBookingPrice } from '@/lib/booking-pricing';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before imports. booking-pricing is DELIBERATELY NOT
// mocked here (see file header) — the real multiplication logic is what this
// file proves.
// ---------------------------------------------------------------------------
vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/serialize', () => ({
  serializeDecimals: vi.fn((x) => x),
}));

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-utils';

const { POST } = await import('@/app/api/bookings/route');

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------
const CAMP_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-000000000001';
const SPOT_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-000000000002';
const USER_ID = 'b1c2d3e4-f5a6-4b7c-8d9e-000000000003';
const CHECK_IN = '2026-09-01';
const CHECK_OUT = '2026-09-02'; // exactly 1 night

function makeSession() {
  return { user: { id: USER_ID, email: 'tester@campvibe.com', name: 'Tester' } };
}

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      campSiteId: CAMP_ID,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guests: 3,
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

type Captured = { data?: Record<string, unknown> };

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMP_ID,
    nameTh: 'แคมป์ทดสอบ',
    nameEn: 'Test Camp',
    priceLow: 250,
    priceCurrency: 'THB',
    extraFeeAmount: null,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    maxGuestsPerDay: null,
    maxTentsPerDay: null,
    useSpotView: false,
    spots: [],
    location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
    ...overrides,
  };
}

function mockTransaction(campSiteFixture: Record<string, unknown>, captured: Captured) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        booking: {
          findFirst: vi.fn().mockResolvedValue(null), // no spot overlap
          findMany: vi.fn().mockResolvedValue([]), // no existing bookings (capacity check)
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            captured.data = data;
            return { id: 'booking-1', ...data };
          }),
        },
        campSite: { findUnique: vi.fn().mockResolvedValue(campSiteFixture) },
        blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
        internalHold: { findMany: vi.fn().mockResolvedValue([]) },
      })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null, session: makeSession() });
});

describe('POST /api/bookings — CAM-652 real priceUnit x quantity multiplication', () => {
  it('[normal] a PER_PERSON camp, 3 guests, 1 night at 250/night -> totalPrice 750, snapshot unit+quantity frozen', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite({ priceUnit: 'PER_PERSON' }), captured);

    const res = await POST(makePostRequest({ guests: 3 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(750); // 250 * 3 guests * 1 night
    expect(captured.data?.snapshotPricingUnit).toBe('PER_PERSON');
    expect(captured.data?.snapshotQuantity).toBe(3);
    expect(captured.data?.snapshotTotalAmount).toBe(750);
  });

  it('[normal] a PER_SITE camp, 3 guests, 1 night at 250/night -> totalPrice UNCHANGED at 250 (I2 golden, no guest multiplier)', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite({ priceUnit: 'PER_SITE' }), captured);

    const res = await POST(makePostRequest({ guests: 3 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(250); // the owner-reported camp: unchanged
    expect(captured.data?.snapshotPricingUnit).toBe('PER_SITE');
    expect(captured.data?.snapshotQuantity).toBe(1);
  });

  it('[null/empty] campSite.priceUnit is undefined in the DB row (pre-CAM-650 fixture) -> normalizes to PER_SITE, never crashes', async () => {
    const captured: Captured = {};
    const fixture = baseCampSite();
    delete (fixture as Record<string, unknown>).priceUnit;
    mockTransaction(fixture, captured);

    const res = await POST(makePostRequest({ guests: 5 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(250); // normalized PER_SITE, no crash, no guest multiplier
    expect(captured.data?.snapshotPricingUnit).toBe('PER_SITE');
    expect(captured.data?.snapshotQuantity).toBe(1);
  });

  it('[boundary] a spot-level booking reads the SPOT priceUnit, not the camp priceUnit', async () => {
    const captured: Captured = {};
    mockTransaction(
      baseCampSite({
        priceUnit: 'PER_PERSON', // camp says per-person...
        spots: [{ id: SPOT_ID, name: 'A1', pricePerNight: 400, priceUnit: 'PER_SITE' }], // ...but the booked spot says per-site
      }),
      captured
    );

    const res = await POST(makePostRequest({ spotId: SPOT_ID, guests: 4 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(400); // spot's own PER_SITE unit wins — never paired with the camp's unit
    expect(captured.data?.snapshotPricingUnit).toBe('PER_SITE');
    expect(captured.data?.snapshotQuantity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Client/server total PARITY — the whole point of routing every caller
// through the SAME buildBookingPriceArgs. Asserted directly (not trusted):
// the "regression" case proves this assertion has teeth by reproducing the
// exact class of bug CAM-58/ADR-014 exists to prevent (a caller that still
// hardcodes guests: 1 while the server uses the real party size).
// ---------------------------------------------------------------------------
describe('CAM-652 — client preview and server total agree for the same real inputs', () => {
  const campSite = { priceLow: 250, priceUnit: 'PER_PERSON' as const, extraFeeAmount: null };

  it('[normal] same guests, divergent vatRate (client always renders 0; server uses the real country VAT) -> totals still agree, because VAT is inclusive (extracted, never added on top)', () => {
    const server = buildBookingPriceArgs({ campSite, spot: null, party: { guests: 3 }, nights: 1, vatRate: 0.07 });
    const client = buildBookingPriceArgs({ campSite, spot: null, party: { guests: 3 }, nights: 1, vatRate: 0 });
    expect(server.ok && client.ok).toBe(true);
    if (!server.ok || !client.ok) throw new Error('unreachable');
    const serverTotal = computeBookingPrice(server.input).totalAmount;
    const clientTotal = computeBookingPrice(client.input).totalAmount;
    expect(clientTotal).toBe(serverTotal);
    expect(clientTotal).toBe(750); // 250 * 3 guests * 1 night
  });

  it('[error/teeth] a stale caller still hardcoding guests: 1 WOULD diverge from the real party size — proves the parity assertion is meaningful, not tautological', () => {
    const server = buildBookingPriceArgs({ campSite, spot: null, party: { guests: 3 }, nights: 1, vatRate: 0 });
    const staleClient = buildBookingPriceArgs({ campSite, spot: null, party: { guests: 1 }, nights: 1, vatRate: 0 }); // the pre-CAM-652 bug
    if (!server.ok || !staleClient.ok) throw new Error('unreachable');
    const serverTotal = computeBookingPrice(server.input).totalAmount;
    const staleClientTotal = computeBookingPrice(staleClient.input).totalAmount;
    expect(staleClientTotal).not.toBe(serverTotal); // 250 !== 750 — exactly the CAM-58 failure class
  });
});

// ---------------------------------------------------------------------------
// Source-inspection: CampgroundDetailClient.tsx (client preview) and the
// in-chat booking flow (booking-view.ts / AiChatDetailCard.tsx, the "third
// caller" CAM-651 flagged) — established precedent for
// CampgroundDetailClient.tsx is source-inspection (no render harness exists
// for its ~15 heavy dependencies, see cam-636-guests-select-wiring.test.ts).
// ---------------------------------------------------------------------------
function src(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

describe('CampgroundDetailClient.tsx — real priceUnit + real guests thread through buildBookingPriceArgs', () => {
  const detailSrc = src('components/CampgroundDetailClient.tsx');

  it('[unit] priceUnit is read from campground.priceUnit, never hardcoded "PER_SITE"', () => {
    expect(detailSrc).toContain('priceUnit: (campground.priceUnit ?? null) as PricingUnit | null,');
  });

  it('[unit] party.guests is the real guests state, never hardcoded { guests: 1 }', () => {
    expect(detailSrc).toContain('party: { guests },');
    expect(detailSrc).not.toContain('party: { guests: 1 },');
  });

  it('[unit] the breakdown row adds the guest-count term only for PER_PERSON', () => {
    expect(detailSrc).toContain('bookingPricingUnit === "PER_PERSON"');
    expect(detailSrc).toContain('t.booking.guestsCount.replace("{count}", String(bookingQuantity))');
  });
});

describe('the in-chat booking summary (booking-view.ts) is routed through buildBookingPriceArgs — the "third caller" CAM-651 flagged', () => {
  const bookingViewSrc = src('components/ai-chat/booking-view.ts');
  const detailCardSrc = src('components/ai-chat/AiChatDetailCard.tsx');

  it('[unit] buildSummaryView calls buildBookingPriceArgs(, never assembling its own ComputeBookingPriceInput object literal', () => {
    expect(bookingViewSrc).toContain('buildBookingPriceArgs({');
    expect(bookingViewSrc).not.toContain('computeBookingPrice({');
  });

  it('[unit] the party guests passed in is the real slots.guests, not a hardcoded 1', () => {
    expect(bookingViewSrc).toContain('party: { guests },');
  });

  it('[unit] AiChatDetailCard threads the resolved unit (not just the number) into BookingCampContext', () => {
    expect(detailCardSrc).toContain('priceUnit: resolved.unit,');
  });
});

// ---------------------------------------------------------------------------
// A booking made before CAM-648 (both snapshot columns NULL) — the detail
// page renders the frozen `booking.totalPrice` directly and never derives
// from snapshotPricingUnit/snapshotQuantity, so a NULL there cannot change
// what a camper sees (ADR-005 immutability; ADR-014 §4 "never backfilled").
// ---------------------------------------------------------------------------
describe('BookingDetailClient.tsx never reads snapshotPricingUnit/snapshotQuantity for display', () => {
  it('[regression] a pre-CAM-648 booking (snapshot columns NULL) renders unchanged — the display path only ever reads booking.totalPrice', () => {
    const bookingDetailSrc = src('app/bookings/[id]/BookingDetailClient.tsx');
    expect(bookingDetailSrc).not.toContain('snapshotPricingUnit');
    expect(bookingDetailSrc).not.toContain('snapshotQuantity');
    expect(bookingDetailSrc).toContain('booking.totalPrice');
  });
});
