/**
 * cam-619-taxonomy-array-caps.test.ts — CAM-619 AC-3/BR-3
 *
 * Every taxonomy array on the host write path (`lib/validations/campsite.ts`)
 * is now capped — was fully uncapped before (a client could send an
 * arbitrarily long array straight into `resolveOptionConnect`'s
 * `code: { in: [...] } }` Prisma query, the exact CAM-344 "cap a
 * client-controlled array length before the query" class already closed on
 * the AI input branch). Each bound is the MasterData group's live-DB row
 * count (or, for images/tags, a real-usage ceiling) — asserted at the exact
 * boundary (cap = accepted, cap+1 = rejected), not an invented round number.
 */
import { describe, it, expect } from 'vitest';
import {
  campSiteSchema,
  MAX_ACCESS_TYPES,
  MAX_ACCOMMODATION_TYPES,
  MAX_FACILITIES,
  MAX_EXTERNAL_FACILITIES,
  MAX_EQUIPMENT,
  MAX_ACTIVITIES,
  MAX_TERRAIN,
  MAX_ANNOTATED_FEATURES,
  MAX_CAMPER_STYLE,
  MAX_STAY_CONNECTED,
  MAX_MARKING_METHOD,
  MAX_DRIVEWAY,
  MAX_CAMPSITE_IMAGES,
  MAX_CAMPSITE_TAGS,
} from '@/lib/validations/campsite';

/** A generic string array of length n — good enough for the array-LENGTH cap; per-code validity is resolveOptionConnect's job, not this schema's. */
function arrayOf(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `CODE${i}`);
}

// A representative MasterData-group-array field is enough to prove the
// shape works; every field below is asserted individually for the exact
// bound the ticket names (facilities/activities/terrain by name, "six more").
describe('campSiteSchema — taxonomy array caps (CAM-619 BR-3)', () => {
  const cases: Array<[string, number]> = [
    ['facilities', MAX_FACILITIES],
    ['externalFacilities', MAX_EXTERNAL_FACILITIES],
    ['equipment', MAX_EQUIPMENT],
    ['activities', MAX_ACTIVITIES],
    ['terrain', MAX_TERRAIN],
    ['annotatedFeatures', MAX_ANNOTATED_FEATURES],
    ['camperStyle', MAX_CAMPER_STYLE],
    ['stayConnected', MAX_STAY_CONNECTED],
    ['markingMethod', MAX_MARKING_METHOD],
    ['driveway', MAX_DRIVEWAY],
  ];

  it.each(cases)('[boundary] %s accepts exactly its cap (%i)', (field, cap) => {
    const result = campSiteSchema.partial().safeParse({ [field]: arrayOf(cap) });
    expect(result.success).toBe(true);
  });

  it.each(cases)('[error/validation, teeth] %s REJECTS cap+1 (%i+1) — was fully uncapped before', (field, cap) => {
    const result = campSiteSchema.partial().safeParse({ [field]: arrayOf(cap + 1) });
    expect(result.success).toBe(false);
  });

  it('[boundary] accessTypes (enum-restricted) rejects more entries than MAX_ACCESS_TYPES', () => {
    const overCap = Array.from({ length: MAX_ACCESS_TYPES + 1 }, (_, i) => (['BAOT', 'DRIV', 'HIKE', 'WALK'][i % 4]));
    const result = campSiteSchema.partial().safeParse({ accessTypes: overCap });
    expect(result.success).toBe(false);
  });

  it('[boundary] accommodationTypes (enum-restricted) rejects more entries than MAX_ACCOMMODATION_TYPES', () => {
    const overCap = Array.from({ length: MAX_ACCOMMODATION_TYPES + 1 }, (_, i) => (['CABI', 'DISP', 'GROU', 'RECR', 'TSIT'][i % 5]));
    const result = campSiteSchema.partial().safeParse({ accommodationTypes: overCap });
    expect(result.success).toBe(false);
  });

  it('[normal] a real-world-sized array (well under any cap) still passes', () => {
    const result = campSiteSchema.partial().safeParse({ facilities: arrayOf(5), activities: arrayOf(3), terrain: arrayOf(2) });
    expect(result.success).toBe(true);
  });
});

describe('campSiteSchema.images — CAM-619 BR-3 (real-usage ceiling, not MasterData-backed)', () => {
  function imagesOf(n: number) {
    return Array.from({ length: n }, (_, i) => `https://example.com/img${i}.jpg`);
  }

  it('[boundary] exactly MAX_CAMPSITE_IMAGES is accepted', () => {
    const result = campSiteSchema.partial().safeParse({ images: imagesOf(MAX_CAMPSITE_IMAGES) });
    expect(result.success).toBe(true);
  });

  it('[error/validation, teeth] MAX_CAMPSITE_IMAGES+1 is REJECTED (was fully uncapped before)', () => {
    const result = campSiteSchema.partial().safeParse({ images: imagesOf(MAX_CAMPSITE_IMAGES + 1) });
    expect(result.success).toBe(false);
  });

  it('[normal] the real observed max (30, live DB, 2026-07-28) still passes comfortably', () => {
    const result = campSiteSchema.partial().safeParse({ images: imagesOf(30) });
    expect(result.success).toBe(true);
  });
});

describe('campSiteSchema.tags — CAM-619 BR-3 (real-usage ceiling, free-text CSV)', () => {
  it('[boundary] exactly MAX_CAMPSITE_TAGS is accepted', () => {
    const result = campSiteSchema.partial().safeParse({ tags: arrayOf(MAX_CAMPSITE_TAGS) });
    expect(result.success).toBe(true);
  });

  it('[error/validation, teeth] MAX_CAMPSITE_TAGS+1 is REJECTED (was fully uncapped before)', () => {
    const result = campSiteSchema.partial().safeParse({ tags: arrayOf(MAX_CAMPSITE_TAGS + 1) });
    expect(result.success).toBe(false);
  });

  it('[normal] the real observed max (4, live DB, 2026-07-28) still passes comfortably', () => {
    const result = campSiteSchema.partial().safeParse({ tags: arrayOf(4) });
    expect(result.success).toBe(true);
  });
});
