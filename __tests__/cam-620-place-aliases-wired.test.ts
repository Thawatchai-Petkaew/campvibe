/**
 * CAM-620 (item 1, cheapest — zero DB) — `scripts/validate-place-aliases.mjs`
 * already implements a real, pure, exported cross-reference validator
 * (`validatePlaceAliases`) over the hand-authored
 * `prisma/data/place-aliases.json`, and its own header calls it the sibling
 * of `validate-landmark-gazetteer.mjs` — which IS run on every `npm test`
 * via `__tests__/cam-503-landmark.test.ts`. `validate-place-aliases.mjs`
 * itself is invoked by NOTHING: absent from `package.json`, absent from
 * every CI workflow, imported by no test, until this file. Zero lines
 * change in `scripts/validate-place-aliases.mjs` — it already exports the
 * pure validator and already guards its own CLI behind an `isMain`-style
 * check; the only gap was that nothing exercised it.
 *
 * Consequence this closes: this repo has already applied two RTGS province
 * spelling overrides (CAM-553, "Lop Buri"/"Phang Nga"). One more
 * `canonicalCode`/`canonicalTh`/`canonicalEn` typo in a future alias edit
 * would silently ship a dead alias — the assistant answers "I do not know
 * that place" about a province it fully supports, the exact honest-failure-
 * looking-correct shape CAM-605 was built to expose for the sub-district
 * shortlist. AC-2/EC-1 below proves this suite would actually catch that
 * class of mistake, not just that today's real file happens to be clean.
 */
import { describe, it, expect } from 'vitest';
import { validatePlaceAliases } from '../scripts/validate-place-aliases.mjs';
import realPlaceAliases from '@/prisma/data/place-aliases.json';
import realThailandLocations from '@/prisma/data/thailand-locations.json';

describe('CAM-620 place-aliases.json — wiring validatePlaceAliases into npm test (AC-1)', () => {
  it('[real data] the committed place-aliases.json has zero violations against the real thailand-locations.json', () => {
    const errors = validatePlaceAliases(realPlaceAliases, realThailandLocations);
    expect(errors).toEqual([]);
  });

  it('[real data] the committed file actually has provinceAliases to validate (not an empty/no-op fixture)', () => {
    expect(Array.isArray((realPlaceAliases as { provinceAliases: unknown[] }).provinceAliases)).toBe(true);
    expect((realPlaceAliases as { provinceAliases: unknown[] }).provinceAliases.length).toBeGreaterThan(0);
  });
});

describe('CAM-620 validatePlaceAliases — proven to fail on demand (AC-2/EC-1)', () => {
  it('[unit] a canonicalCode absent from thailand-locations.json is caught, naming the bad reference', () => {
    const fixtureLocations = [{ code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }];
    const badData = {
      provinceAliases: [
        {
          canonicalCode: '99', // does not exist in fixtureLocations
          canonicalTh: 'ไม่มีจริง',
          canonicalEn: 'Nonexistent',
          aliases: [{ text: 'มั่ว', matchMode: 'exact', kind: 'colloquial' }],
        },
      ],
    };
    const errors = validatePlaceAliases(badData, fixtureLocations);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('99') && e.includes('is not a province'))).toBe(true);
  });

  it('[unit] a canonicalTh that no longer matches the seeded nameTh is caught (the RTGS-override-class mistake)', () => {
    const fixtureLocations = [{ code: '16', nameTh: 'ลพบุรี', nameEn: 'Lop Buri' }];
    const badData = {
      provinceAliases: [
        {
          canonicalCode: '16',
          canonicalTh: 'ลพบุรีย์', // typo'd, no longer matches seeded nameTh
          canonicalEn: 'Lop Buri',
          aliases: [{ text: 'ลพ', matchMode: 'exact', kind: 'abbreviation' }],
        },
      ],
    };
    const errors = validatePlaceAliases(badData, fixtureLocations);
    expect(errors.some((e) => e.includes('canonicalTh'))).toBe(true);
  });

  it('[unit] clean input against a matching fixture reports zero violations (proves the check stays quiet too)', () => {
    const fixtureLocations = [{ code: '10', nameTh: 'กรุงเทพมหานคร', nameEn: 'Bangkok' }];
    const goodData = {
      provinceAliases: [
        {
          canonicalCode: '10',
          canonicalTh: 'กรุงเทพมหานคร',
          canonicalEn: 'Bangkok',
          aliases: [{ text: 'กทม', matchMode: 'exact', kind: 'abbreviation' }],
        },
      ],
    };
    expect(validatePlaceAliases(goodData, fixtureLocations)).toEqual([]);
  });
});
