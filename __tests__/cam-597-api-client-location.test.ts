/**
 * cam-597-api-client-location.test.ts — CAM-597
 *
 * `isAiChatCardResponse` accepts the new additive `location` fields
 * (`provinceTh`/`provinceEn`/`district`/`districtTh`/`districtEn`/
 * `subDistrictTh`/`subDistrictEn`) per api.md rule 12 (backward-compatible
 * by addition) — an older/unaware wire body (before this story) still
 * validates.
 *
 * Coverage matrix:
 *   normal      — a card with every new location field present, well-formed
 *   null/empty  — a card with NONE of the new location fields (older body)
 *                 still passes
 *   error/validation — a malformed field (wrong type) fails the guard
 */
import { describe, it, expect } from 'vitest';
import { isAiChatCardResponse, type AiChatCardResponse } from '@/lib/api-client';

function baseCard(locationOverrides: Partial<AiChatCardResponse['location']> = {}): unknown {
  return {
    id: 'c1',
    nameTh: 'ลานกางเต็นท์โคราช',
    nameEn: 'Korat Camp',
    nameThSlug: 'korat-camp-th',
    nameEnSlug: 'korat-camp-en',
    priceLow: 800,
    createdAt: '2026-01-01T00:00:00.000Z',
    avgRating: null,
    reviewCount: 0,
    location: { province: 'Nakhon Ratchasima', ...locationOverrides },
  };
}

describe('isAiChatCardResponse — CAM-597 additive location fields (normal)', () => {
  it('[normal] a card carrying every new location field, all well-formed, passes', () => {
    const card = baseCard({
      provinceTh: 'นครราชสีมา',
      provinceEn: 'Nakhon Ratchasima',
      district: 'Mueang Nakhon Ratchasima',
      districtTh: 'เมืองนครราชสีมา',
      districtEn: 'Mueang Nakhon Ratchasima',
      subDistrictTh: 'ในเมือง',
      subDistrictEn: 'Nai Mueang',
    });
    expect(isAiChatCardResponse(card)).toBe(true);
  });

  it('[normal] district: null (no free-text fallback available) is well-formed', () => {
    expect(isAiChatCardResponse(baseCard({ district: null }))).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-597 additive location fields (null/empty, backward-compatible)', () => {
  it('[null/empty] a card with none of the new location keys still passes (api.md rule 12)', () => {
    expect(isAiChatCardResponse(baseCard())).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-597 additive location fields (error/validation)', () => {
  it('[error] a non-string provinceTh fails the guard', () => {
    const card = baseCard({ provinceTh: 42 as unknown as string });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-string, non-null district fails the guard', () => {
    const card = baseCard({ district: 42 as unknown as string });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-string districtEn fails the guard', () => {
    const card = baseCard({ districtEn: true as unknown as string });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-string subDistrictTh fails the guard', () => {
    const card = baseCard({ subDistrictTh: [] as unknown as string });
    expect(isAiChatCardResponse(card)).toBe(false);
  });
});
