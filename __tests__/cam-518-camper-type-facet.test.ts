/**
 * cam-518-camper-type-facet.test.ts — CAM-518 (S6): the DERIVED `camper_type`
 * facet (BEGN/INMD/PROF) + the enriched `beginner` facet composing the new
 * S1-S5 comfort codes (HOTW/GLAMP/CHIC/LIGT/RESV) — `lib/facet-scores.ts`.
 *
 * Owner rule: Camper Type is DERIVED, never stored — no schema/column/
 * migration; this file proves the compute-on-read behavior only.
 *
 * Coverage matrix (story AC-1..AC-3 / BR-1..BR-5 / EC-1..EC-2):
 *   - AC-1: a comfort-loaded camp (gear+HOTW+GLAMP+DRIV+CHIC) -> the enriched
 *     `beginner` facet scores with the new codes named in evidence, AND
 *     `camper_type` resolves BEGN with evidence
 *   - AC-2: a rustic camp (DIFT/IDMT style, HIKE access, minimal facilities,
 *     no gear) -> `camper_type` resolves PROF (deterministic, not INMD for
 *     this fixture) with evidence naming the hardship codes; `beginner` is
 *     low (not absent — the hard-access `limits` entry is real evidence)
 *   - AC-3/EC-1: a sparse camp (too little signal) -> `camper_type` is
 *     OMITTED (confidence < ANSWERABLE_CONFIDENCE) — no low-confidence guess,
 *     even though 2 hardship slots technically fire (noGearRental +
 *     minimalFacilities on an empty listing)
 *   - EC-2 (compile-time): `camper_type` is registered in FACET_COMPUTERS +
 *     FACET_ORDER (proven implicitly — the module compiles + emits the facet)
 *   - BR-3: `camper_type`'s honesty gate is STRICTER than the other 3 facets
 *     — it OMITS below-confidence rather than emitting `answerable:false`
 *   - determinism: identical input -> deep-equal output (BR-6/P13)
 *   - teeth: score/threshold values are pinned exactly (not just
 *     toBeDefined()) — a weight/threshold regression reddens these
 */
import { describe, it, expect } from 'vitest';
import {
  computeFacetScores,
  ANSWERABLE_CONFIDENCE,
  CAMPER_TYPE_BEGN_THRESHOLD,
  CAMPER_TYPE_PROF_THRESHOLD,
  type FacetScoreInput,
  type FacetScore,
} from '@/lib/facet-scores';

function opt(code: string, group: string) {
  return { code, group };
}

const ACCESS = 'Access type';
const FACILITY = 'Internal facility';
const EQUIPMENT = 'Equipment for rent';
const CAMPER_STYLE = 'Camper style';
const ANNOTATED = 'Annotated features';
const TERRAIN = 'Terrain';

function findFacet(scores: FacetScore[], facet: FacetScore['facet']): FacetScore | undefined {
  return scores.find((s) => s.facet === facet);
}

describe('computeFacetScores — camper_type (CAM-518 BR-2, proves AC-1)', () => {
  it('[normal] a comfort-loaded camp (gear+HOTW+GLAMP+DRIV+CHIC) resolves BEGN with named evidence, and the enriched beginner facet scores with the same new codes', () => {
    const input: FacetScoreInput = {
      options: [opt('TENT', EQUIPMENT), opt('HOTW', FACILITY), opt('DRIV', ACCESS), opt('CHIC', CAMPER_STYLE)],
      minimumAge: null,
      campSiteType: 'GLAMP',
    };
    const result = computeFacetScores(input);

    const camperType = findFacet(result, 'camper_type');
    expect(camperType).toBeDefined();
    expect(camperType?.score).toBe(0.87); // netScore .74 -> (.74+1)/2
    expect(camperType?.confidence).toBe(0.38); // 5/13 rounded
    expect(camperType?.answerable).toBe(true);
    expect(camperType?.label).toBe('BEGN');
    expect(camperType?.score).toBeGreaterThanOrEqual(CAMPER_TYPE_BEGN_THRESHOLD);
    expect(camperType?.evidence).toEqual([
      { type: 'field', ref: 'DRIV', effect: 'supports' },
      { type: 'field', ref: 'TENT', effect: 'supports' },
      { type: 'field', ref: 'campSiteType', effect: 'supports' },
      { type: 'field', ref: 'HOTW', effect: 'supports' },
      { type: 'field', ref: 'CHIC', effect: 'supports' },
    ]);

    const beginner = findFacet(result, 'beginner');
    expect(beginner).toBeDefined();
    expect(beginner?.score).toBe(0.58); // .20 driveUp + .12 gearRental + .09 hotWater + .08 glamp + .09 chic
    expect(beginner?.confidence).toBe(0.42); // 5/12 rounded
    expect(beginner?.answerable).toBe(true);
    expect(beginner?.evidence).toEqual([
      { type: 'field', ref: 'DRIV', effect: 'supports' },
      { type: 'field', ref: 'TENT', effect: 'supports' },
      { type: 'field', ref: 'HOTW', effect: 'supports' },
      { type: 'field', ref: 'campSiteType', effect: 'supports' },
      { type: 'field', ref: 'CHIC', effect: 'supports' },
    ]);
  });
});

