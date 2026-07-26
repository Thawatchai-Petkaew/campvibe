/**
 * cam-427-ai-camp-card.test.ts — CAM-427 (Part 1: dedicated AI card read-model)
 *
 * Coverage matrix:
 *   - normal: aiCampCardSelect extends campCardSelect (every shared field
 *     present) + adds a bounded `options` (Terrain group, take 1)
 *   - normal: toAiCampCard carries price/first-tag/avgRating/reviewCount through
 *   - null/empty: reviewCount 0 → hasReviews false (G7); reviewCount > 0 → true
 *   - null/empty: a null Location.province is coerced to '' (G8) — never thrown,
 *     never silently drops the card downstream
 *   - regression guard: the shared campCardSelect object itself is untouched
 *     (reference-checked: every existing key still present, same value)
 */
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { campCardSelect } from '@/lib/read-models/camp-card';
import { aiCampCardSelect, toAiCampCard, type AiCampCardPayload } from '@/lib/read-models/ai-camp-card';

describe('aiCampCardSelect — extends, never regresses, campCardSelect', () => {
  it('[normal] every campCardSelect key is present and unchanged on aiCampCardSelect', () => {
    for (const key of Object.keys(campCardSelect)) {
      expect(aiCampCardSelect).toHaveProperty(key);
      expect((aiCampCardSelect as Record<string, unknown>)[key]).toEqual(
        (campCardSelect as Record<string, unknown>)[key]
      );
    }
  });

  it('[regression] campCardSelect itself is not mutated (other consumers, e.g. getDefaultCatalog, are unaffected)', () => {
    expect(campCardSelect).not.toHaveProperty('options');
  });

  it('[normal] adds a bounded, Terrain-only, single-row options select ("first tag")', () => {
    expect(aiCampCardSelect.options).toMatchObject({
      where: { group: 'Terrain' },
      take: 1,
    });
  });
});

function makeRow(overrides: Partial<AiCampCardPayload> = {}): AiCampCardPayload {
  return {
    id: 'c1',
    nameTh: 'ลานกางเต็นท์ริมน้ำ',
    nameEn: 'Riverside Camp',
    nameThSlug: 'riverside-camp-th',
    nameEnSlug: 'riverside-camp-en',
    priceLow: new Prisma.Decimal('1500.00'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avgRating: new Prisma.Decimal('4.5'),
    reviewCount: 12,
    location: { province: 'Chiang Mai' },
    images: [{ url: '/img/a.jpg', sortOrder: 0 }],
    options: [{ code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' }],
    ...overrides,
  } as AiCampCardPayload;
}

describe('toAiCampCard — normal', () => {
  it('[normal] carries price/first-tag/avgRating/reviewCount through unchanged', () => {
    const card = toAiCampCard(makeRow());

    expect(card.priceLow).toEqual(new Prisma.Decimal('1500.00'));
    expect(card.avgRating).toEqual(new Prisma.Decimal('4.5'));
    expect(card.reviewCount).toBe(12);
    expect(card.options).toEqual([{ code: 'RIVE', nameTh: 'แม่น้ำ ลำธาร คลองเล็ก', nameEn: 'River, stream, or creek' }]);
  });
});

describe('toAiCampCard — G7 null/empty rating handling', () => {
  it('[normal] reviewCount > 0 → hasReviews true', () => {
    const card = toAiCampCard(makeRow({ reviewCount: 12 }));
    expect(card.hasReviews).toBe(true);
  });

  it('[null/empty] reviewCount 0 (avgRating null) → hasReviews false', () => {
    const card = toAiCampCard(makeRow({ reviewCount: 0, avgRating: null }));
    expect(card.hasReviews).toBe(false);
  });

  it('[boundary] reviewCount 0 but a stale non-null avgRating still reads hasReviews false (count is canonical, not avg)', () => {
    const card = toAiCampCard(makeRow({ reviewCount: 0, avgRating: new Prisma.Decimal('3.0') }));
    expect(card.hasReviews).toBe(false);
  });
});

describe('toAiCampCard — G8 null province handling', () => {
  it('[null/empty] a null Location.province is coerced to \'\' — never throws, card is kept', () => {
    const row = makeRow({
      // CAM-545: campCardSelect now also selects location.thaiLocation, so
      // AiCampCardPayload['location'] requires that key too (present, nullable) —
      // unrelated to this test's own province-null concern, included so the
      // literal still type-checks against the (unchanged) real payload shape.
      location: { province: null, thaiLocation: null } as unknown as { province: string; thaiLocation: null },
    });
    expect(() => toAiCampCard(row)).not.toThrow();
    expect(toAiCampCard(row).location.province).toBe('');
  });

  it('[normal] a real province value passes through unchanged', () => {
    const card = toAiCampCard(makeRow({ location: { province: 'Rayong', thaiLocation: null } }));
    expect(card.location.province).toBe('Rayong');
  });

  it('[boundary] a missing location object on the row does not throw (defensive optional-chaining)', () => {
    const row = makeRow({ location: undefined as unknown as { province: string; thaiLocation: null } });
    expect(() => toAiCampCard(row)).not.toThrow();
    expect(toAiCampCard(row).location.province).toBe('');
  });
});
