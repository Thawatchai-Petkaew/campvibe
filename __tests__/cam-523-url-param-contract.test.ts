/**
 * cam-523-url-param-contract.test.ts — CAM-523 (S7) taxonomy registry refactor
 *
 * Behavior-preserving safety net for collapsing ~20 hand-maintained
 * group<->param copies onto lib/taxonomy-registry.ts (see
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-523-taxonomy-registry/story.md).
 *
 * Two kinds of assertion in this file:
 *
 *   A) REGRESSION PIN (Part 1) — `buildCampSiteWhere`'s Prisma where-shape for
 *      a representative multi-param query, called directly (pure function,
 *      no mocking needed). Green BEFORE this story's refactor (campsite-
 *      filters.ts's addOptionFilter/province/keyword/date/price logic was not
 *      touched, only the CampSiteFilterParams TYPE declaration above it) and
 *      green AFTER — proves byte-equivalent output for every already-wired
 *      param (type/keyword/province/district/guests/min/max/access/
 *      facilities/external/equipment/activities/terrain/annotatedFeatures/
 *      camperStyle).
 *
 *   B) PROVE-IT FIX (Part 2, source-inspection — same layer/precedent as
 *      __tests__/cam-197-loading-skeletons.test.ts: CatalogResults.tsx is a
 *      pure async Server Component whose prisma/getDefaultCatalog/unstable_cache
 *      dependencies require a live Next.js runtime + DB, so per .claude/rules/
 *      qa.md §6 this contract is asserted via source-inspection, not by
 *      invoking the component). `equipment`/`external` were OMITTED from
 *      CatalogResultsProps (app/page.tsx never forwarded them either) even
 *      though catalogQuerySchema + buildCampSiteWhere already accepted them —
 *      a `?equipment=`/`?external=` URL param was silently dropped on the
 *      SSR/first-page path. These assertions are RED on the pre-CAM-523 source
 *      (documented, acknowledged gap — HARD REQ #3 of the story) and GREEN
 *      after the fix — Prove-It methodology (.claude/rules/qa.md §7), same as
 *      any other bug-fix regression test.
 *
 * Sort param (`sort`) is covered by the existing, unmodified cam-196 suite
 * (VALID_SORTS / encodeCursorFromItem contract) — not re-pinned here.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { buildCampSiteWhere } from '@/lib/campsite-filters';

const root = process.cwd();
function src(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf-8');
}

/* ========================================================================= */
/* Part 1 — buildCampSiteWhere representative multi-param shape (regression) */
/* ========================================================================= */

