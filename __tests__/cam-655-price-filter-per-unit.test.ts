/**
 * CAM-655 (epic CAM-648, ADR-014 §6) — "A price filter means what the camper
 * meant, whatever the unit."
 *
 * `buildCampSiteWhere`'s price BAND (min/max) is translated per pricing unit
 * when the camper's party size is known: a PER_PERSON camp's stored priceLow
 * is compared against the threshold DIVIDED by party size (predicting the
 * per-trip total); a PER_SITE camp compares the threshold directly. When
 * `guests` is absent/0/1/garbage, the shape is byte-identical to before this
 * story (pinned by cam-463-qa-partition-audit-and-boundary.test.ts and
 * campsite-capacity-filter.test.ts, neither of which supply `guests`).
 *
 * Out of scope (per the ticket, do NOT assert here): the sort key
 * (lib/catalog-cursor.ts still sorts on raw priceLow — unchanged) and any
 * price CAPTION (CAM-653 owns that).
 */

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildCampSiteWhere } from '@/lib/campsite-filters';
import { getActiveFilterChips } from '@/components/ActiveFilters';
import translations from '@/locales/translations.json';

const enT = translations.en;
const thT = translations.th;

// ---------------------------------------------------------------------------
// Behavioral evaluator — simulates Prisma's boolean evaluation of the
// price-band OR clause pushed into where.AND, so a test can prove WHICH
// camps a given `where` would actually include/exclude (Prove-It), not just
// eyeball the JSON shape.
// ---------------------------------------------------------------------------
function findPriceOrClause(
  where: Prisma.CampSiteWhereInput
): Array<{ priceUnit: string; priceLow: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } }> | undefined {
  const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  const clause = andArray.find(
    (c) =>
      typeof c === 'object' &&
      c !== null &&
      'OR' in c &&
      Array.isArray((c as Prisma.CampSiteWhereInput).OR) &&
      ((c as Prisma.CampSiteWhereInput).OR as Array<Record<string, unknown>>).some(
        (branch) => 'priceUnit' in branch
      )
  ) as Prisma.CampSiteWhereInput | undefined;
  return clause?.OR as
    | Array<{ priceUnit: string; priceLow: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } }>
    | undefined;
}

function matchesPriceBand(
  where: Prisma.CampSiteWhereInput,
  camp: { priceUnit: 'PER_SITE' | 'PER_PERSON'; priceLow: number }
): boolean {
  const orBranches = findPriceOrClause(where);
  if (!orBranches) {
    // No per-unit OR clause — fall back to the plain where.priceLow shape.
    const plain = where.priceLow as { gte?: number; lte?: number } | undefined;
    if (!plain) return true;
    if (plain.gte !== undefined && camp.priceLow < plain.gte) return false;
    if (plain.lte !== undefined && camp.priceLow > plain.lte) return false;
    return true;
  }
  const branch = orBranches.find((b) => b.priceUnit === camp.priceUnit);
  if (!branch) return false;
  const price = new Prisma.Decimal(camp.priceLow);
  if (branch.priceLow.gte && price.lt(branch.priceLow.gte)) return false;
  if (branch.priceLow.lte && price.gt(branch.priceLow.lte)) return false;
  return true;
}

const BASE = { isActive: true, isPublished: true, deletedAt: null };

describe('buildCampSiteWhere — price band, guests absent/1 (byte-identical to pre-CAM-655)', () => {
  it('[normal] guests absent: where.priceLow is the exact pre-change shape, no AND price clause', () => {
    const where = buildCampSiteWhere({ min: '500', max: '2000' });
    expect(where).toMatchObject(BASE);
    expect(where.priceLow).toEqual({ gte: 500, lte: 2000 });
    expect(findPriceOrClause(where)).toBeUndefined();
  });

  it('[boundary] guests=1: division by 1 is a no-op — same exact shape as guests absent', () => {
    const where = buildCampSiteWhere({ min: '500', max: '2000', guests: '1' });
    expect(where.priceLow).toEqual({ gte: 500, lte: 2000 });
    expect(findPriceOrClause(where)).toBeUndefined();
  });

  it('[normal] only min supplied, guests absent: identical to pre-change (no lte key at all)', () => {
    const where = buildCampSiteWhere({ min: '500' });
    expect(where.priceLow).toEqual({ gte: 500 });
  });

  it('[normal] only max supplied, guests absent: identical to pre-change (no gte key at all)', () => {
    const where = buildCampSiteWhere({ max: '2000' });
    expect(where.priceLow).toEqual({ lte: 2000 });
  });
});

