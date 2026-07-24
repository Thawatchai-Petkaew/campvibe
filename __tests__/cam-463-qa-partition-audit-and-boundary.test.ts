/**
 * CAM-463 — independent QA verify: gap-fill tests.
 *
 * The existing cam-463 suite (42 tests) proves the region map is a
 * COMPLETE partition of the 77 seeded provinces (no dup, none missing,
 * correct per-region SIZE: 9/20/22/7/5/14) — but completeness/size alone
 * cannot catch a MISASSIGNMENT that swaps two ambiguous provinces between
 * regions while leaving both regions' size unchanged (e.g. accidentally
 * filing Prachuap Khiri Khan under SOUTH and Ranong under WEST would keep
 * WEST=5/SOUTH=14 and pass every existing test, yet silently return the
 * wrong camps for a real region ask).
 *
 * This file:
 *   1. Pins the exact region assignment for every genuinely AMBIGUOUS
 *      province (the "6-region ≠ tourism/4-region" quirks tech.md itself
 *      calls out, plus additional border provinces spot-audited against
 *      the standard NESDB/National Geographic Committee 6-region scheme)
 *      — regression-proof against a future silent reassignment.
 *   2. Closes the `region` arg's zod BOUNDARY coverage (empty / too-long /
 *      whitespace-only) — the sibling `province` arg has no dedicated
 *      schema-boundary test either, but BR-4/AC-6 make the `region` arg's
 *      empty-vs-unrecognized distinction load-bearing, so it is worth
 *      pinning explicitly.
 *   3. Deep non-breaking check: a single-province string call combined
 *      with several OTHER unrelated params (min/max/petFriendly/keyword)
 *      produces the exact pre-CAM-463 shape for all of them together, not
 *      just province in isolation.
 *
 * Independent verify note (province-assignment authority, this session):
 * no `region` column exists anywhere in the repo to cross-check against, so
 * the spot-audit below is corroborated two ways — (a) domain knowledge of
 * the standard Thai 6-region geography curriculum scheme, and (b) the
 * province's official Ministry-of-Interior numeric code block in
 * `prisma/data/thailand-locations.json` (NORTH=50-58, NORTHEAST=30-49,
 * SOUTH=80-86+90-96 are clean contiguous blocks that match the code
 * 1:1; the two well-documented exceptions — Nakhon Nayok routed to
 * CENTRAL despite sitting in the 20-27 "East" numeric block, and Tak
 * routed to WEST despite sitting in the 60-67 "lower-north/Central"
 * numeric block — are exactly the quirks the standard scheme is known
 * for, and both match the code). No misassignment found.
 */
import { describe, it, expect } from 'vitest';
import { REGION_TO_PROVINCES } from '@/lib/thai-regions';
import { searchCampsitesArgsSchema } from '@/lib/ai/tools/search-campsites';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

describe('REGION_TO_PROVINCES — ambiguous-province spot-audit (independent QA verify, CAM-463 BR-1)', () => {
  // [province, expected region, why it is ambiguous / the common wrong guess]
  const ambiguous: Array<[string, keyof typeof REGION_TO_PROVINCES, string]> = [
    ['Phetchabun', 'CENTRAL', 'often assumed NORTH (lower-north quirk)'],
    ['Tak', 'WEST', 'often assumed NORTH (borders Chiang Mai/Mae Hong Son)'],
    ['Nakhon Sawan', 'CENTRAL', 'lower-north quirk'],
    ['Uthai Thani', 'CENTRAL', 'lower-north quirk'],
    ['Kamphaeng Phet', 'CENTRAL', 'lower-north quirk'],
    ['Sukhothai', 'CENTRAL', 'lower-north quirk'],
    ['Phitsanulok', 'CENTRAL', 'lower-north quirk'],
    ['Phichit', 'CENTRAL', 'lower-north quirk'],
    ['Nakhon Nayok', 'CENTRAL', 'often assumed EAST (adjacent to the eastern-seaboard provinces)'],
    ['Prachuap Khiri Khan', 'WEST', 'often assumed SOUTH (peninsula isthmus)'],
    ['Sa Kaeo', 'EAST', 'often assumed NORTHEAST (Cambodia-border, landlocked like Isan)'],
    ['Trat', 'EAST', 'often assumed SOUTH (far down the gulf coast)'],
    ['Ranong', 'SOUTH', 'often assumed WEST (Myanmar-border, like the western provinces)'],
    ['Chumphon', 'SOUTH', 'North/South transition-zone province'],
    ['Nakhon Ratchasima', 'NORTHEAST', 'sanity pin — the largest, best-known Isan province'],
  ];

  it.each(ambiguous)('[unit][boundary] "%s" is assigned to %s (%s)', (province, region) => {
    expect(REGION_TO_PROVINCES[region]).toContain(province);
    // and to no OTHER region — a swap-type misassignment must fail here
    const others = (Object.keys(REGION_TO_PROVINCES) as Array<keyof typeof REGION_TO_PROVINCES>).filter(
      (r) => r !== region
    );
    for (const other of others) {
      expect(REGION_TO_PROVINCES[other]).not.toContain(province);
    }
  });
});

describe('searchCampsitesArgsSchema — region arg zod BOUNDARY (CAM-463 Decision 2, gap-fill)', () => {
  it('[unit][boundary][error] an empty-string region fails validation (min(1))', () => {
    const result = searchCampsitesArgsSchema.safeParse({ region: '' });
    expect(result.success).toBe(false);
  });

  it('[unit][boundary][error] a whitespace-only region fails after trim (effectively empty)', () => {
    const result = searchCampsitesArgsSchema.safeParse({ region: '   ' });
    expect(result.success).toBe(false);
  });

  it('[unit][boundary] a region exactly at the 50-char max is accepted', () => {
    const exactly50 = 'ก'.repeat(50);
    const result = searchCampsitesArgsSchema.safeParse({ region: exactly50 });
    expect(result.success).toBe(true);
  });

  it('[unit][boundary][error] a region over the 50-char max fails validation', () => {
    const over50 = 'ก'.repeat(51);
    const result = searchCampsitesArgsSchema.safeParse({ region: over50 });
    expect(result.success).toBe(false);
  });

  it('[unit] region omitted entirely still validates (optional)', () => {
    const result = searchCampsitesArgsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data.region).toBeUndefined();
  });
});

describe('buildCampSiteWhere — deep non-breaking check: province string + several other params together (CAM-463 Decision 4)', () => {
  it('[unit] a single-province string call combined with min/max/petFriendly/keyword produces the exact pre-CAM-463 combined shape', () => {
    const where = buildCampSiteWhere({
      province: 'Chiang Mai',
      min: '500',
      max: '2000',
      petFriendly: true,
      keyword: 'ริมน้ำ',
    });

    // province: plain equality, no `in` (byte-identical string path)
    expect(where.location?.province).toBe('Chiang Mai');
    expect(JSON.stringify(where.location)).not.toContain('"in"');

    // the other params are untouched by the province widening
    expect(where.priceLow).toEqual({ gte: 500, lte: 2000 });
    expect(where.OR).toEqual([
      { nameTh: { contains: 'ริมน้ำ' } },
      { nameEn: { contains: 'ริมน้ำ' } },
      { description: { contains: 'ริมน้ำ' } },
      { operator: { name: { contains: 'ริมน้ำ' } } },
    ]);
    expect(where.AND).toContainEqual({ petFriendly: true });
  });
});
