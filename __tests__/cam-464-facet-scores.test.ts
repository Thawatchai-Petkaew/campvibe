/**
 * cam-464-facet-scores.test.ts — CAM-464: derived facet scores (family /
 * beginner / road_access), rules-only v1 — lib/facet-scores.ts
 *
 * Coverage matrix (per tech.md D3's own confirmation list + story
 * Self-verify):
 *   - purity (D1/D6): no `prisma`/`@/lib/prisma` import in the module
 *   - FAMILY: high-score fixture w/ exact evidence (AC-1) · age-ceiling
 *     clamp to 0.40 (BR-1) · absent when zero support fires + neutral age
 *     (EC-1/BR-5) · confidence = firedSupportSlots/5
 *   - BEGINNER: drive-up + comforts fixture (AC-2) · zero-comfort conflict
 *     lowers confidence below the answerable threshold, no cap needed
 *     (EC-2) · hard-access cap to 0.30 (BR-2/BR-3 region) · absent when
 *     empty (EC-1/EC-4)
 *   - ROAD_ACCESS: drivable → 0.70/0.50 + vehicle_class_unknown note (AC-3)
 *     · not-drivable → 0.15/0.50, evidence in BAOT→HIKE→WALK order (EC-3)
 *     · absent when no access codes (AC-4) · confidence NEVER exceeds the
 *     0.50 cap for any input (BR-4)
 *   - BR-5: every emitted score has evidence.length >= 1
 *   - BR-6/P13: identical input ⇒ deep-equal output; a changed field ⇒ a
 *     changed output (determinism/reproducibility)
 *   - EC-4: a camp with essentially empty option data ⇒ ALL THREE facets
 *     absent (computeFacetScores returns [])
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  computeFacetScores,
  ANSWERABLE_CONFIDENCE,
  ROAD_ACCESS_CONFIDENCE_CAP,
  FAMILY_AGE_RESTRICTED_CAP,
  ROAD_DRIVABLE_SCORE,
  ROAD_NOT_DRIVABLE_SCORE,
  type FacetScoreInput,
  type FacetScore,
} from '@/lib/facet-scores';

function opt(code: string, group: string) {
  return { code, group };
}

const ACCESS = 'Access type';
const FACILITY = 'Internal facility';
const EQUIPMENT = 'Equipment for rent';

function findFacet(scores: FacetScore[], facet: FacetScore['facet']): FacetScore | undefined {
  return scores.find((s) => s.facet === facet);
}

describe('lib/facet-scores.ts — purity (D1/D6)', () => {
  it('[normal] the module has no prisma import (pure, no I/O)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/facet-scores.ts'), 'utf-8');
    expect(src).not.toMatch(/from\s+['"][^'"]*prisma[^'"]*['"]/i);
    expect(src).not.toMatch(/import\s+.*prisma/i);
  });
});

describe('computeFacetScores — FAMILY (BR-1, proves AC-1)', () => {
  it('[normal] TOIL+SHOW+DRIV + no minimum-age restriction ⇒ high score with the exact named evidence (AC-1)', () => {
    const input: FacetScoreInput = {
      options: [opt('TOIL', FACILITY), opt('SHOW', FACILITY), opt('DRIV', ACCESS)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);
    const family = findFacet(result, 'family');

    expect(family).toBeDefined();
    expect(family?.score).toBe(0.85); // toilet .25 + shower .20 + driveUp .25 + kidsWelcome .15
    expect(family?.confidence).toBe(0.8); // 4 fired support slots / 5
    expect(family?.answerable).toBe(true);
    expect(family?.source).toBe('rules');
    expect(family?.evidence).toEqual([
      { type: 'field', ref: 'TOIL', effect: 'supports' },
      { type: 'field', ref: 'SHOW', effect: 'supports' },
      { type: 'field', ref: 'DRIV', effect: 'supports' },
      { type: 'field', ref: 'minimumAge', effect: 'supports' },
    ]);
  });

  it('[boundary] minimumAge >= 12 clamps the score to FAMILY_AGE_RESTRICTED_CAP (0.40) and appends a limits entry (BR-1)', () => {
    const input: FacetScoreInput = {
      options: [opt('TOIL', FACILITY), opt('SHOW', FACILITY), opt('DRIV', ACCESS), opt('WATE', FACILITY)],
      minimumAge: 15,
    };
    const result = computeFacetScores(input);
    const family = findFacet(result, 'family');

    expect(family).toBeDefined();
    expect(family?.score).toBe(FAMILY_AGE_RESTRICTED_CAP); // raw 0.85 clamped to 0.40
    expect(family?.confidence).toBe(0.8); // 4 fired SUPPORT slots (the limits entry doesn't count) / 5
    expect(family?.evidence).toContainEqual({ type: 'field', ref: 'minimumAge', effect: 'limits' });
    // kidsWelcome did NOT fire (age 15 > 6) — no duplicate minimumAge 'supports' entry.
    expect(family?.evidence.filter((e) => e.ref === 'minimumAge')).toHaveLength(1);
  });

  it('[boundary] minimumAge 7-11 is neutral — neither fires kidsWelcome nor caps the score', () => {
    const input: FacetScoreInput = {
      options: [opt('TOIL', FACILITY)],
      minimumAge: 9,
    };
    const result = computeFacetScores(input);
    const family = findFacet(result, 'family');

    expect(family).toBeDefined();
    expect(family?.score).toBe(0.25); // toilet only, no clamp, no kidsWelcome
    expect(family?.evidence).toEqual([{ type: 'field', ref: 'TOIL', effect: 'supports' }]);
  });

  it('[null/empty] zero fired support slots + neutral age ⇒ family is ABSENT (EC-1/BR-5, never a fake 0)', () => {
    const input: FacetScoreInput = { options: [opt('RIVE', 'Terrain')], minimumAge: 9 };
    const result = computeFacetScores(input);
    expect(findFacet(result, 'family')).toBeUndefined();
  });

  it('[normal] the waterPower slot picks the first present code in POTA→WATE→ELEC order', () => {
    const input: FacetScoreInput = { options: [opt('ELEC', FACILITY), opt('WATE', FACILITY)], minimumAge: 9 };
    const result = computeFacetScores(input);
    const family = findFacet(result, 'family');
    expect(family?.evidence).toEqual([{ type: 'field', ref: 'WATE', effect: 'supports' }]);
  });

  it('[boundary] independent gap-fill: zero support slots BUT minimumAge >= 12 ⇒ NOT absent (the age-cap "limits" entry is itself real evidence) — score 0, confidence 0, answerable false, never silently dropped', () => {
    // Distinguishes true absence (EC-1: no evidence at all) from an honest
    // zero-with-a-reason: the camp genuinely restricts young kids AND has no
    // recorded family comforts. The limits entry is real evidence (not fake),
    // so BR-5 does not drop the facet — but confidence=0 correctly gates
    // `answerable:false` so the assistant still hedges to "ข้อมูลไม่พอ".
    const input: FacetScoreInput = { options: [], minimumAge: 15 };
    const result = computeFacetScores(input);
    const family = findFacet(result, 'family');

    expect(family).toBeDefined(); // NOT absent — real evidence exists (the age restriction)
    expect(family?.score).toBe(0);
    expect(family?.confidence).toBe(0);
    expect(family?.answerable).toBe(false);
    expect(family?.evidence).toEqual([{ type: 'field', ref: 'minimumAge', effect: 'limits' }]);
  });
});

describe('computeFacetScores — BEGINNER (BR-2, proves AC-2)', () => {
  it('[normal] drive-up + core comforts ⇒ grounded beginner score naming DRIV + the comfort facilities (AC-2)', () => {
    const input: FacetScoreInput = {
      options: [opt('DRIV', ACCESS), opt('TOIL', FACILITY), opt('SHOW', FACILITY), opt('ELEC', FACILITY)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);
    const beginner = findFacet(result, 'beginner');

    expect(beginner).toBeDefined();
    expect(beginner?.score).toBe(0.65); // .35 + .10 + .10 + .10
    expect(beginner?.confidence).toBe(0.57); // 4/7 rounded to 2dp
    expect(beginner?.answerable).toBe(true);
    expect(beginner?.evidence).toEqual([
      { type: 'field', ref: 'DRIV', effect: 'supports' },
      { type: 'field', ref: 'TOIL', effect: 'supports' },
      { type: 'field', ref: 'SHOW', effect: 'supports' },
      { type: 'field', ref: 'ELEC', effect: 'supports' },
    ]);
  });

  it('[boundary] EC-2: drive-up but zero comfort facilities ⇒ low confidence, NOT answerable (never a blanket "yes")', () => {
    const input: FacetScoreInput = { options: [opt('DRIV', ACCESS)], minimumAge: null };
    const result = computeFacetScores(input);
    const beginner = findFacet(result, 'beginner');

    expect(beginner).toBeDefined();
    expect(beginner?.score).toBe(0.35);
    expect(beginner?.confidence).toBeCloseTo(1 / 7, 2);
    expect(beginner?.confidence).toBeLessThan(ANSWERABLE_CONFIDENCE);
    expect(beginner?.answerable).toBe(false);
  });

  it('[boundary] hard-access cap: no DRIV + boat/hike-only clamps the score to 0.30 (BR-2/BR-3 region)', () => {
    const input: FacetScoreInput = {
      options: [opt('TOIL', FACILITY), opt('SHOW', FACILITY), opt('ELEC', FACILITY), opt('POTA', FACILITY), opt('BAOT', ACCESS)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);
    const beginner = findFacet(result, 'beginner');

    expect(beginner).toBeDefined();
    expect(beginner?.score).toBe(0.3); // raw .40 clamped to .30
    expect(beginner?.evidence).toContainEqual({ type: 'field', ref: 'BAOT', effect: 'limits' });
  });

  it('[normal] gearRental fires from ANY Equipment-for-rent option, evidence = first code in code order', () => {
    const input: FacetScoreInput = {
      options: [opt('TFAN', EQUIPMENT), opt('TENT', EQUIPMENT)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);
    const beginner = findFacet(result, 'beginner');
    expect(beginner?.evidence).toEqual([{ type: 'field', ref: 'TENT', effect: 'supports' }]); // TENT < TFAN alphabetically
  });

  it('[null/empty] zero fired slots + no hard-access code ⇒ beginner is ABSENT (EC-1/EC-4/BR-5)', () => {
    const result = computeFacetScores({ options: [], minimumAge: null });
    expect(findFacet(result, 'beginner')).toBeUndefined();
  });

  it('[boundary] independent gap-fill: zero support slots BUT a hard-access code (HIKE-only, no DRIV/comforts) ⇒ NOT absent — the cap\'s "limits" entry is real evidence, score 0, confidence 0, answerable false', () => {
    const input: FacetScoreInput = { options: [opt('HIKE', ACCESS)], minimumAge: null };
    const result = computeFacetScores(input);
    const beginner = findFacet(result, 'beginner');

    expect(beginner).toBeDefined(); // NOT absent — the hard-access cap names a real reason
    expect(beginner?.score).toBe(0);
    expect(beginner?.confidence).toBe(0);
    expect(beginner?.answerable).toBe(false);
    expect(beginner?.evidence).toEqual([{ type: 'field', ref: 'HIKE', effect: 'limits' }]);
  });
});

describe('computeFacetScores — ROAD_ACCESS (BR-3/BR-4, proves AC-3/EC-3, the P13 honesty demo)', () => {
  it('[normal] DRIV present ⇒ drivable, score 0.70, confidence CAPPED at 0.50, note vehicle_class_unknown (AC-3)', () => {
    const result = computeFacetScores({ options: [opt('DRIV', ACCESS)], minimumAge: null });
    const roadAccess = findFacet(result, 'road_access');

    expect(roadAccess).toBeDefined();
    expect(roadAccess?.score).toBe(ROAD_DRIVABLE_SCORE);
    expect(roadAccess?.confidence).toBe(ROAD_ACCESS_CONFIDENCE_CAP);
    expect(roadAccess?.answerable).toBe(true);
    expect(roadAccess?.evidence).toEqual([
      { type: 'field', ref: 'DRIV', effect: 'supports', note: 'vehicle_class_unknown' },
    ]);
  });

  it('[boundary] boat/hike-only (no DRIV) ⇒ not drivable, score 0.15, evidence in BAOT→HIKE→WALK order (EC-3)', () => {
    const result = computeFacetScores({ options: [opt('HIKE', ACCESS), opt('BAOT', ACCESS)], minimumAge: null });
    const roadAccess = findFacet(result, 'road_access');

    expect(roadAccess).toBeDefined();
    expect(roadAccess?.score).toBe(ROAD_NOT_DRIVABLE_SCORE);
    expect(roadAccess?.confidence).toBe(ROAD_ACCESS_CONFIDENCE_CAP);
    expect(roadAccess?.evidence).toEqual([
      { type: 'field', ref: 'BAOT', effect: 'limits' },
      { type: 'field', ref: 'HIKE', effect: 'limits' },
    ]);
    // The "vehicle_class_unknown" hedge is DRIV-specific — must not leak onto the not-drivable branch.
    expect(roadAccess?.evidence.every((e) => e.note === undefined)).toBe(true);
  });

  it('[boundary] a single WALK-only access code is reported honestly (not drivable)', () => {
    const result = computeFacetScores({ options: [opt('WALK', ACCESS)], minimumAge: null });
    const roadAccess = findFacet(result, 'road_access');
    expect(roadAccess?.evidence).toEqual([{ type: 'field', ref: 'WALK', effect: 'limits' }]);
  });

  it('[null/empty] no access codes at all ⇒ road_access is ABSENT (AC-4)', () => {
    const result = computeFacetScores({ options: [opt('TOIL', FACILITY)], minimumAge: null });
    expect(findFacet(result, 'road_access')).toBeUndefined();
  });

  it('[boundary] independent gap-fill: DRIV takes precedence over co-present BAOT/HIKE/WALK — never a mixed/averaged outcome, never leaks the other codes into evidence', () => {
    const result = computeFacetScores({
      options: [opt('BAOT', ACCESS), opt('HIKE', ACCESS), opt('WALK', ACCESS), opt('DRIV', ACCESS)],
      minimumAge: null,
    });
    const roadAccess = findFacet(result, 'road_access');

    expect(roadAccess?.score).toBe(ROAD_DRIVABLE_SCORE); // 0.70, not the not-drivable 0.15
    expect(roadAccess?.evidence).toEqual([{ type: 'field', ref: 'DRIV', effect: 'supports', note: 'vehicle_class_unknown' }]);
  });

  it('[boundary] confidence NEVER exceeds ROAD_ACCESS_CONFIDENCE_CAP (0.50) for ANY input that produces road_access (BR-4)', () => {
    const fixtures: FacetScoreInput[] = [
      { options: [opt('DRIV', ACCESS)], minimumAge: null },
      { options: [opt('DRIV', ACCESS), opt('BAOT', ACCESS)], minimumAge: null },
      { options: [opt('BAOT', ACCESS)], minimumAge: null },
      { options: [opt('WALK', ACCESS), opt('HIKE', ACCESS), opt('BAOT', ACCESS)], minimumAge: null },
    ];
    for (const fixture of fixtures) {
      const roadAccess = findFacet(computeFacetScores(fixture), 'road_access');
      expect(roadAccess?.confidence).toBeLessThanOrEqual(ROAD_ACCESS_CONFIDENCE_CAP);
    }
  });
});

describe('computeFacetScores — BR-5 (mandatory evidence, all facets)', () => {
  it('[normal] every emitted facet score carries evidence.length >= 1', () => {
    const result = computeFacetScores({
      options: [opt('TOIL', FACILITY), opt('SHOW', FACILITY), opt('DRIV', ACCESS), opt('ELEC', FACILITY)],
      minimumAge: null,
    });
    expect(result.length).toBeGreaterThan(0);
    for (const facetScore of result) {
      expect(facetScore.evidence.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('computeFacetScores — EC-4 (essentially empty listing ⇒ every facet absent)', () => {
  it('[null/empty] a sparse/new listing (no options, neutral age) produces NO facets at all', () => {
    const result = computeFacetScores({ options: [], minimumAge: 9 });
    expect(result).toEqual([]);
  });
});

describe('computeFacetScores — BR-6/P13 determinism (proves AC-5/EC-5)', () => {
  it('[normal] identical input ⇒ deep-equal output across repeated calls', () => {
    const input: FacetScoreInput = {
      options: [opt('TOIL', FACILITY), opt('DRIV', ACCESS)],
      minimumAge: 5,
    };
    const first = computeFacetScores(input);
    const second = computeFacetScores({ ...input, options: [...input.options] });
    expect(second).toEqual(first);
  });

  it('[normal] a changed source field (minimumAge) changes the output (not a stale/cached value)', () => {
    const before = computeFacetScores({ options: [opt('TOIL', FACILITY), opt('DRIV', ACCESS)], minimumAge: null });
    const after = computeFacetScores({ options: [opt('TOIL', FACILITY), opt('DRIV', ACCESS)], minimumAge: 15 });
    const familyBefore = findFacet(before, 'family');
    const familyAfter = findFacet(after, 'family');
    expect(familyAfter?.score).not.toBe(familyBefore?.score);
  });
});