describe('computeFacetScores — camper_type (CAM-518 BR-2, proves AC-2)', () => {
  it('[boundary] a rustic camp (DIFT/IDMT style + HIKE access + minimal facilities + no gear) resolves PROF with named hardship evidence; beginner is low (not absent)', () => {
    const input: FacetScoreInput = {
      options: [opt('DIFT', CAMPER_STYLE), opt('IDMT', CAMPER_STYLE), opt('HIKE', ACCESS)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);

    const camperType = findFacet(result, 'camper_type');
    expect(camperType).toBeDefined();
    expect(camperType?.score).toBe(0.1); // netScore -.80 -> (-.80+1)/2
    expect(camperType?.confidence).toBe(0.31); // 4/13 rounded
    expect(camperType?.answerable).toBe(true);
    expect(camperType?.label).toBe('PROF');
    expect(camperType?.score).toBeLessThanOrEqual(CAMPER_TYPE_PROF_THRESHOLD);
    expect(camperType?.evidence).toEqual([
      { type: 'field', ref: 'HIKE', effect: 'limits' },
      { type: 'field', ref: 'DIFT', effect: 'limits' },
      { type: 'field', ref: 'gearRental', effect: 'limits' },
      { type: 'field', ref: 'facilityCount', effect: 'limits' },
    ]);

    // beginner: no comfort signal fires at all; the hard-access cap's
    // `limits` entry is real evidence (mirrors the pre-existing HIKE-only
    // gap-fill test) — present, score 0, confidence 0, NOT answerable.
    const beginner = findFacet(result, 'beginner');
    expect(beginner).toBeDefined();
    expect(beginner?.score).toBe(0);
    expect(beginner?.confidence).toBe(0);
    expect(beginner?.answerable).toBe(false);
    expect(beginner?.evidence).toEqual([{ type: 'field', ref: 'HIKE', effect: 'limits' }]);
  });

  it('[boundary] a rustic camp with a rustic-terrain code also fires the rusticTerrain hardship slot', () => {
    const input: FacetScoreInput = {
      options: [opt('DIFT', CAMPER_STYLE), opt('WALK', ACCESS), opt('CAVE', TERRAIN)],
      minimumAge: null,
    };
    const result = computeFacetScores(input);
    const camperType = findFacet(result, 'camper_type');

    expect(camperType).toBeDefined();
    expect(camperType?.label).toBe('PROF');
    expect(camperType?.evidence).toContainEqual({ type: 'field', ref: 'CAVE', effect: 'limits' });
  });
});

describe('computeFacetScores — camper_type (CAM-518 BR-3/AC-3, the honesty gate)', () => {
  it('[null/empty] a sparse camp with too little signal -> camper_type OMITTED, never a low-confidence guess (EC-1)', () => {
    const input: FacetScoreInput = { options: [opt('RIVE', TERRAIN)], minimumAge: null };
    const result = computeFacetScores(input);
    expect(findFacet(result, 'camper_type')).toBeUndefined();
  });

  it('[null/empty] an essentially empty listing -> camper_type OMITTED even though noGearRental+minimalFacilities technically fire (BR-3 stricter than the other 3 facets)', () => {
    const result = computeFacetScores({ options: [], minimumAge: 9 });
    expect(findFacet(result, 'camper_type')).toBeUndefined();
    // Every facet is absent for this canonical "sparse/new listing" fixture.
    expect(result).toEqual([]);
  });

  it('[boundary] camper_type is NEVER emitted below ANSWERABLE_CONFIDENCE — a mix of omitted AND emitted fixtures all satisfy the gate (BR-3, not vacuous)', () => {
    const fixtures: FacetScoreInput[] = [
      { options: [opt('RIVE', TERRAIN)], minimumAge: null }, // omitted (below threshold)
      { options: [], minimumAge: null }, // omitted (below threshold)
      { options: [opt('BEAC', TERRAIN)], minimumAge: null }, // omitted (below threshold)
      {
        options: [opt('DIFT', CAMPER_STYLE), opt('HIKE', ACCESS)],
        minimumAge: null,
      }, // emitted (at/above threshold) — proves the loop isn't vacuously true
    ];
    let emittedCount = 0;
    for (const fixture of fixtures) {
      const camperType = findFacet(computeFacetScores(fixture), 'camper_type');
      if (camperType) {
        emittedCount += 1;
        expect(camperType.confidence).toBeGreaterThanOrEqual(ANSWERABLE_CONFIDENCE);
      }
    }
    expect(emittedCount).toBeGreaterThan(0); // at least one fixture actually emitted the facet
  });
});

describe('computeFacetScores — camper_type determinism (BR-6/P13)', () => {
  it('[normal] identical input ⇒ deep-equal output across repeated calls', () => {
    const input: FacetScoreInput = {
      options: [opt('DRIV', ACCESS), opt('HOTW', FACILITY), opt('CHIC', CAMPER_STYLE)],
      minimumAge: null,
      campSiteType: 'GLAMP',
    };
    const first = computeFacetScores(input);
    const second = computeFacetScores({ ...input, options: [...input.options] });
    expect(second).toEqual(first);
  });

  it('[normal] a changed source field (campSiteType) changes the camper_type/beginner output (not stale/cached)', () => {
    const base: FacetScoreInput = {
      options: [opt('DRIV', ACCESS), opt('HOTW', FACILITY), opt('CHIC', CAMPER_STYLE)],
      minimumAge: null,
    };
    const withoutGlamp = computeFacetScores(base);
    const withGlamp = computeFacetScores({ ...base, campSiteType: 'GLAMP' });

    const beforeCamperType = findFacet(withoutGlamp, 'camper_type');
    const afterCamperType = findFacet(withGlamp, 'camper_type');
    expect(afterCamperType?.score).not.toBe(beforeCamperType?.score);

    const beforeBeginner = findFacet(withoutGlamp, 'beginner');
    const afterBeginner = findFacet(withGlamp, 'beginner');
    expect(afterBeginner?.score).not.toBe(beforeBeginner?.score);
  });
});

describe('computeFacetScores — camper_type registration (EC-2)', () => {
  it('[normal] camper_type is a member of the emitted FacetId set (the satisfies-Record compile guard registered it)', () => {
    const result = computeFacetScores({
      options: [opt('TENT', EQUIPMENT), opt('HOTW', FACILITY), opt('DRIV', ACCESS), opt('CHIC', CAMPER_STYLE)],
      minimumAge: null,
      campSiteType: 'GLAMP',
    });
    const facetIds = result.map((f) => f.facet);
    expect(facetIds).toContain('camper_type');
  });

  it('[normal] every emitted camper_type facet score carries a label + non-empty evidence (BR-5 mirrors the other 3 facets)', () => {
    const result = computeFacetScores({
      options: [opt('DRIV', ACCESS), opt('RESV', ANNOTATED)],
      minimumAge: null,
      campSiteType: 'GLAMP',
    });
    const camperType = findFacet(result, 'camper_type');
    expect(camperType).toBeDefined(); // confidence 4/13 ≈ 0.31, at/above the gate — must be emitted, not omitted
    expect(camperType?.label).toBe('INMD'); // netScore .05 -> score .53 — the honest middle
    expect(camperType?.evidence.length).toBeGreaterThanOrEqual(1);
    expect(['BEGN', 'INMD', 'PROF']).toContain(camperType?.label);
  });
});
