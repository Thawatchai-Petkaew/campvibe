/**
 * cam-564-api-client-matched-tag.test.ts — CAM-564 wire contract.
 *
 * `AiChatCardResponse.matchedTag` (lib/api-client.ts) is additive per api.md
 * rule 12 (backward-compatible by addition) — mirrors the exact coverage
 * shape `cam-427-api-client-card-fields.test.ts` already used for `options`/
 * `hasReviews`/`remaining` when THOSE fields were added.
 *
 * Coverage matrix:
 *   - normal: a card carrying a well-formed matchedTag passes
 *   - normal: matchedTag: null (no supplied filter matched) is well-formed
 *   - null/empty: a card with no matchedTag key at all (older/unaware body)
 *     still passes — absence is fine, the field is optional
 *   - error/validation: a malformed matchedTag (missing nameEn) fails the guard
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

describe('isAiChatCardResponse — CAM-564 matchedTag (normal)', () => {
  it('[normal] a well-formed matchedTag passes', () => {
    const card = baseCard({ matchedTag: { nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' } });
    expect(isAiChatCardResponse(card)).toBe(true);
  });

  it('[normal] matchedTag: null (no supplied filter matched this card) is well-formed', () => {
    const card = baseCard({ matchedTag: null });
    expect(isAiChatCardResponse(card)).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-564 matchedTag (null/empty, backward-compatible)', () => {
  it('[null/empty] a card with no matchedTag key at all (older/unaware body) still passes', () => {
    expect(isAiChatCardResponse(baseCard())).toBe(true);
  });
});

describe('isAiChatCardResponse — CAM-564 matchedTag (error/validation)', () => {
  it('[error] a malformed matchedTag (missing nameEn) fails the guard', () => {
    const card = baseCard({ matchedTag: { nameTh: 'แม่น้ำ' } as unknown as AiChatCardResponse['matchedTag'] });
    expect(isAiChatCardResponse(card)).toBe(false);
  });

  it('[error] a non-object, non-null matchedTag fails the guard', () => {
    const card = baseCard({ matchedTag: 'RIVE' as unknown as AiChatCardResponse['matchedTag'] });
    expect(isAiChatCardResponse(card)).toBe(false);
  });
});

describe('parseAiChatSuccessBody — end-to-end with matchedTag present', () => {
  it('[normal] a full 200 body carrying matchedTag resolves to kind:"ok" and keeps the card\'s value', () => {
    const body = {
      answer: 'พบแคมป์ริมน้ำ 1 แห่ง',
      cards: [baseCard({ matchedTag: { nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' } })],
    };

    const outcome = parseAiChatSuccessBody(body);
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') {
      expect(outcome.cards).toHaveLength(1);
      expect(outcome.cards[0].matchedTag).toEqual({ nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' });
    }
  });
});
