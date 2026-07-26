/**
 * cam-524-filter-count-parity.test.ts — CAM-524
 *
 * "Filter count matches what the grid shows" — FilterModal's debounced
 * match-count effect built a NARROWER query (taxonomy/price only) than the
 * apply handler (which preserves keyword/province/district/startDate/
 * endDate/guests from the current URL). The count could promise "Show N"
 * for a query the apply navigation never actually runs, and the button was
 * also wrongly disabled on that wrong (too-narrow) count.
 *
 * Full story: docs/specs/platform-hardening/taxonomy-ui-foundation/
 * CAM-524-filter-count-parity/story.md
 *
 * Prove-It: this suite was run against the pre-fix components/FilterModal.tsx
 * (buildPendingQuery did not exist; the count effect built its own standalone
 * filters object that never read keyword/province/district/startDate/
 * endDate/guests) and was RED — every `buildPendingQuery` import/behavioral
 * assertion below failed, and the button's `disabled` source-inspection
 * assertion failed because `matchCount === 0` was present. After wiring one
 * shared builder (`buildPendingQuery`, exported from FilterModal.tsx) into
 * both the debounced count effect and `handleShowCampgrounds`, and changing
 * the button's `disabled` to track only `isCountLoading`, the suite is GREEN.
 *
 * Layers:
 *   - buildPendingQuery — behavioral/unit, imported directly (a plain,
 *     hookless function; importing the module and calling only this named
 *     export is the established precedent for .tsx client components in
 *     this repo, see __tests__/cam-343-host-holds-ui.test.ts importing
 *     isLiveHold from components/host-holds-section.tsx).
 *   - components/FilterModal.tsx wiring + the apply button's disabled
 *     attribute — source-inspection (established precedent:
 *     __tests__/cam-344-availability-badge.test.ts Group D/E/F/H;
 *     vitest.config.ts runs in the `node` environment, no jsdom, so a full
 *     render of the Dialog/modal tree is not attempted here).
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary ·
 * error/validation (N/A — pure param mapping, no external validation here) ·
 * concurrent/ordering (N/A — no shared mutable state in the pure builder).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { buildPendingQuery } from '@/components/FilterModal';

function src(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ===========================================================================
// Group A: buildPendingQuery — the shared builder (AC-1, BR-1)
// ===========================================================================

describe('buildPendingQuery — count and apply are built from the SAME query (AC-1, BR-1)', () => {
  it('[prove-it][normal] forwards keyword/province/startDate/endDate/guests from the current URL into BOTH nextParams and filters, plus the pending taxonomy selection', () => {
    const current = new URLSearchParams(
      'keyword=%E0%B8%A3%E0%B8%B4%E0%B8%A1%E0%B8%99%E0%B9%89%E0%B8%B3&province=%E0%B9%80%E0%B8%8A%E0%B8%B5%E0%B8%A2%E0%B8%87%E0%B9%83%E0%B8%AB%E0%B8%A1%E0%B9%88&startDate=2026-09-10&endDate=2026-09-12&guests=4&sort=newest'
    );

    const { nextParams, filters } = buildPendingQuery(current, { Terrain: ['SEA'] }, { min: '', max: '' });

    // The URL the apply handler will push keeps every param this modal does
    // not own.
    expect(nextParams.get('keyword')).toBe(current.get('keyword'));
    expect(nextParams.get('province')).toBe(current.get('province'));
    expect(nextParams.get('startDate')).toBe('2026-09-10');
    expect(nextParams.get('endDate')).toBe('2026-09-12');
    expect(nextParams.get('guests')).toBe('4');
    expect(nextParams.get('sort')).toBe('newest');

    // The count filters — read back from the SAME params — must carry the
    // SAME values (this is the exact bug: pre-fix, this object only ever
    // carried the taxonomy/price fields and never these).
    expect(filters.keyword).toBe(current.get('keyword'));
    expect(filters.province).toBe(current.get('province'));
    expect(filters.startDate).toBe('2026-09-10');
    expect(filters.endDate).toBe('2026-09-12');
    expect(filters.guests).toBe('4');

    // Plus the camper's pending taxonomy selection, layered on top of both.
    expect(filters.terrain).toBe('SEA');
    expect(nextParams.get('terrain')).toBe('SEA');
  });

  it('[boundary/null-empty] no unowned params in the URL and no pending selections → filters carries none of them', () => {
    const current = new URLSearchParams('');
    const { nextParams, filters } = buildPendingQuery(current, {}, { min: '', max: '' });

    expect(filters.keyword).toBeUndefined();
    expect(filters.province).toBeUndefined();
    expect(filters.district).toBeUndefined();
    expect(filters.startDate).toBeUndefined();
    expect(filters.endDate).toBeUndefined();
    expect(filters.guests).toBeUndefined();
    expect(nextParams.toString()).toBe('');
  });

  it('[normal] price range layers onto both nextParams and filters', () => {
    const current = new URLSearchParams('');
    const { nextParams, filters } = buildPendingQuery(current, {}, { min: '500', max: '2000' });

    expect(nextParams.get('min')).toBe('500');
    expect(nextParams.get('max')).toBe('2000');
    expect(filters.min).toBe('500');
    expect(filters.max).toBe('2000');
  });

  it('[normal] district forwards alongside province (both unowned by the modal)', () => {
    const current = new URLSearchParams('province=%E0%B8%A0%E0%B8%B9%E0%B9%80%E0%B8%81%E0%B9%87%E0%B8%95&district=%E0%B8%A7%E0%B8%B1%E0%B8%87%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B9%80%E0%B8%82%E0%B8%B5%E0%B8%A2%E0%B8%A7');
    const { filters } = buildPendingQuery(current, {}, { min: '', max: '' });

    expect(filters.province).toBe(current.get('province'));
    expect(filters.district).toBe(current.get('district'));
  });

  it('[normal] Campground type (a special-cased single-select) is written to nextParams AND read back into filters.type', () => {
    const current = new URLSearchParams('');
    const { nextParams, filters } = buildPendingQuery(current, { 'Campground type': ['GLAMP'] }, { min: '', max: '' });

    expect(nextParams.get('type')).toBe('GLAMP');
    expect(filters.type).toBe('GLAMP');
  });
});

// ===========================================================================
// Group B: FilterModal.tsx wiring — both call sites use the ONE shared
// builder, and the apply button no longer disables on a stale/real 0
// (AC-2, AC-3, BR-2) — source-inspection (no jsdom render in this repo)
// ===========================================================================

describe('FilterModal.tsx — count effect + apply handler share one builder; button disables only on isCountLoading (AC-2/AC-3, BR-2)', () => {
  const filterModalSrc = src('components/FilterModal.tsx');

  it('[prove-it] both the debounced count effect and handleShowCampgrounds call buildPendingQuery(searchParams, selectedFilters, priceRange)', () => {
    const calls = filterModalSrc.match(/buildPendingQuery\(\s*searchParams\s*,\s*selectedFilters\s*,\s*priceRange\s*\)/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('[wiring] exactly ONE call site reconstructs URLSearchParams from the current searchParams (the shared builder) — no duplicated reconstruction', () => {
    const occurrences = (filterModalSrc.match(/searchParams\.toString\(\)/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('[prove-it] the apply button disabled attribute no longer includes matchCount === 0 (a truthful 0 must stay applyable)', () => {
    const disabledMatch = filterModalSrc.match(/disabled=\{([^}]*)\}/);
    expect(disabledMatch).not.toBeNull();
    expect(disabledMatch![1]).not.toMatch(/matchCount/);
  });

  it('[prove-it] the apply button disabled attribute IS driven by isCountLoading (the only legitimate reason to block apply)', () => {
    const disabledMatch = filterModalSrc.match(/disabled=\{([^}]*)\}/);
    expect(disabledMatch).not.toBeNull();
    expect(disabledMatch![1]).toMatch(/isCountLoading/);
  });
});