describe('buildCampSiteWhere — representative multi-param query shape (regression pin, CAM-523)', () => {
  it('[unit] emits the exact Prisma where-shape for a query touching every catalog param', () => {
    // CAM-655 (ADR-014 §6) — guests='4' is a KNOWN party size (>1), so the
    // price band below is now translated per pricing unit instead of a bare
    // where.priceLow (see __tests__/cam-655-price-filter-per-unit.test.ts for
    // the full guests-absent/guests=1 byte-identical case). This pin is
    // updated to the new, intentional shape — not weakened.
    const where = buildCampSiteWhere({
      type: 'CAGD',
      keyword: 'ริมธาร',
      province: 'เชียงใหม่',
      district: 'แม่ริม',
      guests: '4',
      min: '300',
      max: '2000',
      access: 'DRIV,WALK',
      facilities: 'WIFI',
      external: 'SVEL',
      equipment: 'TENT',
      activities: 'SWIM',
      terrain: 'MTNS',
      annotatedFeatures: 'ALCO',
      camperStyle: 'GENR',
    });

    expect(where).toEqual({
      isActive: true,
      isPublished: true,
      deletedAt: null,
      campSiteType: 'CAGD',
      OR: [
        { nameTh: { contains: 'ริมธาร' } },
        { nameEn: { contains: 'ริมธาร' } },
        { description: { contains: 'ริมธาร' } },
        { operator: { name: { contains: 'ริมธาร' } } },
      ],
      location: { province: 'เชียงใหม่', district: 'แม่ริม' },
      AND: [
        {
          OR: [
            {
              priceUnit: 'PER_SITE',
              priceLow: { gte: new Prisma.Decimal(300), lte: new Prisma.Decimal(2000) },
            },
            {
              priceUnit: 'PER_PERSON',
              priceLow: {
                gte: new Prisma.Decimal(300).div(4),
                lte: new Prisma.Decimal(2000).div(4),
              },
            },
          ],
        },
        { OR: [{ maxGuestsPerDay: { gte: 4 } }, { maxGuestsPerDay: null }] },
        { options: { some: { code: 'DRIV' } } },
        { options: { some: { code: 'WALK' } } },
        { options: { some: { code: 'WIFI' } } },
        { options: { some: { code: 'SVEL' } } },
        { options: { some: { code: 'TENT' } } },
        { options: { some: { code: 'SWIM' } } },
        { options: { some: { code: 'MTNS' } } },
        { options: { some: { code: 'ALCO' } } },
        { options: { some: { code: 'GENR' } } },
      ],
    });
  });

  it('[unit] no params supplied yields only the base publish/active/soft-delete gate (empty edge)', () => {
    expect(buildCampSiteWhere({})).toEqual({
      isActive: true,
      isPublished: true,
      deletedAt: null,
    });
  });

  it('[unit] province/district-only query keeps the location shape unchanged', () => {
    const where = buildCampSiteWhere({ province: 'ภูเก็ต', district: 'กะทู้' });
    expect(where.location).toEqual({ province: 'ภูเก็ต', district: 'กะทู้' });
    expect(where.AND).toBeUndefined();
  });

  it('[unit] the AI-tool-only string[] branch (OR-within-group) is unaffected by the registry refactor', () => {
    const where = buildCampSiteWhere({ terrain: ['MTNS', 'SEA'] }) as { AND?: unknown[] };
    expect(where.AND).toContainEqual({ options: { some: { code: { in: ['MTNS', 'SEA'] } } } });
  });
});

/* ========================================================================= */
/* Part 2 — equipment/external pass-through (Prove-It: source-inspection)    */
/* ========================================================================= */

const catalogResultsSrc = src('components/CatalogResults.tsx');
const infiniteScrollSrc = src('components/InfiniteScrollGrid.tsx');
const pageSrc = src('app/page.tsx');