describe('buildCampSiteWhere — price band translated per unit when party size is known (CAM-655 AC)', () => {
  it('[normal] max=500, guests=3: includes PER_SITE ฿400, includes PER_PERSON ฿150, excludes PER_PERSON ฿200 (600/trip)', () => {
    const where = buildCampSiteWhere({ max: '500', guests: '3' });

    expect(matchesPriceBand(where, { priceUnit: 'PER_SITE', priceLow: 400 })).toBe(true);
    expect(matchesPriceBand(where, { priceUnit: 'PER_PERSON', priceLow: 150 })).toBe(true);
    expect(matchesPriceBand(where, { priceUnit: 'PER_PERSON', priceLow: 200 })).toBe(false);

    // PER_SITE branch compares the threshold directly (unchanged), PER_PERSON
    // branch compares the threshold divided by party size.
    const orBranches = findPriceOrClause(where)!;
    const perSite = orBranches.find((b) => b.priceUnit === 'PER_SITE')!;
    const perPerson = orBranches.find((b) => b.priceUnit === 'PER_PERSON')!;
    expect(perSite.priceLow.lte?.toString()).toBe('500');
    expect(perPerson.priceLow.lte?.toString()).toBe(new Prisma.Decimal(500).div(3).toString());
  });

  it('[normal] gte side is symmetric: min=300, guests=2 excludes PER_SITE ฿250, includes PER_SITE ฿350; excludes PER_PERSON ฿100, includes PER_PERSON ฿200', () => {
    const where = buildCampSiteWhere({ min: '300', guests: '2' });

    expect(matchesPriceBand(where, { priceUnit: 'PER_SITE', priceLow: 250 })).toBe(false);
    expect(matchesPriceBand(where, { priceUnit: 'PER_SITE', priceLow: 350 })).toBe(true);
    expect(matchesPriceBand(where, { priceUnit: 'PER_PERSON', priceLow: 100 })).toBe(false);
    expect(matchesPriceBand(where, { priceUnit: 'PER_PERSON', priceLow: 200 })).toBe(true);
  });

  it('[normal] min+max both supplied with guests: both bounds translated on both branches', () => {
    const where = buildCampSiteWhere({ min: '300', max: '900', guests: '3' });
    const orBranches = findPriceOrClause(where)!;
    const perSite = orBranches.find((b) => b.priceUnit === 'PER_SITE')!;
    const perPerson = orBranches.find((b) => b.priceUnit === 'PER_PERSON')!;

    expect(perSite.priceLow.gte?.toString()).toBe('300');
    expect(perSite.priceLow.lte?.toString()).toBe('900');
    expect(perPerson.priceLow.gte?.toString()).toBe(new Prisma.Decimal(300).div(3).toString());
    expect(perPerson.priceLow.lte?.toString()).toBe(new Prisma.Decimal(900).div(3).toString());
  });

  it('[normal] uses Prisma.Decimal arithmetic, not JS float, for the division (ADR-002)', () => {
    // 1000/3 as JS float is 333.33333333333337 (float rounding artifact);
    // Decimal division must not reproduce that artifact.
    const where = buildCampSiteWhere({ max: '1000', guests: '3' });
    const orBranches = findPriceOrClause(where)!;
    const perPerson = orBranches.find((b) => b.priceUnit === 'PER_PERSON')!;
    expect(perPerson.priceLow.lte).toBeInstanceOf(Prisma.Decimal);
    expect(perPerson.priceLow.lte?.toString()).not.toBe(String(1000 / 3));
  });

  it('[normal] does not clobber a sibling AND clause (guest-capacity filter still applies)', () => {
    const where = buildCampSiteWhere({ max: '500', guests: '3' });
    const andArray = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    // Both the price-band OR and the guest-capacity OR must coexist.
    const hasPriceClause = andArray.some((c) => 'OR' in (c as object) && findPriceOrClause({ AND: [c] }));
    const hasCapacityClause = andArray.some(
      (c) =>
        typeof c === 'object' &&
        c !== null &&
        'OR' in c &&
        JSON.stringify(c).includes('maxGuestsPerDay')
    );
    expect(hasPriceClause).toBe(true);
    expect(hasCapacityClause).toBe(true);
  });
});

