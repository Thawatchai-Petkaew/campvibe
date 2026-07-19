/**
 * cam-427-api-client-card-fields.test.ts — CAM-427 (Part 1/4 wire contract):
 * `isAiChatCardResponse` accepts the new additive fields (`options`,
 * `hasReviews`, `remaining`) per api.md rule 12 (backward-compatible by
 * addition) and no longer silently drops a card over a null province (G8).
 *
 * Coverage matrix:
 *   - normal: a card with all three new fields present + well-formed passes
 *   - null/empty: a card with NONE of the new fields (older/unaware body)
 *     still passes — absence is fine, additive fields are optional
 *   - error/validation: a malformed `options` entry (missing nameEn) or a
 *     non-boolean `hasReviews` fails the guard (defense-in-depth, CAM-305)
 *   - regression (G8): a card whose `location.province` is `''` (the
 *     server-side coercion for a null DB value, see toAiCampCard) still
 *     passes — it is NOT treated as malformed
 */
import { describe, it, expect } from 'vitest';
import { isAiChatCardResponse, parseAiChatSuccessBody, type AiChatCardResponse } from '@/lib/api-client';

function baseCard(overrides: Partial<AiChatCardResponse> = {}): unknown {
  return {
    id: 'c1',
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    nameThSlug: 'riverside-camp-th',
    nameEnSlug: 'riverside-camp-en',
    priceLow: 1500,
    createdAt: '2026-01-01T00:00:00.000Z',
    avgRating: 4.5,
    reviewCount: 12,
    location: { province: 'เชียงใหม่' },
    ...overrides,
  };
}

describe('isAiChatCardResponse — CAM-427 additive fields (normal)', () => {
  it('[normal] a card carrying options/hasReviews/remaining, all well-formed, passes', () => {
    const card = baseCard({
      options: [{ nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' }],
      hasReviews: true,
      remaining: 6,
    });
    expect(isAiChatCardResponse(card)).toBe(true);
  });

  it('[normal] remaining: null (unknown, no date range requested) is well-formed', () => {
    const card = baseCard({ remaining: null });
    expect(isAiChatCardResponse(card)).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-427 additive fields (null/empty, backward-compatible)', () => {
  it('[null/empty] a card with none of the new keys still passes (api.md rule 12)', () => {
    expect(isAiChatCardResponse(baseCard())).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-427 additive fields (error/validation)', () => {
  it('[error] a malformed options entry (missing nameEn) fails the guard', () => {
    const card = baseCard({ options: [{ nameTh: 'แม่น้ำ' }] as unknown as AiChatCardResponse['options'] });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-boolean hasReviews fails the guard', () => {
    const card = baseCard({ hasReviews: 'yes' as unknown as boolean });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-number, non-null remaining fails the guard', () => {
    const card = baseCard({ remaining: 'lots' as unknown as number });
    expect(isAiChatCardResponse(card)).toBe(false);
  });
});

describe('isAiChatCardResponse — G8 regression (server-coerced empty province)', () => {
  it('[regression] location.province === "" (server-side null-coercion) is accepted, not treated as malformed', () => {
    const card = baseCard({ location: { province: '' } });
    expect(isAiChatCardResponse(card)).toBe(true);
  });
});

describe('parseAiChatSuccessBody — end-to-end with the new fields present', () => {
  it('[normal] a full 200 body with the CAM-427 fields resolves to kind:"ok" and keeps the card', () => {
    const body = {
      answer: 'พบแคมป์ริมน้ำ 1 แห่ง',
      cards: [
        baseCard({
          options: [{ nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' }],
          hasReviews: true,
          remaining: 6,
        }),
      ],
    };

    const outcome = parseAiChatSuccessBody(body);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.cards).toHaveLength(1);
      expect(outcome.cards[0].remaining).toBe(6);
      expect(outcome.cards[0].hasReviews).toBe(true);
    }
  });
});