describe('CAM-523 BR-4 — equipment/external now survive page.tsx -> CatalogResults -> buildCampSiteWhere (Prove-It)', () => {
  it('[fix] CatalogResultsProps declares external/equipment (was omitted — the acknowledged gap)', () => {
    expect(catalogResultsSrc).toMatch(/external\?:\s*string/);
    expect(catalogResultsSrc).toMatch(/equipment\?:\s*string/);
  });

  it('[fix] CatalogResults destructures external/equipment from its props', () => {
    const fnSigMatch = catalogResultsSrc.match(/export default async function CatalogResults\(\{[\s\S]*?\}: CatalogResultsProps\)/);
    expect(fnSigMatch).not.toBeNull();
    expect(fnSigMatch![0]).toMatch(/\bexternal\b/);
    expect(fnSigMatch![0]).toMatch(/\bequipment\b/);
  });

  it('[fix] external/equipment are forwarded into the buildCampSiteWhere({...}) call', () => {
    const callMatch = catalogResultsSrc.match(/buildCampSiteWhere\(\{[\s\S]*?\}\);/);
    expect(callMatch).not.toBeNull();
    expect(callMatch![0]).toMatch(/\bexternal,/);
    expect(callMatch![0]).toMatch(/\bequipment,/);
  });

  it('[fix] isSearchActive now includes external/equipment (previously a param-only-active request fell through to the cached default catalog)', () => {
    const gateMatch = catalogResultsSrc.match(/const isSearchActive = !!\(([\s\S]*?)\);/);
    expect(gateMatch).not.toBeNull();
    expect(gateMatch![1]).toMatch(/\bexternal\b/);
    expect(gateMatch![1]).toMatch(/\bequipment\b/);
  });

  it('[fix] the InfiniteScrollGrid remount key includes external/equipment (a change to either now resets pagination)', () => {
    const keyMatch = catalogResultsSrc.match(/key=\{`[^`]*`\}/);
    expect(keyMatch).not.toBeNull();
    expect(keyMatch![0]).toMatch(/\$\{external/);
    expect(keyMatch![0]).toMatch(/\$\{equipment/);
  });

  it('[fix] activeFilters passed to InfiniteScrollGrid includes external/equipment', () => {
    const activeFiltersMatch = catalogResultsSrc.match(/activeFilters=\{\{([\s\S]*?)\}\}/);
    expect(activeFiltersMatch).not.toBeNull();
    expect(activeFiltersMatch![1]).toMatch(/external:/);
    expect(activeFiltersMatch![1]).toMatch(/equipment:/);
  });

  it('[fix] InfiniteScrollGrid ActiveFilters interface + the /api/campsites forward list include external/equipment', () => {
    expect(infiniteScrollSrc).toMatch(/external\?:\s*string/);
    expect(infiniteScrollSrc).toMatch(/equipment\?:\s*string/);
    const filterKeysMatch = infiniteScrollSrc.match(/const filterKeys = \[([\s\S]*?)\] as const;/);
    expect(filterKeysMatch).not.toBeNull();
    expect(filterKeysMatch![1]).toContain('"external"');
    expect(filterKeysMatch![1]).toContain('"equipment"');
  });

  it('[fix] app/page.tsx destructures searchParams.external/.equipment and forwards them to <CatalogResults>', () => {
    expect(pageSrc).toMatch(/external\?:\s*string/);
    expect(pageSrc).toMatch(/equipment\?:\s*string/);
    expect(pageSrc).toMatch(/external,\s*\n\s*equipment,/);
    expect(pageSrc).toMatch(/external=\{external\}/);
    expect(pageSrc).toMatch(/equipment=\{equipment\}/);
  });

  it('[fix] app/page.tsx\'s searchParamsKey includes external/equipment (Suspense fallback fires on either changing)', () => {
    const keyArrayMatch = pageSrc.match(/const searchParamsKey = \[([\s\S]*?)\]\.join\("\|"\);/);
    expect(keyArrayMatch).not.toBeNull();
    expect(keyArrayMatch![1]).toMatch(/external \?\? ""/);
    expect(keyArrayMatch![1]).toMatch(/equipment \?\? ""/);
  });
});

/* ========================================================================= */
/* Part 3 — every OTHER already-wired param still survives (regression pin) */
/* ========================================================================= */

describe('CAM-523 regression pin — every other filter param still round-trips page.tsx -> CatalogResults -> buildCampSiteWhere', () => {
  const alreadyWiredParams = [
    'type', 'keyword', 'province', 'district', 'startDate', 'endDate', 'guests',
    'min', 'max', 'access', 'facilities', 'activities', 'terrain',
    'annotatedFeatures', 'camperStyle',
  ];

  it.each(alreadyWiredParams)('[pin] %s is still destructured by CatalogResults and forwarded to buildCampSiteWhere', (param) => {
    const fnSigMatch = catalogResultsSrc.match(/export default async function CatalogResults\(\{[\s\S]*?\}: CatalogResultsProps\)/);
    const callMatch = catalogResultsSrc.match(/buildCampSiteWhere\(\{[\s\S]*?\}\);/);
    expect(fnSigMatch![0]).toMatch(new RegExp(`\\b${param}\\b`));
    expect(callMatch![0]).toMatch(new RegExp(`\\b${param},`));
  });

  it('[pin] sort still drives activeSortForCursor unchanged', () => {
    expect(catalogResultsSrc).toContain('activeSortForCursor');
    expect(catalogResultsSrc).toContain('VALID_SORTS');
  });
});
