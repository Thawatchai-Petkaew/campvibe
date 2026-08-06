/**
 * cam-446-api-client-camp-detail.test.ts — CAM-446: `aiChatAPI.getCampDetail`
 * (lib/api-client.ts), the client facade for GET /api/ai/camp-detail/[id].
 *
 * All fetch calls are mocked (vi.stubGlobal, mirrors
 * __tests__/cam-412-api-client-streaming.test.ts) — never a real endpoint.
 *
 * Coverage matrix:
 *   - normal: a valid 200 body narrows into the `ok:true` GetCampDetailResult
 *   - null/empty: a 404 body ({ok:false, code:'not_found'}) passes through
 *   - error/validation: an off-contract 200 body (missing/wrong-typed field)
 *     is REJECTED by runtime narrowing, never blindly cast (code.md CAM-305)
 *   - error/validation: a non-2xx status (400/429/500) collapses to
 *     {ok:false, code:'not_found'} — this facade's return type has no other
 *     failure variant
 *   - error/validation: a network exception (fetch throws) also resolves to
 *     {ok:false, code:'not_found'}, never throws to the caller
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiChatAPI } from '@/lib/api-client';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function fullOkBody() {
  return {
    ok: true,
    id: VALID_UUID,
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    description: 'ลานกางเต็นท์ริมแม่น้ำ วิวสวย',
    // CAM-700 additive field.
    useSpotView: false,
    amenities: [
      { code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek', icon: 'Waves' },
    ],
    reviews: [{ name: 'สมชาย', rating: 5, content: 'ดีมาก', createdAt: '2026-01-01T00:00:00.000Z' }],
    reviewSummary: { hasReviews: true, avgRating: 4.5, count: 12 },
    // CAM-449 fields:
    price: {
      low: 500,
      high: 1200,
      currency: 'THB',
      extraFeeAmount: 50,
      extraFeeLabel: 'ค่าเข้าอุทยาน',
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
    directions: 'เลี้ยวขวาที่ทางแยกที่สอง',
    distanceFromBangkokKm: 580.2,
    availableWeekendDates: ['2026-07-25', '2026-08-01'],
    weekendAvailability: [
      { date: '2026-07-25', remaining: 15, blockedByHost: false },
      { date: '2026-08-01', remaining: null, blockedByHost: false },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('aiChatAPI.getCampDetail — normal', () => {
  it('[normal] a well-formed 200 body narrows into the ok:true GetCampDetailResult, fetched from the right path', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(fullOkBody()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual(fullOkBody());
    expect(fetchMock).toHaveBeenCalledWith(`/api/ai/camp-detail/${VALID_UUID}`);
  });
});

describe('aiChatAPI.getCampDetail — null/empty + error/validation', () => {
  it('[null/empty] a 404 { ok:false, code:"not_found" } body passes through unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: false, code: 'not_found' }, 404)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] an off-contract 200 body (missing reviewSummary) is REJECTED by runtime narrowing, never blindly trusted', async () => {
    const malformed = { ...fullOkBody(), reviewSummary: undefined };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] a wrong-typed amenities[] entry (nameEn missing) is REJECTED, never crashes', async () => {
    const malformed = {
      ...fullOkBody(),
      amenities: [{ code: 'RIVE', group: 'Terrain', nameTh: 'แม่น้ำ' }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(malformed)));

    const result = await aiChatAPI.getCampDetail(VALID_UUID);

    expect(result).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] a 429/500 non-2xx status collapses to {ok:false, code:"not_found"}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'rate_limited' }, 429)));
    expect(await aiChatAPI.getCampDetail(VALID_UUID)).toEqual({ ok: false, code: 'not_found' });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'internal_error' }, 500)));
    expect(await aiChatAPI.getCampDetail(VALID_UUID)).toEqual({ ok: false, code: 'not_found' });
  });

  it('[error/validation] a network exception (fetch throws) resolves to {ok:false, code:"not_found"}, never throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    await expect(aiChatAPI.getCampDetail(VALID_UUID)).resolves.toEqual({
      ok: false,
      code: 'not_found',
    });
  });
});
