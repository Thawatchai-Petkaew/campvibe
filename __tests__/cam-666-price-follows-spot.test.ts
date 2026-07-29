/**
 * cam-666-price-follows-spot.test.ts — CAM-666
 *
 * "ถ้าเป็นสปอตก็ต้องเลือกก่อนว่าจะพักที่สปอตไหน แล้วค่อยเห็นว่ามีราคา" — at a
 * per-pitch camp, the camper picks a pitch FIRST, and only then sees a price.
 * Before this story, `CampgroundDetailClient.tsx` hard-coded `spot: null` into
 * `buildBookingPriceArgs` and rendered the headline/breakdown/reserve control
 * unconditionally.
 *
 * Layers (established precedent for this ~15-dependency, no-jsdom-harness
 * component — cam-396/cam-400/cam-616/cam-636/cam-652/cam-664 all
 * source-inspect it):
 *   A. CampgroundDetailClient.tsx — source-inspection Prove-It.
 *   B. components/spot-viewer/SpotViewer.tsx — source-inspection (the lift).
 *   C. lib/booking-pricing.ts — REAL function calls, hard-coded golden
 *      numbers (never re-derived from the same code path under test).
 *   D. app/api/bookings/route.ts — REAL route handler, mocked Prisma
 *      transaction (mirrors cam-652/cam-400's own established convention) —
 *      proves preview-vs-recorded parity without a live DB/server.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation · regression (golden numbers).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NextRequest } from "next/server";
import translations from "../locales/translations.json";
import {
  buildBookingPriceArgs,
  computeBookingPrice,
  resolveUnitPrice,
} from "@/lib/booking-pricing";
import { computeGuestCeiling, buildGuestOptions } from "@/lib/guest-capacity";

const root = process.cwd();
const src = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

const detailSrc = src("components/CampgroundDetailClient.tsx");
const spotViewerSrc = src("components/spot-viewer/SpotViewer.tsx");

// ---------------------------------------------------------------------------
// A. CampgroundDetailClient.tsx — wiring (source-inspection)
// ---------------------------------------------------------------------------
describe("CampgroundDetailClient.tsx — the real selected pitch replaces the hard-coded no-spot value (CAM-666)", () => {
  it('[regression][error/teeth] the old hard-coded "spot: null" argument is gone', () => {
    expect(detailSrc).not.toContain("spot: null");
  });

  it("[unit] buildBookingPriceArgs feeds the SELECTED spot's own price/unit, never a second derivation", () => {
    expect(detailSrc).toContain("spot: selectedSpot");
    expect(detailSrc).toContain(
      "pricePerNight: selectedSpot.pricePerNight != null ? Number(selectedSpot.pricePerNight) : null,"
    );
    expect(detailSrc).toContain("priceUnit: (selectedSpot.priceUnit ?? null) as PricingUnit | null,");
  });

  it("[unit] priceUnit still reads campground.priceUnit for the camp side of the args (CAM-652 pin preserved)", () => {
    expect(detailSrc).toContain('priceUnit: (campground.priceUnit ?? null) as PricingUnit | null,');
  });

  it("[unit] selectedSpotId/selectedSpot/hasPitchSelection are declared, never a second showSpotSection derivation", () => {
    expect(detailSrc).toContain('const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);');
    expect(detailSrc).toContain(
      "const selectedSpot = showSpotSection ? spots.find((s) => s.id === selectedSpotId) ?? null : null;"
    );
    expect(detailSrc).toContain("const hasPitchSelection = !showSpotSection || !!selectedSpot;");
    // only ONE showSpotSection derivation left in the file (the old duplicate further down is gone)
    const matches = detailSrc.match(/const showSpotSection = !!campground\.useSpotView && spots\.length > 0;/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("[unit] SpotViewer receives onSelectSpot wired to setSelectedSpotId, alongside the unchanged CAM-664 props", () => {
    expect(detailSrc).toContain("onSelectSpot={setSelectedSpotId}");
    expect(detailSrc).toContain("spots={spots}");
    expect(detailSrc).toContain("onOpenGallery={openSpotGallery}");
    expect(detailSrc).toContain("onOpenPanorama={openPanorama}");
  });

  it("[unit][ac] handleReserve sends spotId only when a pitch is selected, never unconditionally", () => {
    expect(detailSrc).toContain("...(selectedSpot ? { spotId: selectedSpot.id } : {}),");
  });

  it("[unit][ec, defense-in-depth] handleReserve early-returns when a per-spot camp has no pitch picked yet, before the fetch", () => {
    const start = detailSrc.indexOf("const handleReserve = async () => {");
    const end = detailSrc.indexOf("};", start);
    const body = detailSrc.slice(start, end);
    const pitchGateIdx = body.indexOf("if (showSpotSection && !selectedSpot)");
    const fetchIdx = body.indexOf('fetch("/api/bookings"');
    expect(pitchGateIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(pitchGateIdx).toBeLessThan(fetchIdx);
  });

  it("[unit][ec] handleReserve blocks + shows a real message when the selected pitch is unavailable for the chosen dates", () => {
    const start = detailSrc.indexOf("const handleReserve = async () => {");
    const end = detailSrc.indexOf("};", start);
    const body = detailSrc.slice(start, end);
    const unavailIdx = body.indexOf("if (isSelectedSpotUnavailableForStay)");
    const fetchIdx = body.indexOf('fetch("/api/bookings"');
    expect(unavailIdx).toBeGreaterThan(-1);
    expect(unavailIdx).toBeLessThan(fetchIdx);
    expect(body.slice(unavailIdx, unavailIdx + 200)).toContain("toast.error(t.booking.spotUnavailableForStay)");
  });

  it("[unit][ac] the login gate + isFullyBooked gate still sit ahead of every CAM-666 guard (order preserved)", () => {
    const start = detailSrc.indexOf("const handleReserve = async () => {");
    const end = detailSrc.indexOf("};", start);
    const body = detailSrc.slice(start, end);
    const loginIdx = body.indexOf("if (!isLoggedInLive)");
    const fullIdx = body.indexOf("if (isFullyBooked)");
    const pitchGateIdx = body.indexOf("if (showSpotSection && !selectedSpot)");
    expect(loginIdx).toBeLessThan(fullIdx);
    expect(fullIdx).toBeLessThan(pitchGateIdx);
  });

  it("[a11y/i18n] the headline shows a 'from ฿X' form until a pitch is chosen, reusing the pinned isHeadlinePriceFree/priceUnitWord expressions", () => {
    expect(detailSrc).toContain("{isHeadlinePriceFree ? (");
    expect(detailSrc).toContain(") : !showSpotSection ? (");
    expect(detailSrc).toContain(") : selectedSpot ? (");
    expect(detailSrc).toContain("t.booking.priceFromPrefix");
    expect(detailSrc).toContain("priceUnitWord(t, bookingPricingUnit)");
  });

  it("[unit] isSelectedSpotFree mirrors SpotStrip's own isFree rule (byte-identical expression, not a new one)", () => {
    expect(detailSrc).toContain("const isSelectedSpotFree = !!selectedSpot && Number(selectedSpot.pricePerNight) === 0;");
  });

  it("[ac] price/totals/the reserve control are absent until a pitch is picked; an empty-state prompt replaces them", () => {
    expect(detailSrc).toContain("{hasPitchSelection ? (");
    expect(detailSrc).toContain('data-testid="empty--booking-select-pitch"');
    expect(detailSrc).toContain("{t.booking.selectPitchToSeePrice}");
  });

  it("[ac] the mobile StickyActionBar follows the SAME hasPitchSelection rule as the desktop widget", () => {
    expect(detailSrc).toContain("{hasPitchSelection && (");
    expect(detailSrc).toContain("<StickyActionBar");
    expect(detailSrc).toContain("onAction={handleReserve}");
    expect(detailSrc).toContain("disabled={isFullyBooked}");
    expect(detailSrc).toContain("loading={isReserving}");
    expect(detailSrc).toContain("actionLabel={t.common.reserve}");
  });

  it("[unit][ac] guest ceiling is layered on TOP of guestCeiling via computeGuestCeiling again (reused, never forked) with the pitch's OWN maxCampers, isPerSpot=false", () => {
    // The CAM-636 pinned line stays completely untouched (its own test owns that pin).
    expect(detailSrc).toContain(
      "const guestCeiling = computeGuestCeiling(remainingCapacity?.remaining ?? null, maxGuestsPerDay, isPerSpot);"
    );
    expect(detailSrc).toContain("const guestOptions = buildGuestOptions(guestCeiling);");
    expect(detailSrc).toContain("{guestOptions.map(num => (");
    // The NEW, additional derivation this story adds.
    expect(detailSrc).toContain(
      "const spotGuestCeiling = showSpotSection && selectedSpot\n        ? computeGuestCeiling(guestCeiling, selectedSpotMaxCampers, false)\n        : guestCeiling;"
    );
    expect(detailSrc).toContain("disabled={spotGuestCeiling !== null && num > spotGuestCeiling}");
  });

  it("[unit][ec] a date the selected pitch cannot cover blocks the calendar too (spotAvailable === false), never guessed from null", () => {
    const start = detailSrc.indexOf("const isDateDisabled = (date: Date) => {");
    const end = detailSrc.indexOf("\n    };", start);
    const body = detailSrc.slice(start, end);
    expect(body).toContain("if (selectedSpotId && (spotAvailabilityError || spotAvailability[dateKey] === false)) {");
  });

  it("[unit] the per-pitch availability fetch is a SEPARATE effect from fetchAvailability — that callback's deps stay [campground.id] only (CAM-616 pin untouched)", () => {
    expect(detailSrc).toContain("}, [campground.id]);");
    expect(detailSrc).toContain("&endDate=${end.toISOString()}&spotId=${selectedSpotId}");
    expect(detailSrc).toContain("}, [campground.id, showSpotSection, selectedSpotId]);");
  });
});

// ---------------------------------------------------------------------------
// B. components/spot-viewer/SpotViewer.tsx — the lift (source-inspection)
// ---------------------------------------------------------------------------
describe("SpotViewer.tsx — selection is notified up, never fired on the mount default (CAM-666)", () => {
  it('[regression] the CAM-664 mount default is unchanged (the pinned cam-664 wiring test still passes)', () => {
    expect(spotViewerSrc).toContain('useState(spots[0]?.id ?? "");');
  });

  it("[unit] a real selection calls BOTH setSelectedSpotId (internal, unchanged) AND onSelectSpot (new, optional)", () => {
    expect(spotViewerSrc).toContain("const handleSelectSpot = (spotId: string) => {");
    expect(spotViewerSrc).toContain("setSelectedSpotId(spotId);");
    expect(spotViewerSrc).toContain("onSelectSpot?.(spotId);");
  });

  it("[regression] the mount-default useState call itself never invokes onSelectSpot (only a real tap does)", () => {
    const mountLine = spotViewerSrc.match(/const \[selectedSpotId, setSelectedSpotId\] = useState\(spots\[0\]\?\.id \?\? ""\);/);
    expect(mountLine).not.toBeNull();
  });

  it("[unit] SpotStrip's onSelect now points at the wrapper, not the bare setter", () => {
    expect(spotViewerSrc).toContain("onSelect={handleSelectSpot}");
    expect(spotViewerSrc).not.toContain("onSelect={setSelectedSpotId}");
  });

  it("[unit] onSelectSpot is optional (never required — keeps SpotViewer usable with no lift, per prop doc)", () => {
    expect(spotViewerSrc).toMatch(/onSelectSpot\?:\s*\(spotId: string\) => void;/);
  });
});

// ---------------------------------------------------------------------------
// C. lib/booking-pricing.ts — REAL functions, hard-coded golden numbers
// ---------------------------------------------------------------------------
describe("buildBookingPriceArgs/computeBookingPrice — a selected pitch's own price+unit resolves and prices correctly (CAM-666)", () => {
  it("[normal][ac] a PER_SITE pitch at ฿400, 1 night -> unitAmount=400, totalAmount=400 (golden numbers)", () => {
    const args = buildBookingPriceArgs({
      campSite: { priceLow: 250, priceUnit: "PER_SITE", extraFeeAmount: null },
      spot: { pricePerNight: 400, priceUnit: "PER_SITE" },
      party: { guests: 2 },
      nights: 1,
      vatRate: 0,
    });
    expect(args.ok).toBe(true);
    if (!args.ok) throw new Error("unreachable");
    const result = computeBookingPrice(args.input);
    expect(result.unitAmount).toBe(400);
    expect(result.totalAmount).toBe(400);
  });

  it("[normal][ac] a PER_PERSON pitch at ฿500, 3 guests, 1 night -> subtotal/total = 1500, quantity = 3 (golden numbers)", () => {
    const args = buildBookingPriceArgs({
      campSite: { priceLow: 250, priceUnit: "PER_SITE", extraFeeAmount: null },
      spot: { pricePerNight: 500, priceUnit: "PER_PERSON" },
      party: { guests: 3 },
      nights: 1,
      vatRate: 0,
    });
    expect(args.ok).toBe(true);
    if (!args.ok) throw new Error("unreachable");
    expect(args.input.quantity).toBe(3);
    const result = computeBookingPrice(args.input);
    expect(result.subtotalAmount).toBe(1500);
    expect(result.totalAmount).toBe(1500);
  });

  it("[boundary] resolveUnitPrice's SPOT branch — previously unreachable (every caller passed null) — now fires for real: spot price wins over the camp's", () => {
    const result = resolveUnitPrice({
      campSitePriceLow: 250,
      campSitePriceUnit: "PER_SITE",
      spotPricePerNight: 400,
      spotPriceUnit: "PER_SITE",
    });
    expect(result.source).toBe("SPOT");
    expect(result.unitPrice).toBe(400);
  });

  it("[regression][golden] a normal (non-per-spot) camp books EXACTLY as before — no spot passed, hard-coded expected total", () => {
    const args = buildBookingPriceArgs({
      campSite: { priceLow: 350, priceUnit: "PER_SITE", extraFeeAmount: null },
      spot: null,
      party: { guests: 4 },
      nights: 2,
      vatRate: 0,
    });
    expect(args.ok).toBe(true);
    if (!args.ok) throw new Error("unreachable");
    const result = computeBookingPrice(args.input);
    // 350/night x 1 (PER_SITE ignores guests) x 2 nights = 700 — a fixed,
    // hard-coded expectation (never `350 * 1 * 2` re-derived from the same
    // multiplication the function under test performs).
    expect(result.totalAmount).toBe(700);
  });

  it("[null/empty] a pitch with no price set (null) falls through to the camp's own price, never crashes", () => {
    const args = buildBookingPriceArgs({
      campSite: { priceLow: 300, priceUnit: "PER_SITE", extraFeeAmount: null },
      spot: { pricePerNight: null, priceUnit: "PER_PERSON" },
      party: { guests: 2 },
      nights: 1,
      vatRate: 0,
    });
    expect(args.ok).toBe(true);
    if (!args.ok) throw new Error("unreachable");
    expect(args.input.unit).toBe("PER_SITE"); // the CAMP's unit, not the spot's — the spot row never fired
    expect(computeBookingPrice(args.input).totalAmount).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// C2. lib/guest-capacity.ts — the layered spot ceiling call (real functions)
// ---------------------------------------------------------------------------
describe("computeGuestCeiling — layered call for a selected pitch's maxCampers (CAM-666)", () => {
  it("[normal] the pitch's own maxCampers (isPerSpot=false) narrows a wider whole-camp ceiling", () => {
    // guestCeiling (whole-camp side) = 10; pitch caps at 3 -> tighter wins.
    const spotCeiling = computeGuestCeiling(10, 3, false);
    expect(spotCeiling).toBe(3);
    expect(buildGuestOptions(spotCeiling)).toEqual([1, 2, 3]);
  });

  it("[normal] a wider pitch maxCampers never loosens a tighter whole-camp ceiling", () => {
    const spotCeiling = computeGuestCeiling(2, 8, false);
    expect(spotCeiling).toBe(2);
  });

  it("[null/empty] no whole-camp ceiling yet (dates unpicked) + a real pitch maxCampers -> the pitch's own number is trusted", () => {
    const spotCeiling = computeGuestCeiling(null, 4, false);
    expect(spotCeiling).toBe(4);
  });

  it("[boundary] neither signal set -> unbounded (null), same as the whole-camp case", () => {
    expect(computeGuestCeiling(null, null, false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D. app/api/bookings/route.ts — REAL route, mocked Prisma transaction
//    (mirrors cam-652/cam-400's established convention; proves preview vs
//    recorded total parity + spotId persistence without a live DB/server).
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

const CAMP_ID = 'c1c2d3e4-f5a6-4b7c-8d9e-000000000666';
const SPOT_ID = 'c1c2d3e4-f5a6-4b7c-8d9e-000000000667';
const OTHER_SPOT_ID = 'c1c2d3e4-f5a6-4b7c-8d9e-000000000668';
const USER_ID = 'c1c2d3e4-f5a6-4b7c-8d9e-000000000669';
const CHECK_IN = '2026-11-01';
const CHECK_OUT = '2026-11-02'; // exactly 1 night

function makePostRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      campSiteId: CAMP_ID,
      checkInDate: CHECK_IN,
      checkOutDate: CHECK_OUT,
      guests: 2,
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function baseCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMP_ID,
    nameTh: 'แคมป์ทดสอบสปอต',
    nameEn: 'Spot Test Camp',
    priceLow: 250,
    priceUnit: 'PER_SITE',
    priceCurrency: 'THB',
    extraFeeAmount: null,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    maxGuestsPerDay: null,
    maxTentsPerDay: null,
    useSpotView: true,
    spots: [
      { id: SPOT_ID, name: 'A1', pricePerNight: 400, priceUnit: 'PER_SITE', maxCampers: 4, maxTents: 2 },
    ],
    location: { countryRel: { vatRate: 0, timezone: 'Asia/Bangkok' } },
    ...overrides,
  };
}

type Captured = { data?: Record<string, unknown> };

function mockTransaction(campSiteFixture: Record<string, unknown>, captured: Captured, spotOverlap = false) {
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        booking: {
          findFirst: vi.fn().mockResolvedValue(spotOverlap ? { id: 'existing-booking' } : null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            captured.data = data;
            return { id: 'booking-666', ...data };
          }),
        },
        campSite: { findUnique: vi.fn().mockResolvedValue(campSiteFixture) },
        blockedDate: { findFirst: vi.fn().mockResolvedValue(null) },
        internalHold: { findMany: vi.fn().mockResolvedValue([]) },
        // CAM-355 (ADR-009): a useSpotView camp's daily-capacity check derives
        // its effective ceiling by summing live spots inside the SAME tx —
        // needed here since the fixture below is useSpotView: true.
        spot: { findMany: vi.fn().mockResolvedValue((campSiteFixture.spots as unknown[]) ?? []) },
      })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    session: { user: { id: USER_ID, email: 'camper@campvibe.com', name: 'Camper' } },
  });
});

describe('POST /api/bookings — a booking records the SELECTED pitch, priced by its own row (CAM-666)', () => {
  it('[normal][ac] a ฿400 PER_SITE pitch, 1 night -> totalPrice 400 AND spotId is that pitch (preview vs recorded parity)', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite(), captured);

    const res = await POST(makePostRequest({ spotId: SPOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(400);
    expect(body.spotId).toBe(SPOT_ID);
    expect(captured.data?.spotId).toBe(SPOT_ID);
    expect(captured.data?.totalPrice).toBe(400);
    expect(captured.data?.snapshotSpotName).toBe('A1');
  });

  it('[normal][ac] a PER_PERSON pitch at ฿500, 3 guests, 1 night -> totalPrice 1500, snapshot quantity 3', async () => {
    const captured: Captured = {};
    mockTransaction(
      baseCampSite({
        spots: [{ id: SPOT_ID, name: 'B2', pricePerNight: 500, priceUnit: 'PER_PERSON', maxCampers: 4, maxTents: 2 }],
      }),
      captured
    );

    const res = await POST(makePostRequest({ spotId: SPOT_ID, guests: 3 }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(1500);
    expect(captured.data?.snapshotPricingUnit).toBe('PER_PERSON');
    expect(captured.data?.snapshotQuantity).toBe(3);
  });

  it('[regression][golden] a normal camp (no spotId sent) books EXACTLY as before — hard-coded total, unaffected by this story', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite({ useSpotView: false, spots: [] }), captured);

    const res = await POST(makePostRequest({ guests: 5 })); // no spotId
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.totalPrice).toBe(250); // campSite.priceLow, PER_SITE ignores guests — fixed golden number
    expect(captured.data?.spotId).toBeUndefined();
  });

  it('[error/validation][ec] a pitch unavailable for the chosen dates (already booked) -> 409, no Booking row created', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite(), captured, /* spotOverlap */ true);

    const res = await POST(makePostRequest({ spotId: SPOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Dates not available');
    expect(captured.data).toBeUndefined();
  });

  it('[error/validation][ec, CAM-668] a spotId that does not belong to this camp is rejected 400, never silently priced off the camp', async () => {
    const captured: Captured = {};
    mockTransaction(baseCampSite(), captured);

    const res = await POST(makePostRequest({ spotId: OTHER_SPOT_ID }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid spotId parameter');
    expect(captured.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// i18n — locales/translations.json (both en + th), new CAM-666 keys.
// ---------------------------------------------------------------------------
describe('i18n: booking.priceFromPrefix / selectPitchToSeePrice / spotUnavailableForStay (CAM-666)', () => {
  it('[normal] all three keys exist with non-empty strings in en + th', () => {
    for (const lang of ['en', 'th'] as const) {
      expect(typeof translations[lang].booking.priceFromPrefix).toBe('string');
      expect(translations[lang].booking.priceFromPrefix.length).toBeGreaterThan(0);
      expect(typeof translations[lang].booking.selectPitchToSeePrice).toBe('string');
      expect(translations[lang].booking.selectPitchToSeePrice.length).toBeGreaterThan(0);
      expect(typeof translations[lang].booking.spotUnavailableForStay).toBe('string');
      expect(translations[lang].booking.spotUnavailableForStay.length).toBeGreaterThan(0);
    }
  });

  it('[i18n rule] no em-dash (—) and no jargon in the new Thai copy', () => {
    const th = translations.th.booking;
    for (const key of ['priceFromPrefix', 'selectPitchToSeePrice', 'spotUnavailableForStay'] as const) {
      expect(th[key]).not.toContain('—');
      expect(th[key]).not.toMatch(/API|endpoint|webhook/i);
    }
  });

  it('[AC] th.selectPitchToSeePrice is verbatim the intended Thai copy', () => {
    expect(translations.th.booking.selectPitchToSeePrice).toBe('เลือกจุดกางเต็นท์เพื่อดูราคาและจอง');
  });

  it('[AC] th.spotUnavailableForStay is verbatim the intended Thai copy', () => {
    expect(translations.th.booking.spotUnavailableForStay).toBe('จุดนี้ไม่ว่างในวันที่เลือก กรุณาเลือกจุดอื่นหรือเปลี่ยนวันที่');
  });
});