describe('buildCampSiteWhere — price band, guests=0/garbage never divides by zero or produces NaN', () => {
  it('[boundary] guests=0 falls back to the plain shape (no divide-by-zero, no crash)', () => {
    const where = buildCampSiteWhere({ min: '500', max: '2000', guests: '0' });
    expect(where.priceLow).toEqual({ gte: 500, lte: 2000 });
    expect(findPriceOrClause(where)).toBeUndefined();
  });

  it('[error/validation] guests is a garbage string ("abc") falls back to the plain shape (no crash, no NaN)', () => {
    const where = buildCampSiteWhere({ min: '500', max: '2000', guests: 'abc' });
    expect(where.priceLow).toEqual({ gte: 500, lte: 2000 });
    const priceLow = where.priceLow as { gte?: number; lte?: number };
    expect(Number.isNaN(priceLow.gte)).toBe(false);
    expect(Number.isNaN(priceLow.lte)).toBe(false);
  });

  it('[boundary] a negative guests value falls back to the plain shape (no crash)', () => {
    const where = buildCampSiteWhere({ min: '500', guests: '-5' });
    expect(where.priceLow).toEqual({ gte: 500 });
  });

  it('[error/validation] guests=3 with a garbage min/max never throws — the per-unit branch simply carries no bound', () => {
    expect(() => buildCampSiteWhere({ min: 'abc', max: 'xyz', guests: '3' })).not.toThrow();
    const where = buildCampSiteWhere({ min: 'abc', max: 'xyz', guests: '3' });
    const orBranches = findPriceOrClause(where)!;
    const perSite = orBranches.find((b) => b.priceUnit === 'PER_SITE')!;
    expect(perSite.priceLow.gte).toBeUndefined();
    expect(perSite.priceLow.lte).toBeUndefined();
  });
});

describe('ActiveFilters chip — least-confusing choice: name the party size the threshold was interpreted against', () => {
  it('[normal] guests absent: the min/max chip is byte-identical to before this story (no qualifier)', () => {
    const chips = getActiveFilterChips(new URLSearchParams('min=500&max=2000'), enT);
    expect(chips.some((c) => c.label === 'Min Price: 500')).toBe(true);
    expect(chips.some((c) => c.label === 'Max Price: 2000')).toBe(true);
  });

  it('[boundary] guests=1: no qualifier (division by 1 changes nothing about the band)', () => {
    const chips = getActiveFilterChips(new URLSearchParams('min=500&guests=1'), enT);
    expect(chips.some((c) => c.label === 'Min Price: 500')).toBe(true);
  });

  it('[normal] guests=3: the chip names the party size the threshold was interpreted for (EN)', () => {
    const chips = getActiveFilterChips(new URLSearchParams('max=500&guests=3'), enT);
    expect(chips.some((c) => c.label === 'Max Price: 500 (for 3 guests)')).toBe(true);
  });

  it('[normal] guests=3: the chip names the party size the threshold was interpreted for (TH, verbatim)', () => {
    const chips = getActiveFilterChips(new URLSearchParams('max=500&guests=3'), thT);
    expect(chips.some((c) => c.label === 'ราคาสูงสุด: 500 (สำหรับ 3 คน)')).toBe(true);
  });

  it('[boundary] guests=0/garbage: no qualifier shown (matches the where-clause fallback)', () => {
    const zero = getActiveFilterChips(new URLSearchParams('min=500&guests=0'), enT);
    expect(zero.some((c) => c.label === 'Min Price: 500')).toBe(true);
    const garbage = getActiveFilterChips(new URLSearchParams('min=500&guests=abc'), enT);
    expect(garbage.some((c) => c.label === 'Min Price: 500')).toBe(true);
  });
});

describe('Sort label — "Starting price", not a bare "Price" (the number sorted is a starting price whose unit varies)', () => {
  it('[normal] EN sort labels read "Starting price"', () => {
    expect(enT.sort.priceLow).toBe('Starting price: low to high');
    expect(enT.sort.priceHigh).toBe('Starting price: high to low');
  });

  it('[normal] TH sort labels read "ราคาเริ่มต้น" verbatim', () => {
    expect(thT.sort.priceLow).toBe('ราคาเริ่มต้น: ต่ำไปสูง');
    expect(thT.sort.priceHigh).toBe('ราคาเริ่มต้น: สูงไปต่ำ');
  });
});
