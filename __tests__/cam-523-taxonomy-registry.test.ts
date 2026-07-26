/**
 * cam-523-taxonomy-registry.test.ts — CAM-523 (S7)
 *
 * Unit coverage for lib/taxonomy-registry.ts itself, plus a guard test that
 * keeps FilterModal.tsx's hand-written `NON_FILTERABLE_GROUPS` literal (kept
 * as-is because __tests__/cam-521-metadata-groups.test.ts source-inspects
 * that exact literal array, outside this story's file surface) in sync with
 * the registry's own NON_FILTERABLE_GROUP_NAMES — so the two lists can never
 * silently drift apart (the "guard so it cannot silently regrow" requirement,
 * .claude/rules/performance.md's Measure->Identify->Fix->Verify->Guard loop
 * applied to a structural invariant instead of a perf number).
 *
 * Coverage matrix: normal (shape/derivation) · boundary (facility-fold set
 * exactness) · null/empty (Campground type deliberately absent) · guard
 * (FilterModal literal <-> registry sync).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  TAXONOMY_GROUPS,
  FILTERABLE_GROUPS,
  NON_FILTERABLE_GROUP_NAMES,
  FACILITY_SECTION_GROUP_NAMES,
  FILTERABLE_URL_PARAMS,
  FILTERABLE_ZOD_FIELDS,
} from '@/lib/taxonomy-registry';

describe('TAXONOMY_GROUPS — normal shape', () => {
  it('[normal] every entry\'s group/urlParam/zodField/i18nGroupKey are non-empty strings', () => {
    for (const g of TAXONOMY_GROUPS) {
      expect(typeof g.group).toBe('string');
      expect(g.group.length).toBeGreaterThan(0);
      expect(typeof g.urlParam).toBe('string');
      expect(g.urlParam.length).toBeGreaterThan(0);
      expect(typeof g.zodField).toBe('string');
      expect(typeof g.i18nGroupKey).toBe('string');
      expect(typeof g.filterable).toBe('boolean');
    }
  });

  it('[normal] group names are globally unique (no duplicate MasterData.group join key)', () => {
    const names = TAXONOMY_GROUPS.map((g) => g.group);
    expect(new Set(names).size).toBe(names.length);
  });

  it('[normal] "Campground type" is deliberately absent (scalar campSiteType, not an options-relation group)', () => {
    const groupNames: readonly string[] = TAXONOMY_GROUPS.map((g) => g.group);
    expect(groupNames.includes('Campground type')).toBe(false);
  });
});

describe('FILTERABLE_GROUPS / FILTERABLE_URL_PARAMS / FILTERABLE_ZOD_FIELDS — derived lists', () => {
  it('[normal] FILTERABLE_GROUPS is exactly the 8 camper-facing taxonomy groups', () => {
    expect(FILTERABLE_GROUPS.map((g) => g.group)).toEqual([
      'Terrain', 'Activity', 'Access type', 'Internal facility',
      'External facility', 'Equipment for rent', 'Annotated features', 'Camper style',
    ]);
  });

  it('[normal] FILTERABLE_URL_PARAMS matches FILTERABLE_GROUPS 1:1 in the same order', () => {
    expect(FILTERABLE_URL_PARAMS).toEqual(FILTERABLE_GROUPS.map((g) => g.urlParam));
    expect(FILTERABLE_URL_PARAMS).toContain('external');
    expect(FILTERABLE_URL_PARAMS).toContain('equipment');
  });

  it('[normal] FILTERABLE_ZOD_FIELDS matches FILTERABLE_GROUPS 1:1 in the same order', () => {
    expect(FILTERABLE_ZOD_FIELDS).toEqual(FILTERABLE_GROUPS.map((g) => g.zodField));
  });
});

describe('NON_FILTERABLE_GROUP_NAMES — the 3 CAM-521 metadata-only groups', () => {
  it('[boundary] is exactly Stay connected / Marking method / Driveway, filterable:false', () => {
    expect(NON_FILTERABLE_GROUP_NAMES).toEqual(['Stay connected', 'Marking method', 'Driveway']);
    for (const name of NON_FILTERABLE_GROUP_NAMES) {
      const entry = TAXONOMY_GROUPS.find((g) => g.group === name);
      expect(entry?.filterable).toBe(false);
    }
  });

  it('[guard] FilterModal.tsx\'s hand-written NON_FILTERABLE_GROUPS literal stays in sync with the registry (drift guard)', () => {
    // FilterModal.tsx cannot import NON_FILTERABLE_GROUP_NAMES directly — an
    // existing pinned test (cam-521-metadata-groups.test.ts, outside this
    // story's file surface) source-inspects the exact literal array syntax.
    // This test is the safety net: if either list changes without the other,
    // it goes red.
    const filterModalSrc = readFileSync(
      path.join(process.cwd(), 'components/FilterModal.tsx'),
      'utf-8'
    );
    const literalMatch = filterModalSrc.match(/const NON_FILTERABLE_GROUPS = \[([^\]]*)\];/);
    expect(literalMatch).not.toBeNull();
    const literalNames = literalMatch![1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);
    expect(literalNames).toEqual([...NON_FILTERABLE_GROUP_NAMES]);
  });
});

describe('FACILITY_SECTION_GROUP_NAMES — the CAM-496 facilities-fold set', () => {
  it('[boundary] is exactly Internal facility (owns the param) + External facility + Equipment for rent (fold in)', () => {
    expect(FACILITY_SECTION_GROUP_NAMES).toEqual([
      'Internal facility', 'External facility', 'Equipment for rent',
    ]);
  });

  it('[normal] Internal facility owns urlParam "facilities"; the other two declare foldsInto:"facilities"', () => {
    const internal = TAXONOMY_GROUPS.find((g) => g.group === 'Internal facility');
    const external = TAXONOMY_GROUPS.find((g) => g.group === 'External facility');
    const equipment = TAXONOMY_GROUPS.find((g) => g.group === 'Equipment for rent');
    expect(internal?.urlParam).toBe('facilities');
    expect(internal?.foldsInto).toBeUndefined();
    expect(external?.foldsInto).toBe('facilities');
    expect(external?.urlParam).toBe('external');
    expect(equipment?.foldsInto).toBe('facilities');
    expect(equipment?.urlParam).toBe('equipment');
  });
});
