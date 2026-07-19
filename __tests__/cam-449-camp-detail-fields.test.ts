/**
 * cam-449-camp-detail-fields.test.ts — CAM-449 (S5 enrichment): extends
 * lib/ai/tools/get-camp-detail.ts + lib/geo/distance.ts + lib/api-client.ts
 * with more guest-safe, DECISION-relevant fields for the in-chat detail card.
 *
 * Coverage matrix:
 *   - normal: new fields present on the wire + Decimal (priceLow/priceHigh/
 *     extraFeeAmount) serialized to plain numbers
 *   - normal: `weekendAvailability` — a date with remaining>0, a date with
 *     remaining=null (uncapped camp), a full date (remaining 0)
 *   - normal: `availableWeekendDates` (legacy) still returned unchanged
 *     alongside the new `weekendAvailability` (back-compat)
 *   - security/PDPA: the full serialized result carries no operator/contact/
 *     phone/email/line/facebook/tiktok/kyc/payout field anywhere
 *   - unit: lib/geo/distance haversine — a known-pair sane value + null when
 *     either coordinate is missing/non-finite
 *   - error/validation: aiChatAPI.getCampDetail narrows the new fields on a
 *     well-formed body, and rejects an off-contract body (wrong-typed new
 *     field) — never a blind cast (code.md CAM-305)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { haversineDistanceKm, distanceFromBangkokKm, BANGKOK_ORIGIN } from '@/lib/geo/distance';

const mockFindFirst = vi.fn();
const mockGetCampSiteDailyAvailability = vi.fn();
const mockGetEffectiveCapacity = vi.fn();
const mockGetRemainingCapacityForCamps = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock('@/lib/campsite-availability', () => ({
  getCampSiteDailyAvailability: (...args: unknown[]) => mockGetCampSiteDailyAvailability(...args),
  getEffectiveCapacity: (...args: unknown[]) => mockGetEffectiveCapacity(...args),
  getRemainingCapacityForCamps: (...args: unknown[]) => mockGetRemainingCapacityForCamps(...args),
}));

const { executeGetCampDetail } = await import('@/lib/ai/tools/get-camp-detail');
const { aiChatAPI } = await import('@/lib/api-client');

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function decimal(n: number) {
  return { toNumber: () => n };
}

function fullCampSite(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    description: 'ลานกางเต็นท์ริมแม่น้ำ วิวสวย',
    useSpotView: false,
    maxGuestsPerDay: 20,
    maxTentsPerDay: 10,
    avgRating: null,
    reviewCount: 0,
    priceLow: decimal(500),
    priceHigh: decimal(1200),
    priceCurrency: 'THB',
    extraFeeAmount: decimal(50),
    extraFeeLabel: 'ค่าเข้าอุทยาน',
    feeInfo: null,
    isFree: false,
    cancellationPolicy: 'MODERATE',
    isVerified: true,
    checkInTime: '13:00',
    checkOutTime: '11:00',
    minimumAge: null,
    directions: 'เลี้ยวขวาที่ทางแยกที่สอง',
    latitude: 18.7904,
    longitude: 98.9847,
    location: { province: 'Chiang Mai', region: 'North' },
    options: [],
    reviews: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCampSiteDailyAvailability.mockResolvedValue({});
  mockGetEffectiveCapacity.mockResolvedValue({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });
  mockGetRemainingCapacityForCamps.mockResolvedValue({
    [VALID_UUID]: { capacity: 20, bookedGuests: 0, heldGuests: 0, remaining: 20, blockedByHost: false },
  });
});

describe('getCampDetail — CAM-449 new fields (normal + Decimal serialization)', () => {
  it('[normal] price/capacity/policy/verified/checkIn-Out/location/directions/description are present, Decimals serialized to plain numbers', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.description).toBe('ลานกางเต็นท์ริมแม่น้ำ วิวสวย');
    expect(result.price).toEqual({
      low: 500,
      high: 1200,
      currency: 'THB',
      extraFeeAmount: 50,
      extraFeeLabel: 'ค่าเข้าอุทยาน',
      feeInfo: null,
      isFree: false,
    });
    expect(typeof result.price.low).toBe('number');
    expect(result.capacity).toEqual({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });
    expect(result.cancellationPolicy).toBe('MODERATE');
    expect(result.isVerified).toBe(true);
    expect(result.checkInTime).toBe('13:00');
    expect(result.checkOutTime).toBe('11:00');
    expect(result.minimumAge).toBeNull();
    expect(result.location).toEqual({ province: 'Chiang Mai', region: 'North' });
    expect(result.directions).toBe('เลี้ยวขวาที่ทางแยกที่สอง');
  });

  it('[null/empty] null Decimal fields (priceLow/priceHigh/extraFeeAmount unset) serialize to null, not a crash', async () => {
    mockFindFirst.mockResolvedValueOnce(
      fullCampSite({ priceLow: null, priceHigh: null, extraFeeAmount: null, extraFeeLabel: null, cancellationPolicy: null })
    );

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.price.low).toBeNull();
    expect(result.price.high).toBeNull();
    expect(result.price.extraFeeAmount).toBeNull();
    expect(result.cancellationPolicy).toBeNull();
  });

  it('[normal] distanceFromBangkokKm is a real number when lat/lng are present; null when a coord is missing', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());
    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.distanceFromBangkokKm).not.toBeNull();
    expect(result.distanceFromBangkokKm).toBeGreaterThan(500);
    expect(result.distanceFromBangkokKm).toBeLessThan(700);
  });

  it('[Prove-It / boundary] a PER-SPOT camp (useSpotView:true, raw columns null) reports EFFECTIVE (spot-derived) capacity, not {null,null}', async () => {
    // Bug (G3 finding): `capacity` was built straight from the raw
    // CampSite.maxGuestsPerDay/maxTentsPerDay columns. For a useSpotView:true
    // camp those columns are null (capacity lives on its Spot rows instead) —
    // the same forked-data-path class as CAM-355/CAM-400. This case pins the
    // fix: `capacity` must come from getEffectiveCapacity (mocked here to
    // return the spot-derived sum), the SAME canonical source
    // `weekendAvailability` already uses via getRemainingCapacityForCamps —
    // never the raw columns directly.
    mockFindFirst.mockResolvedValueOnce(
      fullCampSite({ useSpotView: true, maxGuestsPerDay: null, maxTentsPerDay: null })
    );
    mockGetEffectiveCapacity.mockResolvedValueOnce({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The raw-column bug would have returned { maxGuestsPerDay: null, maxTentsPerDay: null } here.
    expect(result.capacity).toEqual({ maxGuestsPerDay: 20, maxTentsPerDay: 10 });
    // getEffectiveCapacity is called with the useSpotView:true campSite (so it takes the spot-sum path).
    expect(mockGetEffectiveCapacity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ useSpotView: true })
    );
    // Exactly ONE getEffectiveCapacity call for the whole request (no forked second read for `capacity`).
    expect(mockGetEffectiveCapacity).toHaveBeenCalledTimes(1);
  });
});

describe('getCampDetail — CAM-449 weekendAvailability (normal)', () => {
  it('[normal] a date with remaining>0, a date with remaining=null (uncapped), and a full date (remaining 0) are each reported correctly', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());

    mockGetRemainingCapacityForCamps
      .mockImplementationOnce(async () => ({
        [VALID_UUID]: { capacity: 20, bookedGuests: 5, heldGuests: 0, remaining: 15, blockedByHost: false },
      }))
      .mockImplementationOnce(async () => ({
        [VALID_UUID]: { capacity: null, bookedGuests: 0, heldGuests: 0, remaining: null, blockedByHost: false },
      }))
      .mockImplementationOnce(async () => ({
        [VALID_UUID]: { capacity: 10, bookedGuests: 10, heldGuests: 0, remaining: 0, blockedByHost: false },
      }));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weekendAvailability.length).toBeGreaterThanOrEqual(3);
    expect(result.weekendAvailability[0]).toMatchObject({ remaining: 15, blockedByHost: false });
    expect(result.weekendAvailability[1]).toMatchObject({ remaining: null, blockedByHost: false });
    expect(result.weekendAvailability[2]).toMatchObject({ remaining: 0, blockedByHost: false });
    // Every entry has a real ISO date key.
    for (const entry of result.weekendAvailability) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('[boundary] a host-blocked weekend date reports remaining:0 + blockedByHost:true', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());
    mockGetRemainingCapacityForCamps.mockImplementationOnce(async () => ({
      [VALID_UUID]: { capacity: 20, bookedGuests: 0, heldGuests: 0, remaining: 0, blockedByHost: true },
    }));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weekendAvailability[0]).toMatchObject({ remaining: 0, blockedByHost: true });
  });

  it('[null/empty] a campId absent from the batched result (edge) falls back to remaining:null, blockedByHost:false', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());
    mockGetRemainingCapacityForCamps.mockImplementationOnce(async () => ({}));

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.weekendAvailability[0]).toMatchObject({ remaining: null, blockedByHost: false });
  });
});

describe('getCampDetail — back-compat (availableWeekendDates unchanged)', () => {
  it('[normal] availableWeekendDates is still returned alongside the new weekendAvailability, unaffected', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.isArray(result.availableWeekendDates)).toBe(true);
    expect(result.availableWeekendDates.length).toBeGreaterThan(0);
    expect(Array.isArray(result.weekendAvailability)).toBe(true);
  });
});

describe('getCampDetail — CAM-449 PDPA (security)', () => {
  it('[security] the full serialized result carries no operator/contact/phone/email/line/facebook/tiktok/kyc/payout field', async () => {
    mockFindFirst.mockResolvedValueOnce(fullCampSite());

    const result = await executeGetCampDetail({ campSiteId: VALID_UUID });
    const serialized = JSON.stringify(result).toLowerCase();

    // NOTE: bare 'host' is intentionally excluded — `blockedByHost` is a
    // legitimate boolean, not a host-contact leak (see cam-446-camp-detail-
    // route.test.ts for the same rationale).
    for (const forbidden of ['operator', 'phone', 'email', 'line', 'contact', 'facebook', 'tiktok', 'kyc', 'payout']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe('lib/geo/distance — unit', () => {
  it('[normal] haversine returns a sane value for a known pair (1 degree of longitude at the equator ≈ 111.2km)', () => {
    const km = haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('[boundary] the same point is 0km', () => {
    expect(haversineDistanceKm(BANGKOK_ORIGIN, BANGKOK_ORIGIN)).toBe(0);
  });

  it('[null/empty] distanceFromBangkokKm returns null when lat, lng, or both are missing/non-finite', () => {
    expect(distanceFromBangkokKm(null, 100.5)).toBeNull();
    expect(distanceFromBangkokKm(13.7, null)).toBeNull();
    expect(distanceFromBangkokKm(undefined, undefined)).toBeNull();
    expect(distanceFromBangkokKm(NaN, 100.5)).toBeNull();
  });

  it('[normal] distanceFromBangkokKm(Chiang Mai) is a sane real-world value (~500-700km)', () => {
    const km = distanceFromBangkokKm(18.7904, 98.9847);
    expect(km).not.toBeNull();
    expect(km as number).toBeGreaterThan(500);
    expect(km as number).toBeLessThan(700);
  });
});

describe('aiChatAPI.getCampDetail — CAM-449 narrows the new fields', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function fullWireBody() {
    return {
      ok: true,
      id: VALID_UUID,
      nameTh: 'ลานกางเต็นท์ริมน้ำ',
      nameEn: 'Riverside Camp',
      description: 'ลานกางเต็นท์ริมแม่น้ำ วิวสวย',
      amenities: [],
      reviews: [],
      reviewSummary: { hasReviews: false, avgRating: null, count: 0 },
      price: {
        low: 500,
        high: 1200,
        currency: 'THB',
        extraFeeAmount: null,
        extraFeeLabel: null,
        feeInfo: null,
        isFree: false,
      },
      capacity: { maxGuestsPerDay: 20, maxTentsPerDay: 10 },
      cancellationPolicy: 'MODERATE',
      isVerified: true,
      checkInTime: '13:00',
      checkOutTime: '11:00',
      minimumAge: null,
      location: { province: 'Chiang Mai', region: 'North' },
      directions: null,
      distanceFromBangkokKm: 582.7,
      availableWeekendDates: ['2026-07-25'],
      weekendAvailability: [{ date: '2026-07-25', remaining: 15, blockedByHost: false }],
    };
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }

  it('[normal] a well-formed body carrying every CAM-449 field narrows into ok:true unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(fullWireBody())));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual(fullWireBody());
  });

  it('[error/validation] a wrong-typed weekendAvailability entry (remaining as a string) is REJECTED, never crashes', async () => {
    const malformed = {
      ...fullWireBody(),
      weekendAvailability: [{ date: '2026-07-25', remaining: 'fifteen', blockedByHost: false }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] a missing `price` group is REJECTED, never crashes', async () => {
    const malformed = { ...fullWireBody(), price: undefined };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] an invalid cancellationPolicy value (not one of the four closed enum values) is REJECTED', async () => {
    const malformed = { ...fullWireBody(), cancellationPolicy: 'SOMETHING_MADE_UP' };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });
});
